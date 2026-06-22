/**
 * policy.ts — Context loading policy defaults and loader.
 *
 * Provides the default ContextLoadingPolicy (budgets from §10.2 spec) and a
 * function to override it from harness/context/policy.yaml if present.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ContextLoadingPolicy } from '../standardTypes.js'
import type { HarnessLayout } from '../types.js'

// ---------------------------------------------------------------------------
// Spec defaults (§10.2 budgets)
// ---------------------------------------------------------------------------

const DEFAULT_SESSION_TOKENS = 1500
const DEFAULT_PHASE_TOKENS = 3000
const DEFAULT_ON_DEMAND_TOKENS = 8000
const DEFAULT_SUMMARIZE_IF_OVER = 1200

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the default ContextLoadingPolicy from the §10.2 spec.
 *
 * Callers may mutate the returned object — a fresh copy is returned each time.
 */
export function defaultPolicy(): ContextLoadingPolicy {
  return {
    budget: {
      session: DEFAULT_SESSION_TOKENS,
      phase: DEFAULT_PHASE_TOKENS,
      onDemand: DEFAULT_ON_DEMAND_TOKENS,
    },
    summarizeIfOverTokens: DEFAULT_SUMMARIZE_IF_OVER,
  }
}

// ---------------------------------------------------------------------------
// YAML override types (subset we care about)
// ---------------------------------------------------------------------------

type PolicyYaml = {
  budget?: {
    session?: number
    phase?: number
    on_demand?: number
  }
  summarize_if_over?: number
}

/**
 * Parse a minimal YAML policy file without a full YAML library.
 *
 * Handles the simple key: value format used in policy.yaml.
 * Intentionally narrow — only the fields we need.
 */
function parsePolicyYaml(raw: string): PolicyYaml {
  const result: PolicyYaml = {}

  // Split into sections: top-level vs budget block
  const lines = raw.split(/\r?\n/)
  let inBudget = false

  for (const line of lines) {
    const stripped = line.trim()
    if (!stripped || stripped.startsWith('#')) continue

    if (stripped === 'budget:') {
      inBudget = true
      result.budget = {}
      continue
    }

    if (inBudget && line.startsWith(' ')) {
      const match = stripped.match(/^(\w+):\s*(\d+)$/)
      if (match) {
        const key = match[1] as 'session' | 'phase' | 'on_demand'
        const val = parseInt(match[2], 10)
        if (!result.budget) result.budget = {}
        if (key === 'session') result.budget.session = val
        else if (key === 'phase') result.budget.phase = val
        else if (key === 'on_demand') result.budget.on_demand = val
      }
      continue
    } else {
      inBudget = false
    }

    const topMatch = stripped.match(/^summarize_if_over:\s*(\d+)$/)
    if (topMatch) {
      result.summarize_if_over = parseInt(topMatch[1], 10)
    }
  }

  return result
}

/**
 * Load a ContextLoadingPolicy for the given harness layout.
 *
 * Starts from `defaultPolicy()` then merges any overrides found in
 * `harness/context/policy.yaml`. If the file is absent or unreadable, the
 * defaults are returned unchanged.
 *
 * @param layout - Loaded harness layout (provides workspacePath)
 * @returns Merged ContextLoadingPolicy
 */
export async function loadPolicy(layout: HarnessLayout): Promise<ContextLoadingPolicy> {
  const policy = defaultPolicy()

  const policyPath = path.join(layout.rootDir, 'context', 'policy.yaml')
  let raw: string
  try {
    raw = await fs.readFile(policyPath, 'utf8')
  } catch {
    // File absent — return defaults
    return policy
  }

  let overrides: PolicyYaml
  try {
    overrides = parsePolicyYaml(raw)
  } catch {
    // Malformed — silently return defaults
    return policy
  }

  if (overrides.budget) {
    if (typeof overrides.budget.session === 'number') {
      policy.budget.session = overrides.budget.session
    }
    if (typeof overrides.budget.phase === 'number') {
      policy.budget.phase = overrides.budget.phase
    }
    if (typeof overrides.budget.on_demand === 'number') {
      policy.budget.onDemand = overrides.budget.on_demand
    }
  }
  if (typeof overrides.summarize_if_over === 'number') {
    policy.summarizeIfOverTokens = overrides.summarize_if_over
  }

  return policy
}
