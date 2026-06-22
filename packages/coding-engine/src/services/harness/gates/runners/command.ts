/**
 * command runner — generic shell-command gate check.
 *
 * Runs an arbitrary shell command and applies pass/fail criteria based on
 * exit code, stdout regex, and/or stderr regex. Useful when a project needs
 * a check that isn't covered by the more specific built-in runners
 * (typecheck / unit-test / sast / dependency-scan / load-test / …).
 *
 * Configuration in gates.yaml:
 *
 *   gate-custom:
 *     phase: implementation
 *     checks:
 *       - type: command
 *         command: "bash scripts/check-api-contract.sh"
 *         cwd: "."                 # optional, default workspacePath
 *         shell: true              # optional, default true; if false, command
 *                                  # is split via simple whitespace and run via
 *                                  # spawnSync without a shell
 *         timeout: "5m"            # optional, default 5m
 *         expected_exit: 0         # optional, default 0
 *         expected_stdout: "OK$"   # optional regex, must match stdout
 *         expected_stderr_absent: "error|fail"  # optional regex; if set,
 *                                  # MUST NOT match anywhere in stderr
 *         env:                     # optional, extra env vars merged with
 *           CI: "true"             # process.env
 *
 * Pass criteria (all must hold when configured):
 *   - exit code === expected_exit (default 0)
 *   - expected_stdout regex matches captured stdout (when configured)
 *   - expected_stderr_absent regex does NOT match captured stderr (when configured)
 *
 * Captured stdout/stderr are truncated to MAX_OUTPUT_BYTES to keep audit
 * payloads bounded.
 *
 * Exports setExec() for test injection — identical pattern to other runners.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type { CheckResult } from '../../types.js'

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

export type CommandCheck = {
  type: 'command'
  command: string
  cwd?: string
  shell?: boolean
  timeout?: string
  expected_exit?: number
  expected_stdout?: string
  expected_stderr_absent?: string
  env?: Record<string, string>
}

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
  cwd: string,
  timeoutMs: number,
  opts: { shell: boolean; env: Record<string, string> },
) => ShellResult

let _exec: ExecFn = (command, cwd, timeoutMs, opts) => {
  const childEnv = { ...process.env, ...opts.env }

  if (opts.shell) {
    const result = spawnSync(command, {
      cwd,
      shell: true,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: childEnv as NodeJS.ProcessEnv,
      maxBuffer: MAX_OUTPUT_BYTES,
    })
    return {
      stdout: String(result.stdout ?? '').slice(0, MAX_OUTPUT_BYTES),
      stderr: String(result.stderr ?? '').slice(0, MAX_OUTPUT_BYTES),
      status: result.status,
      timedOut: result.signal === 'SIGTERM' || (result.error as NodeJS.ErrnoException)?.code === 'ETIMEDOUT',
    }
  }

  // shell=false: simple whitespace split (no quote handling). Sufficient for
  // straightforward invocations like "bun test src/foo.test.ts".
  const parts = command.split(/\s+/).filter(Boolean)
  const cmd = parts[0]
  if (!cmd) {
    return { stdout: '', stderr: 'command is empty', status: 127, timedOut: false }
  }
  const result = spawnSync(cmd, parts.slice(1), {
    cwd,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: childEnv as NodeJS.ProcessEnv,
    maxBuffer: MAX_OUTPUT_BYTES,
  })
  return {
    stdout: String(result.stdout ?? '').slice(0, MAX_OUTPUT_BYTES),
    stderr: String(result.stderr ?? '').slice(0, MAX_OUTPUT_BYTES),
    status: result.status,
    timedOut: result.signal === 'SIGTERM' || (result.error as NodeJS.ErrnoException)?.code === 'ETIMEDOUT',
  }
}

export function setExec(fn: ExecFn): void {
  _exec = fn
}

export function resetExec(): void {
  _exec = (command, cwd, timeoutMs, opts) => {
    const childEnv = { ...process.env, ...opts.env }
    const result = spawnSync(command, {
      cwd,
      shell: opts.shell,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: childEnv as NodeJS.ProcessEnv,
      maxBuffer: MAX_OUTPUT_BYTES,
    })
    return {
      stdout: String(result.stdout ?? '').slice(0, MAX_OUTPUT_BYTES),
      stderr: String(result.stderr ?? '').slice(0, MAX_OUTPUT_BYTES),
      status: result.status,
      timedOut: result.signal === 'SIGTERM' || (result.error as NodeJS.ErrnoException)?.code === 'ETIMEDOUT',
    }
  }
}

// ---------------------------------------------------------------------------
// Public: runCommand
// ---------------------------------------------------------------------------

export async function runCommand(
  check: CommandCheck,
  ctx: { workspacePath: string; timeoutMs: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()

  if (typeof check.command !== 'string' || check.command.trim() === '') {
    return {
      type: 'command' as never,
      passed: false,
      durationMs: 0,
      error: 'check.command is required and must be a non-empty string',
      detail: { gateId: meta?.gateId, phaseId: meta?.phaseId },
    }
  }

  const expectedExit = check.expected_exit ?? 0
  const cwd = check.cwd
    ? path.isAbsolute(check.cwd) ? check.cwd : path.join(ctx.workspacePath, check.cwd)
    : ctx.workspacePath
  const shell = check.shell !== false // default true
  const env = check.env ?? {}

  const result = _exec(check.command, cwd, ctx.timeoutMs, { shell, env })

  const exitOk = result.status === expectedExit
  let stdoutOk = true
  let stderrOk = true
  const problems: string[] = []

  if (!exitOk) {
    problems.push(`exit code ${result.status} ≠ expected ${expectedExit}`)
  }

  if (check.expected_stdout) {
    try {
      const re = new RegExp(check.expected_stdout)
      stdoutOk = re.test(result.stdout)
      if (!stdoutOk) problems.push(`stdout does not match /${check.expected_stdout}/`)
    } catch {
      problems.push(`expected_stdout is not a valid regex: ${check.expected_stdout}`)
      stdoutOk = false
    }
  }

  if (check.expected_stderr_absent) {
    try {
      const re = new RegExp(check.expected_stderr_absent)
      const matched = re.test(result.stderr)
      stderrOk = !matched
      if (matched) {
        problems.push(`stderr matches forbidden pattern /${check.expected_stderr_absent}/`)
      }
    } catch {
      problems.push(`expected_stderr_absent is not a valid regex: ${check.expected_stderr_absent}`)
      stderrOk = false
    }
  }

  if (result.timedOut) {
    problems.push(`command timed out after ${ctx.timeoutMs}ms`)
  }

  const passed = exitOk && stdoutOk && stderrOk && !result.timedOut

  return {
    type: 'command' as never,
    passed,
    durationMs: Date.now() - start,
    output: passed
      ? `Command passed: \`${check.command}\` (exit ${result.status}, ${result.stdout.length}B stdout)`
      : `Command failed: \`${check.command}\`\n  - ${problems.join('\n  - ')}`,
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      command: check.command,
      cwd,
      exit: result.status,
      expected_exit: expectedExit,
      timedOut: result.timedOut,
      stdoutBytes: result.stdout.length,
      stderrBytes: result.stderr.length,
      // Include first 256 bytes of each stream for quick triage in audit log
      stdoutPreview: result.stdout.slice(0, 256),
      stderrPreview: result.stderr.slice(0, 256),
    },
  }
}
