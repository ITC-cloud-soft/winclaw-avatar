/**
 * Gate orchestrator — loads gates.yaml and runs a named gate.
 *
 * Sequentially executes each check in the gate, collects results, and
 * returns a GateResult. Supports per-gate timeouts parsed from strings
 * like "5m", "15m", "1h".
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'yaml'
import type { GateConfig, GateDefinition, GateCheck, GateResult, CheckResult } from '../types.js'
import { HarnessError } from '../types.js'
import { getCheckRunner } from './registry.js'
import { appendAudit } from '../audit/auditLog.js'
import { readActiveFeature } from '../spec/crossArtifact.js'
import { loadHarnessPolicy, isSoftenable, type HarnessPolicy } from '../policy.js'

// ---------------------------------------------------------------------------
// ${ACTIVE_FEATURE} placeholder resolution
// ---------------------------------------------------------------------------

const ACTIVE_FEATURE_PATTERN = /\$\{ACTIVE_FEATURE\}/g

/**
 * Returns true if any string value (recursively) inside the check contains
 * the ${ACTIVE_FEATURE} placeholder. Used to decide whether a check should be
 * skipped when active-feature.txt is unset.
 */
function checkUsesActiveFeature(value: unknown): boolean {
  if (typeof value === 'string') return ACTIVE_FEATURE_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(checkUsesActiveFeature)
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      if (checkUsesActiveFeature(v)) return true
    }
  }
  return false
}

/**
 * Recursively replace ${ACTIVE_FEATURE} in every string field of an object,
 * preserving structure. Returns a new value — does NOT mutate the input.
 */
function substituteActiveFeature<T>(value: T, activeFeature: string): T {
  if (typeof value === 'string') {
    return value.replace(ACTIVE_FEATURE_PATTERN, activeFeature) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteActiveFeature(v, activeFeature)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = substituteActiveFeature(v, activeFeature)
    }
    return out as unknown as T
  }
  return value
}

// ---------------------------------------------------------------------------
// Result softening
// ---------------------------------------------------------------------------

/**
 * If gateEnforcement is 'warn' and this check type is softenable, downgrade a
 * failing CheckResult to a passing warning. The original failure detail is
 * preserved in `output` / `error` so the user still sees what went wrong.
 * Otherwise the result is returned unchanged.
 */
function softenResult(result: CheckResult, policy: HarnessPolicy): CheckResult {
  if (result.passed) return result
  if (policy.gateEnforcement !== 'warn') return result
  if (!isSoftenable(result.type)) return result

  const originalError = result.error ?? result.output ?? '(no detail)'
  return {
    ...result,
    passed: true,
    severity: 'warn',
    softened: true,
    output:
      `[softened to warning by policy.yaml gateEnforcement: warn] ` +
      `Original failure: ${originalError}`,
    error: undefined,
  }
}

// ---------------------------------------------------------------------------
// Timeout parsing
// ---------------------------------------------------------------------------

/**
 * Parse a duration string like "5m", "1h", "30s", "90" (seconds) into ms.
 * Default is 5 minutes if falsy.
 */
export function parseDurationMs(value: string | undefined, defaultMs = 5 * 60 * 1000): number {
  if (!value) return defaultMs
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(h|m|s)?$/)
  if (!m) return defaultMs
  const n = parseFloat(m[1]!)
  switch (m[2]) {
    case 'h': return Math.round(n * 60 * 60 * 1000)
    case 'm': return Math.round(n * 60 * 1000)
    case 's': return Math.round(n * 1000)
    default:  return Math.round(n * 1000) // bare number = seconds
  }
}

// ---------------------------------------------------------------------------
// Public: loadGates
// ---------------------------------------------------------------------------

/**
 * Read and parse harness/workflow/gates.yaml.
 * Throws HarnessError if the file is missing or malformed.
 */
export async function loadGates(workspacePath: string): Promise<GateConfig> {
  const gatesPath = path.join(workspacePath, 'harness', 'workflow', 'gates.yaml')

  let raw: string
  try {
    raw = await fs.readFile(gatesPath, 'utf8')
  } catch {
    throw new HarnessError(
      `gates.yaml not found at ${gatesPath}`,
      'harness-not-initialized',
    )
  }

  let parsed: unknown
  try {
    parsed = yaml.parse(raw)
  } catch (err) {
    throw new HarnessError(
      `Failed to parse gates.yaml: ${err instanceof Error ? err.message : String(err)}`,
      'invalid-yaml',
    )
  }

  // Minimal structure validation
  if (typeof parsed !== 'object' || parsed === null || !('gates' in parsed)) {
    throw new HarnessError(
      'gates.yaml must have a top-level "gates" object',
      'invalid-yaml',
    )
  }

  const config = parsed as GateConfig

  // Validate each gate has a checks array
  for (const [gateId, gateDef] of Object.entries(config.gates ?? {})) {
    if (!Array.isArray((gateDef as Partial<GateDefinition>).checks)) {
      throw new HarnessError(
        `Gate "${gateId}" is missing a "checks" array in gates.yaml`,
        'invalid-yaml',
      )
    }
  }

  return config
}

// ---------------------------------------------------------------------------
// Public: runGate
// ---------------------------------------------------------------------------

