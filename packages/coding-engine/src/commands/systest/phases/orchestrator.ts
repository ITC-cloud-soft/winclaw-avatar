import { prepareServicesForTesting, generateServicePrompt } from '../../../services/systest/serviceStarter.js'
/**
 * Phase orchestrator for systest.
 * 
 * Manages the execution of all test phases with proper sequencing,
 * timeout handling, and resume capability.
 */

import { join } from 'node:path'
import type { GraphEngine } from '../../../services/graphify/engine.js'
import type { TestMode } from '../../../services/systest/modeDetector.js'
import type { WorkflowState, PhaseStatus } from '../../../services/systest/workflowState.js'
import type { LocalJSXCommandContext } from '../../../types/command.ts'

export interface PhaseConfig {
  id: string
  name: string
  timeout: number
  modes: TestMode[]
  condition?: (ctx: SystestContext) => boolean
  skipReason?: (ctx: SystestContext) => string
  skipIfExists?: string[]
  execute: (ctx: SystestContext) => Promise<PhaseResult>
  executePromptDriven?: (ctx: SystestContext) => Promise<PhaseResult>  // NEW: Prompt-driven execution
}

export interface PhaseResult {
  status: 'completed' | 'failed' | 'timeout' | 'skipped'
  outputs: string[]
  duration: number
  error?: string
  skipReason?: string
  passRate?: number
  iteration?: number
  // Phase 4 specific
  architecture?: 'separated' | 'monolith' | 'ssr' | 'static' | 'unknown'
  services?: any
  skipPhase5B?: boolean
  // Metadata added by orchestrator for downstream reporting
  phaseId?: string
  phaseName?: string
}

export interface SystestContext {
    mode: TestMode
    workspace: string
    designDocsDir?: string
    backendUrl?: string
    frontendUrl?: string
    databaseUrl?: string
    outputDir: string
    graphEngine?: GraphEngine
    workflowState: WorkflowState
    config: PhaseControlConfig
    nonInteractive: boolean
    chromeMcpAvailable?: boolean
    usePromptDriven?: boolean  // NEW: Use prompt-driven phase execution
    servicesReady?: boolean  // Phase 4 sets this
    // Phase 4 results
    architecture?: 'separated' | 'monolith' | 'ssr' | 'static' | 'unknown'
    skipPhase5B?: boolean
    // NEW: For query AsyncGenerator support in prompt-driven phases
    getCwd?: () => string
    getTools?: () => any
    mcpClients?: any[]
    toolUseContext?: LocalJSXCommandContext  // ToolUseContext for Chrome MCP access
    // Env-aware fields (Phase 3 Agent B)
    envName?: string          // active env name if env-driven
    envVars?: Record<string, string>  // resolved env vars for child processes
    isProduction?: boolean    // true if env is tagged production — runPhases refuses all phases
  }

export interface PhaseControlConfig {
  global: {
    targetPassRate5b: number
    targetPassRate5c: number
    verboseLogging: boolean
    stopOnFailure: boolean
    graphEnabled: boolean
    graphAutoBuild: boolean
  }
  phaseTimeouts: {
    phase1: number
    phase2: number
    phase3: number
    phase4: number  // NEW: Phase 4 timeout
    phase5a: number
    phase5bIteration: number
    phase5cIteration: number
    phase6: number
  }
  iterationControl: {
    maxIterations: number
    earlyExitThreshold: number
    enableEarlyExit: boolean
  }
}

const DEFAULT_CONFIG: PhaseControlConfig = {
  global: {
    targetPassRate5b: 95,
    targetPassRate5c: 100,
    verboseLogging: true,
    stopOnFailure: true,
    graphEnabled: true,
    graphAutoBuild: true,
  },
  phaseTimeouts: {
    phase1: 1800,
    phase2: 1800,
    phase3: 2400,
    phase4: 3600,  // NEW: 1 hour for service startup
    phase5a: 1800,
    phase5bIteration: 3600,
    phase5cIteration: 3600,
    phase6: 1800,
  },
  iterationControl: {
    maxIterations: 15,
    earlyExitThreshold: 3,
    enableEarlyExit: true,
  },
}

