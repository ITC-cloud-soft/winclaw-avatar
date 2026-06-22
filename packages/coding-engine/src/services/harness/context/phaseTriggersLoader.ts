/**
 * phaseTriggersLoader.ts — Load and validate the phase-triggers.yaml file.
 *
 * Reads `harness/context/phase-triggers.yaml` and parses it into a
 * `PhaseTriggers` object. Tolerates a missing file (returns safe defaults)
 * and provides light structural validation.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { PhaseTriggers, PhaseId } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Safe default (missing file or empty yaml)
// ---------------------------------------------------------------------------

const EMPTY_TRIGGERS: PhaseTriggers = {
  version: 1,
  phase_contexts: {},
}

// ---------------------------------------------------------------------------
// Known phase ids for validation
// ---------------------------------------------------------------------------

const KNOWN_PHASES = new Set<string>([
  'requirements',
  'design',
  'test-spec',
  'implementation',
  'code-review',
  'integration-test',
  'performance',
  'security',
  'deploy-plan',
  'confirm',
])

// ---------------------------------------------------------------------------
// Minimal YAML parser for phase-triggers.yaml
// ---------------------------------------------------------------------------
//
// Format (§10.2 spec):
//
//   version: 1
//   phase_contexts:
//     design:
//       inject:
//         - harness/rules/architecture.md
//       summarize_if_over: "1500 tokens"
//     implementation:
//       inject:
//         - harness/rules/coding.md
//

type RawPhaseContext = {
  inject: string[]
  summarize_if_over?: string
}

type RawTriggers = {
  version?: number
  phase_contexts?: Record<string, RawPhaseContext>
}

/** Extract leading spaces to determine indent level. */
function indentLevel(line: string): number {
  const m = line.match(/^(\s+)/)
  return m ? m[1].length : 0
}

function parsePhaseTriggersYaml(raw: string): RawTriggers {
  const result: RawTriggers = {}
  const lines = raw.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()

    if (!stripped || stripped.startsWith('#')) {
      i++
      continue
    }

    const versionMatch = stripped.match(/^version:\s*(\d+)$/)
    if (versionMatch) {
      result.version = parseInt(versionMatch[1], 10)
      i++
      continue
    }

    if (stripped === 'phase_contexts:') {
      result.phase_contexts = {}
      i++

      // Parse phase blocks
      while (i < lines.length) {
        const phaseLine = lines[i]
        const phaseStripped = phaseLine.trim()

        if (!phaseStripped || phaseStripped.startsWith('#')) {
          i++
          continue
        }

        // Must be at indent 2 (2 spaces)
        const phaseIndent = indentLevel(phaseLine)
        if (phaseIndent === 0) break // back to top level

        const phaseMatch = phaseStripped.match(/^([\w-]+):$/)
        if (!phaseMatch) {
          i++
          continue
        }

        const phaseId = phaseMatch[1]
        const phaseContext: RawPhaseContext = { inject: [] }
        i++

        // Parse inject / summarize_if_over under this phase
        let inInjectList = false
        while (i < lines.length) {
          const propLine = lines[i]
          const propStripped = propLine.trim()
          const propIndent = indentLevel(propLine)

          if (!propStripped || propStripped.startsWith('#')) {
            i++
            continue
          }

          // Back to phase level or higher = done with this phase
          if (propIndent <= phaseIndent) break

          if (propStripped === 'inject:') {
            inInjectList = true
            i++
            continue
          }

          if (inInjectList && propStripped.startsWith('- ')) {
            phaseContext.inject.push(propStripped.slice(2).trim())
            i++
            continue
          }

          const summarizeMatch = propStripped.match(/^summarize_if_over:\s*"?(.+?)"?$/)
          if (summarizeMatch) {
            inInjectList = false
            phaseContext.summarize_if_over = summarizeMatch[1].trim()
            i++
            continue
          }

          inInjectList = false
          i++
        }

        result.phase_contexts[phaseId] = phaseContext
      }
      continue
    }

    i++
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and validate `harness/context/phase-triggers.yaml`.
 *
 * Returns `{ version: 1, phase_contexts: {} }` when:
 * - The file does not exist
 * - The file is empty
 * - The file cannot be parsed
 *
 * Unknown phase ids are skipped with no error (forward-compatible).
 *
 * @param workspacePath - Absolute path to the workspace root
 * @returns Validated PhaseTriggers object
 */
export async function loadPhaseTriggers(workspacePath: string): Promise<PhaseTriggers> {
  const filePath = path.join(workspacePath, 'harness', 'context', 'phase-triggers.yaml')

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return { ...EMPTY_TRIGGERS, phase_contexts: {} }
  }

  if (!raw.trim()) {
    return { ...EMPTY_TRIGGERS, phase_contexts: {} }
  }

  let parsed: RawTriggers
  try {
    parsed = parsePhaseTriggersYaml(raw)
  } catch {
    return { ...EMPTY_TRIGGERS, phase_contexts: {} }
  }

  const result: PhaseTriggers = {
    version: parsed.version ?? 1,
    phase_contexts: {},
  }

  for (const [rawPhase, ctx] of Object.entries(parsed.phase_contexts ?? {})) {
    if (!KNOWN_PHASES.has(rawPhase)) continue // skip unknown phases
    const phaseId = rawPhase as PhaseId
    result.phase_contexts[phaseId] = {
      inject: Array.isArray(ctx.inject) ? ctx.inject.filter(s => typeof s === 'string') : [],
      ...(ctx.summarize_if_over != null ? { summarize_if_over: ctx.summarize_if_over } : {}),
    }
  }

  return result
}
