/**
 * internalExec.ts — Internal CLI dispatcher for metacoder binary.
 *
 * PURPOSE
 * -------
 * Bundled skill prompts used to run service functions via:
 *   node --input-type=module <<'EOF'
 *   import { initHarness } from './src/services/harness/init.js'
 *   ...
 *   EOF
 *
 * That pattern fails in user projects because `./src/services/...` paths do
 * not exist there. This dispatcher lets the compiled `metacoder` binary expose
 * the same service functions via:
 *
 *   echo '<json-args>' | metacoder _exec <op>
 *
 * The binary already contains all service code (bundled by `bun build --compile`),
 * so this works both in user projects and from the meta-coder source tree.
 *
 * CALLING CONVENTION
 * ------------------
 * Args are read as JSON from STDIN (preferred) or from the MC_ARGS env var.
 * The operation name is the first positional argument after `_exec`.
 *
 * On success:   stdout receives JSON.stringify(result, null, 2), exit 0.
 * On error:     stderr receives JSON.stringify({ error: { message, kind, detail } }), exit 1.
 *
 * EXAMPLE
 * -------
 *   echo '{"workspacePath":"/my/project","template":"minimal"}' \
 *     | metacoder _exec harness.init
 *
 * REGISTRY
 * --------
 * Each key is "<module>.<fn>" (deduped). The handler receives the parsed args
 * object and returns Promise<unknown>. Static ESM imports are used so the
 * bundler includes all referenced modules.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

// --- harness service imports ---
import { initHarness } from '../services/harness/init.js'
import {
  loadHarness,
  validateLayout,
  isHarnessInitialized,
} from '../services/harness/loader.js'
import { harnessLint } from '../services/harness/lint.js'
import { loadGates, runGate } from '../services/harness/gates/runner.js'
import {
  loadPhaseState,
  savePhaseState,
  initPhaseState,
} from '../services/harness/workflow/phaseState.js'
import { loadPhasesConfig } from '../services/harness/workflow/phasesLoader.js'
import { advancePhase, rollbackPhase } from '../services/harness/workflow/phaseEngine.js'
import { loadRollbackPolicy } from '../services/harness/workflow/rollbackLoader.js'
import { appendAudit } from '../services/harness/audit/auditLog.js'
import {
  assumeRole,
} from '../services/harness/agents/roleAssumer.js'
import { writePersonaBlockToCLAUDEMD } from '../services/harness/agents/personaInjector.js'
import { resolveRoleForPhase } from '../services/harness/agents/phaseRoleResolver.js'
import {
  loadPolicy,
} from '../services/harness/context/policy.js'
import { loadPhaseTriggers } from '../services/harness/context/phaseTriggersLoader.js'
import {
  buildSnapshot,
  buildOnDemand,
} from '../services/harness/context/contextManager.js'
import {
  renderSnapshotToBlock,
  writeContextBlockToCLAUDEMD,
} from '../services/harness/context/promptInjector.js'
import { runDrill, type DrillOptions } from '../services/harness/advanced/drill.js'
import { computeAiRate } from '../services/harness/advanced/aiRate.js'
import { writeCiScaffold } from '../services/harness/ciInit.js'

// --- harness spec-kit imports (v3.1.0) ---
import {
  getHarnessSpecConfig,
} from '../services/harness/spec/config.js'
import {
  loadConstitution,
  validateConstitution,
} from '../services/harness/spec/constitution.js'
import {
  runCrossArtifactAnalysis,
  readActiveFeature,
} from '../services/harness/spec/crossArtifact.js'
import {
  parseTasksStatus,
  generateTasksFromPlan,
  saveSidecarStatus,
  type TaskStatus,
} from '../services/harness/spec/tasks.js'
import { scanClarifications } from '../services/harness/spec/clarify.js'
import { initFeatureSpec } from '../services/harness/spec/specInit.js'

// --- env service imports ---
import { listCatalog } from '../services/envManager/deployment/skillCatalog.js'
import { plan } from '../services/envManager/deployment/skillOrchestrator.js'
import { preview, cancel } from '../services/envManager/safety/twoPhaseCommit.js'
import { importDotenv } from '../services/envManager/dotenvImporter.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Handler = (args: Record<string, unknown>) => Promise<unknown>

interface ErrorOutput {
  error: {
    message: string
    kind: string
    detail?: unknown
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Registry of all dispatchable operations. Key format: "<module>.<fn>" */
const REGISTRY: Record<string, Handler> = {
  // harness.init
  'harness.init': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const template = (args['template'] as string | undefined) ?? 'minimal'
    const force = Boolean(args['force'] ?? false)
    const minimal = Boolean(args['minimal'] ?? false)
    const ciTarget = (args['ciTarget'] as string | undefined) ?? 'none'
    return initHarness({ workspacePath, template: template as Parameters<typeof initHarness>[0]['template'], force, minimal, ciTarget: ciTarget as Parameters<typeof initHarness>[0]['ciTarget'] })
  },

  // harness.loadLayout (loadHarness)
  'harness.loadLayout': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    return loadHarness(workspacePath)
  },

  // harness.validate (loadHarness + validateLayout)
  'harness.validate': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const layout = await loadHarness(workspacePath)
    const result = await validateLayout(layout)
    return result
  },

  // harness.status (isHarnessInitialized + loadHarness + validateLayout)
  'harness.status': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const initialized = await isHarnessInitialized(workspacePath)
    if (!initialized) return { initialized: false }
    const layout = await loadHarness(workspacePath)
    const validation = await validateLayout(layout)
    return { initialized: true, layout, validation }
  },

  // harness.lint
  'harness.lint': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    return harnessLint(workspacePath)
  },

  // harness.loadGates
  'harness.loadGates': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const config = await loadGates(workspacePath)
    return Object.keys(config.gates)
  },

  // harness.runGate
  'harness.runGate': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const gateId = String(args['gateId'] ?? '')
    if (!gateId) throw new Error('gateId is required')
    return runGate(gateId, workspacePath)
  },

  // harness.loadPhaseState
  'harness.loadPhaseState': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const layout = await loadHarness(workspacePath)
    const state = await loadPhaseState(workspacePath)
    if (!state) return { initialized: false }
    return { state, layout }
  },

  // harness.loadPhasesConfig
  'harness.loadPhasesConfig': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    return loadPhasesConfig(workspacePath)
  },

  // harness.advancePhase
  'harness.advancePhase': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const state = await loadPhaseState(workspacePath)
    if (!state) return { error: 'not-initialized' }
    const phasesConfig = await loadPhasesConfig(workspacePath)
    if (!phasesConfig) return { error: 'no-phases-yaml' }
    const layout = await loadHarness(workspacePath)
    const gateResultJson = args['gateResultJson'] as string | undefined
    const gateResult = gateResultJson ? JSON.parse(gateResultJson) as Parameters<typeof advancePhase>[0]['gateResult'] : undefined
    const reason = (args['reason'] as string | undefined) || undefined
    return advancePhase({ workspacePath, layout, phasesConfig, currentState: state, gateResult, reason })
  },

  // harness.rollbackPhase
  'harness.rollbackPhase': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const state = await loadPhaseState(workspacePath)
    if (!state) return { error: 'not-initialized' }
    const phasesConfig = await loadPhasesConfig(workspacePath)
    if (!phasesConfig) return { error: 'no-phases-yaml' }
    const rollbackPolicy = await loadRollbackPolicy(workspacePath)
    const layout = await loadHarness(workspacePath)
    const reason = (args['reason'] as string | undefined) || undefined
    return rollbackPhase({ workspacePath, layout, phasesConfig, currentState: state, rollbackPolicy, reason })
  },

  // harness.initPhaseState
  'harness.initPhaseState': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const phasesConfig = await loadPhasesConfig(workspacePath)
    if (!phasesConfig) return { error: 'no-phases-yaml' }
    const targetPhase = (args['targetPhase'] as string | undefined) || phasesConfig.default_phase
    const state = await initPhaseState(workspacePath, targetPhase as Parameters<typeof initPhaseState>[1])
    await appendAudit(workspacePath, {
      timestamp: new Date().toISOString(),
      workspacePath,
      phase: targetPhase as Parameters<typeof appendAudit>[1]['phase'],
      role: null,
      actor: 'harness-engine',
      kind: 'phase-init',
      summary: `Phase state initialized at "${targetPhase}"`,
    })
    return state
  },

  // harness.appendAudit
  'harness.appendAudit': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const entry = args['entry'] as Parameters<typeof appendAudit>[1]
    await appendAudit(workspacePath, entry)
    return { ok: true }
  },

  // harness.assumeRole
  'harness.assumeRole': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const currentState = await loadPhaseState(workspacePath)
    if (!currentState) return { error: 'not-initialized' }
    const layout = await loadHarness(workspacePath)
    const role = args['role'] as Parameters<typeof assumeRole>[0]['role']
    const reason = (args['reason'] as string | undefined) || undefined
    const { next, assumption } = await assumeRole({ workspacePath, layout, currentState, role, fromPhaseAuto: false, reason })
    await savePhaseState(next)
    await writePersonaBlockToCLAUDEMD(workspacePath, assumption.personaBlock)
    await appendAudit(workspacePath, {
      timestamp: new Date().toISOString(),
      workspacePath,
      phase: next.current,
      role: next.activeRole,
      actor: 'harness-skill',
      kind: 'role-assume',
      summary: `Role manually set to "${role}"`,
      detail: { fromPhaseAuto: false, role, reason },
    })
    return { ok: true, role: next.activeRole, manualRole: next.manualRole }
  },

  // harness.getActiveRole
  'harness.getActiveRole': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const state = await loadPhaseState(workspacePath)
    const phasesConfig = await loadPhasesConfig(workspacePath)
    const phaseDefault = state && phasesConfig && state.current
      ? resolveRoleForPhase(phasesConfig, state.current)
      : null
    return { state, phaseDefault }
  },

  // harness.autoAssumeRole (post-advance role auto-assume)
  'harness.autoAssumeRole': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const state = await loadPhaseState(workspacePath)
    if (!state || !state.current) return { autoAssumed: false }
    if (state.manualRole) {
      return { autoAssumed: false, reason: 'manual-override-active', manualRole: state.manualRole }
    }
    const phasesConfig = await loadPhasesConfig(workspacePath)
    const defaultRole = phasesConfig ? resolveRoleForPhase(phasesConfig, state.current) : null
    if (!defaultRole) return { autoAssumed: false, reason: 'no-default-role' }
    const layout = await loadHarness(workspacePath)
    const { next, assumption } = await assumeRole({
      workspacePath, layout, currentState: state, role: defaultRole, fromPhaseAuto: true,
      reason: `auto-assume on advance to ${state.current}`,
    })
    await savePhaseState(next)
    await writePersonaBlockToCLAUDEMD(workspacePath, assumption.personaBlock)
    await appendAudit(workspacePath, {
      timestamp: new Date().toISOString(), workspacePath, phase: next.current, role: next.activeRole,
      actor: 'harness-engine', kind: 'role-assume',
      summary: `Auto-assumed role "${defaultRole}" for phase "${state.current}"`,
      detail: { fromPhaseAuto: true, role: defaultRole },
    })
    return { autoAssumed: true, role: defaultRole }
  },

  // harness.buildSnapshot (context show)
  'harness.buildSnapshot': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const layout = await loadHarness(workspacePath)
    const policy = await loadPolicy(layout)
    const triggers = await loadPhaseTriggers(workspacePath)
    let phaseId: string | null = null
    let role: string | null = null
    try {
      const state = await loadPhaseState(workspacePath)
      if (state) { phaseId = state.current; role = state.activeRole }
    } catch { /* graceful degrade */ }
    const snapshot = await buildSnapshot({
      workspacePath, layout,
      phaseId: phaseId as Parameters<typeof buildSnapshot>[0]['phaseId'],
      role: role as Parameters<typeof buildSnapshot>[0]['role'],
      policy, triggers,
    })
    const block = renderSnapshotToBlock(snapshot)
    return {
      block,
      totalTokens: snapshot.totalTokens,
      budgetUsed: snapshot.budgetUsed,
      entries: snapshot.entries.length,
    }
  },

  // harness.refreshContext (context refresh)
  'harness.refreshContext': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const layout = await loadHarness(workspacePath)
    const policy = await loadPolicy(layout)
    const triggers = await loadPhaseTriggers(workspacePath)
    let phaseId: string | null = null
    let role: string | null = null
    try {
      const state = await loadPhaseState(workspacePath)
      if (state) { phaseId = state.current; role = state.activeRole }
    } catch { /* graceful degrade */ }
    const snapshot = await buildSnapshot({
      workspacePath, layout,
      phaseId: phaseId as Parameters<typeof buildSnapshot>[0]['phaseId'],
      role: role as Parameters<typeof buildSnapshot>[0]['role'],
      policy, triggers,
    })
    const block = renderSnapshotToBlock(snapshot)
    await writeContextBlockToCLAUDEMD(workspacePath, block)
    await appendAudit(workspacePath, {
      timestamp: new Date().toISOString(), workspacePath,
      phase: phaseId as Parameters<typeof appendAudit>[1]['phase'],
      role: role as Parameters<typeof appendAudit>[1]['role'],
      actor: 'harness-context', kind: 'context-load',
      summary: `Context refreshed: ${snapshot.totalTokens} tokens (${snapshot.entries.length} entries)`,
      detail: { budgetUsed: snapshot.budgetUsed, entriesCount: snapshot.entries.length },
    })
    return { ok: true, totalTokens: snapshot.totalTokens, budgetUsed: snapshot.budgetUsed }
  },

  // harness.queryContext (context query)
  'harness.queryContext': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const query = String(args['query'] ?? '')
    const layout = await loadHarness(workspacePath)
    const policy = await loadPolicy(layout)
    const entries = await buildOnDemand(layout, query, policy)
    return { entries, totalTokens: entries.reduce((s, e) => s + e.approxTokens, 0) }
  },

  // harness.approveGate
  'harness.approveGate': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const gateId = String(args['gateId'] ?? '')
    const reason = String(args['reason'] ?? '')
    if (!gateId) return { error: 'no-gate-id' }
    const state = await loadPhaseState(workspacePath)
    const phaseId = state?.current ?? 'unknown-phase'
    const role = state?.activeRole ?? 'human'
    const approvalDir = path.join(workspacePath, '.metacoder', 'audit', 'approvals')
    await fs.mkdir(approvalDir, { recursive: true })
    const filePath = path.join(approvalDir, `${gateId}-${phaseId}.yaml`)
    const approvedAt = new Date().toISOString()
    const approvedBy = process.env['USER'] || process.env['USERNAME'] || 'unknown'
    const yamlBody = [
      'approved: true',
      `approvedAt: "${approvedAt}"`,
      `approvedBy: "${approvedBy}"`,
      `role: "${role}"`,
      `gateId: "${gateId}"`,
      `phaseId: "${phaseId}"`,
      reason ? `reason: "${reason.replace(/"/g, '\\"')}"` : '',
    ].filter(Boolean).join('\n') + '\n'
    await fs.writeFile(filePath, yamlBody)
    await appendAudit(workspacePath, {
      timestamp: approvedAt, workspacePath,
      phase: phaseId as Parameters<typeof appendAudit>[1]['phase'],
      role: role as Parameters<typeof appendAudit>[1]['role'],
      actor: approvedBy, kind: 'role-assume',
      summary: `Human approval recorded for gate "${gateId}"${reason ? ' — ' + reason : ''}`,
      detail: { gateId, phaseId, approvedAt, approvedBy, reason },
    })
    return { ok: true, file: filePath }
  },

  // harness.runDrill
  'harness.runDrill': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const skipGates = Boolean(args['skipGates'] ?? false)
    const phaseFrom = args['phaseFrom'] as DrillOptions['phaseFrom'] | undefined
    const phaseTo = args['phaseTo'] as DrillOptions['phaseTo'] | undefined
    const drillOptions: DrillOptions = { skipGates }
    if (phaseFrom) drillOptions.phaseFrom = phaseFrom
    if (phaseTo) drillOptions.phaseTo = phaseTo
    return runDrill({ workspacePath, options: drillOptions })
  },

  // harness.writeCiScaffold
  'harness.writeCiScaffold': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const target = (args['target'] as string | undefined) ?? 'github'
    const force = Boolean(args['force'] ?? false)
    return writeCiScaffold({
      workspacePath,
      target: target as Parameters<typeof writeCiScaffold>[0]['target'],
      force,
    })
  },

  // harness.runAiRate
  'harness.runAiRate': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const sinceDays = parseInt(String(args['sinceDays'] ?? '30'), 10)
    return computeAiRate({ workspacePath, sinceDays })
  },

  // ---- spec-kit ops (v3.1.0) -----------------------------------------------

  // harness.constitutionValidate
  'harness.constitutionValidate': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.constitution) return { ok: true, skipped: 'constitution feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const constitution = await loadConstitution(workspacePath)
    if (!constitution) return { ok: true, skipped: 'no constitution.md found' }
    const result = validateConstitution(constitution)
    return result
  },

  // harness.constitutionShow
  'harness.constitutionShow': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.constitution) return { ok: true, skipped: 'constitution feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const constitution = await loadConstitution(workspacePath)
    if (!constitution) return { present: false }
    return {
      present: true,
      projectName: constitution.projectName,
      adoptedAt: constitution.adoptedAt,
      version: constitution.version,
      articleCount: constitution.articles.length,
      articles: constitution.articles.map((a) => ({
        number: a.number,
        title: a.title,
        gate: a.gate ?? null,
      })),
    }
  },

  // harness.activeFeature
  'harness.activeFeature': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.perFeature) return { ok: true, skipped: 'perFeature feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId = await readActiveFeature(workspacePath)
    return { featureId: featureId ?? null }
  },

  // harness.crossArtifactAnalyze
  'harness.crossArtifactAnalyze': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.analyze) return { ok: true, skipped: 'analyze feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId = (args['featureId'] as string | undefined) || undefined
    return runCrossArtifactAnalysis({ workspacePath, featureId })
  },

  // harness.tasksStatus
  'harness.tasksStatus': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.autoTasks) return { ok: true, skipped: 'autoTasks feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId =
      (args['featureId'] as string | undefined) ??
      (await readActiveFeature(workspacePath))
    if (!featureId) return { ok: true, skipped: 'no active feature' }
    const result = await parseTasksStatus(workspacePath, featureId)
    if (!result) return { ok: true, skipped: 'no tasks.md found', featureId }
    return result
  },

  // harness.tasksGenerate
  'harness.tasksGenerate': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.autoTasks) return { ok: true, skipped: 'autoTasks feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId =
      (args['featureId'] as string | undefined) ??
      (await readActiveFeature(workspacePath))
    if (!featureId) return { ok: false, error: 'no active feature' }
    return generateTasksFromPlan(workspacePath, featureId)
  },

  // harness.clarifyList
  'harness.clarifyList': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.clarify) return { ok: true, skipped: 'clarify feature disabled', unresolved: 0, markers: [] }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId = (args['featureId'] as string | undefined) || undefined
    return scanClarifications(workspacePath, featureId)
  },

  // harness.specInit
  'harness.specInit': async (args) => {
    const cfg = getHarnessSpecConfig()
    if (!cfg.features.perFeature) return { ok: true, skipped: 'perFeature feature disabled' }
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureName = String(args['featureName'] ?? 'unnamed-feature')
    return initFeatureSpec(workspacePath, featureName)
  },

  // harness.testSpecScaffold
  // Emit a stub harness/specs/<feat>/test-plan.md from tasks.md so the tester
  // has a YAML-frontmatter skeleton matching what test-spec-checklist expects.
  // Does NOT overwrite an existing file.
  'harness.testSpecScaffold': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId =
      (args['featureId'] as string | undefined) ??
      (await readActiveFeature(workspacePath))
    if (!featureId) return { ok: false, error: 'no active feature' }

    const specsDir = path.join(workspacePath, 'harness', 'specs', featureId)
    const tasksPath = path.join(specsDir, 'tasks.md')
    const planOutPath = path.join(specsDir, 'test-plan.md')

    // Check for existing file (do NOT overwrite)
    try {
      await fs.stat(planOutPath)
      return { ok: true, path: planOutPath, alreadyExists: true }
    } catch {
      // ok — does not exist
    }

    // Read tasks.md
    let tasksRaw: string
    try {
      tasksRaw = await fs.readFile(tasksPath, 'utf8')
    } catch {
      return { ok: false, error: 'tasks.md not found', tasksPath }
    }

    // Extract task IDs (T-NNN), unique + ordered
    const seen = new Set<string>()
    const taskIds: string[] = []
    for (const m of tasksRaw.matchAll(/\[(T-\d+)\]/g)) {
      const id = m[1] ?? ''
      if (id && !seen.has(id)) {
        seen.add(id)
        taskIds.push(id)
      }
    }
    if (taskIds.length === 0) {
      return { ok: false, error: 'no task IDs found in tasks.md', tasksPath }
    }

    // Build cases: one happy-path + one error-path per task with ≥30-char stub
    // text that obviously needs to be filled in.
    const STUB_GIVEN =
      'TODO: describe preconditions and fixture state for this case.'
    const STUB_WHEN =
      'TODO: describe the action under test (function call, request, event).'
    const STUB_THEN =
      'TODO: describe the expected outcome, side effects, and assertions.'

    const cases: Array<Record<string, string>> = []
    for (const id of taskIds) {
      cases.push({
        taskId: id,
        title: `${id} — happy path (stub)`,
        category: 'happy-path',
        given: STUB_GIVEN,
        when: STUB_WHEN,
        then: STUB_THEN,
      })
      cases.push({
        taskId: id,
        title: `${id} — error path (stub)`,
        category: 'error-path',
        given: STUB_GIVEN,
        when: STUB_WHEN,
        then: STUB_THEN,
      })
    }

    const frontmatterObj = {
      feature: featureId,
      generated_at: new Date().toISOString(),
      author: 'scaffold',
      cases,
    }
    const frontmatter = YAML.stringify(frontmatterObj)

    const body =
      `\n# Test plan — ${featureId}\n\n` +
      `Auto-scaffolded by \`harness.testSpecScaffold\`. ` +
      `Each case above is a stub: replace the TODO text in given/when/then ` +
      `with concrete content (≥30 chars per field) before running gate-test-spec.\n`

    const content = `---\n${frontmatter}---\n${body}`

    await fs.mkdir(specsDir, { recursive: true })
    await fs.writeFile(planOutPath, content, 'utf8')

    return {
      ok: true,
      path: planOutPath,
      taskCount: taskIds.length,
      casesGenerated: cases.length,
      alreadyExists: false,
    }
  },

  // harness.implementNext
  // Read-only context aggregator that picks the next not-done task (or a
  // consecutive [P] batch) from tasks.md, joins it with test-plan.md cases,
  // and writes docs/IMPLEMENT_PLAN.md. Does not mutate any spec/code files.
  'harness.implementNext': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())

    // 1. Phase must be 'implementation'
    const state = await loadPhaseState(workspacePath)
    if (!state) {
      return { ok: false, error: 'phase state not initialized' }
    }
    if (state.current !== 'implementation') {
      return {
        ok: false,
        error: 'not in implementation phase',
        currentPhase: state.current,
      }
    }

    // 2. Resolve feature
    const featureId =
      (args['featureId'] as string | undefined) ??
      (await readActiveFeature(workspacePath))
    if (!featureId) return { ok: false, error: 'no active feature' }

    // 3. Read tasks.md
    const tasksStatus = await parseTasksStatus(workspacePath, featureId)
    if (!tasksStatus) {
      return { ok: false, error: 'tasks.md not found', featureId }
    }
    if (tasksStatus.total === 0) {
      return { ok: false, error: 'tasks.md has no [T-NNN] tasks', featureId }
    }

    // 4. Find next not-done task (+ optional [P] batch starting at it)
    const tasks = tasksStatus.tasks
    const firstNotDoneIdx = tasks.findIndex((t) => t.status !== 'done')
    if (firstNotDoneIdx === -1) {
      return { ok: true, allDone: true, taskIds: [], featureId }
    }

    const batch: typeof tasks = []
    const head = tasks[firstNotDoneIdx]!
    batch.push(head)
    if (head.parallel) {
      for (let i = firstNotDoneIdx + 1; i < tasks.length; i++) {
        const t = tasks[i]!
        if (t.parallel && t.status !== 'done') batch.push(t)
        else break
      }
    }
    const targetIds = batch.map((t) => t.id)
    const targetIdSet = new Set(targetIds)

    // 5. Read plan.md (best-effort) and test-plan.md (best-effort)
    const specsDir = path.join(workspacePath, 'harness', 'specs', featureId)
    let planMd = ''
    try {
      planMd = await fs.readFile(path.join(specsDir, 'plan.md'), 'utf8')
    } catch {
      /* tolerate */
    }
    let testPlanMd = ''
    try {
      testPlanMd = await fs.readFile(path.join(specsDir, 'test-plan.md'), 'utf8')
    } catch {
      /* tolerate */
    }

    // 6. Extract test-plan cases for our target IDs (parse YAML frontmatter)
    interface RawCase {
      taskId?: string
      title?: string
      category?: string
      given?: string
      when?: string
      then?: string
    }
    let relevantCases: RawCase[] = []
    if (testPlanMd) {
      const fmMatch = testPlanMd.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
      const body = fmMatch ? fmMatch[1] : testPlanMd
      try {
        const parsed = YAML.parse(body!) as { cases?: RawCase[] } | null
        if (parsed && Array.isArray(parsed.cases)) {
          relevantCases = parsed.cases.filter(
            (c) => typeof c.taskId === 'string' && targetIdSet.has(c.taskId),
          )
        }
      } catch {
        /* tolerate */
      }
    }

    // 7. Best-effort FILES-TO-TOUCH extraction from plan.md
    //    Look for lines like `path/to/file.ts` or `src/foo.ts` referenced in
    //    sections that mention any of our target IDs. This is intentionally
    //    a hint, not authoritative — the developer must verify.
    const filesToTouch: string[] = []
    if (planMd) {
      const fileRegex = /[`"']?((?:src|tests?|docs|harness)\/[A-Za-z0-9_./-]+\.[A-Za-z]+)[`"']?/g
      const seenFiles = new Set<string>()
      for (const m of planMd.matchAll(fileRegex)) {
        const fp = m[1] ?? ''
        if (fp && !seenFiles.has(fp)) {
          seenFiles.add(fp)
          filesToTouch.push(fp)
        }
      }
    }

    // 8. Build IMPLEMENT_PLAN.md
    const lines: string[] = []
    lines.push(`# Implement plan — ${featureId}`)
    lines.push('')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Source: harness.implementNext`)
    lines.push('')
    lines.push(`## TASK(S)`)
    lines.push('')
    for (const t of batch) {
      lines.push(
        `- **[${t.id}]**${t.parallel ? ' [P]' : ''} ${t.description || '(no description)'}`,
      )
    }
    lines.push('')
    lines.push(`## WHAT-TO-IMPLEMENT (from plan.md)`)
    lines.push('')
    if (planMd) {
      // Include plan.md verbatim. The developer reads this for design intent.
      // We do NOT try to slice by task — most plans are short.
      lines.push('```markdown')
      lines.push(planMd.trim())
      lines.push('```')
    } else {
      lines.push('_plan.md not found — proceed using spec.md + tasks.md only._')
    }
    lines.push('')
    lines.push(`## ACCEPTANCE CRITERIA (from test-plan.md)`)
    lines.push('')
    if (relevantCases.length === 0) {
      lines.push(
        '_No test-plan cases found for the target task(s). The developer ' +
          'must hand-derive acceptance criteria from spec.md._',
      )
    } else {
      for (const c of relevantCases) {
        lines.push(
          `### ${c.taskId ?? '?'} — ${c.title ?? '(untitled)'} (${c.category ?? '?'})`,
        )
        lines.push('')
        lines.push(`- **Given**: ${(c.given ?? '').trim()}`)
        lines.push(`- **When**: ${(c.when ?? '').trim()}`)
        lines.push(`- **Then**: ${(c.then ?? '').trim()}`)
        lines.push('')
      }
    }
    lines.push(`## FILES-TO-TOUCH (best-effort hint)`)
    lines.push('')
    if (filesToTouch.length === 0) {
      lines.push(
        '_No file hints extracted from plan.md. The developer must decide ' +
          'which files to touch based on the spec and existing code._',
      )
    } else {
      for (const f of filesToTouch) lines.push(`- \`${f}\``)
    }
    lines.push('')

    const planPath = path.join(workspacePath, 'docs', 'IMPLEMENT_PLAN.md')
    await fs.mkdir(path.dirname(planPath), { recursive: true })
    await fs.writeFile(planPath, lines.join('\n'), 'utf8')

    return {
      ok: true,
      planPath,
      taskIds: targetIds,
      featureId,
      allDone: false,
    }
  },

  // harness.markTasksDone
  // Helper used by /harness implement after the developer completes a batch.
  // Updates the tasks-status.yaml sidecar to mark the listed task IDs as done.
  'harness.markTasksDone': async (args) => {
    const workspacePath = String(args['workspacePath'] ?? process.cwd())
    const featureId =
      (args['featureId'] as string | undefined) ??
      (await readActiveFeature(workspacePath))
    if (!featureId) return { ok: false, error: 'no active feature' }
    const taskIds = (args['taskIds'] as string[] | undefined) ?? []
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return { ok: false, error: 'taskIds is required (non-empty array)' }
    }
    const status = await parseTasksStatus(workspacePath, featureId)
    if (!status) return { ok: false, error: 'tasks.md not found', featureId }
    const map = new Map<string, TaskStatus>()
    for (const t of status.tasks) map.set(t.id, t.status)
    for (const id of taskIds) map.set(id, 'done')
    const specsDir = path.join(workspacePath, 'harness', 'specs', featureId)
    await saveSidecarStatus(specsDir, map)
    return { ok: true, featureId, marked: taskIds }
  },

  // ---- end spec-kit ops -----------------------------------------------------

  // deploy.listSkills
  'deploy.listSkills': async (_args) => {
    return listCatalog()
  },

  // deploy.plan
  'deploy.plan': async (args) => {
    const intent = (args['intent'] as string | undefined) ?? 'deploy'
    const reason = (args['reason'] as string | undefined) || undefined
    const dryRun = Boolean(args['dryRun'] ?? false)
    return plan({
      intent: intent as Parameters<typeof plan>[0]['intent'],
      reason,
      dryRun,
    })
  },

  // deploy.preview (2-phase commit)
  'deploy.preview': async (args) => {
    const command = String(args['command'] ?? '')
    const skillArgs = (args['args'] as string[] | undefined) ?? []
    const description = String(args['description'] ?? '')
    const envName = String(args['envName'] ?? '')
    const reason = (args['reason'] as string | undefined) || undefined
    const rollbackPlan = String(args['rollbackPlan'] ?? '')
    const op = preview(
      { kind: 'cli', command, args: skillArgs },
      { description, envName, reason, rollbackPlan },
    )
    return { id: op.id, expiresAt: op.expiresAt }
  },

  // deploy.cancel
  'deploy.cancel': async (args) => {
    const id = String(args['id'] ?? '')
    return cancel(id)
  },

  // env.importDotenv
  'env.importDotenv': async (args) => {
    const importPath = String(args['importPath'] ?? '')
    const asEnvName = String(args['asEnvName'] ?? '')
    if (!importPath) throw new Error('importPath is required')
    return importDotenv(importPath, { asEnvName })
  },
}

