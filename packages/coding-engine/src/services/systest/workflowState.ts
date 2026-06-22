/**
 * Workflow state management for systest.
 * 
 * Manages the workflow-state.json file that tracks progress across all phases,
 * enabling resume functionality and progress reporting.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Schema version for workflow-state.json
const WORKFLOW_STATE_VERSION = '2.0.0'

export type TestMode = 'A' | 'B' | 'C'

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'timeout' | 'skipped'

export interface PhaseState {
  status: PhaseStatus
  started_at?: string
  completed_at?: string
  duration_ms?: number
  outputs?: string[]
  error?: string
  graph_enhanced?: boolean
  pass_rate?: number
  iteration?: number
}

export interface GraphInfo {
  enabled: boolean
  path: string
  nodes?: number
  edges?: number
  communities?: number
  built_at?: string
}

export interface WorkflowState {
  $schema: string
  _version: string
  mode: TestMode
  workspace: string
  design_docs_dir?: string
  frontend_url?: string
  backend_url?: string
  database_url?: string
  output_dir: string
  started_at: string
  updated_at: string
  graph: GraphInfo
  phases: {
    phase1: PhaseState
    phase2: PhaseState
    phase3: PhaseState
    phase4: PhaseState
    phase5a: PhaseState
    phase5b: PhaseState
    phase5c: PhaseState
    phase6: PhaseState
  }
}

const DEFAULT_PHASE_STATE: PhaseState = { status: 'pending' }

const DEFAULT_GRAPH_INFO: GraphInfo = {
  enabled: false,
  path: '',
}

/**
 * Create a new workflow state object with default values.
 */
function createInitialState(
  mode: TestMode,
  workspace: string,
  outputDir: string,
  options: {
    designDocsDir?: string
    frontendUrl?: string
    backendUrl?: string
    databaseUrl?: string
  } = {}
): WorkflowState {
  const now = new Date().toISOString()
  
  return {
    $schema: 'meta-coder-systest-workflow-state',
    _version: WORKFLOW_STATE_VERSION,
    mode,
    workspace,
    design_docs_dir: options.designDocsDir,
    frontend_url: options.frontendUrl,
    backend_url: options.backendUrl,
    database_url: options.databaseUrl,
    output_dir: outputDir,
    started_at: now,
    updated_at: now,
    graph: { ...DEFAULT_GRAPH_INFO },
    phases: {
      phase1: { ...DEFAULT_PHASE_STATE },
      phase2: { ...DEFAULT_PHASE_STATE },
      phase3: { ...DEFAULT_PHASE_STATE },
      phase4: { ...DEFAULT_PHASE_STATE },
      phase5a: { ...DEFAULT_PHASE_STATE },
      phase5b: { ...DEFAULT_PHASE_STATE },
      phase5c: { ...DEFAULT_PHASE_STATE },
      phase6: { ...DEFAULT_PHASE_STATE },
    },
  }
}

/**
 * Load workflow state from disk, or create a new one if it doesn't exist.
 */
export function loadWorkflowState(outputDir: string): WorkflowState {
  const statePath = join(outputDir, 'workflow-state.json')
  
  if (!existsSync(statePath)) {
    return null
  }
  
  try {
    const content = readFileSync(statePath, 'utf-8')
    return JSON.parse(content) as WorkflowState
  } catch (error) {
    console.error(`Failed to load workflow state from ${statePath}:`, error)
    return null
  }
}

/**
 * Create or restore workflow state for a systest run.
 */
export function createWorkflowState(
  mode: TestMode,
  workspace: string,
  outputDir: string,
  options: {
    designDocsDir?: string
    frontendUrl?: string
    backendUrl?: string
    databaseUrl?: string
  } = {}
): WorkflowState {
  const existing = loadWorkflowState(outputDir)
  
  if (existing) {
    // Update timestamp for resume
    existing.updated_at = new Date().toISOString()
    return existing
  }
  
  return createInitialState(mode, workspace, outputDir, options)
}

