/**
 * skillBridge.ts
 *
 * Phase 3 helper — builds an env context block for ANY skill
 * (/newproject, /modernize, /systest, deployment skills).
 *
 * Loads the active env, resolves it, and renders a Markdown block that the
 * skill prepends to its SKILL_PROMPT.  All env context injection is
 * BEST-EFFORT; on any failure the skill continues without env context.
 */

import type { SkillEnvContext } from './deployment/types.js'
import { getActiveEnv } from './activeEnv.js'
import { loadEnvironments, loadInfraFile, resolveEnvByName, resolveExtendsChain } from './loader.js'
import { resolveEnvironment } from './resolver.js'
import { buildContextBlock } from './contextInjector.js'
import { EnvManagerError } from './types.js'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an env context block for ANY skill (newproject / modernize / systest /
 * deployment skills).  Loads active env, resolves it, and renders a Markdown
 * block that the skill prepends to its SKILL_PROMPT.
 *
 * Failure modes (returns ok=false):
 *   - no active env set
 *   - environments.yaml missing
 *   - env resolution failed (missing required var)
 *
 * On any failure the skill should still run — the env context is best-effort.
 */
export async function buildEnvContextForSkill(
  skillName: string,
  workspacePath: string,
  options?: {
    /** Override the env name; defaults to active env from session state */
    envOverride?: string
    /** Skip secret resolution entirely (avoids OS prompts during dry-run) */
    varsOnly?: boolean
  },
): Promise<SkillEnvContext> {
  const empty: SkillEnvContext = { block: '', envVars: {}, ok: false }

  try {
    // Resolve the env name: explicit override wins over session state
    const envName = options?.envOverride ?? getActiveEnv().envName

    if (!envName) {
      return {
        ...empty,
        reason: 'No active environment is set. Run `/env use <name>` to activate one.',
      }
    }

    // Load environments.yaml
    let envFile
    try {
      envFile = await loadEnvironments(workspacePath)
    } catch (err) {
      const msg = err instanceof EnvManagerError ? err.message : String(err)
      return {
        ...empty,
        reason: `environments.yaml missing or invalid: ${msg}`,
      }
    }

    // Find and resolve extends chain
    const rawEnv = resolveEnvByName(envName, envFile)
    const mergedEnv = resolveExtendsChain(rawEnv, envFile.environments)

    // Load infra (best-effort — returns empty InfraFile if missing)
    const infra = await loadInfraFile(workspacePath)

    // Resolve vars (and optionally secrets)
    let resolvedEnv
    try {
      resolvedEnv = await resolveEnvironment(mergedEnv, infra, {
        offline: options?.varsOnly === true,
      })
    } catch (err) {
      const msg = err instanceof EnvManagerError ? err.message : String(err)
      return {
        ...empty,
        reason: `Env resolution failed for "${envName}": ${msg}`,
      }
    }

    // Build the base context block via the shared injector
    const baseBlock = buildContextBlock(resolvedEnv)

    // Add skill-name-aware framing
    const block = renderSkillBlock(skillName, envName, baseBlock, resolvedEnv.secretRefs)

    const tags = resolvedEnv.tags ?? []
    return {
      block,
      envVars: resolvedEnv.envVars,
      ok: true,
      envName,
      tags,
      isProduction: tags.includes('production'),
    }
  } catch (err) {
    // Defensive catch — never let env context fail a skill
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ...empty,
      reason: `Unexpected error building env context: ${msg}`,
    }
  }
}

/**
 * Convenience: parse `--env <name>` from a CLI-style args string.
 * Returns the env name + the args without the --env flag.
 */
export function extractEnvFlag(args: string): { envName?: string; rest: string } {
  // Match --env followed by a non-whitespace value
  const match = args.match(/(?:^|\s)--env\s+(\S+)/)
  if (!match) {
    return { envName: undefined, rest: args }
  }

  const envName = match[1]
  // Remove the matched --env <name> fragment and normalise whitespace
  const rest = args
    .replace(/(?:^|\s)--env\s+\S+/, ' ')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { envName, rest }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function renderSkillBlock(
  skillName: string,
  envName: string,
  baseBlock: string,
  secretRefs: string[],
): string {
  const lines: string[] = []

  lines.push(`## Skill: ${skillName} running in env=${envName}`)
  lines.push('')
  lines.push(baseBlock)
  lines.push('')
  lines.push('### Skill-specific guidance')

  if (secretRefs.length > 0) {
    lines.push(
      `- When this skill needs DB access, use ` +
        `\${var:DB_USER_*}/\${secret:DB_PASS_*}`,
    )
    lines.push(
      `- Available secret refs (values never exposed to AI): ${secretRefs.join(', ')}`,
    )
  } else {
    lines.push('- No secret refs registered for this env.')
  }

  lines.push(
    `- When deploying, use deploy.skill from the env config (see ENV block above)`,
  )

  return lines.join('\n')
}
