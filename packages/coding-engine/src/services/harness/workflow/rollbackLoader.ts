/**
 * workflow/rollbackLoader.ts — Load harness/workflow/rollback.yaml into RollbackPolicy.
 *
 * Applies defaults:
 *   max_attempts : 3
 *   after_max    : 'human-approval-required'
 *   audit        : true
 *
 * Returns null gracefully when the file is absent.
 * Throws HarnessError('invalid-yaml') for malformed content.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'yaml'
import type { RollbackPolicy, RollbackPerPhasePolicy } from '../standardTypes.js'
import type { PhaseId } from '../standardTypes.js'
import { HarnessError } from '../types.js'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_AFTER_MAX: RollbackPolicy['default']['after_max'] = 'human-approval-required'
const DEFAULT_AUDIT = true

const VALID_AFTER_MAX = new Set<string>([
  'human-approval-required',
  'emergency-rollback-deploy',
  'abort',
])

const VALID_PHASE_IDS = new Set<PhaseId>([
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
// Internal helpers
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceAfterMax(
  v: unknown,
  context: string,
): RollbackPolicy['default']['after_max'] {
  if (v === undefined || v === null) return DEFAULT_AFTER_MAX
  if (typeof v !== 'string' || !VALID_AFTER_MAX.has(v)) {
    throw new HarnessError(
      `${context}: "after_max" must be one of ${[...VALID_AFTER_MAX].join(', ')}; got "${String(v)}"`,
      'invalid-yaml',
    )
  }
  return v as RollbackPolicy['default']['after_max']
}

function coercePerPhasePolicy(
  v: unknown,
  phaseId: string,
  filePath: string,
): RollbackPerPhasePolicy {
  if (!isRecord(v)) {
    throw new HarnessError(
      `${filePath}: per_phase["${phaseId}"] must be a mapping`,
      'invalid-yaml',
    )
  }
  const policy: RollbackPerPhasePolicy = {}

  if (v['target'] !== undefined) {
    const target = String(v['target'])
    if (!VALID_PHASE_IDS.has(target as PhaseId)) {
      throw new HarnessError(
        `${filePath}: per_phase["${phaseId}"].target "${target}" is not a valid PhaseId`,
        'invalid-yaml',
      )
    }
    policy.target = target as PhaseId
  }

  if (v['max_attempts'] !== undefined) {
    const n = Number(v['max_attempts'])
    if (!Number.isInteger(n) || n < 1) {
      throw new HarnessError(
        `${filePath}: per_phase["${phaseId}"].max_attempts must be a positive integer`,
        'invalid-yaml',
      )
    }
    policy.max_attempts = n
  }

  if (v['after_max'] !== undefined) {
    policy.after_max = coerceAfterMax(
      v['after_max'],
      `${filePath}: per_phase["${phaseId}"]`,
    )
  }

  return policy
}

// ---------------------------------------------------------------------------
// Public: loadRollbackPolicy
// ---------------------------------------------------------------------------

/**
 * Load `harness/workflow/rollback.yaml` from the given workspace.
 *
 * Returns a `RollbackPolicy` with defaults applied for any missing field.
 * Returns `null` when the file does not exist (harness not initialized).
 * Throws `HarnessError('invalid-yaml')` for malformed content.
 */
export async function loadRollbackPolicy(workspacePath: string): Promise<RollbackPolicy | null> {
  const filePath = path.join(workspacePath, 'harness', 'workflow', 'rollback.yaml')

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }

  let parsed: unknown
  try {
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

  if (!isRecord(parsed)) {
    throw new HarnessError(
      `${filePath}: top-level value must be a YAML mapping`,
      'invalid-yaml',
    )
  }

  // Parse the optional "default" block
  const defaultBlock = parsed['default']
  let maxAttempts = DEFAULT_MAX_ATTEMPTS
  let afterMax = DEFAULT_AFTER_MAX
  let audit = DEFAULT_AUDIT

  if (defaultBlock !== undefined) {
    if (!isRecord(defaultBlock)) {
      throw new HarnessError(
        `${filePath}: "default" must be a mapping`,
        'invalid-yaml',
      )
    }

    if (defaultBlock['max_attempts'] !== undefined) {
      const n = Number(defaultBlock['max_attempts'])
      if (!Number.isInteger(n) || n < 1) {
        throw new HarnessError(
          `${filePath}: default.max_attempts must be a positive integer`,
          'invalid-yaml',
        )
      }
      maxAttempts = n
    }

    afterMax = coerceAfterMax(defaultBlock['after_max'], `${filePath}: default`)

    if (defaultBlock['audit'] !== undefined) {
      audit = Boolean(defaultBlock['audit'])
    }
  }

  // Parse optional per_phase block
  let perPhase: RollbackPolicy['per_phase'] | undefined

  if (parsed['per_phase'] !== undefined) {
    if (!isRecord(parsed['per_phase'])) {
      throw new HarnessError(
        `${filePath}: "per_phase" must be a mapping`,
        'invalid-yaml',
      )
    }
    perPhase = {}
    for (const [phaseId, phasePolicy] of Object.entries(parsed['per_phase'])) {
      if (!VALID_PHASE_IDS.has(phaseId as PhaseId)) {
        throw new HarnessError(
          `${filePath}: per_phase key "${phaseId}" is not a valid PhaseId`,
          'invalid-yaml',
        )
      }
      perPhase[phaseId as PhaseId] = coercePerPhasePolicy(phasePolicy, phaseId, filePath)
    }
  }

  const policy: RollbackPolicy = {
    default: {
      max_attempts: maxAttempts,
      after_max: afterMax,
      audit,
    },
    ...(perPhase ? { per_phase: perPhase } : {}),
  }

  return policy
}