/**
 * Run all phases in sequence with architecture-aware flow.
 */
export async function runPhases(
  context: SystestContext,
  phases: PhaseConfig[]
): Promise<PhaseResult[]> {
  const results: PhaseResult[] = []
  const { shouldSkipPhase, updatePhaseStatus, saveWorkflowState } = await import(
    '../../../services/systest/workflowState.js'
  )

  // Production safety gate — refuse ALL phases when the active env is production.
  // This enforces destructive_ops=deny at runtime, not just in the skill prompt.
  if (context.isProduction === true) {
    const refusalMsg =
      'systest cannot run against a production env (destructive_ops=deny). ' +
      `Env "${context.envName ?? 'unknown'}" is tagged production. Use a staging or dev env.`
    console.log('[systest] REFUSED: ' + refusalMsg)
    return [
      {
        status: 'skipped',
        outputs: [],
        duration: 0,
        skipReason: refusalMsg,
        phaseId: 'all',
        phaseName: 'All phases refused — production env',
      },
    ]
  }

  for (const phase of phases) {
    // Convert phase.id to workflow state key (e.g., '5b' -> 'phase5b')
    const phaseKey = ('phase' + phase.id) as keyof WorkflowState['phases']

    // Check if phase should run for this mode
    if (!phase.modes.includes(context.mode)) {
      continue
    }
    
    // Check custom condition
    if (phase.condition && !phase.condition(context)) {
      const skipReason = phase.skipReason
        ? phase.skipReason(context)
        : 'phase.condition returned false'
      if (context.config.global.verboseLogging) {
        console.log('[systest] [Phase ' + phase.id + '] Skipping: ' + skipReason)
      }
      // Push a structured skip entry so downstream reporting (phase 6, AI summaries)
      // has a truthful reason to quote instead of inventing one. Also update workflow state.
      results.push({
        status: 'skipped',
        outputs: [],
        duration: 0,
        skipReason,
        phaseId: phase.id,
        phaseName: phase.name,
      })
      updatePhaseStatus(context.workflowState, phaseKey, 'skipped', { error: skipReason })
      saveWorkflowState(context.workflowState, context.outputDir)
      continue
    }
    
    // Special handling for Phase 5B based on architecture
    if (phase.id === '5b' && context.skipPhase5B === true) {
      if (context.config.global.verboseLogging) {
        console.log('[systest] [Phase 5B] Skipping (architecture: ' + context.architecture + ')')
      }
      results.push({ status: 'skipped', outputs: [], duration: 0, phaseId: phase.id, phaseName: phase.name })
      continue
    }
    
    // Mark phase as in progress
    updatePhaseStatus(context.workflowState, phaseKey, 'in_progress')
    saveWorkflowState(context.workflowState, context.outputDir)
    
    if (context.config.global.verboseLogging) {
      console.log('[systest] [Phase ' + phase.id + '] ' + phase.name + ' ... running')
    }
    
    // Execute phase with timeout
    const result = await executePhaseWithTimeout(phase, context)
    
    // Store Phase 4 results in context for subsequent phases
    if (phase.id === '4' && result.status === 'completed') {
      context.architecture = result.architecture
      context.skipPhase5B = result.skipPhase5B
      if (result.services) {
        if (result.services.backend) {
          context.backendUrl = result.services.backend.url
        }
        if (result.services.frontend) {
          context.frontendUrl = result.services.frontend.url
        }
        if (result.services.database) {
          context.databaseUrl = result.services.database.url
        }
      }
    }
    
    // Update workflow state
    updatePhaseStatus(
      context.workflowState,
      phaseKey,
      result.status as PhaseStatus,
      {
        outputs: result.outputs,
        error: result.error,
        passRate: result.passRate,
        iteration: result.iteration,
      }
    )
    saveWorkflowState(context.workflowState, context.outputDir)
    
    if (context.config.global.verboseLogging) {
      const statusSymbol = result.status === 'completed' ? 'OK' : result.status === 'skipped' ? '-' : 'X'
      const durationSec = Math.round(result.duration / 1000)
      const passInfo = result.passRate !== undefined ? ' (pass rate: ' + result.passRate + '%)' : ''
      console.log('[Phase ' + phase.id + '] ' + statusSymbol + ' ' + result.status + ' (' + durationSec + 's)' + passInfo)
    }
    
      results.push({ ...result, phaseId: phase.id, phaseName: phase.name })
    
    // Stop on failure if configured
    if (result.status === 'failed' || result.status === 'timeout') {
      if (context.config.global.stopOnFailure) {
        console.log('[systest] Phase ' + phase.id + ' failed. Stopping due to stopOnFailure=true.')
        break
      }
    }
  }
  
  return results
}

