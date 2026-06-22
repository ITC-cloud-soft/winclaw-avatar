/**
 * Main systest command implementation
 */

import type { LocalCommandCall } from '../../types/command.ts'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { mkdirSync } from 'node:fs'

// Import phase implementations
import { executePhase1 } from './phases/phase1_prompt_driven.ts'
import { executePhase2 } from './phases/phase2_prompt_driven.ts'
import { executePhase3 } from './phases/phase3.ts'
import { executePhase4, type Phase4Result } from './phases/phase4_prompt_driven.ts'
import { executePhase5A } from './phases/phase5a.ts'
import { executePhase5B } from './phases/phase5b_prompt_only.js'  // Phase 5B not yet implemented, fallback to 5A
import { executePhase5C } from './phases/phase5c_prompt_only.js'
import { executePhase6 } from './phases/phase6.ts'

// Import orchestrator and utilities
import {
  runPhases,
  type SystestContext,
  type PhaseConfig,
  parseArgsToContext,
  getDefaultConfig,
} from './phases/orchestrator.ts'
import { getAllPhases } from './phases/phases.ts'

import {
  detectMode,
  type ModeDetectionResult,
} from '../../services/systest/modeDetector.ts'

import type { LocalJSXCommandContext } from '../../types/command.ts'

import {
  createWorkflowState,
  saveWorkflowState,
} from '../../services/systest/workflowState.ts'

import { ensureSystestResources, installPhase5BTestRunner } from '../../services/systest/resourceInstaller.ts'

import { getGraphEnhancer } from '../../services/systest/graphEnhancer.ts'

import { checkChromeMcpAvailableWithTimeout, formatChromeMcpStatus } from '../../services/systest/chromeMcpChecker.ts'

// Import graph freshness checker
import { showGraphUpdateWarning } from '../../utils/graphUpdatePrompt.ts'

export const call: LocalCommandCall = async (args, context) => {
  const parts = args.trim().split(/\s+/)
  const subcommand = parts[0] ?? 'run'
  const subArgs = parts.slice(1).join(' ')

  let text: string
  
  try {
    switch (subcommand) {
      case 'run':
        text = await systestRun(subArgs, context)
        break
      case 'status':
        text = await systestStatus()
        break
      case 'resume':
        text = await systestResume(subArgs)
        break
      case 'phase':
        text = await systestPhase(subArgs)
        break
      case 'report':
        text = await systestReport()
        break
      case 'init':
        text = await systestInit(subArgs)
        break
      case 'config':
        text = await systestConfig()
        break
      default:
        text = 'Unknown subcommand: ' + subcommand + '\nAvailable: run, status, resume, phase, report, init, config'
    }
  } catch (error) {
    text = 'Error: ' + (error instanceof Error ? error.message : String(error))
  }

  return { type: 'text', value: text }
}

// ---------------------------------------------------------------------------
// Subcommand Implementations
// ---------------------------------------------------------------------------

