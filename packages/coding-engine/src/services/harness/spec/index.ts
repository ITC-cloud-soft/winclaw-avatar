/**
 * index.ts — Barrel export for the harness spec-kit integration module.
 *
 * All public API surface that Agent D's dispatcher consumes.
 * Agents A/B/C may add to this file when their modules are merged.
 */

export { getHarnessSpecConfig } from './config.js'
export type { HarnessSpecConfig, HarnessSpecFeatures } from './config.js'

export { loadConstitution, validateConstitution, constitutionPath } from './constitution.js'
export type {
  ParsedConstitution,
  ConstitutionArticle,
  ConstitutionValidationResult,
} from './constitution.js'

export { runCrossArtifactAnalysis, readActiveFeature } from './crossArtifact.js'
export type {
  CrossArtifactAnalysisResult,
  CrossArtifactFinding,
} from './crossArtifact.js'

export { parseTasksStatus, generateTasksFromPlan, saveSidecarStatus } from './tasks.js'
export type { TasksStatusResult, TasksGenerateResult, Task, TaskStatus } from './tasks.js'

export { scanClarifications } from './clarify.js'
export type { ClarifyListResult, ClarificationMarker } from './clarify.js'

export { initFeatureSpec } from './specInit.js'
export type { SpecInitResult } from './specInit.js'