export async function runGate(
  gateId: string,
  workspacePath: string,
  options?: { phaseId?: string },
): Promise<GateResult> {
  const config = await loadGates(workspacePath)

  const gateDef = config.gates[gateId]
  if (!gateDef) {
    throw new HarnessError(
      `Gate "${gateId}" not found in gates.yaml. Available: ${Object.keys(config.gates).join(', ')}`,
      'gate-not-found',
    )
  }

  const phaseId = options?.phaseId ?? gateDef.phase ?? gateId
  const gateTimeoutMs = parseDurationMs(gateDef.timeout, 15 * 60 * 1000)
  const startAll = Date.now()

  // Load active feature + policy once per gate run. Both have safe fallbacks.
  const [activeFeature, policy] = await Promise.all([
    readActiveFeature(workspacePath),
    loadHarnessPolicy(workspacePath),
  ])

  const results: CheckResult[] = []
  for (const rawCheck of gateDef.checks as GateCheck[]) {
    // -----------------------------------------------------------------
    // ${ACTIVE_FEATURE} resolution (runner-layer, applies to every type)
    // -----------------------------------------------------------------
    let check: GateCheck = rawCheck
    if (checkUsesActiveFeature(rawCheck)) {
      if (!activeFeature) {
        // When gateEnforcement=error, an unset active feature is a real
        // problem: the check cannot run and the gate must NOT silently pass.
        // When gateEnforcement=warn (default), keep the original back-compat
        // behaviour of skipping with a warning so existing projects don't
        // suddenly break.
        if (policy.gateEnforcement === 'error') {
          results.push({
            type: rawCheck.type as string,
            passed: false,
            severity: 'fail',
            skipped: true,
            durationMs: 0,
            output:
              `active-feature.txt is not set; ${rawCheck.type} requires it under policy=error. ` +
              `Run /harness spec init or /harness spec activate <feature> to set the active feature.`,
          })
        } else {
          // gateEnforcement=warn (default) — skip with warning, gate stays green.
          results.push({
            type: rawCheck.type as string,
            passed: true,
            severity: 'warn',
            skipped: true,
            durationMs: 0,
            output:
              `skipped (no active feature): check references ` +
              `\${ACTIVE_FEATURE} but harness/audit/active-feature.txt is unset. ` +
              `Run /harness spec init or /harness spec activate <feature> first.`,
          })
        }
        continue
      }
      check = substituteActiveFeature(rawCheck, activeFeature)
    }

    const runner = getCheckRunner(check.type)

    if (!runner) {
      // Unknown check type — FAIL the gate (was silently skipped pre-v2.0.4).
      // Silent skip lets a gate pass without actually evaluating all checks,
      // defeating the entire purpose of harness gates. Fail loudly instead.
      const known = (await import('./registry.js')).listSupportedCheckTypes().join(', ')
      results.push(softenResult({
        type: check.type as string,
        passed: false,
        durationMs: 0,
        error: `Unknown check type "${check.type}". Known types: ${known}. ` +
          `Either fix the type in gates.yaml, or implement a runner for it ` +
          `under src/services/harness/gates/runners/.`,
      }, policy))
      continue
    }

    // Each check respects the gate-level timeout remaining
    const elapsed = Date.now() - startAll
    const remainingMs = Math.max(0, gateTimeoutMs - elapsed)
    if (remainingMs === 0) {
      results.push(softenResult({
        type: check.type,
        passed: false,
        durationMs: 0,
        error: 'Gate timeout exceeded before this check could run',
      }, policy))
      break
    }

    // Run check (runners accept timeoutMs as third arg where relevant)
    // Pass meta so runners like human-approval / review-checklist can locate
    // the correct gate/phase context.
    const checkStart = Date.now()
    try {
      const result = await Promise.race([
        runner(check, workspacePath, remainingMs, { gateId, phaseId }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('check timeout')), remainingMs),
        ),
      ])
      results.push(softenResult(result, policy))
    } catch (err) {
      results.push(softenResult({
        type: check.type as (typeof check)['type'],
        passed: false,
        durationMs: Date.now() - checkStart,
        error: err instanceof Error ? err.message : String(err),
      }, policy))
    }
  }

  const passed = results.length > 0 && results.every(r => r.passed)
  const ranAt = new Date().toISOString()
  const totalDurationMs = Date.now() - startAll

  // Emit gate-run audit entry (Standard scope §10.2 audit completeness)
  try {
    await appendAudit(workspacePath, {
      timestamp: ranAt,
      workspacePath,
      phase: (phaseId as never) ?? null,
      role: null,
      actor: 'harness-gate',
      kind: 'gate-run',
      summary: `Gate "${gateId}" ${passed ? 'passed' : 'failed'} (${results.length} checks, ${totalDurationMs}ms)`,
      detail: {
        gateId,
        passed,
        checks: results.map(r => ({ type: r.type, passed: r.passed, durationMs: r.durationMs })),
        totalDurationMs,
      },
    })
  } catch {
    // Audit failure must not break gate execution
  }

  return {
    gateId,
    phaseId,
    passed,
    results,
    totalDurationMs,
    ranAt,
  }
}
