/**
 * harnessRuleConformance runner — in-process lint filtered to a single rule id.
 *
 * ExtendedGateCheck type: 'harness-rule-conformance'
 *
 * Runs harnessLint() restricted to the given rule, computes a pass-rate
 * (violations / total files scanned) and checks against threshold (e.g. ">=95%").
 */

import type { CheckResult } from '../../types.js'
import type { ExtendedGateCheck } from '../../standardTypes.js'
import { harnessLint } from '../../lint.js'
import { parsePercentThreshold, compare } from './_threshold.js'

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runHarnessRuleConformance(
  check: ExtendedGateCheck & { type: 'harness-rule-conformance' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath } = ctx
  const thresholdExpr = check.threshold ?? '>=95%'

  try {
    const lintResult = await harnessLint(workspacePath, { ruleIds: [check.rule] })

    const filesScanned = lintResult.filesScanned
    const ruleViolations = lintResult.violations.filter(v => v.ruleId === check.rule)
    // Pass-rate = percentage of files with NO violation for this rule
    const failedFiles = new Set(ruleViolations.map(v => v.file)).size
    const passedFiles = Math.max(0, filesScanned - failedFiles)
    const passRate = filesScanned > 0 ? (passedFiles / filesScanned) * 100 : 100

    const threshold = parsePercentThreshold(thresholdExpr)
    const meetsThreshold = threshold ? compare(passRate, threshold) : false

    const detail: Record<string, unknown> = {
      rule: check.rule,
      filesScanned,
      passedFiles,
      failedFiles,
      passRate: `${passRate.toFixed(1)}%`,
      threshold: thresholdExpr,
    }

    return {
      type: 'harness-rule-conformance' as never,
      passed: meetsThreshold,
      durationMs: Date.now() - start,
      output: `Rule "${check.rule}": ${passRate.toFixed(1)}% conformance (threshold ${thresholdExpr})`,
      detail,
    }
  } catch (err) {
    return {
      type: 'harness-rule-conformance' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
