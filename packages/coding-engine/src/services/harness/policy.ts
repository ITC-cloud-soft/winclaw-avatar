/**
 * policy.ts — Loader for harness/workflow/policy.yaml.
 *
 * The policy file is optional. Its only purpose in v3.3.0 is to let projects
 * opt into stricter gate enforcement for the new spec-kit-backed runners
 * (spec-requirements, spec-design, test-spec-checklist, tasks-status) before
 * the v3.4.0 default flips to 'error'.
 *
 *   # harness/workflow/policy.yaml
 *   version: 1
 *   gateEnforcement: warn   # or 'error'
 *
 * Missing file, malformed YAML, or unknown enforcement value all fall back to
 * the safe default: { gateEnforcement: 'warn' }.
 *
 * The gate runner reads this to decide whether a failing "new" check should
 * be softened (warn — gate still passes) or enforced (fail — gate stops).
 * Existing MVP/Standard runners (file-exists, typecheck, unit-test, etc.)
 * are NOT affected by gateEnforcement — they enforce as before.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'yaml'

export type GateEnforcement = 'warn' | 'error'

export interface HarnessPolicy {
  /** v3.3.0 default: 'warn'. v3.4.0 will flip to 'error'. */
  gateEnforcement: GateEnforcement
}

/**
 * Safe default returned when policy.yaml is missing / invalid.
 * v3.3.0: warn — softens new spec-kit checks so existing projects don't
 * suddenly fail their gates after upgrading.
 */
export const DEFAULT_POLICY: HarnessPolicy = {
  gateEnforcement: 'warn',
}

/**
 * Load harness/workflow/policy.yaml.
 *
 * Never throws. Returns DEFAULT_POLICY on any error (missing file, parse
 * failure, unknown enforcement value). A diagnostic is written to stderr
 * when an EXISTING file is malformed so the user notices the misconfig.
 */
export async function loadHarnessPolicy(workspacePath: string): Promise<HarnessPolicy> {
  const policyPath = path.join(workspacePath, 'harness', 'workflow', 'policy.yaml')

  let raw: string
  try {
    raw = await fs.readFile(policyPath, 'utf8')
  } catch {
    // Missing file is the common case — silent default is correct.
    return DEFAULT_POLICY
  }

  let parsed: unknown
  try {
    parsed = yaml.parse(raw)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[harness] policy.yaml at ${policyPath} is not valid YAML — ` +
      `falling back to gateEnforcement: '${DEFAULT_POLICY.gateEnforcement}'. ` +
      `${err instanceof Error ? err.message : String(err)}`,
    )
    return DEFAULT_POLICY
  }

  if (typeof parsed !== 'object' || parsed === null) {
    console.error(
      `[harness] policy.yaml at ${policyPath} must be a YAML mapping — ` +
      `falling back to gateEnforcement: '${DEFAULT_POLICY.gateEnforcement}'.`,
    )
    return DEFAULT_POLICY
  }

  const enforcement = (parsed as { gateEnforcement?: unknown }).gateEnforcement

  if (enforcement === 'warn' || enforcement === 'error') {
    return { gateEnforcement: enforcement }
  }

  if (enforcement !== undefined) {
    console.error(
      `[harness] policy.yaml gateEnforcement must be 'warn' or 'error', ` +
      `got ${JSON.stringify(enforcement)} — falling back to ` +
      `'${DEFAULT_POLICY.gateEnforcement}'.`,
    )
  }
  return DEFAULT_POLICY
}

// ---------------------------------------------------------------------------
// Softening helpers
// ---------------------------------------------------------------------------

/**
 * Check types whose failures are softened to warnings when
 * gateEnforcement === 'warn'. Anything outside this set enforces normally.
 *
 * The set is deliberately closed (not prefix-based on 'spec-') to keep
 * behaviour predictable: a future hypothetical 'spec-foo' runner won't
 * be silently softened without an explicit decision.
 */
export const SOFTENABLE_CHECK_TYPES = new Set<string>([
  'spec-requirements',
  'spec-design',
  'test-spec-checklist',
  'tasks-status',
])

/**
 * Returns true if a failing result of this check type should be downgraded
 * to a warning under gateEnforcement: warn.
 */
export function isSoftenable(checkType: string): boolean {
  return SOFTENABLE_CHECK_TYPES.has(checkType)
}
