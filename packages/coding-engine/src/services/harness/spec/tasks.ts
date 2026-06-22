/**
 * tasks.ts — Task status parsing and auto-generation for harness/specs/<feature>/tasks.md
 *
 * Public API consumed by Agent D's dispatcher ops.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export type TaskStatus = 'done' | 'in-progress' | 'todo'

export interface Task {
  id: string
  status: TaskStatus
  description: string
  parallel: boolean
}

export interface TasksStatusResult {
  featureId: string
  total: number
  done: number
  inProgress: number
  todo: number
  tasks: Task[]
  progressPercent: number
}

export interface TasksGenerateResult {
  ok: boolean
  featureId: string
  tasksFile: string
  tasksGenerated: number
  message: string
}

/** Determine task status from surrounding markdown context (inline comment fallback) */
function parseStatusFromLine(line: string): TaskStatus {
  if (/\bdone\b/i.test(line) || /~~.+~~/.test(line)) return 'done'
  if (/\bin.progress\b/i.test(line) || /\bwip\b/i.test(line)) return 'in-progress'
  return 'todo'
}

/** Path to the tasks-status.yaml sidecar file */
function tasksStatusYamlPath(specsDir: string): string {
  return path.join(specsDir, 'tasks-status.yaml')
}

/** Load sidecar tasks-status.yaml as a map of taskId → status */
async function loadSidecarStatus(specsDir: string): Promise<Map<string, TaskStatus>> {
  const yamlPath = tasksStatusYamlPath(specsDir)
  try {
    const raw = await fs.readFile(yamlPath, 'utf8')
    const result = new Map<string, TaskStatus>()
    for (const line of raw.split('\n')) {
      const m = line.match(/^(T-\d+):\s*(done|in-progress|todo)/)
      if (m) {
        result.set(m[1] ?? '', (m[2] ?? 'todo') as TaskStatus)
      }
    }
    return result
  } catch {
    return new Map()
  }
}

/** Persist sidecar tasks-status.yaml from a map of taskId → status */
export async function saveSidecarStatus(
  specsDir: string,
  statusMap: Map<string, TaskStatus>,
): Promise<void> {
  const lines = ['# tasks-status.yaml — auto-managed by harness spec-kit', '']
  for (const [id, status] of statusMap.entries()) {
    lines.push(`${id}: ${status}`)
  }
  await fs.writeFile(tasksStatusYamlPath(specsDir), lines.join('\n') + '\n', 'utf8')
}

/**
 * Parse tasks.md and return status summary.
 */
export async function parseTasksStatus(
  workspacePath: string,
  featureId: string,
): Promise<TasksStatusResult | null> {
  const filePath = path.join(workspacePath, 'harness', 'specs', featureId, 'tasks.md')
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }

  const specsDir = path.join(workspacePath, 'harness', 'specs', featureId)
  const sidecarStatus = await loadSidecarStatus(specsDir)

  const tasks: Task[] = []
  for (const line of raw.split('\n')) {
    const match = line.match(/\[(T-\d+)\]/)
    if (!match) continue
    const id = match[1] ?? ''
    const parallel = /\[P\]/.test(line)
    const description = line
      .replace(/\[T-\d+\]/g, '')
      .replace(/\[P\]/g, '')
      .replace(/^[-*\s]+/, '')
      .trim()
    // Prefer sidecar status; fall back to inline comment for back-compat
    const status = sidecarStatus.get(id) ?? parseStatusFromLine(line)
    tasks.push({ id, status, description, parallel })
  }

  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const todo = tasks.filter((t) => t.status === 'todo').length
  const total = tasks.length
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0

  return { featureId, total, done, inProgress, todo, tasks, progressPercent }
}

/**
 * Auto-generate tasks.md from plan.md (simple heuristic decomposition).
 * Called when advancing from design → test-spec phase.
 */
export async function generateTasksFromPlan(
  workspacePath: string,
  featureId: string,
): Promise<TasksGenerateResult> {
  const specsDir = path.join(workspacePath, 'harness', 'specs', featureId)
  const planPath = path.join(specsDir, 'plan.md')
  const tasksPath = path.join(specsDir, 'tasks.md')

  let planContent = ''
  try {
    planContent = await fs.readFile(planPath, 'utf8')
  } catch {
    // no plan.md — generate a placeholder tasks.md
  }

  // Extract design decisions / headings as tasks
  const taskLines: string[] = []
  let counter = 1
  const parallelAfter: string[] = []

  for (const line of planContent.split('\n')) {
    const heading = line.match(/^#{1,3}\s+(.+)/)
    if (heading && !/^#+\s*(plan|design|implementation)/i.test(line)) {
      const label = heading[1]?.trim() ?? ''
      if (label) {
        const id = `T-${String(counter).padStart(3, '0')}`
        const isParallel = /^##\s/.test(line) && counter > 1
        if (isParallel) parallelAfter.push(id)
        taskLines.push(`[${id}]${isParallel ? ' [P]' : ''} ${label}`)
        counter++
      }
    }
  }

  // If no headings found, generate a minimal template
  if (taskLines.length === 0) {
    taskLines.push('[T-001] Define feature requirements')
    taskLines.push('[T-002] Implement core logic')
    taskLines.push('[T-003] [P] Write unit tests')
    taskLines.push('[T-004] [P] Write integration tests')
    taskLines.push('[T-005] Update documentation')
    counter = 6
  }

  const generatedAt = new Date().toISOString()
  const tasksContent = [
    `# Tasks for feature ${featureId}`,
    `Generated: ${generatedAt} (auto by /harness phase advance)`,
    `Source: plan.md`,
    '',
    '## Tasks',
    '',
    ...taskLines.map((t) => `${t}  <!-- status: todo -->`),
    '',
  ].join('\n')

  await fs.mkdir(specsDir, { recursive: true })
  await fs.writeFile(tasksPath, tasksContent, 'utf8')

  // Write sidecar tasks-status.yaml so status can be updated without mutating tasks.md
  const initialStatusMap = new Map<string, TaskStatus>()
  for (const t of taskLines) {
    const m = t.match(/\[(T-\d+)\]/)
    if (m) initialStatusMap.set(m[1] ?? '', 'todo')
  }
  await saveSidecarStatus(specsDir, initialStatusMap)

  return {
    ok: true,
    featureId,
    tasksFile: tasksPath,
    tasksGenerated: counter - 1,
    message: `Generated ${counter - 1} tasks from plan.md`,
  }
}
