/**
 * skillOrchestrator.ts
 *
 * Deployment skill orchestrator for the Meta Coder Infra Environment Manager.
 *
 * Responsibilities:
 *   1. plan()    — resolve env, look up skill, enforce policy gates, build
 *                  DispatchPlan (Markdown context + env vars + warnings)
 *   2. execute() — run the caller-supplied executor, write audit log before
 *                  and after, return DeploymentSkillOutput
 *   3. dispatch() — convenience wrapper: plan + execute in one call
 *
 * The orchestrator does NOT shell out or invoke skills directly.  Actual skill
 * invocation happens at the AI layer via Meta Coder's Skill tool; the
 * orchestrator only prepares the input and enforces policy.
 *
 * §9.4, §17 of v2.2 spec.
 */

import { getActiveEnv } from '../activeEnv.js'
import {
  loadEnvironments,
  loadInfraFile,
  resolveEnvByName,
  resolveExtendsChain,
  loadVerifiedState,
} from '../loader.js'
import { resolveEnvironment } from '../resolver.js'
import { buildContextBlock } from '../contextInjector.js'
import { logAudit } from '../safety/auditHelper.js'
import { getCatalogEntry } from './skillCatalog.js'
import { renderVerifiedStateBlock } from './verifiedStateInjector.js'
import {
  DeploymentError,
  type DispatchOptions,
  type DispatchPlan,
  type DeploymentSkillInput,
  type DeploymentSkillOutput,
  type SkillIntent,
} from './types.js'
import type { DeploySkillName } from '../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Days between two ISO date strings. Returns Infinity if either is invalid. */
function daysBetween(isoA: string, isoB: string): number {
  const a = Date.parse(isoA)
  const b = Date.parse(isoB)
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  return Math.abs(b - a) / (1000 * 60 * 60 * 24)
}

/** Today as YYYY-MM-DD in UTC. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Public: plan
// ---------------------------------------------------------------------------

/**
 * Build a DispatchPlan by:
 *   1. Resolving the workspace and active env
 *   2. Loading environments.yaml + infra.yaml
 *   3. Looking up the skill in the catalog
 *   4. Enforcing policy gates (tested, last_verified age, intent, provider)
 *   5. Rendering the envContext Markdown block (compact + verified state)
 *
 * Throws DeploymentError on hard policy violations.
 * Pushes warnings (non-fatal) into plan.warnings.
 */
export async function plan(
  options: DispatchOptions & { intent: SkillIntent },
): Promise<DispatchPlan> {
  const workspacePath = options.workspacePath ?? process.cwd()
  const warnings: string[] = []

  // ── Step 1: resolve env name ───────────────────────────────────────────────
  const activeState = getActiveEnv()
  const envName = activeState.envName

  if (!envName) {
    throw new DeploymentError(
      'No active environment is set. Run `/env use <name>` to activate one.',
      'env-not-active',
    )
  }

  // ── Step 2: load environments.yaml ────────────────────────────────────────
  const envFile = await loadEnvironments(workspacePath)
  const rawEnv = resolveEnvByName(envName, envFile)
  const mergedEnv = resolveExtendsChain(rawEnv, envFile.environments)

  // ── Step 3: load infra + resolve vars ────────────────────────────────────
  const infra = await loadInfraFile(workspacePath)
  const resolvedEnv = await resolveEnvironment(mergedEnv, infra)

  // ── Step 4: determine skill ────────────────────────────────────────────────
  const skillName: DeploySkillName | undefined =
    options.skillOverride ?? resolvedEnv.deploy?.skill

  if (!skillName) {
    throw new DeploymentError(
      `Environment "${envName}" has no deploy.skill configured and no skillOverride was supplied.`,
      'skill-not-in-catalog',
      { envName },
    )
  }

  // ── Step 5: catalog lookup ────────────────────────────────────────────────
  const catalogEntry = getCatalogEntry(skillName)
  if (!catalogEntry) {
    throw new DeploymentError(
      `Skill "${skillName}" is not registered in the skill catalog.`,
      'skill-not-in-catalog',
      { skillName },
    )
  }

  // ── Step 6: tested gate — production + tested=false → hard error ──────────
  const tags: string[] = Array.isArray(resolvedEnv.tags) ? resolvedEnv.tags : []
  const isProduction = tags.includes('production')

  if (isProduction && !catalogEntry.tested) {
    throw new DeploymentError(
      `Skill "${skillName}" has tested=false and cannot be used with production environment "${envName}".`,
      'untested-skill-on-production',
      { skillName, envName },
    )
  }

  // ── Step 7: last_verified age check — warning only ───────────────────────
  if (catalogEntry.lastVerified) {
    const age = daysBetween(catalogEntry.lastVerified, todayIso())
    if (age > 90) {
      warnings.push(
        `Skill "${skillName}" was last verified ${Math.floor(age)} days ago ` +
          `(${catalogEntry.lastVerified}). Consider re-verifying before a production deploy.`,
      )
    }
  }

  // ── Step 8: intent check ─────────────────────────────────────────────────
  if (!catalogEntry.supports.intents.includes(options.intent)) {
    throw new DeploymentError(
      `Skill "${skillName}" does not support intent "${options.intent}". ` +
        `Supported: ${catalogEntry.supports.intents.join(', ')}.`,
      'unsupported-intent',
      { skillName, intent: options.intent },
    )
  }

  // ── Step 9: provider match ────────────────────────────────────────────────
  const provider = resolvedEnv.cloud.provider
  if (!catalogEntry.supports.providers.includes(provider)) {
    throw new DeploymentError(
      `Skill "${skillName}" does not support provider "${provider}". ` +
        `Supported: ${catalogEntry.supports.providers.join(', ')}.`,
      'unsupported-provider',
      { skillName, provider },
    )
  }

  // ── Step 10: build envVars (secrets stay in the map, never in AI context) ─
  const envVars: Record<string, string> = { ...resolvedEnv.envVars }

  // ── Step 11: load verified state ─────────────────────────────────────────
  const verifiedStatePath = resolvedEnv.deploy?.verified_state
  const verifiedState = verifiedStatePath
    ? await loadVerifiedState(workspacePath, verifiedStatePath)
    : null

  // ── Step 12: render env context block ────────────────────────────────────
  const baseContext = buildContextBlock(resolvedEnv, verifiedState)
  const verifiedBlock = renderVerifiedStateBlock(envName, verifiedState, catalogEntry)

  const envContext = verifiedBlock
    ? `${baseContext}\n\n${verifiedBlock}`
    : baseContext

  // ── Return plan ───────────────────────────────────────────────────────────
  return {
    skill: skillName,
    catalogEntry,
    intent: options.intent,
    envContext,
    envVars,
    warnings,
    errors: [],
    // Reviewer #2 fix: thread structured env metadata so execute() doesn't
    // need to re-load or hardcode 'aliyun'.
    envName,
    envTags: tags,
    envProvider: resolvedEnv.cloud.provider,
    envSafety: resolvedEnv.safety.destructive_ops,
  }
}

