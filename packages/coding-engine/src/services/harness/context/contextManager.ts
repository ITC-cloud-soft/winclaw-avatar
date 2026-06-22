/**
 * contextManager.ts — Orchestrator for the 3-layer context loading system.
 *
 * Composes session / phase / on-demand context entries and enforces per-layer
 * token budgets. Provides buildSnapshot() as the single entry point for callers.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  ContextEntry,
  ContextLoadingPolicy,
  ContextSnapshot,
  PhaseTriggers,
  PhaseId,
  RoleId,
} from '../standardTypes.js'
import type { HarnessLayout } from '../types.js'
import { approxTokens } from './tokenizer.js'
import { defaultPolicy } from './policy.js'
import { summarize } from './summarizer.js'
import { resolveUri } from './uriResolver.js'
import type { GraphifyResolver } from './uriResolver.js'
import { createGraphifyResolver } from './graphifyResolverImpl.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read a file from the workspace or return null if absent. */
async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

/**
 * Parse a `summarize_if_over` string like "1500 tokens" → 1500.
 * Falls back to the policy default if unparseable.
 */
function parseSummarizeThreshold(
  raw: string | undefined,
  policyDefault: number,
): number {
  if (!raw) return policyDefault
  const m = raw.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : policyDefault
}

// ---------------------------------------------------------------------------
// Public: buildSession
// ---------------------------------------------------------------------------

/**
 * Build the session-layer context entries.
 *
 * Loads `harness/context/session.md` (via `layout.context.session`) and
 * trims it to the session budget via the summarizer if necessary.
 *
 * @param layout - Loaded HarnessLayout (workspacePath + context index)
 * @param policy - Active ContextLoadingPolicy
 * @returns Array with 0 or 1 session ContextEntry
 */
export async function buildSession(
  layout: HarnessLayout,
  policy: ContextLoadingPolicy = defaultPolicy(),
): Promise<ContextEntry[]> {
  const sessionPath = layout.context.session
  if (!sessionPath) return []

  const content = await readFileOrNull(sessionPath)
  if (!content) return []

  const budget = policy.budget.session
  const tokens = approxTokens(content)
  const overBudget = tokens > budget

  const finalContent = overBudget ? summarize(content, budget) : content

  return [
    {
      layer: 'session',
      path: path.relative(path.dirname(layout.rootDir), sessionPath).replace(/\\/g, '/'),
      content: finalContent,
      approxTokens: approxTokens(finalContent),
      summarized: overBudget,
    },
  ]
}

// ---------------------------------------------------------------------------
// Public: buildPhase
// ---------------------------------------------------------------------------

/**
 * Build phase-layer context entries for the given phase.
 *
 * For each path in `triggers.phase_contexts[phaseId].inject`:
 *   1. Resolves the URI to text via uriResolver
 *   2. Summarizes entries that exceed the per-entry threshold
 *   3. Drops trailing entries (lowest priority) if total still exceeds budget
 *
 * @param layout - Loaded HarnessLayout
 * @param phaseId - Currently active phase
 * @param policy - Active ContextLoadingPolicy
 * @param triggers - Loaded PhaseTriggers
 * @param graphifyResolver - Optional injectable graphify resolver (for tests)
 * @returns Array of phase ContextEntry objects
 */
export async function buildPhase(
  layout: HarnessLayout,
  phaseId: PhaseId,
  policy: ContextLoadingPolicy = defaultPolicy(),
  triggers: PhaseTriggers,
  graphifyResolver?: GraphifyResolver,
): Promise<ContextEntry[]> {
  const phaseCtx = triggers.phase_contexts[phaseId]
  if (!phaseCtx || phaseCtx.inject.length === 0) return []

  const summarizeThreshold = parseSummarizeThreshold(
    phaseCtx.summarize_if_over,
    policy.summarizeIfOverTokens,
  )

  // Production default: wire createGraphifyResolver so users get the real graphify
  // automatically; tests continue to pass injectedResolver from the caller.
  const effectiveGraphifyResolver: GraphifyResolver =
    graphifyResolver ?? createGraphifyResolver({ workspacePath: path.dirname(layout.rootDir) })

  const entries: ContextEntry[] = []

  for (const source of phaseCtx.inject) {
    let content: string
    try {
      content = await resolveUri(source, {
        workspacePath: path.dirname(layout.rootDir),
        graphifyResolver: effectiveGraphifyResolver,
      })
    } catch {
      // Skip unresolvable sources (file missing, etc.)
      continue
    }

    const tokens = approxTokens(content)
    const needsSummarize = tokens > summarizeThreshold
    const finalContent = needsSummarize ? summarize(content, summarizeThreshold) : content

    entries.push({
      layer: 'phase',
      phases: [phaseId],
      path: source,
      content: finalContent,
      approxTokens: approxTokens(finalContent),
      summarized: needsSummarize,
    })
  }

  // Enforce total phase budget: drop trailing (lowest-priority) entries
  const budget = policy.budget.phase
  let total = entries.reduce((sum, e) => sum + e.approxTokens, 0)

  while (total > budget && entries.length > 0) {
    const dropped = entries.pop()!
    total -= dropped.approxTokens
  }

  return entries
}

