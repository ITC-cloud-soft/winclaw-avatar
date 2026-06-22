/**
 * metacoderDeploy runner — runs Meta Coder deploy command.
 *
 * ExtendedGateCheck type: 'metacoder-deploy'
 *
 * Honors intent: 'verify' | 'deploy'.
 * Parses output for "health: ok|degraded" token.
 * Compares to expected.health.
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
// Health parser
// ---------------------------------------------------------------------------

/** Extract "health: ok" or "health: degraded" from output. */
function parseHealth(output: string): 'ok' | 'degraded' | null {
  const m = output.match(/health\s*:\s*(ok|degraded)/i)
  if (!m) return null
  return m[1]!.toLowerCase() as 'ok' | 'degraded'
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runMetacoderDeploy(
  check: ExtendedGateCheck & { type: 'metacoder-deploy' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath, timeoutMs } = ctx
  const intent = check.intent ?? 'deploy'

  const commandStr =
    check.command ??
    `bun run src/entrypoints/metacoder.ts deploy --env ${check.env}`
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  try {
    const result = _exec(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'metacoder-deploy' as never,
        passed: false,
        durationMs: Date.now() - start,
        output: `metacoder deploy (intent=${intent}) timed out`,
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    const health = parseHealth(rawOutput)
    const expectedHealth = check.expected?.health

    const failures: string[] = []

    if (result.status !== 0) {
      failures.push(`deploy exited with code ${result.status}`)
    }

    if (expectedHealth) {
      if (health === null) {
        failures.push(`expected health="${expectedHealth}" but no health token found in output`)
      } else if (health !== expectedHealth) {
        failures.push(`health="${health}" does not match expected "${expectedHealth}"`)
      }
    }

    return {
      type: 'metacoder-deploy' as never,
      passed: failures.length === 0,
      durationMs: Date.now() - start,
      output: rawOutput + (failures.length ? '\nGate failures:\n' + failures.join('\n') : ''),
      detail: {
        intent,
        env: check.env,
        exitCode: result.status,
        health,
        expectedHealth: expectedHealth ?? null,
        command: commandStr,
      },
    }
  } catch (err) {
    return {
      type: 'metacoder-deploy' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
