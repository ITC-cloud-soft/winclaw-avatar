/**
 * systestCheck runner — bridge to the existing /systest skill.
 *
 * GateCheck type: 'metacoder-systest'
 *
 * MVP: if the workspace package.json has a "systest" script, exec it and
 * check exit code. For Phase 6, this would parse phase5b_results.json and
 * phase5c_results.json from .systest/test-logs/.
 *
 * Exports setShellExecutor() for test injection.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
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
// Helper: check package.json for a given script
// ---------------------------------------------------------------------------

function hasSystestScript(workspacePath: string): boolean {
  const pkgPath = path.join(workspacePath, 'package.json')
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    return typeof pkg.scripts?.['systest'] === 'string'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runSystestCheck(
  check: GateCheck,
  workspacePath: string,
  timeoutMs = 10 * 60 * 1000,
): Promise<CheckResult> {
  if (check.type !== 'metacoder-systest') {
    return {
      type: 'metacoder-systest',
      passed: false,
      durationMs: 0,
      error: `runSystestCheck invoked with wrong check type: ${(check as GateCheck).type}`,
    }
  }

  const start = Date.now()

  // If a custom command is provided, use it directly; otherwise require scripts.systest
  if (!check.command && !hasSystestScript(workspacePath)) {
    return {
      type: 'metacoder-systest',
      passed: false,
      durationMs: Date.now() - start,
      output: 'scripts.systest not configured; cannot run gate',
      detail: {
        hint: 'Add a "systest" script to package.json or supply check.command in gates.yaml',
      },
    }
  }

  const commandStr = check.command ?? 'bun run systest'
  const parts = commandStr.trim().split(/\s+/)
  const executable = parts[0]!
  const args = parts.slice(1)

  try {
    const result = _shellExecutor(executable, args, workspacePath, timeoutMs)

    if (result.timedOut) {
      return {
        type: 'metacoder-systest',
        passed: false,
        durationMs: Date.now() - start,
        output: 'Systest timed out',
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)
    const passed = result.status === 0

    return {
      type: 'metacoder-systest',
      passed,
      durationMs: Date.now() - start,
      output: rawOutput,
      detail: {
        exitCode: result.status,
        note: 'MVP: exit-code only. Phase 6 will parse phase5b_results.json and phase5c_results.json.',
      },
    }
  } catch (err) {
    return {
      type: 'metacoder-systest',
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
