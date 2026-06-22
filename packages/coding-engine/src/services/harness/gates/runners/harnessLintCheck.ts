/**
 * harnessLintCheck runner — runs Agent C's harnessLint() in-process.
 *
 * GateCheck type: 'harness-lint'
 */

import type { GateCheck, CheckResult } from '../../types.js'
import { harnessLint } from '../../lint.js'

export async function runHarnessLintCheck(
  check: GateCheck,
  workspacePath: string,
): Promise<CheckResult> {
  if (check.type !== 'harness-lint') {
    return {
      type: 'harness-lint',
      passed: false,
      durationMs: 0,
      error: `runHarnessLintCheck invoked with wrong check type: ${(check as GateCheck).type}`,
    }
  }

  const start = Date.now()

  try {
    const lintResult = await harnessLint(workspacePath)

    const errorCount = lintResult.violations.filter(v => v.severity === 'error').length
    const warnCount  = lintResult.violations.filter(v => v.severity === 'warning').length

    return {
      type: 'harness-lint',
      passed: lintResult.passed,
      durationMs: Date.now() - start,
      output: `${errorCount} errors, ${warnCount} warnings`,
      detail: {
        score: lintResult.score,
        violations: lintResult.violations.length,
        filesScanned: lintResult.filesScanned,
        rulesEvaluated: lintResult.rulesEvaluated,
        durationMs: lintResult.durationMs,
      },
    }
  } catch (err) {
    return {
      type: 'harness-lint',
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