async function systestRun(args: string, context: any): Promise<string> {
  const lines: string[] = []
  
  lines.push('[systest] System Testing')
  lines.push('')
  
  // Check graph freshness before starting
  showGraphUpdateWarning(cwd())
  
  // Parse arguments and detect mode
  const parsed = parseArgsToContext(args, cwd())
  const detection = detectMode(parsed.workspace, parsed.designDocsDir)
  
  // Merge parsed args with detection
  const workspace = parsed.workspace || detection.workspace
  const designDocsDir = parsed.designDocsDir || detection.designDocsDir
  const mode = detection.mode
  
  lines.push('Mode ' + mode + ': ' + getModeTitle(mode))
  lines.push('Workspace: ' + workspace)
  if (designDocsDir) {
    lines.push('Design Docs: ' + designDocsDir)
  }
  if (parsed.backendUrl) {
    lines.push('Backend: ' + parsed.backendUrl)
  }
  if (parsed.frontendUrl) {
    lines.push('Frontend: ' + parsed.frontendUrl)
  }
  lines.push('')
  
  // Ensure resources are installed
  lines.push('[systest] Ensuring resources are installed...')
  const resourceStatus = await ensureSystestResources()
  lines.push('  Resources ' + (resourceStatus.installed ? 'installed' : 'updated') + ' (v' + resourceStatus.version + ')')

  // Install Phase 5B test runner eagerly so the first iteration does not race
  // with runner creation and so the AI agent cannot author its own fake runner
  // before ours is present. Also auto-adds `.systest/` to the workspace
  // `.gitignore`. Graceful on failure: per-iteration install in
  // phase5b_prompt_only.ts will retry each round.
  try {
    const runnerPath = await installPhase5BTestRunner(workspace)
    lines.push('  Phase 5B test runner installed: ' + runnerPath)
  } catch (e) {
    lines.push('  Initial runner install failed (will retry per iteration): ' + (e as Error).message)
  }
  lines.push('')

  // Initialize graph enhancer for the target workspace (not CWD)
  const graphEnhancer = getGraphEnhancer(workspace)
  let graphAvailable = graphEnhancer.isAvailable()
  
  // Auto-build graph if enabled and not available
  const config = parsed.config || getDefaultConfig()
  
  if (!graphAvailable && config.global.graphEnabled && config.global.graphAutoBuild) {
    lines.push('[systest] Knowledge graph not found. Building...')
    try {
      const { buildGraph } = await import('../../services/graphify/builder/index.ts')
      const { ensureGraphifyInGitignore } = await import('../../services/graphify/gitignoreHelper.ts')
      
      ensureGraphifyInGitignore(workspace)
      
      const result = await buildGraph({ rootDir: workspace })
      
      if (result.success) {
        lines.push('[systest] Graph built: ' + result.nodes.toLocaleString() + ' nodes, ' + result.edges.toLocaleString() + ' edges')

        // Reinitialize graph enhancer from the workspace's graph (not CWD)
        await graphEnhancer.reinitialize()
        graphAvailable = graphEnhancer.isAvailable()
      } else {
        lines.push('[systest] Graph build failed. Continuing without graph enhancement.')
      }
    } catch (error) {
      lines.push('[systest] Graph build error: ' + (error instanceof Error ? error.message : String(error)))
      lines.push('[systest] Continuing without graph enhancement.')
    }
  }
  
  if (graphAvailable) {
    lines.push('[systest] Knowledge graph available')
  } else {
    lines.push('[systest] Knowledge graph not available - running in reduced mode')
  }
  
  // Check Chrome MCP availability (required for Phase 5B/5C)
  const chromeMcpStatus = await checkChromeMcpAvailableWithTimeout(
    (config.global as any).environment_check?.chrome_mcp_check_timeout_seconds || 5000
  )
  
  if (chromeMcpStatus.available) {
    lines.push(formatChromeMcpStatus(chromeMcpStatus))
  } else {
    lines.push(formatChromeMcpStatus(chromeMcpStatus))
    if (parsed.backendUrl || parsed.frontendUrl) {
      lines.push('[systest] Phase 5B/5C require Chrome MCP for API/UI testing')
      lines.push('[systest] Install the Claude in Chrome extension to enable these features')
    }
  }
  lines.push('')
  
  // Setup output directory
  const outputDir = join(workspace, '.systest')
  
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(join(outputDir, 'docs'), { recursive: true })
  
  // Create workflow state
  const workflowState = createWorkflowState(mode, workspace, outputDir, {
    designDocsDir,
    frontendUrl: parsed.frontendUrl,
    backendUrl: parsed.backendUrl,
    databaseUrl: parsed.databaseUrl,
  })
  
  const systestContext: SystestContext = {
    mode,
    workspace,
    designDocsDir,
    frontendUrl: parsed.frontendUrl,
    backendUrl: parsed.backendUrl,
    databaseUrl: parsed.databaseUrl,
    outputDir,
    graphEngine: graphEnhancer.getEngine() || undefined,
    workflowState,
    config,
    nonInteractive: parsed.nonInteractive || false,
    chromeMcpAvailable: chromeMcpStatus.available,
    // Query AsyncGenerator context
    getCwd: () => cwd(),
    getTools: () => {
      // Import and return available MCP tools
      // This allows prompt-driven phases to use Claude in Chrome tools
      return undefined  // Will be populated by orchestrator if needed
    },
    mcpClients: [],  // MCP clients initialized by orchestrator
    toolUseContext: context,  // Pass ToolUseContext for Chrome MCP access
  }

  lines.push('')
  lines.push('[systest] Running phases...')

  // Run all phases
  const phases = getAllPhases()
  const phaseResults = await runPhases(systestContext, phases)

  // Add phase results to output
  for (const result of phaseResults) {
    const statusSymbol = result.status === 'completed' ? '✓' : result.status === 'skipped' ? '-' : '✗'
    const durationSec = Math.round(result.duration / 1000)
    const passInfo = result.passRate !== undefined ? ' (pass rate: ' + result.passRate + '%)' : ''
    lines.push('  [Phase ' + result.phaseId + '] ' + statusSymbol + ' ' + result.status + ' (' + durationSec + 's)' + passInfo)
    if (result.error) {
      lines.push('    Error: ' + result.error)
    }
  }


  // Report location
  lines.push('')
  lines.push('[systest] Reports generated:')
  lines.push('  Output directory: ' + outputDir)
  lines.push('  Main report: ' + join(outputDir, 'docs', 'TEST_REPORT.md'))
  lines.push('')

  return lines.join('\n')
}

