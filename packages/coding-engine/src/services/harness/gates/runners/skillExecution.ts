/**
 * skillExecution runner — invokes a Meta Coder skill by id/path.
 *
 * ExtendedGateCheck type: 'skill-execution'
 *
 * Shells out: bun run src/entrypoints/metacoder.ts skill run <skill> --json
 * Parses JSON for { passed, score? } and checks against expected_output.
 * If the skill subsystem is not wired, returns passed=false with a TODO marker.
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
// Runner
// ---------------------------------------------------------------------------

export async function runSkillExecution(
  check: ExtendedGateCheck & { type: 'skill-execution' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath, timeoutMs } = ctx
  const expected = check.expected_output

  try {
    const result = _exec(
      'bun',
      ['run', 'src/entrypoints/metacoder.ts', 'skill', 'run', check.skill, '--json'],
      workspacePath,
      timeoutMs,
    )

    if (result.timedOut) {
      return {
        type: 'skill-execution' as never,
        passed: false,
        durationMs: Date.now() - start,
        output: `Skill "${check.skill}" execution timed out`,
        error: 'timeout',
      }
    }

    const rawOutput = (result.stdout + '\n' + result.stderr).slice(0, MAX_OUTPUT_BYTES)

    // Try to parse JSON response
    let parsed: { passed?: unknown; score?: unknown } | null = null
    try {
      parsed = JSON.parse(result.stdout.trim()) as { passed?: unknown; score?: unknown }
    } catch {
      // If JSON parse fails, check if entrypoint exists at all
      if (result.status === 1 && rawOutput.toLowerCase().includes('not found')) {
        // TODO(Agent A): Wire skill subsystem — src/entrypoints/metacoder.ts skill run <id> --json
        return {
          type: 'skill-execution' as never,
          passed: false,
          durationMs: Date.now() - start,
          output:
            'skill subsystem not wired: src/entrypoints/metacoder.ts skill run command returned non-JSON.\n' +
            'TODO(Agent A): implement `metacoder skill run <id> --json` entrypoint.\n' +
            rawOutput,
        }
      }
    }

    if (!parsed) {
      return {
        type: 'skill-execution' as never,
        passed: false,
        durationMs: Date.now() - start,
        output:
          `skill subsystem not wired: could not parse JSON from skill "${check.skill}".\n` +
          'TODO(Agent A): implement `metacoder skill run <id> --json` entrypoint.\n' +
          rawOutput,
      }
    }

    const skillPassed = parsed.passed === true
    const skillScore = typeof parsed.score === 'number' ? parsed.score : null

    const failures: string[] = []
    if (expected) {
      if (expected.passed !== undefined && skillPassed !== expected.passed) {
        failures.push(`expected passed=${expected.passed}, got passed=${skillPassed}`)
      }
      if (expected.min_score !== undefined && skillScore !== null && skillScore < expected.min_score) {
        failures.push(`score ${skillScore} < min_score ${expected.min_score}`)
      }
    }

    return {
      type: 'skill-execution' as never,
      passed: failures.length === 0 && skillPassed,
      durationMs: Date.now() - start,
      output: rawOutput + (failures.length ? '\nGate failures:\n' + failures.join('\n') : ''),
      detail: { skill: check.skill, skillPassed, skillScore },
    }
  } catch (err) {
    return {
      type: 'skill-execution' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
