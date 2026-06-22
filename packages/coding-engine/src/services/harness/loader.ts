/**
 * Loader for the harness/ directory.
 *
 * Responsibilities:
 *   - Detect whether a workspace has a harness/ directory
 *   - Walk the harness/ tree and populate the HarnessLayout index objects
 *   - Validate the loaded layout, reporting errors and warnings
 *
 * Follows the same patterns as src/services/envManager/loader.ts:
 *   - node:fs/promises for async I/O
 *   - Returns null / undefined for missing optional files
 *   - Throws HarnessError only for structural failures
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  HarnessLayout,
  HarnessRulesIndex,
  HarnessSkillsIndex,
  HarnessAgentsIndex,
  HarnessWorkflowIndex,
  HarnessContextIndex,
} from './types.js'
import { HarnessError } from './types.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the absolute path if the file exists, otherwise undefined.
 */
async function resolveIfExists(filePath: string): Promise<string | undefined> {
  try {
    await fs.access(filePath)
    return filePath
  } catch {
    return undefined
  }
}

/**
 * Collect extra files in a directory that are not part of the known set.
 * Returns paths relative to workspacePath; empty array if dir missing.
 */
async function collectExtras(
  dirPath: string,
  knownFiles: readonly string[],
): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(dirPath)
  } catch {
    return []
  }
  const knownSet = new Set(knownFiles.map(f => path.basename(f)))
  return entries
    .filter(e => !knownSet.has(e))
    .map(e => path.join(dirPath, e))
}

// ---------------------------------------------------------------------------
// Public: isHarnessInitialized
// ---------------------------------------------------------------------------

/**
 * Return true if the workspace has a harness/ directory that contains the
 * minimum required anchor file (rules/architecture.md).
 */