/**
 * Save workflow state to disk.
 */
export function saveWorkflowState(state: WorkflowState, outputDir: string): void {
  try {
    mkdirSync(outputDir, { recursive: true })
  } catch {
    // Ignore if directory exists
  }
  
  const statePath = join(outputDir, 'workflow-state.json')
  state.updated_at = new Date().toISOString()
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Update the status of a specific phase.
 */
export function updatePhaseStatus(
  state: WorkflowState,
  phaseId: keyof WorkflowState['phases'],
  status: PhaseStatus,
  options: {
    outputs?: string[]
    error?: string
    graphEnhanced?: boolean
    passRate?: number
    iteration?: number
  } = {}
): void {
  const phase = state.phases[phaseId]
  const now = new Date().toISOString()
  
  phase.status = status
  
  if (status === 'in_progress' && !phase.started_at) {
    phase.started_at = now
  }
  
  if (status === 'completed' || status === 'failed' || status === 'timeout') {
    phase.completed_at = now
    if (phase.started_at) {
      phase.duration_ms = Date.now() - new Date(phase.started_at).getTime()
    }
  }
  
  if (options.outputs) phase.outputs = options.outputs
  if (options.error) phase.error = options.error
  if (options.graphEnhanced !== undefined) phase.graph_enhanced = options.graphEnhanced
  if (options.passRate !== undefined) phase.pass_rate = options.passRate
  if (options.iteration !== undefined) phase.iteration = options.iteration
}

/**
 * Check if a phase should be skipped based on current state.
 */
export function shouldSkipPhase(
  state: WorkflowState,
  phaseId: keyof WorkflowState['phases']
): boolean {
  const phase = state.phases[phaseId]
  
  // Skip if already completed
  if (phase.status === 'completed') {
    return true
  }
  
  // Special case for Phase 5B: skip if pass rate meets target
  if (phaseId === 'phase5b' && phase.pass_rate !== undefined) {
    if (phase.pass_rate >= 95) {
      return true
    }
  }
  
  // Special case for Phase 5C: skip if pass rate is 100%
  if (phaseId === 'phase5c' && phase.pass_rate !== undefined) {
    if (phase.pass_rate >= 100) {
      return true
    }
  }
  
  return false
}
export function getWorkflowSummary(state: WorkflowState): string {
  const lines: string[] = []
  
  lines.push(`Mode: ${state.mode}`)
  lines.push(`Workspace: ${state.workspace}`)
  lines.push(`Started: ${state.started_at}`)
  lines.push('')
  lines.push('Phase Status:')
  
  const phaseIds: Array<keyof WorkflowState['phases']> = [
    'phase1', 'phase2', 'phase3', 'phase4', 'phase5a', 'phase5b', 'phase5c', 'phase6'
  ]
  
  const phaseLabels: Record<string, string> = {
    phase1: 'Phase 1: Design Document Analysis',
    phase2: 'Phase 2: Code Structure Analysis',
    phase3: 'Phase 3: Code Review',
    phase4: 'Phase 4: Service Startup',
    phase5a: 'Phase 5A: Test Data Seeding',
    phase5b: 'Phase 5B: API Testing',
    phase5c: 'Phase 5C: UI Testing',
    phase6: 'Phase 6: Report Generation',
  }
  
  for (const phaseId of phaseIds) {
    const phase = state.phases[phaseId]
    const label = phaseLabels[phaseId] || phaseId
    const status = phase.status
    const duration = phase.duration_ms ? ` (${Math.round(phase.duration_ms / 1000)}s)` : ''
    lines.push(`  [${status === 'completed' ? '✓' : status === 'pending' ? '○' : status === 'in_progress' ? '→' : '✗'}] ${label}${duration}`)
    if (phase.pass_rate !== undefined) {
      lines.push(`      Pass Rate: ${phase.pass_rate}%`)
    }
  }
  
  return lines.join('\n')
}
