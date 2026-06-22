/**
 * typecheck runner — runs TypeScript type-checking in the workspace.
 *
 * GateCheck type: 'typescript-typecheck'
 *
 * Default command: npx tsc --noEmit -p tsconfig.json
 * Default expected_exit: 0
 *
 * Exports setShellExecutor() for test injection.
 */

import { spawnSync } from 'node:child_process'
import type { GateCheck, CheckResult } from '../../types.js'

// ---------------------------------------------------------------------------
// Shell executor hook (for test injection)
// ---------------------------------------------------------------------------

const MAX_OUTPUT_BYTES = 4 * 1024 // 4 KB

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

/** Inject a shell executor (for tests). */
export function setShellExecutor(fn: ShellExecutor): void {
  _shellExecutor = fn
}

/** Reset to real spawnSync executor. */
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
// Runner
// ---------------------------------------------------------------------------

export async function runTypecheck(
  check: GateCheck,
  workspacePath: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<CheckResult> {
  if (check.type !== 'typescript-typecheck') {
    return {
      type: 'typescript-typecheck',
      passed: false,
      durationMs: 0,
      error: `runTypecheck invoked with wrong check type: ${(check as GateCheck).type}`,
    }
  }

  const start = Date.now()
  const commandStr = check.command ?? 'npx tsc --noEmit -p tsconfig.json'
  const expectedExit = check.expected_exit ?? 0

  // Split command string into executable + args
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  let passed: boolean
  let output: string

  try {
    const result = _shellExecutor(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'typescript-typecheck',
        passed: false,
        durationMs: Date.now() - start,
        output: 'Typecheck timed out',
        error: 'timeout',
      }
    }

    const actualExit = result.status ?? -1
    passed = actualExit === expectedExit

    const combined = (result.stdout + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    output = combined || (passed ? 'No type errors' : `Exit code: ${actualExit}`)
  } catch (err) {
    return {
      type: 'typescript-typecheck',
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  return {
    type: 'typescript-typecheck',
    passed,
    durationMs: Date.now() - start,
    output,
  }
}
