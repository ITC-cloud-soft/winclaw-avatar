/**
 * crossArtifact.ts — Cross-artifact consistency analysis for a feature spec.
 *
 * Checks whether spec.md → plan.md → tasks.md → test-plan.md are mutually
 * consistent. The analysis is intentionally lightweight and heuristic —
 * it looks for referenced IDs and section headers rather than full AST
 * parsing, to keep implementation dependency-free.
 *
 * Public API consumed by Agent D's dispatcher ops.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface CrossArtifactFinding {
  severity: 'error' | 'warning' | 'ok'
  source: string
  target: string
  message: string
}

export interface CrossArtifactAnalysisResult {
  ok: boolean
  skipped?: string
  featureId: string
  findings: CrossArtifactFinding[]
  errorCount: number
  warningCount: number
}

interface RunOptions {
  workspacePath: string
  featureId?: string
}

/** Read active-feature.txt to determine the current feature id.
 * Supports both legacy plain-text format and JSON sidecar format
 * (introduced in v3.1.0 to preserve displayName). */
export async function readActiveFeature(workspacePath: string): Promise<string | null> {
  const p = path.join(workspacePath, 'harness', 'audit', 'active-feature.txt')
  try {
    const txt = await fs.readFile(p, 'utf8')
    const trimmed = txt.trim()
    if (!trimmed) return null
    // Try JSON format first (v3.1.0+)
    try {
      const parsed = JSON.parse(trimmed) as { featureId?: string }
      if (typeof parsed.featureId === 'string') return parsed.featureId || null
    } catch {
      // fall through to legacy plain-text
    }
    return trimmed
  } catch {
    return null
  }
}

/** Resolve the feature directory path */
function featureDir(workspacePath: string, featureId: string): string {
  return path.join(workspacePath, 'harness', 'specs', featureId)
}

async function tryRead(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

/** Extract acceptance criteria IDs from spec.md (lines like "AC-\d+") */
export function extractAcIds(text: string): string[] {
  return [...text.matchAll(/\bAC-\d+\b/g)].map((m) => m[0] ?? '')
}

/** @deprecated alias retained for backward compatibility; use extractAcIds */
function extractAcceptanceCriteria(text: string): string[] {
  return extractAcIds(text)
}

/** Extract task IDs from tasks.md (lines like "[T-\d+]") */
export function extractTaskIds(text: string): string[] {
  return [...text.matchAll(/\[T-\d+\]/g)].map((m) => m[0] ?? '')
}

/**
 * Extract the set of IDs (AC-NNN or T-NNN) that are suppressed via inline
 * `# harness-ignore: <reason>` (shell-style) or `<!-- harness-ignore: ... -->`
 * (HTML comment) annotations.
 *
 * The annotation suppresses the ID(s) on the **same line** or on lines in the
 * immediately preceding non-blank block (up to 3 lines back), so reviewers
 * can write:
 *
 *   AC-007 is intentionally omitted from plan. <!-- harness-ignore: legacy -->
 *
 * or simply annotate above a block.
 */
function extractIgnoredIds(text: string): Set<string> {
  const ignored = new Set<string>()
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const isIgnoreLine =
      /<!--\s*harness-ignore:/i.test(line) || /#\s*harness-ignore:/i.test(line)
    if (!isIgnoreLine) continue
    // Collect IDs from up to 3 preceding lines, this line, and 1 following line
    // (so annotation can appear before OR after the ID reference)
    const window = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 2))
    for (const wl of window) {
      for (const m of wl.matchAll(/\bAC-\d+\b/g)) ignored.add(m[0] ?? '')
      for (const m of wl.matchAll(/\[T-\d+\]/g)) ignored.add(m[0] ?? '')
    }
  }
  return ignored
}

/**
 * Run a heuristic cross-artifact consistency analysis for the given (or active) feature.
 */