// ---------------------------------------------------------------------------
// Input reading
// ---------------------------------------------------------------------------

/**
 * Read JSON args from MC_ARGS env var (first) or from stdin.
 * Returns parsed object or throws on JSON parse failure.
 */
async function readArgs(): Promise<Record<string, unknown>> {
  const fromEnv = process.env['MC_ARGS']
  if (fromEnv) {
    return JSON.parse(fromEnv) as Record<string, unknown>
  }
  // Read all stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Entry point for `metacoder _exec <op> [...]`.
 *
 * @param argv  Remaining argv after the `_exec` token (first element is op name).
 */
export async function runInternalExec(argv: string[]): Promise<void> {
  const op = argv[0]

  if (!op) {
    const errorOut: ErrorOutput = {
      error: {
        message: 'No operation specified. Usage: metacoder _exec <op>',
        kind: 'no-op',
        detail: { available: Object.keys(REGISTRY) },
      },
    }
    process.stderr.write(JSON.stringify(errorOut) + '\n')
    process.exit(1)
  }

  const handler = REGISTRY[op]
  if (!handler) {
    const errorOut: ErrorOutput = {
      error: {
        message: `Unknown operation: "${op}"`,
        kind: 'unknown-op',
        detail: { available: Object.keys(REGISTRY) },
      },
    }
    process.stderr.write(JSON.stringify(errorOut) + '\n')
    process.exit(1)
  }

  let args: Record<string, unknown>
  try {
    args = await readArgs()
  } catch (err) {
    const errorOut: ErrorOutput = {
      error: {
        message: `Failed to parse JSON args: ${(err as Error).message}`,
        kind: 'json-parse-error',
        detail: { raw: process.env['MC_ARGS'] },
      },
    }
    process.stderr.write(JSON.stringify(errorOut) + '\n')
    process.exit(1)
  }

  try {
    const result = await handler(args)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exit(0)
  } catch (err) {
    const e = err as Error & { kind?: string; detail?: unknown }
    const errorOut: ErrorOutput = {
      error: {
        message: e.message ?? String(err),
        kind: e.kind ?? 'runtime-error',
        detail: e.detail,
      },
    }
    process.stderr.write(JSON.stringify(errorOut) + '\n')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Export registry for tests
// ---------------------------------------------------------------------------

export { REGISTRY }
