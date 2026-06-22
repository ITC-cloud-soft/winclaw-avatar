/**
 * Gate check registry.
 *
 * Maps GateCheck type strings to their runner functions. Runners are imported
 * lazily to keep startup cost low — the registry only dispatches.
 *
 * MVP (5) + Standard phase (11) + spec-kit phase validators (4) = 20 total.
 */

import type { GateCheck, CheckResult } from '../types.js'
import type { ExtendedGateCheck, AnyGateCheck } from '../standardTypes.js'
import { runFileExists } from './runners/fileExists.js'
import { runTypecheck } from './runners/typecheck.js'
import { runUnitTest } from './runners/unitTest.js'
import { runHarnessLintCheck } from './runners/harnessLintCheck.js'
import { runSystestCheck } from './runners/systestCheck.js'
import { runHarnessRuleConformance } from './runners/harnessRuleConformance.js'
import { runSkillExecution } from './runners/skillExecution.js'
import { runRulesCoverage } from './runners/rulesCoverage.js'
import { runDependencyScan } from './runners/dependencyScan.js'
import { runSast } from './runners/sast.js'
import { runLoadTest } from './runners/loadTest.js'
import { runHumanApproval } from './runners/humanApproval.js'
import { runMetacoderDeployDryrun } from './runners/metacoderDeployDryrun.js'
import { runMetacoderDeploy } from './runners/metacoderDeploy.js'
import { runReviewChecklist } from './runners/reviewChecklist.js'
import { runCommand } from './runners/command.js'
import { runSpecRequirements } from './runners/specRequirements.js'
import { runSpecDesign } from './runners/specDesign.js'
import { runTestSpecChecklist } from './runners/testSpecChecklist.js'
import { runTasksStatus } from './runners/tasksStatus.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Unified runner signature that handles both MVP GateCheck and
 * ExtendedGateCheck types. The ctx object carries workspacePath + timeoutMs.
 */
export type CheckRunnerMeta = { gateId?: string; phaseId?: string }

export type CheckRunner = (
  check: AnyGateCheck,
  workspacePath: string,
  timeoutMs?: number,
  meta?: CheckRunnerMeta,
) => Promise<CheckResult>

// ---------------------------------------------------------------------------
// Adapter helpers — wrap new-style runners into the legacy CheckRunner shape
// ---------------------------------------------------------------------------

function adaptExtended<T extends ExtendedGateCheck>(
  fn: (check: T, ctx: { workspacePath: string; timeoutMs: number }, meta?: CheckRunnerMeta) => Promise<CheckResult>,
): CheckRunner {
  return (check, workspacePath, timeoutMs = 5 * 60 * 1000, meta) =>
    fn(check as T, { workspacePath, timeoutMs }, meta)
}

// ---------------------------------------------------------------------------
// Internal map — 16 entries
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, CheckRunner> = {
  // MVP (5)
  'file-exists': runFileExists as CheckRunner,
  'typescript-typecheck': runTypecheck as CheckRunner,
  'unit-test': runUnitTest as CheckRunner,
  'harness-lint': runHarnessLintCheck as CheckRunner,
  'metacoder-systest': runSystestCheck as CheckRunner,

  // Standard phase (9)
  'harness-rule-conformance': adaptExtended(runHarnessRuleConformance),
  'skill-execution': adaptExtended(runSkillExecution),
  'rules-coverage': adaptExtended(runRulesCoverage),
  'dependency-scan': adaptExtended(runDependencyScan),
  'sast': adaptExtended(runSast),
  'load-test': adaptExtended(runLoadTest),
  'human-approval': adaptExtended(runHumanApproval),
  'metacoder-deploy-dryrun': adaptExtended(runMetacoderDeployDryrun),
  'metacoder-deploy': adaptExtended(runMetacoderDeploy),

  // Review (Standard scope §10.4: rubber-stamp prevention)
  'review-checklist': adaptExtended(runReviewChecklist),

  // Generic shell command (v2.0.4: previously a frequent "unknown type" footgun)
  'command': adaptExtended(runCommand),

  // v3.3.0 spec-kit phase validators (4): replace "template-existence-only"
  // gates with real checks against spec.md / plan.md / tasks.md / test-plan.md.
  // Wired here for runtime dispatch; failures soften to warnings under
  // policy.gateEnforcement='warn' (see policy.ts isSoftenable).
  'spec-requirements': adaptExtended(runSpecRequirements),
  'spec-design': adaptExtended(runSpecDesign),
  'test-spec-checklist': adaptExtended(runTestSpecChecklist),
  'tasks-status': adaptExtended(runTasksStatus),
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the runner for the given check type, or null if unknown.
 */
export function getCheckRunner(type: string): CheckRunner | null {
  return REGISTRY[type] ?? null
}

/**
 * List all supported check type strings (16 total: MVP 5 + Standard 11).
 */
export function listSupportedCheckTypes(): string[] {
  return Object.keys(REGISTRY)
}
