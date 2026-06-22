/**
 * Phase 5 — Deployment skill orchestrator types.
 *
 * Implements §9.4, §17 of v2.2 design.
 *
 * Layers:
 *   1. Skill catalog — central registry of the 6 existing deployment skills
 *      with tested status, known pitfalls, supported intents/providers
 *   2. Skill contract — input/output types for orchestrator ↔ skill
 *   3. Orchestrator — given active env, picks the right skill and dispatches
 *   4. Verified-state injector — loads .metacoder/verified-state.yaml
 *      and renders an AI context block with cluster IDs + pitfalls
 */

import type { Env, ResolvedEnv, DeploySkillName, VerifiedStateFile } from '../types.js'

// ---------------------------------------------------------------------------
// 1. Skill catalog
// ---------------------------------------------------------------------------

/**
 * Metadata for one deployment skill. Mirrors §17.4 of v2.2 spec.
 *
 * The catalog is held in TypeScript (skillCatalog.ts) so the runtime can
 * enforce policy (tested gate, age warning) without parsing external
 * SKILL.md files.  External SKILL.md files remain the authoritative
 * documentation; this is the runtime mirror.
 */
export type SkillCatalogEntry = {
  name: DeploySkillName
  description: string
  /** Path to the SKILL.md file (informational; AI uses Skill tool to invoke) */
  skillPath: string
  /** Has this skill been verified end-to-end against a real env? */
  tested: boolean
  /** Names of envs / projects where the skill was verified */
  verifiedEnvs: string[]
  /** ISO date of last verification */
  lastVerified?: string
  /** Runtime contract version this skill speaks */
  contractVersion: 1
  /** Which intents this skill supports */
  supports: {
    intents: SkillIntent[]
    providers: ProviderName[]
    deployTargets: string[]
  }
  /** Known pitfalls auto-loaded into AI context for this skill */
  knownPitfalls: SkillPitfall[]
}

export type SkillIntent = 'deploy' | 'rollback' | 'verify' | 'destroy'
export type ProviderName = 'azure' | 'aws' | 'aliyun' | 'gcp' | 'on-prem'

export type SkillPitfall = {
  id: string
  summary: string
  /** Optional mitigation guidance shown alongside the pitfall */
  mitigation?: string
}

// ---------------------------------------------------------------------------
// 2. Skill contract — orchestrator ↔ skill
// ---------------------------------------------------------------------------

export type DeploymentSkillInput = {
  projectRoot: string
  /** active env (post-extends, post-var-resolution) */
  activeEnv: ResolvedEnv
  /** Resolved env vars suitable for child process injection.
   *  Includes secret values — but these never reach the AI context. */
  envVars: Record<string, string>
  intent: SkillIntent
  /** Reason supplied by the user (required for production envs) */
  reason?: string
  /** Skill-specific options */
  options?: Record<string, unknown>
}

export type DeploymentSkillOutput = {
  status: 'success' | 'failure' | 'partial' | 'cancelled'
  skill: DeploySkillName
  intent: SkillIntent
  /** Phases that completed successfully */
  phasesCompleted: string[]
  /** Resource IDs created (Azure resource ID, AWS ARN, k8s deployment, etc.) */
  artifactsCreated: string[]
  /** REQUIRED: how to undo this if needed.  Empty string only if intent=verify */
  rollbackPlan: string
  durationSeconds: number
  warnings: string[]
  errors: string[]
}

// ---------------------------------------------------------------------------
// 3. Orchestrator
// ---------------------------------------------------------------------------

export type DispatchOptions = {
  /** Override the env's deploy.skill (rare; for debugging) */
  skillOverride?: DeploySkillName
  /** Required reason for production / write intents */
  reason?: string
  /** Dry-run: build the input + load verified state + classify, but don't execute */
  dryRun?: boolean
  /** Workspace path; defaults to process.cwd() */
  workspacePath?: string
}

export type DispatchPlan = {
  skill: DeploySkillName
  catalogEntry: SkillCatalogEntry
  intent: SkillIntent
  envContext: string                            // Markdown block for AI prompt
  envVars: Record<string, string>               // Resolved, NOT shown to AI
  warnings: string[]                            // Soft warnings (e.g. last_verified > 90 days)
  errors: string[]                              // Hard blockers (e.g. tested=false on prod)
  /** Resolved env name + tags for executor + audit log.
   *  Reviewer #2 fix: avoids re-loading + hard-coded provider in execute(). */
  envName: string
  envTags: string[]
  envProvider: ProviderName                      // resolvedEnv.cloud.provider
  envSafety: 'allow' | 'confirm' | 'deny'        // resolvedEnv.safety.destructive_ops
}

// ---------------------------------------------------------------------------
// 4. Errors
// ---------------------------------------------------------------------------

export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'skill-not-in-catalog'
      | 'untested-skill-on-production'
      | 'last-verified-too-old'
      | 'unsupported-intent'
      | 'unsupported-provider'
      | 'env-not-active'
      | 'env-vars-resolution-failed'
      | 'rollback-plan-required'
      | 'dispatch-aborted',
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'DeploymentError'
  }
}

// ---------------------------------------------------------------------------
// Cross-phase: Skill bridge (Phase 3) — env context for ANY skill
// ---------------------------------------------------------------------------

/**
 * Phase 3 helper used by /newproject, /modernize, /systest.
 * Builds a Markdown block describing the active env (compact form) that
 * the skill prepends to its SKILL_PROMPT.  Reuses the contextInjector
 * but adds skill-name-aware framing.
 */
export type SkillEnvContext = {
  /** Markdown block for AI prompt */
  block: string
  /** Same env vars as DeploymentSkillInput.envVars (for child proc injection) */
  envVars: Record<string, string>
  /** Whether the active env exists and was resolved */
  ok: boolean
  /** If !ok, why */
  reason?: string
  /** Active env name (resolved or override). Empty if !ok. */
  envName?: string
  /** Tags from the resolved env. Empty array if !ok. */
  tags?: string[]
  /** Convenience: true iff tags includes 'production'.
   *  Spec §1.5.1: production gates must check this structured flag,
   *  NOT pattern-match the Markdown block. */
  isProduction?: boolean
}
