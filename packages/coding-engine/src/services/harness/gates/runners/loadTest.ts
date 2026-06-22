/**
 * loadTest runner — runs a load test command (e.g. k6) and parses output.
 *
 * ExtendedGateCheck type: 'load-test'
 *
 * Parses stdout for p95, rps, error_rate lines (k6 format).
 * Compares to expected thresholds (e.g. "<=200ms", ">=500", "<1%").
 * Exports setExec() for test injection.
 */

import { spawnSync } from 'node:child_process'
import type { CheckResult } from '../../types.js'
import type { ExtendedGateCheck } from '../../standardTypes.js'
import {
  parseDurationThreshold,
  parseCountThreshold,
  parsePercentThreshold,
  compareDuration,
  compare,
} from './_threshold.js'

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
      timedOut: result.signal === 'SIGTERM' || result.error?.message?.includes('ETIMEDLOAD') === true,
    }
  }
}

// ---------------------------------------------------------------------------
// k6 output parsers
// ---------------------------------------------------------------------------

/**
 * Extract p95 value in ms from k6 output.
 * k6 outputs lines like: "http_req_duration.............: ... p(95)=123.45ms"
 * Prefer the http_req_duration line; fallback to last p(95) occurrence.
 */
function parseP95Ms(output: string): number | null {
  // Prefer the http_req_duration line which has overall request latency p95
  const durationLine = output.match(/http_req_duration[^\n]*p\(95\)\s*=\s*(\d+(?:\.\d+)?)\s*(ms|s|µs|us)/i)
  if (durationLine) {
    const value = parseFloat(durationLine[1]!)
    const unit = durationLine[2]!.toLowerCase()
    if (unit === 'ms') return value
    if (unit === 's') return value * 1000
    if (unit === 'µs' || unit === 'us') return value / 1000
    return value
  }
  // Fallback: last p(95) occurrence in the output
  const all = [...output.matchAll(/p\(95\)\s*=\s*(\d+(?:\.\d+)?)\s*(ms|s|µs|us)/gi)]
  const last = all[all.length - 1]
  if (!last) return null
  const value = parseFloat(last[1]!)
  const unit = last[2]!.toLowerCase()
  if (unit === 'ms') return value
  if (unit === 's') return value * 1000
  if (unit === 'µs' || unit === 'us') return value / 1000
  return value
}

/**
 * Extract requests per second from k6 output.
 * k6: "http_reqs.....................: ... 523.45/s"
 */
function parseRps(output: string): number | null {
  const m = output.match(/http_reqs[\s.]+:[\s\S]*?(\d+(?:\.\d+)?)\s*\/s/i)
  if (m) return parseFloat(m[1]!)
  // Fallback: "rps=500" or "RPS: 500"
  const m2 = output.match(/(?:rps|requests\/s(?:ec)?)[:\s=]+(\d+(?:\.\d+)?)/i)
  if (m2) return parseFloat(m2[1]!)
  return null
}

/**
 * Extract error rate as a percentage from k6 output.
 * k6: "http_req_failed...............: 0.50%"
 */
function parseErrorRate(output: string): number | null {
  const m = output.match(/http_req_failed[\s.]+:[\s\S]*?(\d+(?:\.\d+)?)\s*%/i)
  if (m) return parseFloat(m[1]!)
  // Fallback: "error_rate=0.5%" or "Error rate: 0.5%"
  const m2 = output.match(/error[\s_-]?rate[:\s=]+(\d+(?:\.\d+)?)\s*%/i)
  if (m2) return parseFloat(m2[1]!)
  return null
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runLoadTest(
  check: ExtendedGateCheck & { type: 'load-test' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath, timeoutMs } = ctx
  const parts = check.command.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)
  const expected = check.expected

  try {
    const result = _exec(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'load-test' as never,
        passed: false,
        durationMs: Date.now() - start,
        output: 'Load test timed out',
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    const failures: string[] = []
    const detail: Record<string, unknown> = { exitCode: result.status }

    if (expected.p95_ms) {
      const p95 = parseP95Ms(rawOutput)
      const threshold = parseDurationThreshold(expected.p95_ms)
      if (p95 === null) {
        failures.push(`p95_ms: could not parse p95 from output (expected ${expected.p95_ms})`)
      } else if (threshold && !compareDuration(p95, threshold)) {
        failures.push(`p95 ${p95}ms does not satisfy ${expected.p95_ms}`)
      }
      detail['p95_ms'] = p95
    }

    if (expected.rps) {
      const rps = parseRps(rawOutput)
      const threshold = parseCountThreshold(expected.rps)
      if (rps === null) {
        failures.push(`rps: could not parse RPS from output (expected ${expected.rps})`)
      } else if (threshold && !compare(rps, threshold)) {
        failures.push(`rps ${rps} does not satisfy ${expected.rps}`)
      }
      detail['rps'] = rps
    }

    if (expected.error_rate) {
      const errRate = parseErrorRate(rawOutput)
      const threshold = parsePercentThreshold(expected.error_rate)
      if (errRate === null) {
        failures.push(`error_rate: could not parse error rate from output (expected ${expected.error_rate})`)
      } else if (threshold && !compare(errRate, threshold)) {
        failures.push(`error_rate ${errRate}% does not satisfy ${expected.error_rate}`)
      }
      detail['error_rate'] = errRate !== null ? `${errRate}%` : null
    }

    // Also check exit code: non-zero generally means k6 scenario failed
    if (result.status !== 0 && failures.length === 0) {
      failures.push(`load test exited with code ${result.status}`)
    }

    return {
      type: 'load-test' as never,
      passed: failures.length === 0,
      durationMs: Date.now() - start,
      output: rawOutput + (failures.length ? '\nGate failures:\n' + failures.join('\n') : ''),
      detail,
    }
  } catch (err) {
    return {
      type: 'load-test' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