async function systestStatus(): Promise<string> {
  const outputDir = join(cwd(), '.systest')
  
  const { loadWorkflowState, getWorkflowSummary } = await import(
    '../../services/systest/workflowState.ts'
  )
  
  const state = loadWorkflowState(outputDir)
  
  if (!state) {
    return 'No systest state found in current directory.\nUsage: /systest run --workspace <path>'
  }
  
  const lines: string[] = []
  lines.push('[systest] Status')
  lines.push('')
  lines.push(getWorkflowSummary(state))
  lines.push('')
  lines.push('Output: ' + state.output_dir)
  
  return lines.join('\n')
}

async function systestResume(args: string): Promise<string> {
  return '[systest] Resume functionality is integrated into /systest run.\nUse: /systest run --workspace <path>\nThe system will automatically skip completed phases.'
}

async function systestPhase(args: string): Promise<string> {
  return '[systest] Running specific phases is not yet implemented.\nUse: /systest run to run all phases (with automatic resume support)'
}

async function systestReport(): Promise<string> {
  const outputDir = join(cwd(), '.systest')
  const reportPath = join(outputDir, 'docs', 'TEST_REPORT.md')
  
  const { existsSync, readFileSync } = await import('node:fs')
  
  if (!existsSync(reportPath)) {
    return 'No test report found.\nExpected location: ' + reportPath + '\nRun /systest run to generate reports.'
  }
  
  return '[systest] Test Report\nLocation: ' + reportPath + '\n\n' + readFileSync(reportPath, 'utf-8')
}

async function systestInit(args: string): Promise<string> {
  const lines: string[] = []
  
  lines.push('[systest] Initializing systest resources...')
  
  const status = await ensureSystestResources()
  
  lines.push('  Resources ' + (status.installed ? 'installed' : 'updated') + ' (v' + status.version + ')')
  lines.push('')
  lines.push('[systest] Resources installed successfully')
  lines.push('')
  lines.push('Next steps:')
  lines.push('  1. Run: /systest run --workspace <path>')
  lines.push('  2. For design docs: /systest run --workspace <path> --design-docs <path>')
  lines.push('')
  
  return lines.join('\n')
}

async function systestConfig(): Promise<string> {
  const { getSystestResourceDir } = await import('../../utils/metaCoderHome.ts')
  const { existsSync, readFileSync } = await import('node:fs')
  
  const configDir = getSystestResourceDir()
  const configPath = join(configDir, 'config', 'phase-control.json')
  
  if (!existsSync(configPath)) {
    return 'No configuration found.\nExpected location: ' + configPath + '\nRun /systest init to install default configuration.'
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  
  const lines: string[] = []
  lines.push('[systest] Configuration')
  lines.push('')
  lines.push('Global Settings:')
  lines.push('  Target Pass Rate (5B): ' + config.global.target_pass_rate_5b + '%')
  lines.push('  Target Pass Rate (5C): ' + config.global.target_pass_rate_5c + '%')
  lines.push('  Graph Enabled: ' + config.global.graph_enabled)
  lines.push('  Auto Build Graph: ' + config.global.graph_auto_build)
  lines.push('  Stop on Failure: ' + config.global.stop_on_failure)
  lines.push('')
  lines.push('Phase Timeouts:')
  for (const [phase, timeout] of Object.entries(config.phase_timeouts)) {
    lines.push('  ' + phase + ': ' + timeout + 's')
  }
  
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModeTitle(mode: string): string {
  const titles: Record<string, string> = {
    A: 'Source Code Only',
    B: 'Source Code + Design Documents',
    C: 'Design Documents Only',
  }
  return titles[mode] || mode
}