// ---------------------------------------------------------------------------
// Public: buildOnDemand
// ---------------------------------------------------------------------------

/**
 * Build on-demand context entries by searching the glossary for matching sections.
 *
 * Searches `harness/context/on-demand-glossary.md` for headings whose text
 * contains the query keyword(s). Returns the matching sections (heading + body)
 * capped to the onDemand budget.
 *
 * @param layout - Loaded HarnessLayout
 * @param query - Search query (keyword or phrase)
 * @param policy - Active ContextLoadingPolicy
 * @returns Array of on-demand ContextEntry objects
 */
export async function buildOnDemand(
  layout: HarnessLayout,
  query: string,
  policy: ContextLoadingPolicy = defaultPolicy(),
): Promise<ContextEntry[]> {
  const glossaryPath = layout.context.onDemandGlossary
  if (!glossaryPath) return []

  const raw = await readFileOrNull(glossaryPath)
  if (!raw) return []

  const budget = policy.budget.onDemand
  const queryLower = query.toLowerCase()
  const keywords = queryLower.split(/\s+/).filter(Boolean)

  // Split glossary into sections by headings
  const sections: Array<{ heading: string; body: string }> = []
  const lines = raw.split('\n')
  let currentHeading: string | null = null
  let currentBody: string[] = []

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (currentHeading !== null) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
      }
      currentHeading = line
      currentBody = []
    } else {
      if (currentHeading !== null) currentBody.push(line)
    }
  }
  if (currentHeading !== null) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
  }

  // Match sections where heading contains at least one keyword
  const matched: Array<{ heading: string; body: string }> = sections.filter(s => {
    const headingLower = s.heading.toLowerCase()
    return keywords.some(kw => headingLower.includes(kw))
  })

  if (matched.length === 0) return []

  const entries: ContextEntry[] = []
  let usedTokens = 0

  for (const section of matched) {
    const sectionText = `${section.heading}\n\n${section.body}`
    const sectionTokens = approxTokens(sectionText)

    if (usedTokens + sectionTokens > budget) break // respect budget

    entries.push({
      layer: 'on-demand',
      path: path.relative(path.dirname(layout.rootDir), glossaryPath).replace(/\\/g, '/'),
      content: sectionText,
      approxTokens: sectionTokens,
      summarized: false,
    })
    usedTokens += sectionTokens
  }

  return entries
}

// ---------------------------------------------------------------------------
// Public: buildSnapshot
// ---------------------------------------------------------------------------

export type SnapshotOptions = {
  workspacePath: string
  layout: HarnessLayout
  phaseId: PhaseId | null
  role: RoleId | null
  query?: string
  policy?: ContextLoadingPolicy
  triggers?: PhaseTriggers
  graphifyResolver?: GraphifyResolver
}

/**
 * Compose a full ContextSnapshot from all three layers.
 *
 * Calls buildSession + buildPhase + buildOnDemand and merges the results
 * into a single snapshot, computing budgetUsed per layer.
 *
 * @param opts - Snapshot options
 * @returns Full ContextSnapshot
 */
export async function buildSnapshot(opts: SnapshotOptions): Promise<ContextSnapshot> {
  const {
    layout,
    phaseId,
    role,
    query,
    policy = defaultPolicy(),
    triggers = { version: 1, phase_contexts: {} },
    graphifyResolver,
  } = opts

  // Layer 1: Session
  const sessionEntries = await buildSession(layout, policy)

  // Layer 2: Phase
  const phaseEntries =
    phaseId != null
      ? await buildPhase(layout, phaseId, policy, triggers, graphifyResolver)
      : []

  // Layer 3: On-demand
  const onDemandEntries =
    query != null && query.trim().length > 0
      ? await buildOnDemand(layout, query, policy)
      : []

  const allEntries = [...sessionEntries, ...phaseEntries, ...onDemandEntries]

  const sessionTokens = sessionEntries.reduce((s, e) => s + e.approxTokens, 0)
  const phaseTokens = phaseEntries.reduce((s, e) => s + e.approxTokens, 0)
  const onDemandTokens = onDemandEntries.reduce((s, e) => s + e.approxTokens, 0)

  return {
    phase: phaseId,
    role,
    entries: allEntries,
    totalTokens: sessionTokens + phaseTokens + onDemandTokens,
    budgetUsed: {
      session: sessionTokens,
      phase: phaseTokens,
      onDemand: onDemandTokens,
    },
  }
}