/**
 * Execute a single phase with timeout protection.
 */
async function executePhaseWithTimeout(
  phase: PhaseConfig,
  context: SystestContext
): Promise<PhaseResult> {
  const startTime = Date.now()
  
  // Choose execution method based on context setting
  const executeFn = context.usePromptDriven && phase.executePromptDriven 
    ? phase.executePromptDriven 
    : phase.execute
  
  // Ensure execute function exists
  if (!executeFn || typeof executeFn !== 'function') {
    return {
      status: 'failed',
      outputs: [],
      duration: Date.now() - startTime,
      error: 'Phase ' + phase.id + ' missing execute function',
    }
  }
  
  const timeoutPromise = new Promise<PhaseResult>((_, reject) =>
    setTimeout(
      () =>
        reject({
          status: 'timeout',
          outputs: [],
          duration: phase.timeout,
          error: 'Phase ' + phase.id + ' timed out after ' + phase.timeout + 'ms',
        }),
      phase.timeout
    )
  )
  
  const executePromise = executeFn(context).catch((error) => ({
    status: 'failed' as const,
    outputs: [],
    duration: Date.now() - startTime,
    error: error instanceof Error ? error.message : String(error),
  }))
  
  try {
    const result = await Promise.race([executePromise, timeoutPromise])
    
    // Ensure result has status field
    if (!result || typeof result.status === 'undefined') {
      return {
        status: 'failed',
        outputs: (result as PhaseResult | null)?.outputs ?? [],
        duration: Date.now() - startTime,
        error: 'Phase ' + phase.id + ' returned invalid result',
      }
    }
    
    result.duration = Date.now() - startTime
    return result
  } catch (error) {
    return {
      status: 'failed',
      outputs: [],
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get default phase control config.
 */
export function getDefaultConfig(): PhaseControlConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
}

/**
 * Parse command line arguments into context.
 */
export function parseArgsToContext(args: string, workspace: string): Partial<SystestContext> {
  const context: Partial<SystestContext> = {
    workspace,  // Set default workspace from parameter
    usePromptDriven: false,  // Default to traditional execution
  }
  const parts = args.split(/\s+/)
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    
    switch (part) {
      case '--workspace':
      case '-w':
        context.workspace = parts[++i]
        break
      case '--design-docs':
      case '-d':
        context.designDocsDir = parts[++i]
        break
      case '--backend-url':
      case '--backend':
      case '-b':
        context.backendUrl = parts[++i]
        break
      case '--frontend-url':
      case '--frontend':
      case '-f':
        context.frontendUrl = parts[++i]
        break
      case '--database-url':
      case '--database':
      case '--db':
        context.databaseUrl = parts[++i]
        break
      case '--non-interactive':
      case '-n':
        context.nonInteractive = true
        break
      case '--no-graph':
        context.config = {
          ...getDefaultConfig(),
          global: {
            ...getDefaultConfig().global,
            graphEnabled: false,
          },
        }
        break
      case '--prompt-driven':
      case '-pd':
        context.usePromptDriven = true
        break
    }
  }
  
  return context
}

