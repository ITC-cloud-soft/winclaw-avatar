/**
 * testSpecChecklist runner — verifies a structured test-plan.md file
 * exists, has YAML frontmatter with a `cases` array, every case has
 * complete Given/When/Then content, and every task ID listed in
 * tasks.md is covered by all required categories.
 *
 * Designed to prevent rubber-stamp test specs: a tester cannot pass
 * this gate merely by creating an empty test-plan.md. They must
 * produce, for every task in tasks.md, at least one happy-path case
 * and one error-path case (or whatever categories are required),
 * each with concrete Given/When/Then text.
 *
 * Configuration in gates.yaml:
 *
 *   gate-test-spec:
 *     phase: test-spec
 *     checks:
 *       - type: test-spec-checklist
 *         path: harness/specs/${ACTIVE_FEATURE}/test-plan.md
 *         tasksRef: harness/specs/${ACTIVE_FEATURE}/tasks.md
 *         minFieldChars: 30                # default 30
 *         requiredCategories:              # default [happy-path, error-path]
 *           - happy-path
 *           - error-path
 *         requireAllTasksCovered: true     # default true
 *
 * The test-plan.md format (YAML frontmatter):
 *
 *   ---
 *   feature: 001-design
 *   generated_at: 2026-06-09T10:00:00Z
 *   author: tester
 *   cases:
 *     - taskId: T-001
 *       title: phases.yaml loader happy path
 *       category: happy-path
 *       given: |
 *         phases.yaml exists and is well-formed.
 *       when: |
 *         loadPhases(workspacePath) is called.
 *       then: |
 *         returns 10 phases with valid gate ids.
 *     - taskId: T-001
 *       title: phases.yaml broken
 *       category: error-path
 *       given: |
 *         phases.yaml is malformed.
 *       when: |
 *         loadPhases is called.
 *       then: |
 *         throws makeError('harness.invalidPhases', ...).
 *   ---
 *   (free-form markdown body)
 *
 * The check fails if:
 *   - test-plan.md is missing or unreadable
 *   - YAML parse error or no `cases` array
 *   - Any case is missing taskId / category / given / when / then
 *   - Any of given / when / then is shorter than minFieldChars after trim
 *   - requireAllTasksCovered=true and a tasks.md task id has no case
 *   - For any tasks.md task id, a requiredCategory is not represented
 */

import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { CheckResult } from '../../types.js'

export type TestSpecChecklistCheck = {
  type: 'test-spec-checklist'
  path: string                       // resolved path to test-plan.md
  tasksRef: string                   // resolved path to tasks.md
  minFieldChars?: number             // default 30
  requiredCategories?: string[]      // default ['happy-path', 'error-path']
  requireAllTasksCovered?: boolean   // default true
}

type TestCase = {
  taskId?: string
  title?: string
  category?: string
  given?: string
  when?: string
  then?: string
}

type TestPlanDoc = {
  feature?: string
  generated_at?: string
  author?: string
  cases?: TestCase[]
}

/**
 * Parse the test-plan file. Supports:
 *  - Pure YAML (.yaml / .yml)
 *  - Markdown with YAML frontmatter (--- ... ---)
 */
function parseTestPlan(raw: string): TestPlanDoc | null | 'parse-error' {
  // Markdown frontmatter
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const body = m ? m[1] : raw
  try {
    const parsed = YAML.parse(body!) as unknown
    if (typeof parsed === 'object' && parsed !== null) return parsed as TestPlanDoc
    return null
  } catch {
    return 'parse-error'
  }
}

