/**
 * specRequirements runner — validates that the active feature's spec.md is
 * a real requirements document, not just an empty template scaffold.
 *
 * GateCheck type: 'spec-requirements'
 *
 * Configuration in gates.yaml:
 *
 *   gate-requirements:
 *     phase: requirements
 *     checks:
 *       - type: spec-requirements
 *         path: harness/specs/${ACTIVE_FEATURE}/spec.md   # foundation layer
 *                                                        # resolves the
 *                                                        # ${ACTIVE_FEATURE}
 *                                                        # placeholder before
 *                                                        # calling this runner
 *         minAcceptanceCriteria: 1                       # default 1
 *         allowUnresolvedClarifications: 0               # default 0
 *
 * The check fails if:
 *   - The spec.md file is missing or unreadable.
 *   - The spec.md contains fewer AC-NNN ids than `minAcceptanceCriteria`.
 *   - The spec.md contains more `[NEEDS CLARIFICATION]` markers than
 *     `allowUnresolvedClarifications`.
 *
 * Re-uses existing spec-kit logic — `extractAcIds` from `crossArtifact.ts`
 * for acceptance criteria parsing and `scanClarificationsInText` from
 * `clarify.ts` for [NEEDS CLARIFICATION] marker scanning — so the gate
 * stays in lock-step with the rest of the spec-kit tooling.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { CheckResult } from '../../types.js'
import { extractAcIds } from '../../spec/crossArtifact.js'
import { scanClarificationsInText } from '../../spec/clarify.js'

export type SpecRequirementsCheck = {
  type: 'spec-requirements'
  path: string
  minAcceptanceCriteria?: number
  allowUnresolvedClarifications?: number
}

const MAX_MARKERS_IN_MESSAGE = 5

export async function runSpecRequirements(
  check: SpecRequirementsCheck,
  ctx: { workspacePath: string; timeoutMs?: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const minAc = check.minAcceptanceCriteria ?? 1
  const allowedClar = check.allowUnresolvedClarifications ?? 0

  const absPath = path.isAbsolute(check.path)
    ? check.path
    : path.join(ctx.workspacePath, check.path)

  // 1. File exists / readable
  let raw: string
  try {
    raw = await fs.readFile(absPath, 'utf8')
  } catch {
    return {
      type: 'spec-requirements' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `spec.md not found at ${absPath}`,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        file: absPath,
      },
    }
  }

  // 2. Acceptance criteria count (reuse crossArtifact extractAcIds)
  const acIds = extractAcIds(raw)
  if (acIds.length < minAc) {
    return {
      type: 'spec-requirements' as never,
      passed: false,
      durationMs: Date.now() - start,
      output:
        `spec.md at ${absPath} has ${acIds.length} acceptance criteria, ` +
        `but at least ${minAc} required. ` +
        `Add AC-NNN lines describing user-visible acceptance criteria.`,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        file: absPath,
        acceptanceCriteriaFound: acIds.length,
        minAcceptanceCriteria: minAc,
      },
    }
  }

  // 3. Unresolved clarifications (reuse clarify.scanClarificationsInText)
  const relForReport = path.isAbsolute(check.path)
    ? absPath
    : path.relative(ctx.workspacePath, absPath) || check.path
  const markers = scanClarificationsInText(raw, relForReport)
  if (markers.length > allowedClar) {
    const sample = markers
      .slice(0, MAX_MARKERS_IN_MESSAGE)
      .map((m) => `  - ${m.file}:${m.line} ${m.text}`)
      .join('\n')
    const more =
      markers.length > MAX_MARKERS_IN_MESSAGE
        ? `\n  ... and ${markers.length - MAX_MARKERS_IN_MESSAGE} more`
        : ''
    return {
      type: 'spec-requirements' as never,
      passed: false,
      durationMs: Date.now() - start,
      output:
        `spec.md at ${absPath} has ${markers.length} unresolved ` +
        `[NEEDS CLARIFICATION] marker(s), but at most ${allowedClar} allowed.\n` +
        sample +
        more,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        file: absPath,
        acceptanceCriteriaFound: acIds.length,
        unresolvedClarifications: markers.length,
        allowUnresolvedClarifications: allowedClar,
      },
    }
  }

  // All pass
  return {
    type: 'spec-requirements' as never,
    passed: true,
    durationMs: Date.now() - start,
    output:
      `spec.md has ${acIds.length} AC, ${markers.length} unresolved clarifications`,
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      file: absPath,
      acceptanceCriteriaFound: acIds.length,
      unresolvedClarifications: markers.length,
    },
  }
}
