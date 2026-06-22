/**
 * specDesign runner — gate check for the design phase.
 *
 * Thin wrapper over `runCrossArtifactAnalysis` (already implemented in
 * src/services/harness/spec/crossArtifact.ts). The job of this runner is to:
 *   1. Verify plan.md and tasks.md exist for the feature.
 *   2. Translate the analyzer's findings into pass/fail per the policy knobs
 *      (`requireAcCoverage`, `requireTasksDecomposed`).
 *   3. Optionally require a data-model.md (Q4 of the design spec — default
 *      'optional').
 *
 * Configuration in gates.yaml (see docs/harness-pipeline-improvements.md §2.3):
 *
 *   gate-design:
 *     phase: design
 *     checks:
 *       - type: spec-design
 *         featureId: ${ACTIVE_FEATURE}
 *         requireAcCoverage: true
 *         requireTasksDecomposed: true
 *         requireDataModel: optional
 *
 * NOTE: placeholder substitution for ${ACTIVE_FEATURE} is performed by the
 * gate foundation (Coder A's work); this runner receives a resolved featureId.
 *
 * NOTE: this file is the runner module only. Registration in the gate
 * runner registry and the GateCheck type union are handled separately
 * (Coder A type stub + Wave 2 registration).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CheckResult } from '../../types.js'
import {
  runCrossArtifactAnalysis,
  extractAcIds,
  type CrossArtifactFinding,
} from '../../spec/crossArtifact.js'

export type SpecDesignCheck = {
  type: 'spec-design'
  /** Resolved feature id (placeholder substitution done by foundation). */
  featureId: string
  /** Require every AC-NNN in spec.md to be referenced in plan.md. Default true. */
  requireAcCoverage?: boolean
  /** Require plan.md → tasks.md decomposition gap = 0. Default true. */
  requireTasksDecomposed?: boolean
  /** Whether data-model.md must exist alongside plan.md. Default 'optional'. */
  requireDataModel?: 'optional' | 'required'
}

function featureFile(workspacePath: string, featureId: string, name: string): string {
  return path.join(workspacePath, 'harness', 'specs', featureId, name)
}

