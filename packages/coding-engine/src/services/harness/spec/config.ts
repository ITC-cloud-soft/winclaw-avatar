/**
 * config.ts — Feature-flag configuration for Harness spec-kit integration (v3.1.0)
 *
 * Environment variables:
 *   METACODER_HARNESS_SPEC_MODE=off     master kill: all new features become no-ops
 *   METACODER_HARNESS_CONSTITUTION=off  disable constitution generation/validation
 *   METACODER_HARNESS_CLARIFY=off       disable [NEEDS CLARIFICATION] detection
 *   METACODER_HARNESS_PER_FEATURE=off   disable per-feature spec scaffolding
 *   METACODER_HARNESS_ANALYZE=off       disable cross-artifact analysis
 *   METACODER_HARNESS_AUTO_TASKS=off    disable auto tasks.md generation
 */

export interface HarnessSpecFeatures {
  constitution: boolean
  clarify: boolean
  perFeature: boolean
  analyze: boolean
  autoTasks: boolean
}

export interface HarnessSpecConfig {
  enabled: boolean
  features: HarnessSpecFeatures
}

function resolveFlag(envVar: string, masterOff: boolean): boolean {
  if (masterOff) return false
  return (process.env[envVar] ?? '').toLowerCase() !== 'off'
}

/**
 * Returns current feature-flag configuration, derived from environment variables.
 * Default: all features ON (v3.1.0 mode).
 * When METACODER_HARNESS_SPEC_MODE=off: all features OFF (v3.0.2 compat mode).
 */
export function getHarnessSpecConfig(): HarnessSpecConfig {
  const masterOff =
    (process.env['METACODER_HARNESS_SPEC_MODE'] ?? '').toLowerCase() === 'off'

  const enabled = !masterOff

  return {
    enabled,
    features: {
      constitution: resolveFlag('METACODER_HARNESS_CONSTITUTION', masterOff),
      clarify: resolveFlag('METACODER_HARNESS_CLARIFY', masterOff),
      perFeature: resolveFlag('METACODER_HARNESS_PER_FEATURE', masterOff),
      analyze: resolveFlag('METACODER_HARNESS_ANALYZE', masterOff),
      autoTasks: resolveFlag('METACODER_HARNESS_AUTO_TASKS', masterOff),
    },
  }
}
