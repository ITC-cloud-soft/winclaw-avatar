/**
 * metacoderDeployDryrun runner — runs Meta Coder deploy in dry-run mode.
 *
 * ExtendedGateCheck type: 'metacoder-deploy-dryrun'
 *
 * Default command: bun run src/entrypoints/metacoder.ts deploy --dry-run --env <env>
 * passed = (exitCode === expected_exit ?? 0)
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
// Runner
// ---------------------------------------------------------------------------

export async function runMetacoderDeployDryrun(
  check: ExtendedGateCheck & { type: 'metacoder-deploy-dryrun' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath, timeoutMs } = ctx
  const expectedExit = check.expected_exit ?? 0

  const commandStr =
    check.command ??
    `bun run src/entrypoints/metacoder.ts deploy --dry-run --env ${check.env}`
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  try {
    const result = _exec(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'metacoder-deploy-dryrun' as never,
        passed: false,
        durationMs: Date.now() - start,
        output: 'metacoder deploy --dry-run timed out',
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    const passed = result.status === expectedExit

    return {
      type: 'metacoder-deploy-dryrun' as never,
      passed,
      durationMs: Date.now() - start,
      output: rawOutput,
      detail: { exitCode: result.status, expectedExit, env: check.env, command: commandStr },
    }
  } catch (err) {
    return {
      type: 'metacoder-deploy-dryrun' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
