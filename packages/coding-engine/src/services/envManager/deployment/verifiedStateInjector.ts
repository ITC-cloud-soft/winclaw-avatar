/**
 * verifiedStateInjector.ts
 *
 * Renders Markdown context blocks from verified-state.yaml data combined
 * with the skill catalog's built-in pitfall list.
 *
 * Output is inserted into the AI prompt before skill invocation so the
 * model has authoritative cluster IDs, endpoint names, and pitfall guidance.
 *
 * §9.4 / §17.6 of v2.2 spec.
 */

import type { VerifiedStateFile, VerifiedEnvState } from '../types.js'
import type { SkillCatalogEntry, SkillPitfall } from './types.js'

// ---------------------------------------------------------------------------
// Public: selectPitfalls
// ---------------------------------------------------------------------------

/**
 * Combine pitfalls from two sources, deduplicate by id, and cap the list.
 *
 * Priority (first occurrence wins on id collision):
 *   1. envState.known_pitfalls (runtime / env-specific overrides)
 *   2. skill.knownPitfalls     (static catalog defaults)
 *
 * @param skill     - catalog entry containing base pitfall list
 * @param envState  - optional verified env state loaded from yaml
 * @param maxItems  - maximum pitfalls to return (default 15)
 */
export function selectPitfalls(
  skill: SkillCatalogEntry,
  envState?: VerifiedEnvState,
  maxItems = 15,
): Array<{ id: string; summary: string; mitigation?: string }> {
  const seen = new Set<string>()
  const result: Array<{ id: string; summary: string; mitigation?: string }> = []

  // env-level pitfalls (yaml) take priority
  const yamlPitfalls: Array<{ id: string; summary: string; mitigation?: string }> =
    Array.isArray(envState?.known_pitfalls) ? (envState!.known_pitfalls as Array<{ id: string; summary: string; mitigation?: string }>) : []

  for (const p of yamlPitfalls) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      result.push({ id: p.id, summary: p.summary, mitigation: p.mitigation })
    }
  }

  // catalog pitfalls fill remaining slots
  for (const p of skill.knownPitfalls) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      result.push({ id: p.id, summary: p.summary, mitigation: p.mitigation })
    }
  }

  return result.slice(0, maxItems)
}

// ---------------------------------------------------------------------------
// Public: renderVerifiedStateBlock
// ---------------------------------------------------------------------------

/**
 * Render a Markdown block describing the verified env state and the skill's
 * known pitfalls.
 *
 * Returns an empty string when both verifiedState and pitfalls list are absent.
 *
 * Output sections (when data present):
 *   ## Verified state for env=<name>
 *   ## Known pitfalls (must avoid)
 *
 * @param envName       - name of the environment being deployed to
 * @param verifiedState - parsed verified-state.yaml (null when file absent)
 * @param skill         - catalog entry for the skill being dispatched
 */
export function renderVerifiedStateBlock(
  envName: string,
  verifiedState: VerifiedStateFile | null,
  skill: SkillCatalogEntry,
): string {
  const lines: string[] = []

  // Locate this env's state in the verified-state file
  const envState: VerifiedEnvState | undefined =
    verifiedState != null
      ? (verifiedState as Record<string, unknown>)[envName] as VerifiedEnvState | undefined
      : undefined

  // ── Verified state section ─────────────────────────────────────────────────
  if (envState != null && verifiedState != null) {
    const lastVerified = verifiedState.last_verified ?? 'unknown date'
    const verifiedBy = verifiedState.last_verified_by ?? 'unknown'

    lines.push(
      `## 🔒 Verified state for env=${envName} (last verified: ${lastVerified} by ${verifiedBy})`,
    )

    if (envState.cluster) {
      const c = envState.cluster
      const parts: string[] = [c.type, c.id]
      if (c.region) parts.push(c.region)
      lines.push(`- Cluster: ${parts.join(' / ')}`)
    }

    if (envState.registry) {
      const r = envState.registry
      const url = r.instance ? `${r.url} (${r.instance})` : r.url
      lines.push(`- Registry: ${r.type} → ${url}`)
    }

    if (envState.database?.rds_instance) {
      lines.push(`- RDS: ${envState.database.rds_instance}`)
    } else if (envState.database?.cluster) {
      lines.push(`- DB cluster: ${envState.database.cluster}`)
    }

    if (envState.ingress) {
      const ing = envState.ingress
      const idPart = ing.id ? ` ${ing.id}` : ''
      const domainPart = ing.domain ? ` → ${ing.domain}` : ''
      lines.push(`- Ingress ALB:${idPart}${domainPart}`)
    }

    if (envState.network) {
      const n = envState.network
      if (n.vpc) lines.push(`- VPC: ${n.vpc}`)
      if (Array.isArray(n.alb_vswitches) && n.alb_vswitches.length > 0) {
        lines.push(`- ALB vSwitches: ${n.alb_vswitches.join(', ')}`)
      }
      if (n.eci_pod_vswitch) lines.push(`- ECI pod vSwitch: ${n.eci_pod_vswitch}`)
    }
  }

  // ── Pitfalls section ──────────────────────────────────────────────────────
  const pitfalls = selectPitfalls(skill, envState)

  if (pitfalls.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`## ⚠️ Known pitfalls (auto-loaded for skill \`${skill.name}\`)`)
    for (const p of pitfalls) {
      lines.push(`[${p.id}] ${p.summary}`)
      if (p.mitigation) {
        lines.push(`→ Mitigation: ${p.mitigation}`)
      }
    }
  }

  return lines.join('\n')
}
