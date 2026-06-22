/**
 * unitTest runner — runs the project's unit test suite.
 *
 * GateCheck type: 'unit-test'
 *
 * Default command: bun test
 *
 * Parses stdout for pass/fail counts.
 * Supports check.expected.passing_ratio (e.g. ">=95%")
 * Supports check.expected.line_coverage   (e.g. ">=80%")
 *
 * Exports setShellExecutor() for test injection.
 */

import { spawnSync } from 'node:child_process'
import type { GateCheck, CheckResult } from '../../types.js'

// ---------------------------------------------------------------------------
// Shell executor hook
// ---------------------------------------------------------------------------

const MAX_OUTPUT_BYTES = 4 * 1024

type ShellResult = {
  stdout: string
  stderr: string
  status: number | null
  timedOut: boolean
}

type ShellExecutor = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
) => ShellResult

let _shellExecutor: ShellExecutor = (command, args, cwd, timeoutMs) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
    timedOut: result.signal === 'SIGTERM' || result.error?.message?.includes('ETIMEDOUT') === true,
  }
}

export function setShellExecutor(fn: ShellExecutor): void {
  _shellExecutor = fn
}

export function resetShellExecutor(): void {
  _shellExecutor = (command, args, cwd, timeoutMs) => {
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    })
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      status: result.status,
      timedOut: result.signal === 'SIGTERM' || result.error?.message?.includes('ETIMEDOUT') === true,
    }
  }
}

// ---------------------------------------------------------------------------
// Expression evaluator for ">=80%", ">90%", "=100%", "<=50%" style strings
// ---------------------------------------------------------------------------

/**
 * Parse a threshold expression like ">=80%" and return { op, threshold }.
 */
function parseThreshold(expr: string): { op: string; threshold: number } | null {
  const m = expr.trim().match(/^(>=|>|<=|<|=|==)(\d+(?:\.\d+)?)%$/)
  if (!m) return null
  return { op: m[1]!, threshold: parseFloat(m[2]!) }
}

function evaluateThreshold(actual: number, expr: string): boolean {
  const parsed = parseThreshold(expr)
  if (!parsed) return false
  const { op, threshold } = parsed
  switch (op) {
    case '>=': return actual >= threshold
    case '>':  return actual > threshold
    case '<=': return actual <= threshold
    case '<':  return actual < threshold
    case '=':
    case '==': return actual === threshold
    default:   return false
  }
}

// ---------------------------------------------------------------------------
// Parse test output
// ---------------------------------------------------------------------------

/**
 * Try to extract pass/fail counts from typical test runner output.
 * Patterns:
 *   bun:  "42 pass\n3 fail" or "42 pass" or "3 fail"
 *   jest: "Tests: 42 passed, 3 failed"
 *   vitest: "✓ 42 | ✗ 3"
 */
function parsePassFail(output: string): { passed: number; failed: number } | null {
  // bun test format: "X pass" / "Y fail"
  const bunPass = output.match(/(\d+)\s+pass(?:ed)?/i)
  const bunFail = output.match(/(\d+)\s+fail(?:ed)?/i)
  if (bunPass) {
    return {
      passed: parseInt(bunPass[1]!, 10),
      failed: bunFail ? parseInt(bunFail[1]!, 10) : 0,
    }
  }

  // jest format: "Tests: X passed, Y failed"
  const jestM = output.match(/Tests:\s+(?:(\d+)\s+passed)?(?:,\s*)?(?:(\d+)\s+failed)?/i)
  if (jestM && (jestM[1] || jestM[2])) {
    return {
      passed: jestM[1] ? parseInt(jestM[1], 10) : 0,
      failed: jestM[2] ? parseInt(jestM[2], 10) : 0,
    }
  }

  return null
}

/**
 * Try to extract line coverage % from test output.
 * Patterns: "Lines: 80.5%" or "All files | ... | 80.5 |"
 */
function parseCoverage(output: string): number | null {
  const m = output.match(/(?:Lines|line\s+coverage)[:\s|]+(\d+(?:\.\d+)?)\s*%/i)
  if (m) return parseFloat(m[1]!)
  // istanbul/c8 table format: "All files | ... | 80.5 |"
  const m2 = output.match(/All files\s*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+(?:\.\d+)?)\s*\|/)
  if (m2) return parseFloat(m2[1]!)
  return null
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runUnitTest(
  check: GateCheck,
  workspacePath: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<CheckResult> {
  if (check.type !== 'unit-test') {
    return {
      type: 'unit-test',
      passed: false,
      durationMs: 0,
      error: `runUnitTest invoked with wrong check type: ${(check as GateCheck).type}`,
    }
  }

  const start = Date.now()
  const commandStr = check.command ?? 'bun test'
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  const expected = check.expected ?? {}

  let rawOutput: string
  let exitStatus: number | null

  try {
    const result = _shellExecutor(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'unit-test',
        passed: false,
        durationMs: Date.now() - start,
        output: 'Unit test run timed out',
        error: 'timeout',
      }
    }

    rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    exitStatus = result.status
  } catch (err) {
    return {
      type: 'unit-test',
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const detail: Record<string, unknown> = {}
  const failures: string[] = []

  // Basic exit-code check
  const exitOk = exitStatus === 0

  // Passing ratio check
  if (expected.passing_ratio) {
    const counts = parsePassFail(rawOutput)
    if (counts) {
      const total = counts.passed + counts.failed
      const ratio = total > 0 ? (counts.passed / total) * 100 : 0
      detail.passed = counts.passed
      detail.failed = counts.failed
      detail.passing_ratio_actual = `${ratio.toFixed(1)}%`
      if (!evaluateThreshold(ratio, expected.passing_ratio)) {
        failures.push(
          `passing_ratio ${ratio.toFixed(1)}% does not satisfy ${expected.passing_ratio}`,
        )
      }
    } else {
      failures.push('passing_ratio: could not parse pass/fail counts from test output')
    }
  }

  // Line coverage check
  if (expected.line_coverage) {
    const cov = parseCoverage(rawOutput)
    if (cov !== null) {
      detail.line_coverage_actual = `${cov}%`
      if (!evaluateThreshold(cov, expected.line_coverage)) {
        failures.push(
          `line_coverage ${cov}% does not satisfy ${expected.line_coverage}`,
        )
      }
    } else {
      failures.push(
        'line_coverage: coverage not in test output; run with --coverage (e.g. bun test --coverage)',
      )
    }
  }

  // branch coverage (MVP: just log if set)
  if (expected.branch_coverage) {
    failures.push(
      'branch_coverage: branch coverage parsing not supported in MVP; run with --coverage and check manually',
    )
  }

  const passed = exitOk && failures.length === 0

  return {
    type: 'unit-test',
    passed,
    durationMs: Date.now() - start,
    output: rawOutput + (failures.length ? '\n\nGate failures:\n' + failures.join('\n') : ''),
    ...(Object.keys(detail).length ? { detail } : {}),
  }
}
