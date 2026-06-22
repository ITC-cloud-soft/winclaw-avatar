/**
 * workflow/phasesLoader.ts — Load and validate harness/workflow/phases.yaml
 *
 * Returns null gracefully when the file is absent (harness not initialized).
 * Throws HarnessError('invalid-yaml') for structurally bad YAML.
 * Validates that every `next` and `rollback_to` reference resolves to a known
 * phase id or is null.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'yaml'
import type { PhasesConfig, PhaseDefinition } from '../types.js'
import { HarnessError } from '../types.js'
import { CANONICAL_PHASE_IDS } from './phaseState.js'

// ---------------------------------------------------------------------------
// Internal: shape-guards for parsed YAML
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPhaseDefinitionRaw(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false
  if (typeof v['id'] !== 'string') return false
  if (typeof v['name'] !== 'string') return false
  return true
}

/**
 * Validate and coerce a raw YAML value into `PhasesConfig`.
 * Throws HarnessError('invalid-yaml') with a descriptive message on failure.
 */
function coercePhasesConfig(raw: unknown, filePath: string): PhasesConfig {
  if (!isRecord(raw)) {
    throw new HarnessError(
      `${filePath}: top-level value must be a YAML mapping`,
      'invalid-yaml',
    )
  }

  const version = typeof raw['version'] === 'number' ? raw['version'] : 1

  if (typeof raw['default_phase'] !== 'string') {
    throw new HarnessError(
      `${filePath}: missing required field "default_phase"`,
      'invalid-yaml',
    )
  }
  const defaultPhase = raw['default_phase'] as string

  if (!Array.isArray(raw['phases'])) {
    throw new HarnessError(
      `${filePath}: "phases" must be a YAML sequence`,
      'invalid-yaml',
    )
  }

  const phases: PhaseDefinition[] = (raw['phases'] as unknown[]).map((entry, idx) => {
    if (!isPhaseDefinitionRaw(entry)) {
      throw new HarnessError(
        `${filePath}: phases[${idx}] must be a mapping with "id" and "name" strings`,
        'invalid-yaml',
      )
    }
    const next = entry['next'] === null || entry['next'] === undefined
      ? null
      : String(entry['next'])
    const rollback_to = entry['rollback_to'] === null || entry['rollback_to'] === undefined
      ? null
      : String(entry['rollback_to'])

    const gate = entry['gate'] !== undefined ? String(entry['gate']) : undefined
    const roleRaw = entry['role']
    const role =
      roleRaw === 'pm' || roleRaw === 'developer' || roleRaw === 'reviewer' || roleRaw === 'tester'
        ? roleRaw
        : undefined

    return {
      id: String(entry['id']),
      name: String(entry['name']),
      next,
      rollback_to,
      ...(gate !== undefined ? { gate } : {}),
      ...(role !== undefined ? { role } : {}),
    } satisfies PhaseDefinition
  })

  // Validate cross-references
  const phaseIds = new Set(phases.map(p => p.id))

  // Enforce canonical phase ids — the 10-phase pipeline is design-mandated.
  // Renaming phases (e.g. `review` → `code-review`, `done` → `confirm`) breaks
  // the state machine because phaseState.coercePhaseId rejects unknown ids.
  // We fail loudly here instead of silently coercing later.
  const canonical = new Set<string>(CANONICAL_PHASE_IDS)
  const invalidIds = phases.map(p => p.id).filter(id => !canonical.has(id))
  if (invalidIds.length > 0) {
    throw new HarnessError(
      `${filePath}: non-canonical phase id(s) [${invalidIds.join(', ')}]. ` +
      `Harness Engineering requires the 10 canonical ids: ` +
      `${CANONICAL_PHASE_IDS.join(', ')}. ` +
      `Rename your phases (typical mappings: review→code-review, done→confirm, ` +
      `verification→test-spec) and update phases.yaml / gates.yaml / ` +
      `phase-triggers.yaml accordingly.`,
      'invalid-yaml',
    )
  }

  if (!phaseIds.has(defaultPhase)) {
    throw new HarnessError(
      `${filePath}: default_phase "${defaultPhase}" does not resolve to any phase id`,
      'invalid-yaml',
    )
  }

  for (const p of phases) {
    if (p.next !== null && !phaseIds.has(p.next)) {
      throw new HarnessError(
        `${filePath}: phase "${p.id}" has next="${p.next}" which does not resolve to any known phase id`,
        'invalid-yaml',
      )
    }
    if (p.rollback_to !== null && !phaseIds.has(p.rollback_to)) {
      throw new HarnessError(
        `${filePath}: phase "${p.id}" has rollback_to="${p.rollback_to}" which does not resolve to any known phase id`,
        'invalid-yaml',
      )
    }
  }

  return { version, default_phase: defaultPhase, phases }
}

// ---------------------------------------------------------------------------
// Public: loadPhasesConfig
// ---------------------------------------------------------------------------

/**
 * Load `harness/workflow/phases.yaml` from the given workspace.
 *
 * Returns `null` if the file does not exist (harness not initialized).
 * Throws `HarnessError('invalid-yaml')` for malformed content.
 */
export async function loadPhasesConfig(workspacePath: string): Promise<PhasesConfig | null> {
  const filePath = path.join(workspacePath, 'harness', 'workflow', 'phases.yaml')

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }

  let parsed: unknown
  try {
    // Use Document mode so we can surface line information in the future
    const doc = yaml.parseDocument(raw)
    if (doc.errors && doc.errors.length > 0) {
      const msgs = doc.errors.map(e => e.message).join('; ')
      throw new HarnessError(
        `${filePath}: YAML parse error — ${msgs}`,
        'invalid-yaml',
      )
    }
    parsed = doc.toJS()
  } catch (err) {
    if (err instanceof HarnessError) throw err
    throw new HarnessError(
      `${filePath}: failed to parse YAML — ${err instanceof Error ? err.message : String(err)}`,
      'invalid-yaml',
    )
  }

  return coercePhasesConfig(parsed, filePath)
}