/** Extract task IDs (T-NNN) from tasks.md content. Returns unique, ordered list. */
function extractTaskIdsFromTasksMd(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of raw.matchAll(/\[(T-\d+)\]/g)) {
    const id = m[1] ?? ''
    if (id && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export async function runTestSpecChecklist(
  check: TestSpecChecklistCheck,
  ctx: { workspacePath: string; timeoutMs: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const minField = check.minFieldChars ?? 30
  const requiredCategories = check.requiredCategories ?? ['happy-path', 'error-path']
  const requireAllTasksCovered = check.requireAllTasksCovered ?? true

  const file = path.isAbsolute(check.path)
    ? check.path
    : path.join(ctx.workspacePath, check.path)
  const tasksFile = path.isAbsolute(check.tasksRef)
    ? check.tasksRef
    : path.join(ctx.workspacePath, check.tasksRef)

  // 1. test-plan.md must be readable
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return {
      type: 'test-spec-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Test plan not found at ${file}.\n` +
        `Per the harness test-spec gate, the tester must produce a structured ` +
        `test-plan.md with YAML frontmatter listing Given/When/Then cases for every ` +
        `task in tasks.md. Run "/harness skill test" to scaffold one.`,
    }
  }

  // 2. YAML must parse and contain a cases array
  const parsed = parseTestPlan(raw)
  if (parsed === 'parse-error') {
    return {
      type: 'test-spec-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Test plan at ${file} could not be parsed (expected YAML or markdown with YAML frontmatter).`,
    }
  }
  if (!parsed) {
    return {
      type: 'test-spec-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Test plan at ${file} did not parse to an object (expected YAML mapping with a "cases" key).`,
    }
  }

  const cases = Array.isArray(parsed.cases) ? parsed.cases : null
  if (!cases || cases.length === 0) {
    return {
      type: 'test-spec-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Test plan at ${file} has no "cases" array (or it is empty). ` +
        `Every task in tasks.md needs at least one test case with given/when/then.`,
    }
  }

  // 3. Per-case structural validation
  const problems: string[] = []
  for (const [i, c] of cases.entries()) {
    const tag = c.taskId
      ? `case[${i}] (${c.taskId}${c.title ? ` "${c.title}"` : ''})`
      : `case[${i}]`
    if (!c.taskId || typeof c.taskId !== 'string') {
      problems.push(`${tag}: missing taskId`)
    }
    if (!c.category || typeof c.category !== 'string') {
      problems.push(`${tag}: missing category`)
    }
    for (const field of ['given', 'when', 'then'] as const) {
      const val = c[field]
      if (typeof val !== 'string' || val.trim().length === 0) {
        problems.push(`${tag}: missing ${field}`)
        continue
      }
      const len = val.trim().length
      if (len < minField) {
        problems.push(`${tag}: ${field} too short (${len} chars, min ${minField})`)
      }
    }
  }

  // 4. Task-coverage matrix (only if requested or required categories were specified)
  let taskIds: string[] = []
  if (requireAllTasksCovered || requiredCategories.length > 0) {
    let tasksRaw: string | null = null
    try {
      tasksRaw = fs.readFileSync(tasksFile, 'utf8')
    } catch {
      problems.push(
        `tasks.md not found at ${tasksFile} (needed to verify coverage). ` +
          `Run "/harness skill plan" to generate it.`,
      )
    }
    if (tasksRaw !== null) {
      taskIds = extractTaskIdsFromTasksMd(tasksRaw)
      if (taskIds.length === 0) {
        problems.push(
          `tasks.md at ${tasksFile} contains no [T-NNN] task identifiers; ` +
            `cannot verify per-task test coverage.`,
        )
      }
    }
  }

  // Build a taskId → categories covered map from cases that are fully valid:
  // taskId, category, and all three G/W/T fields must be present and meet
  // minFieldChars. Structurally-invalid cases (reported above in problems[])
  // are intentionally excluded here so that a task covered ONLY by broken
  // cases is correctly reported as uncovered.
  const coverage = new Map<string, Set<string>>()
  for (const c of cases) {
    if (
      typeof c.taskId === 'string' &&
      c.taskId.length > 0 &&
      typeof c.category === 'string' &&
      c.category.length > 0 &&
      typeof c.given === 'string' && c.given.trim().length >= minField &&
      typeof c.when === 'string' && c.when.trim().length >= minField &&
      typeof c.then === 'string' && c.then.trim().length >= minField
    ) {
      let set = coverage.get(c.taskId)
      if (!set) {
        set = new Set<string>()
        coverage.set(c.taskId, set)
      }
      set.add(c.category)
    }
  }

  // 5. Every task in tasks.md must have at least one case
  if (requireAllTasksCovered && taskIds.length > 0) {
    const missingTasks = taskIds.filter((id) => !coverage.has(id))
    if (missingTasks.length > 0) {
      problems.push(
        `tasks not covered by any test case: ${missingTasks.join(', ')}`,
      )
    }
  }

  // 6. For each task in tasks.md, every required category must be present
  if (requiredCategories.length > 0 && taskIds.length > 0) {
    const missingCombos: string[] = []
    for (const id of taskIds) {
      const covered = coverage.get(id) ?? new Set<string>()
      for (const cat of requiredCategories) {
        if (!covered.has(cat)) {
          missingCombos.push(`${id} missing "${cat}"`)
        }
      }
    }
    if (missingCombos.length > 0) {
      problems.push(
        `required category coverage gaps: ${missingCombos.join('; ')}`,
      )
    }
  }

  if (problems.length > 0) {
    return {
      type: 'test-spec-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Test plan at ${file} has ${problems.length} problem(s):\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        file,
        tasksFile,
        feature: parsed.feature,
        author: parsed.author,
        caseCount: cases.length,
        taskCount: taskIds.length,
        problemCount: problems.length,
      },
    }
  }

  return {
    type: 'test-spec-checklist' as never,
    passed: true,
    durationMs: Date.now() - start,
    output:
      `test-plan: ${cases.length} cases covering ${coverage.size} tasks; ` +
      `all required categories present`,
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      file,
      tasksFile,
      feature: parsed.feature,
      author: parsed.author,
      caseCount: cases.length,
      taskCount: taskIds.length,
      tasksCovered: coverage.size,
      requiredCategories,
    },
  }
}
