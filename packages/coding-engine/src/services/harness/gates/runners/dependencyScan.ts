/**
 * dependencyScan runner — runs bun audit (or custom command) and compares
 * severity counts against expected thresholds.
 *
 * ExtendedGateCheck type: 'dependency-scan'
 *
 * Exports setExec() for test injection.
 */

import { spawnSync } from 'node:child_process'
import type { CheckResult } from '../../types.js'
import type { ExtendedGateCheck } from '../../standardTypes.js'

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

type ExecFn = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
) => ShellResult

let _exec: ExecFn = (command, args, cwd, timeoutMs) => {
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

export function setExec(fn: ExecFn): void { _exec = fn }
export function resetExec(): void {
  _exec = (command, args, cwd, timeoutMs) => {
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
// Severity parsers
// ---------------------------------------------------------------------------

type SeverityCounts = { critical: number; high: number; medium: number }

/** Try JSON parse of bun audit --json output */
function parseJson(stdout: string): SeverityCounts | null {
  try {
    const data = JSON.parse(stdout) as Record<string, unknown>
    // bun audit --json shape: { metadata: { vulnerabilities: { critical, high, moderate } } }
    const vulns = (
      data?.['metadata'] as Record<string, unknown> | undefined
    )?.['vulnerabilities'] as Record<string, unknown> | undefined

    if (vulns) {
      return {
        critical: typeof vulns['critical'] === 'number' ? vulns['critical'] : 0,
        high: typeof vulns['high'] === 'number' ? vulns['high'] : 0,
        medium:
          typeof vulns['moderate'] === 'number'
            ? vulns['moderate']
            : typeof vulns['medium'] === 'number'
              ? vulns['medium']
              : 0,
      }
    }
  } catch {
    // fall through to text parser
  }
  return null
}

/** Fallback: count severity keywords in text output */
function parseText(output: string): SeverityCounts {
  const lower = output.toLowerCase()
  const countMatches = (pattern: RegExp) => {
    const matches = lower.match(pattern)
    if (!matches) return 0
    // Try to find a number before the keyword: "3 critical"
    const numMatch = lower.match(new RegExp(`(\\d+)\\s+${pattern.source}`))
    return numMatch ? parseInt(numMatch[1]!, 10) : matches.length
  }
  return {
    critical: countMatches(/critical/g),
    high: countMatches(/high/g),
    medium: countMatches(/moderate|medium/g),
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runDependencyScan(
  check: ExtendedGateCheck & { type: 'dependency-scan' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath, timeoutMs } = ctx
  const commandStr = check.command ?? 'bun audit --json'
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  try {
    const result = _exec(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'dependency-scan' as never,
        passed: false,
        durationMs: Date.now() - start,
        output: 'dependency-scan timed out',
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    const counts = parseJson(result.stdout) ?? parseText(rawOutput)
    const expected = check.expected

    const failures: string[] = []

    if (expected.critical !== undefined && counts.critical > expected.critical) {
      failures.push(`critical: ${counts.critical} > allowed ${expected.critical}`)
    }
    if (expected.high !== undefined && counts.high > expected.high) {
      failures.push(`high: ${counts.high} > allowed ${expected.high}`)
    }
    if (expected.medium !== undefined && counts.medium > expected.medium) {
      failures.push(`medium: ${counts.medium} > allowed ${expected.medium}`)
    }

    return {
      type: 'dependency-scan' as never,
      passed: failures.length === 0,
      durationMs: Date.now() - start,
      output: rawOutput + (failures.length ? '\nGate failures:\n' + failures.join('\n') : ''),
      detail: { counts, expected },
    }
  } catch (err) {
    return {
      type: 'dependency-scan' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
