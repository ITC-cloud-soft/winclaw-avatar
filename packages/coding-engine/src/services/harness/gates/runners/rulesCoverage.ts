/**
 * rulesCoverage runner — checks fraction of rule files that have at least
 * one successfully parsed ProgrammaticRule.
 *
 * ExtendedGateCheck type: 'rules-coverage'
 */

import fs from 'node:fs/promises'
import type { CheckResult } from '../../types.js'
import type { ExtendedGateCheck } from '../../standardTypes.js'
import { parseRulesFromMarkdown } from '../../ruleParser.js'
import { parsePercentThreshold, compare } from './_threshold.js'

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runRulesCoverage(
  check: ExtendedGateCheck & { type: 'rules-coverage' },
  ctx: { workspacePath: string; timeoutMs: number },
): Promise<CheckResult> {
  const start = Date.now()

  try {
    const thresholdExpr = check.threshold
    const threshold = parsePercentThreshold(thresholdExpr)

    if (!threshold) {
      return {
        type: 'rules-coverage' as never,
        passed: false,
        durationMs: Date.now() - start,
        error: `Could not parse threshold expression: "${thresholdExpr}"`,
      }
    }

    let covered = 0
    const detail: Array<{ file: string; ruleCount: number }> = []

    for (const ruleFile of check.rules) {
      let content: string
      try {
        content = await fs.readFile(ruleFile, 'utf8')
      } catch {
        detail.push({ file: ruleFile, ruleCount: 0 })
        continue
      }

      const rules = parseRulesFromMarkdown(content, ruleFile)
      const programmaticCount = rules.filter(r => r.kind !== 'human').length
      detail.push({ file: ruleFile, ruleCount: programmaticCount })
      if (programmaticCount > 0) covered++
    }

    const total = check.rules.length
    const coverageRate = total > 0 ? (covered / total) * 100 : 100
    const passed = compare(coverageRate, threshold)

    return {
      type: 'rules-coverage' as never,
      passed,
      durationMs: Date.now() - start,
      output:
        `Rules coverage: ${covered}/${total} files have programmatic rules ` +
        `(${coverageRate.toFixed(1)}%, threshold ${thresholdExpr})`,
      detail: { covered, total, coverageRate: `${coverageRate.toFixed(1)}%`, files: detail },
    }
  } catch (err) {
    return {
      type: 'rules-coverage' as never,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