function exists(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/**
 * Detect findings that indicate spec.md → plan.md AC coverage gaps.
 * The underlying analyzer emits `severity: 'warning'` with a message that
 * starts with `"N acceptance criteria not referenced in plan.md"`. We treat
 * both 'error' and 'warning' as failure (per the check contract).
 */
function isAcCoverageFailure(f: CrossArtifactFinding): boolean {
  return (
    f.source === 'spec.md' &&
    f.target === 'plan.md' &&
    (f.severity === 'error' || f.severity === 'warning') &&
    /not referenced/i.test(f.message)
  )
}

/**
 * Detect findings that indicate plan.md → tasks.md decomposition gaps.
 * The analyzer's emitted message for an empty tasks.md is
 * `"tasks.md has no [T-NNN] task IDs"`; a missing tasks.md produces
 * `"tasks.md not found — ..."`. Both signal a decomposition gap.
 *
 * Exported for contract-testing: if crossArtifact.ts ever changes its
 * message strings, the contract test in specDesign.test.ts will catch it.
 */
export function isDecompositionFailure(f: CrossArtifactFinding): boolean {
  return (
    f.source === 'plan.md' &&
    f.target === 'tasks.md' &&
    (f.severity === 'error' || f.severity === 'warning') &&
    (/no \[T-\d*\s*N*\]? ?task ids/i.test(f.message) ||
      /no \[t-/i.test(f.message) ||
      /not found/i.test(f.message))
  )
}

export async function runSpecDesign(
  check: SpecDesignCheck,
  ctx: { workspacePath: string; timeoutMs: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const featureId = check.featureId
  const requireAcCoverage = check.requireAcCoverage ?? true
  const requireTasksDecomposed = check.requireTasksDecomposed ?? true
  const requireDataModel = check.requireDataModel ?? 'optional'

  // Pre-flight: featureId must be supplied (placeholder substitution upstream).
  if (!featureId) {
    return {
      type: 'spec-design',
      passed: false,
      durationMs: Date.now() - start,
      output:
        'spec-design: featureId is required (active feature not set; check ' +
        '${ACTIVE_FEATURE} resolution or pass featureId explicitly).',
      detail: { gateId: meta?.gateId, phaseId: meta?.phaseId },
    }
  }

  // (1) plan.md / tasks.md existence — surfaced explicitly so the user sees
  // the missing-file message rather than only an indirect cross-artifact
  // warning.
  const planPath = featureFile(ctx.workspacePath, featureId, 'plan.md')
  const tasksPath = featureFile(ctx.workspacePath, featureId, 'tasks.md')
  const planExists = exists(planPath)
  const tasksExists = exists(tasksPath)

  const problems: string[] = []
  if (!planExists) {
    problems.push(`plan.md not found at harness/specs/${featureId}/plan.md`)
  }
  if (!tasksExists) {
    problems.push(`tasks.md not found at harness/specs/${featureId}/tasks.md`)
  }

  if (problems.length > 0) {
    return {
      type: 'spec-design',
      passed: false,
      durationMs: Date.now() - start,
      output:
        `spec-design: design artifacts missing for feature "${featureId}":\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        featureId,
        planExists,
        tasksExists,
      },
    }
  }

  // (2) Run the cross-artifact analyzer once and translate findings.
  const analysis = await runCrossArtifactAnalysis({
    workspacePath: ctx.workspacePath,
    featureId,
  })

  const failures: string[] = []
  const passDetails: string[] = []

  if (requireAcCoverage) {
    // Guard against vacuous pass: if spec.md has no AC-NNN entries at all,
    // there is nothing to cover — this is almost certainly an incomplete spec.
    const specPath = featureFile(ctx.workspacePath, featureId, 'spec.md')
    let specMd = ''
    try {
      specMd = fs.readFileSync(specPath, 'utf8')
    } catch {
      // If spec.md is missing the cross-artifact analysis will also have
      // produced a finding; let that surface below rather than double-reporting.
    }
    if (extractAcIds(specMd).length === 0) {
      failures.push(
        'spec.md has no AC-NNN entries — design AC coverage is vacuous',
      )
    } else {
      const acFailures = analysis.findings.filter(isAcCoverageFailure)
      if (acFailures.length > 0) {
        for (const f of acFailures) {
          failures.push(`AC coverage: ${f.message}`)
        }
      } else {
        const ok = analysis.findings.find(
          (f) =>
            f.source === 'spec.md' &&
            f.target === 'plan.md' &&
            f.severity === 'ok',
        )
        if (ok) passDetails.push(ok.message)
        else passDetails.push('spec.md → plan.md AC coverage OK')
      }
    }
  }

  if (requireTasksDecomposed) {
    const decompFailures = analysis.findings.filter(isDecompositionFailure)
    if (decompFailures.length > 0) {
      for (const f of decompFailures) {
        failures.push(`tasks decomposition: ${f.message}`)
      }
    } else {
      const ok = analysis.findings.find(
        (f) =>
          f.source === 'plan.md' &&
          f.target === 'tasks.md' &&
          f.severity === 'ok',
      )
      if (ok) passDetails.push(ok.message)
      else passDetails.push('plan.md → tasks.md decomposition OK')
    }
  }

  // (3) requireDataModel
  if (requireDataModel === 'required') {
    const dataModelPath = featureFile(ctx.workspacePath, featureId, 'data-model.md')
    if (!exists(dataModelPath)) {
      failures.push(
        `data-model.md required but not found at harness/specs/${featureId}/data-model.md`,
      )
    } else {
      passDetails.push('data-model.md present')
    }
  }

  if (failures.length > 0) {
    return {
      type: 'spec-design',
      passed: false,
      durationMs: Date.now() - start,
      output:
        `spec-design: ${failures.length} problem(s) for feature "${featureId}":\n` +
        failures.map((p) => `  - ${p}`).join('\n'),
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        featureId,
        findings: analysis.findings,
        errorCount: analysis.errorCount,
        warningCount: analysis.warningCount,
      },
    }
  }

  return {
    type: 'spec-design',
    passed: true,
    durationMs: Date.now() - start,
    output:
      `design: spec.md → plan.md AC coverage OK, plan.md → tasks.md decomposed OK` +
      (passDetails.length > 0 ? ` (${passDetails.join('; ')})` : ''),
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      featureId,
      findings: analysis.findings,
    },
  }
}
