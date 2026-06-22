/**
 * advanced/drill.ts — /harness drill (virtual dry-run)
 *
 * Walks the entire phases.yaml pipeline without persisting state,
 * simulating gate execution. Surfaces what would pass/fail end-to-end.
 *
 * Implements Harness Engineering Advanced scope §10.3.
 */

import { loadPhasesConfig } from '../workflow/phasesLoader.js'
import { runGate } from '../gates/runner.js'
import { harnessLint } from '../lint.js'
import { appendAudit } from '../audit/auditLog.js'
import type { PhaseId } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DrillGateResult = {
  phase: PhaseId | string
  gateId: string | null
  passed: boolean
  durationMs: number
  errors: string[]
}

export type DrillReport = {
  ranAt: string
  workspacePath: string
  phasesWalked: (PhaseId | string)[]
  gateResults: DrillGateResult[]
  rulesCoverage: {
    rulesEvaluated: number
    violations: number
    score: number
  }
  summary: {
    totalDurationMs: number
    phasesPassed: number
    phasesFailed: number
    allGreen: boolean
  }
}

export type DrillOptions = {
  /** When true, skip individual gate execution (structure walk only) */
  skipGates?: boolean
  /** Start walking from this phase (inclusive). Defaults to default_phase. */
  phaseFrom?: PhaseId
  /** Stop walking at this phase (inclusive). Defaults to 'confirm'. */
  phaseTo?: PhaseId
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the ordered slice of phase ids to walk.
 * Follows `next` pointers from the start phase until phaseTo or terminal.
 */
function buildPhaseWalkOrder(
  phases: { id: string; next: string | null }[],
  startId: string,
  endId: string,
): PhaseId[] {
  const byId = new Map(phases.map(p => [p.id, p]))
  const result: PhaseId[] = []
  let current: string | null = startId

  while (current !== null) {
    const phase = byId.get(current)
    if (!phase) break
    result.push(current as PhaseId)
    if (current === endId) break
    current = phase.next
  }

  return result
}

// ---------------------------------------------------------------------------
// Public: runDrill
// ---------------------------------------------------------------------------

/**
 * Perform a virtual dry-run of the phases.yaml pipeline.
 *
 * - Runs harnessLint once to populate rulesCoverage.
 * - For each phase in the walk order, runs the associated gate (if any)
 *   via runGate — catching errors per-phase without aborting the whole walk.
 * - Does NOT persist PhaseState or write phase-advance audit entries.
 * - Does write a single 'drill-run' audit entry summarising the result.
 */
export async function runDrill(opts: {
  workspacePath: string
  options?: DrillOptions
}): Promise<DrillReport> {
  const { workspacePath, options = {} } = opts
  const { skipGates = false } = options
  const drillStart = Date.now()
  const ranAt = new Date().toISOString()

  // -------------------------------------------------------------------------
  // 1. Load phases config
  // -------------------------------------------------------------------------
  const phasesConfig = await loadPhasesConfig(workspacePath)

  // -------------------------------------------------------------------------
  // 2. Run harnessLint for rules coverage (once, up-front)
  // -------------------------------------------------------------------------
  let rulesCoverage = { rulesEvaluated: 0, violations: 0, score: 100 }
  try {
    const lintResult = await harnessLint(workspacePath)
    rulesCoverage = {
      rulesEvaluated: lintResult.rulesEvaluated,
      violations: lintResult.violations.length,
      score: lintResult.score,
    }
  } catch {
    // Lint failure (harness not initialised etc.) — record as zero coverage
    rulesCoverage = { rulesEvaluated: 0, violations: 0, score: 0 }
  }

  // -------------------------------------------------------------------------
  // 3. Determine walk order
  // -------------------------------------------------------------------------
  const gateResults: DrillGateResult[] = []
  const phasesWalked: (PhaseId | string)[] = []

  if (phasesConfig !== null) {
    const startId = options.phaseFrom ?? (phasesConfig.default_phase as PhaseId)

    // Determine end phase: use phaseTo if specified, otherwise find the last
    // phase in the chain (first with next === null).
    let endId: string = options.phaseTo ?? startId
    if (!options.phaseTo) {
      // Walk to terminal
      const byId = new Map(phasesConfig.phases.map(p => [p.id, p]))
      let cursor: string | null = startId
      while (cursor !== null) {
        const p = byId.get(cursor)
        if (!p) break
        endId = cursor
        cursor = p.next
      }
    }

    const walkOrder = buildPhaseWalkOrder(phasesConfig.phases, startId, endId)
    phasesWalked.push(...walkOrder)

    // -----------------------------------------------------------------------
    // 4. Per-phase gate execution
    // -----------------------------------------------------------------------
    const phaseById = new Map(phasesConfig.phases.map(p => [p.id, p]))

    for (const phaseId of walkOrder) {
      const phaseDef = phaseById.get(phaseId)
      const gateId = phaseDef?.gate ?? null

      if (skipGates || gateId === null) {
        // No gate or skipped — record as trivially passed
        gateResults.push({
          phase: phaseId,
          gateId,
          passed: true,
          durationMs: 0,
          errors: [],
        })
        continue
      }

      const gateStart = Date.now()
      try {
        const gateResult = await runGate(gateId, workspacePath, { phaseId })
        gateResults.push({
          phase: phaseId,
          gateId,
          passed: gateResult.passed,
          durationMs: gateResult.totalDurationMs,
          errors: gateResult.results
            .filter(r => !r.passed)
            .map(r => r.error ?? r.output ?? `check type "${r.type}" failed`)
            .filter(Boolean),
        })
      } catch (err) {
        gateResults.push({
          phase: phaseId,
          gateId,
          passed: false,
          durationMs: Date.now() - gateStart,
          errors: [err instanceof Error ? err.message : String(err)],
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Build summary
  // -------------------------------------------------------------------------
  const phasesPassed = gateResults.filter(r => r.passed).length
  const phasesFailed = gateResults.filter(r => !r.passed).length
  const totalDurationMs = Date.now() - drillStart
  const allGreen = phasesFailed === 0 && phasesWalked.length > 0

  const report: DrillReport = {
    ranAt,
    workspacePath,
    phasesWalked,
    gateResults,
    rulesCoverage,
    summary: {
      totalDurationMs,
      phasesPassed,
      phasesFailed,
      allGreen,
    },
  }

  // -------------------------------------------------------------------------
  // 6. Write single drill-run audit entry (dry-run → no phase-state persist)
  // -------------------------------------------------------------------------
  try {
    await appendAudit(workspacePath, {
      timestamp: ranAt,
      workspacePath,
      phase: null,
      role: null,
      actor: 'harness-drill',
      kind: 'drill-run',
      summary: `Drill dry-run: ${phasesWalked.length} phases walked, ${phasesPassed} passed, ${phasesFailed} failed (${totalDurationMs}ms)`,
      detail: {
        phasesWalked,
        phasesPassed,
        phasesFailed,
        allGreen,
        rulesCoverage,
        skipGates,
      },
    })
  } catch {
    // Audit failure must not break the drill result
  }

  return report
}