export async function runCrossArtifactAnalysis(
  options: RunOptions,
): Promise<CrossArtifactAnalysisResult> {
  const { workspacePath } = options
  const featureId = options.featureId ?? (await readActiveFeature(workspacePath))

  if (!featureId) {
    return {
      ok: true,
      skipped: 'no active feature',
      featureId: '',
      findings: [],
      errorCount: 0,
      warningCount: 0,
    }
  }

  const dir = featureDir(workspacePath, featureId)
  const findings: CrossArtifactFinding[] = []

  const specMd = await tryRead(path.join(dir, 'spec.md'))
  const planMd = await tryRead(path.join(dir, 'plan.md'))
  const tasksMd = await tryRead(path.join(dir, 'tasks.md'))
  const testPlanMd = await tryRead(path.join(dir, 'test-plan.md'))

  // Collect harness-ignore suppressions from all available artifact texts
  const allText = [specMd, planMd, tasksMd, testPlanMd].filter(Boolean).join('\n')
  const ignoredIds = extractIgnoredIds(allText)

  // spec.md exists?
  if (!specMd) {
    findings.push({
      severity: 'warning',
      source: 'spec.md',
      target: '-',
      message: `spec.md not found in ${featureId}`,
    })
  }

  // spec → plan: acceptance criteria coverage
  if (specMd && planMd) {
    const acIds = extractAcceptanceCriteria(specMd)
    const uncovered = acIds.filter((id) => !planMd.includes(id) && !ignoredIds.has(id))
    if (uncovered.length > 0) {
      findings.push({
        severity: 'warning',
        source: 'spec.md',
        target: 'plan.md',
        message: `${uncovered.length} acceptance criteria not referenced in plan.md: ${uncovered.join(', ')}`,
      })
    } else if (acIds.length > 0) {
      findings.push({
        severity: 'ok',
        source: 'spec.md',
        target: 'plan.md',
        message: `All ${acIds.length} acceptance criteria referenced in plan.md`,
      })
    }
  }

  // plan → tasks: task decomposition
  if (planMd && tasksMd) {
    const taskIds = extractTaskIds(tasksMd)
    const effectiveTaskIds = taskIds.filter((id) => !ignoredIds.has(id))
    if (effectiveTaskIds.length === 0 && taskIds.length === 0) {
      findings.push({
        severity: 'warning',
        source: 'plan.md',
        target: 'tasks.md',
        message: 'tasks.md has no [T-NNN] task IDs',
      })
    } else {
      findings.push({
        severity: 'ok',
        source: 'plan.md',
        target: 'tasks.md',
        message: `${taskIds.length} tasks found in tasks.md`,
      })
    }
  } else if (planMd && !tasksMd) {
    findings.push({
      severity: 'warning',
      source: 'plan.md',
      target: 'tasks.md',
      message: 'tasks.md not found — run /harness phase advance to auto-generate',
    })
  }

  // tasks → test-plan: test coverage
  if (tasksMd && testPlanMd) {
    const taskIds = extractTaskIds(tasksMd)
    const uncoveredTasks = taskIds.filter(
      (id) => !testPlanMd.includes(id) && !ignoredIds.has(id),
    )
    if (uncoveredTasks.length > 0) {
      findings.push({
        severity: 'warning',
        source: 'tasks.md',
        target: 'test-plan.md',
        message: `${uncoveredTasks.length} tasks not covered in test-plan.md: ${uncoveredTasks.slice(0, 5).join(', ')}${uncoveredTasks.length > 5 ? '...' : ''}`,
      })
    } else if (taskIds.length > 0) {
      findings.push({
        severity: 'ok',
        source: 'tasks.md',
        target: 'test-plan.md',
        message: `All ${taskIds.length} tasks have test coverage`,
      })
    }
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length
  const warningCount = findings.filter((f) => f.severity === 'warning').length

  return {
    ok: errorCount === 0,
    featureId,
    findings,
    errorCount,
    warningCount,
  }
}