// ---------------------------------------------------------------------------
// Public: execute
// ---------------------------------------------------------------------------

/**
 * Execute a DispatchPlan by:
 *   1. Writing a "pending" audit log entry
 *   2. Calling the supplied executor with the prepared DeploymentSkillInput
 *   3. Writing a "success" or "failure" audit log entry
 *   4. Returning the output (or rethrowing on error)
 *
 * The actual skill invocation is performed by the `executor` callback.
 * In Phase 5 v1 this callback is supplied by the AI layer (Skill tool wrapper).
 */
export async function execute(
  dispatchPlan: DispatchPlan,
  executor: (input: DeploymentSkillInput) => Promise<DeploymentSkillOutput>,
): Promise<DeploymentSkillOutput> {
  const workspacePath = process.cwd()
  const startMs = Date.now()

  // Build the skill input from the plan's structured fields (Reviewer #2 fix:
  // use envName/envProvider/envSafety from DispatchPlan instead of hardcoding).
  const input: DeploymentSkillInput = {
    projectRoot: workspacePath,
    activeEnv: {
      name: dispatchPlan.envName,
      tags: dispatchPlan.envTags,
      cloud: { provider: dispatchPlan.envProvider, region: '' } as import('../types.js').CloudSpec,
      safety: { destructive_ops: dispatchPlan.envSafety },
      secretRefs: [],
      envVars: dispatchPlan.envVars,
    } as unknown as import('../types.js').ResolvedEnv,
    envVars: dispatchPlan.envVars,
    intent: dispatchPlan.intent,
    reason: undefined,
    options: undefined,
  }

  // Minimal Env-shaped object for audit logging — uses the real env's
  // provider, tags, and safety mode (Reviewer #2 fix).
  const auditEnv = {
    name: dispatchPlan.envName,
    tags: dispatchPlan.envTags,
    cloud: { provider: dispatchPlan.envProvider, region: '' } as import('../types.js').CloudSpec,
    safety: { destructive_ops: dispatchPlan.envSafety },
  } satisfies import('../types.js').Env

  // Pending entry
  await logAudit({
    env: auditEnv,
    toolKind: 'deploy',
    summary: `[skill=${dispatchPlan.skill}] [phase=plan] status=pending intent=${dispatchPlan.intent}`,
    status: 'pending',
    workspacePath,
    skill: dispatchPlan.skill,
    phase: 'plan',
  })

  try {
    const output = await executor(input)
    const durationMs = Date.now() - startMs

    await logAudit({
      env: auditEnv,
      toolKind: 'deploy',
      summary: `[skill=${dispatchPlan.skill}] [phase=execute] status=success intent=${dispatchPlan.intent}`,
      status: 'success',
      workspacePath,
      skill: dispatchPlan.skill,
      phase: 'execute',
      durationMs,
      rollbackPlan: output.rollbackPlan,
    })

    return output
  } catch (err: unknown) {
    const durationMs = Date.now() - startMs

    await logAudit({
      env: auditEnv,
      toolKind: 'deploy',
      summary: `[skill=${dispatchPlan.skill}] [phase=execute] status=failure intent=${dispatchPlan.intent}: ${String(err)}`,
      status: 'failure',
      workspacePath,
      skill: dispatchPlan.skill,
      phase: 'execute',
      durationMs,
    })

    throw err
  }
}

// ---------------------------------------------------------------------------
// Public: dispatch
// ---------------------------------------------------------------------------

/**
 * Convenience: plan + execute in a single call.
 *
 * Returns the DeploymentSkillOutput from the executor.
 */
export async function dispatch(
  options: DispatchOptions & {
    intent: SkillIntent
    executor: (input: DeploymentSkillInput) => Promise<DeploymentSkillOutput>
  },
): Promise<DeploymentSkillOutput> {
  const { executor, ...planOptions } = options
  const dispatchPlan = await plan(planOptions)
  return execute(dispatchPlan, executor)
}