export async function isHarnessInitialized(workspacePath: string): Promise<boolean> {
  const anchorPath = path.join(workspacePath, 'harness', 'rules', 'architecture.md')
  try {
    await fs.access(anchorPath)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Public: loadHarness
// ---------------------------------------------------------------------------

/**
 * Walk the harness/ directory and return a fully-populated HarnessLayout.
 *
 * For each expected file: sets the absolute path if the file exists,
 * or leaves the property undefined if the file is missing.
 * Does NOT throw for missing files — use validateLayout() for that.
 */
export async function loadHarness(workspacePath: string): Promise<HarnessLayout> {
  const harnessRoot = path.join(workspacePath, 'harness')
  const rulesDir = path.join(harnessRoot, 'rules')
  const skillsDir = path.join(harnessRoot, 'skills')
  const agentsDir = path.join(harnessRoot, 'agents')
  const workflowDir = path.join(harnessRoot, 'workflow')
  const contextDir = path.join(harnessRoot, 'context')

  // Resolve all known paths in parallel
  const [
    archPath,
    workflowRulePath,
    codingPath,
    planPath,
    implementPath,
    reviewPath,
    testPath,
    pmPath,
    devPath,
    reviewerPath,
    testerPath,
    phasesPath,
    gatesPath,
    rollbackPath,
    sessionPath,
    phaseTriggersPath,
    glossaryPath,
  ] = await Promise.all([
    resolveIfExists(path.join(rulesDir, 'architecture.md')),
    resolveIfExists(path.join(rulesDir, 'workflow.md')),
    resolveIfExists(path.join(rulesDir, 'coding.md')),
    resolveIfExists(path.join(skillsDir, 'plan.md')),
    resolveIfExists(path.join(skillsDir, 'implement-by-layer.md')),
    resolveIfExists(path.join(skillsDir, 'review.md')),
    resolveIfExists(path.join(skillsDir, 'test.md')),
    resolveIfExists(path.join(agentsDir, 'pm.md')),
    resolveIfExists(path.join(agentsDir, 'developer.md')),
    resolveIfExists(path.join(agentsDir, 'reviewer.md')),
    resolveIfExists(path.join(agentsDir, 'tester.md')),
    resolveIfExists(path.join(workflowDir, 'phases.yaml')),
    resolveIfExists(path.join(workflowDir, 'gates.yaml')),
    resolveIfExists(path.join(workflowDir, 'rollback.yaml')),
    resolveIfExists(path.join(contextDir, 'session.md')),
    resolveIfExists(path.join(contextDir, 'phase-triggers.yaml')),
    resolveIfExists(path.join(contextDir, 'on-demand-glossary.md')),
  ])

  // Collect extras in parallel (files in the dir not part of the known set)
  const knownRules = [archPath, workflowRulePath, codingPath].filter(Boolean) as string[]
  const knownSkills = [planPath, implementPath, reviewPath, testPath].filter(Boolean) as string[]
  const knownAgents = [pmPath, devPath, reviewerPath, testerPath].filter(Boolean) as string[]

  const [extraRules, extraSkills, extraAgents] = await Promise.all([
    collectExtras(rulesDir, knownRules.map(p => path.basename(p))),
    collectExtras(skillsDir, knownSkills.map(p => path.basename(p))),
    collectExtras(agentsDir, knownAgents.map(p => path.basename(p))),
  ])

  const rules: HarnessRulesIndex = {
    architecture: archPath ?? '',
    workflow: workflowRulePath ?? '',
    coding: codingPath ?? '',
    ...(extraRules.length > 0 ? { extra: extraRules } : {}),
  }

  const skills: HarnessSkillsIndex = {
    ...(planPath ? { plan: planPath } : {}),
    ...(implementPath ? { implement: implementPath } : {}),
    ...(reviewPath ? { review: reviewPath } : {}),
    ...(testPath ? { test: testPath } : {}),
    ...(extraSkills.length > 0 ? { extra: extraSkills } : {}),
  }

  const agents: HarnessAgentsIndex = {
    ...(pmPath ? { pm: pmPath } : {}),
    ...(devPath ? { developer: devPath } : {}),
    ...(reviewerPath ? { reviewer: reviewerPath } : {}),
    ...(testerPath ? { tester: testerPath } : {}),
    ...(extraAgents.length > 0 ? { extra: extraAgents } : {}),
  }

  const workflow: HarnessWorkflowIndex = {
    ...(phasesPath ? { phases: phasesPath } : {}),
    ...(gatesPath ? { gates: gatesPath } : {}),
    ...(rollbackPath ? { rollback: rollbackPath } : {}),
  }

  const context: HarnessContextIndex = {
    ...(sessionPath ? { session: sessionPath } : {}),
    ...(phaseTriggersPath ? { phaseTriggers: phaseTriggersPath } : {}),
    ...(glossaryPath ? { onDemandGlossary: glossaryPath } : {}),
  }

  return {
    rootDir: harnessRoot,
    rules,
    skills,
    agents,
    workflow,
    context,
  }
}

// ---------------------------------------------------------------------------
// Public: validateLayout
// ---------------------------------------------------------------------------

/**
 * Validate a loaded HarnessLayout.
 *
 * Required files (errors if missing):
 *   - rules/architecture.md
 *   - rules/coding.md
 *   - workflow/phases.yaml
 *
 * Optional files (warnings if missing):
 *   - rules/workflow.md
 *   - skills/review.md
 *   - workflow/gates.yaml
 *
 * Does not throw — returns { ok, errors, warnings }.
 */
export async function validateLayout(
  layout: HarnessLayout,
): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = []
  const warnings: string[] = []

  // Required
  if (!layout.rules.architecture) {
    errors.push('Missing required file: harness/rules/architecture.md')
  }
  if (!layout.rules.coding) {
    errors.push('Missing required file: harness/rules/coding.md')
  }
  if (!layout.workflow.phases) {
    errors.push('Missing required file: harness/workflow/phases.yaml')
  } else {
    // Phase-id canonicalization check — surface non-canonical ids here so
    // /harness validate can flag the problem upfront instead of waiting for
    // /harness phase advance to silently no-op.
    try {
      const { loadPhasesConfig } = await import('./workflow/phasesLoader.js')
      const workspacePath = layout.rootDir.replace(/[\\/]+harness[\\/]*$/, '')
      await loadPhasesConfig(workspacePath)
    } catch (err) {
      if (err instanceof HarnessError && err.kind === 'invalid-yaml') {
        errors.push(`phases.yaml: ${err.message}`)
      } else {
        errors.push(
          `phases.yaml: failed to validate — ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  // Optional
  if (!layout.rules.workflow) {
    warnings.push('Missing optional file: harness/rules/workflow.md')
  }
  if (!layout.skills.review) {
    warnings.push('Missing optional file: harness/skills/review.md')
  }
  if (!layout.workflow.gates) {
    warnings.push('Missing optional file: harness/workflow/gates.yaml')
  }
  if (!layout.workflow.rollback) {
    warnings.push('Missing optional file: harness/workflow/rollback.yaml')
  }
  if (!layout.agents.pm) {
    warnings.push('Missing optional file: harness/agents/pm.md')
  }
  if (!layout.agents.developer) {
    warnings.push('Missing optional file: harness/agents/developer.md')
  }
  if (!layout.agents.reviewer) {
    warnings.push('Missing optional file: harness/agents/reviewer.md')
  }
  if (!layout.agents.tester) {
    warnings.push('Missing optional file: harness/agents/tester.md')
  }
  if (!layout.context.session) {
    warnings.push('Missing optional file: harness/context/session.md')
  }
  if (!layout.context.phaseTriggers) {
    warnings.push('Missing optional file: harness/context/phase-triggers.yaml')
  }
  if (!layout.context.onDemandGlossary) {
    warnings.push('Missing optional file: harness/context/on-demand-glossary.md')
  }

  const ok = errors.length === 0
  return { ok, errors, warnings }
}

// Re-export HarnessError so callers can import it from this module
export { HarnessError }
