/**
 * Shared utility functions for /modernize and /newproject skills.
 *
 * Provides argument parsing, directory scaffolding, knowledge-graph
 * integration, project-structure analysis, and document generation.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { auditFileOwnership } from './completionVerifier.js'
import { analyzeTimeline, runFunctionalTestGate } from './testGate.js'
import { verifyAcceptanceCriteria, summarizeResult as summarizeRuntimeResult } from './runtimeVerifier.js'
import { scanForSecrets } from './secretsScanner.js'

// Re-export Guard 4 so callers (e.g. systest, CLI tools) can invoke it without
// importing from the internal shared module path.
export { runFunctionalTestGate, analyzeTimeline }

// Wave-2 re-exports: runtime verifier + secrets scanner.
export { verifyAcceptanceCriteria, summarizeResult as summarizeRuntimeResult } from './runtimeVerifier.js'
export type { RuntimeVerifyResult, RuntimeVerifyConfig, AcceptanceCriterion, CriterionResult } from './runtimeVerifier.js'
export { scanForSecrets } from './secretsScanner.js'
export type { SecretFinding, SecretsScanResult } from './secretsScanner.js'

// Wave-2 re-exports: Frontend verification / API client generation helpers.
// Expose them from a single shared facade so external callers (systest, CLI
// wrappers, future skills) don't need to know the internal module layout.
export { generateApiClient, detectBackendDir } from './apiClientGenerator.js'
export type { ApiClientGenResult, BackendLaunchConfig } from './apiClientGenerator.js'
export { analyzePageStatically, auditFrontendPages, buildChromeMcpVerifyPlan } from './visualVerifier.js'
export type { StaticPageCheck, FrontendPagesAudit, ChromeMcpVerifyPlan } from './visualVerifier.js'
export { runFrontendTestGate, detectFrontendTestFramework, countFrontendTestFiles } from './frontendTestGate.js'
export type { FrontendTestResult, FrontendTestGateConfig } from './frontendTestGate.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectArgs {
  workspace: string
  output: string
  designDocsDir?: string
  databaseUrl?: string
  backendUrl?: string
  frontendUrl?: string
  referenceProject?: string
  language: string
  backendLang?: string   // language: "typescript", "python", "java", "php", "go", "csharp", "ruby", "rust"
  frontendLang?: string  // language: "typescript", "javascript", "dart" (flutter)
  designStyle?: string   // e.g. "stripe", "linear.app", "notion"
  teamMode?: boolean
  verify?: boolean       // -v/--verify: pause at Phase 1.5 (newproject) and Phase 3 for user review
  resume?: boolean       // --resume or auto-detected from done/ dir — skip Phase 1-3, go straight to Phase 4 with resume context
}

export interface ScreenshotInfo {
  path: string        // relative path from workspace
  screenName: string  // inferred screen name from filename
}

export interface ProjectStructure {
  techStack: { language: string; backend: string; frontend: string; database: string }
  entities: Array<{ name: string; fields: any[]; sourceFile: string }>
  routes: Array<{ method: string; path: string; handler: string; sourceFile: string }>
  services: Array<{ name: string; sourceFile: string }>
  communities: Array<{ id: number; label: string; size: number; godNodes: string[] }>
  graphStats: { nodes: number; edges: number } | null
  screenshots?: ScreenshotInfo[]
}

// ---------------------------------------------------------------------------
// 1. parseProjectArgs
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments shared by both /modernize and /newproject.
 *
 * Supported flags:
 *   --workspace / -w        target workspace path
 *   --output / -o           output directory  (default: workspace itself)
 *   --design-docs / -d      requirements / design documents directory
 *   --database / --db       database connection URL
 *   --backend-url / -b      backend URL (testing phase)
 *   --frontend-url / -f     frontend URL (testing phase)
 *   --reference / -r        reference project path (newproject)
 *   --language / -l         documentation language (default: 'ja')
 *   --backend-lang          backend language/framework (e.g. hono, fastapi, spring-boot)
 *   --frontend-lang         frontend language/framework (e.g. react, vue, nextjs)
 *   --design-style          design style reference (e.g. stripe, linear.app, notion)
 */
export function parseProjectArgs(args: string): ProjectArgs {
  const parts = args.split(/\s+/)
  let workspace = ''
  let output = ''
  let designDocsDir: string | undefined
  let databaseUrl: string | undefined
  let backendUrl: string | undefined
  let frontendUrl: string | undefined
  let referenceProject: string | undefined
  let language = 'ja'
  let backendLang: string | undefined
  let frontendLang: string | undefined
  let designStyle: string | undefined
  let teamMode = false
  let verify = false
  let resume = false

  let i = 0
  // Skip a leading subcommand such as "run"
  if (parts[0] === 'run') i = 1

  for (; i < parts.length; i++) {
    const p = parts[i]
    if ((p === '--workspace' || p === '-w') && i + 1 < parts.length) { workspace = parts[++i]; continue }
    if ((p === '--output' || p === '-o') && i + 1 < parts.length) { output = parts[++i]; continue }
    if ((p === '--design-docs' || p === '-d') && i + 1 < parts.length) { designDocsDir = parts[++i]; continue }
    if ((p === '--database' || p === '--db') && i + 1 < parts.length) { databaseUrl = parts[++i]; continue }
    if ((p === '--backend-url' || p === '-b') && i + 1 < parts.length) { backendUrl = parts[++i]; continue }
    if ((p === '--frontend-url' || p === '-f') && i + 1 < parts.length) { frontendUrl = parts[++i]; continue }
    if ((p === '--reference' || p === '-r') && i + 1 < parts.length) { referenceProject = parts[++i]; continue }
    if ((p === '--language' || p === '-l') && i + 1 < parts.length) { language = parts[++i]; continue }
    if (p === '--backend-lang' && i + 1 < parts.length) { backendLang = parts[++i]; continue }
    if (p === '--frontend-lang' && i + 1 < parts.length) { frontendLang = parts[++i]; continue }
    if (p === '--design-style' && i + 1 < parts.length) { designStyle = parts[++i]; continue }
    if (p === '--team') { teamMode = true; continue }
    if (p === '-v' || p === '--verify') { verify = true; continue }
    if (p === '--resume') { resume = true; continue }
  }

  // Normalise Windows backslashes
  workspace = workspace.replace(/\\/g, '/')
  if (output) output = output.replace(/\\/g, '/')
  if (!output) output = workspace

  return { workspace, output, designDocsDir, databaseUrl, backendUrl, frontendUrl, referenceProject, language, backendLang, frontendLang, designStyle, teamMode, verify, resume }
}

// ---------------------------------------------------------------------------
// 2. initializeProject
// ---------------------------------------------------------------------------

/**
 * Create the output directory structure and write `project-init.json`.
 *
 * Layout:
 * ```
 * {output}/.project/
 *   config/          project-init.json, project-structure.json
 *   prps/            module PRP files
 *   test-logs/       test results, test data
 *   test-cases/      generated test cases
 *   docs/            generated documentation
 * ```
 */
export async function initializeProject(parsed: ProjectArgs): Promise<string> {
  const projectRoot = join(parsed.output, '.project')

  for (const dir of ['', 'config', 'prps', 'test-logs', 'test-cases', 'docs']) {
    mkdirSync(join(projectRoot, dir), { recursive: true })
  }

  // Detect tech stack from code, then override with user-specified values
  const detectedStack = detectTechStack(parsed.workspace)
  const techStack = {
    ...detectedStack,
    ...(parsed.backendLang ? { backend: parsed.backendLang } : {}),
    ...(parsed.frontendLang ? { frontend: parsed.frontendLang } : {}),
  }

  const initData = {
    workspace: parsed.workspace,
    output: parsed.output,
    designDocsDir: parsed.designDocsDir ?? null,
    databaseUrl: parsed.databaseUrl ?? null,
    backendUrl: parsed.backendUrl ?? null,
    frontendUrl: parsed.frontendUrl ?? null,
    referenceProject: parsed.referenceProject ?? null,
    language: parsed.language,
    backendLang: parsed.backendLang ?? null,
    frontendLang: parsed.frontendLang ?? null,
    designStyle: parsed.designStyle ?? null,
    detectedTechStack: techStack,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(join(projectRoot, 'config', 'project-init.json'), JSON.stringify(initData, null, 2))
  console.log('[project] Initialized project at', projectRoot)

  // Fetch DESIGN.md if --design-style specified
  if (parsed.designStyle) {
    console.log('[project] Fetching DESIGN.md for style:', parsed.designStyle)
    try {
      const { execSync } = await import('node:child_process')
      execSync(
        'npx getdesign@latest add ' + parsed.designStyle,
        { cwd: parsed.output, timeout: 30000, stdio: 'pipe' }
      )
      // getdesign outputs DESIGN.md — find it and move to .project/
      const possiblePaths = [
        join(parsed.output, 'DESIGN.md'),
        join(parsed.output, '..', 'DESIGN.md'),
      ]
      for (const src of possiblePaths) {
        if (existsSync(src)) {
          const dest = join(projectRoot, 'DESIGN.md')
          // Also copy to project output root for developer reference
          const devDest = join(parsed.output, 'DESIGN.md')
          const content = readFileSync(src, 'utf-8')
          writeFileSync(dest, content)
          if (dest !== devDest) writeFileSync(devDest, content)
          if (src !== dest && src !== devDest) {
            const { unlinkSync } = await import('node:fs')
            try { unlinkSync(src) } catch {}
          }
          console.log('[project] DESIGN.md installed for:', parsed.designStyle)
          break
        }
      }
    } catch (e) {
      console.warn('[project] Failed to fetch DESIGN.md:', e instanceof Error ? e.message : e)
      console.warn('[project] Continuing without design style — default aesthetics will be used')
    }
  }

  return projectRoot
}

// ---------------------------------------------------------------------------
// 3. buildKnowledgeGraph
// ---------------------------------------------------------------------------

/**
 * Build the graphify knowledge graph for the given workspace.
 * Returns node/edge counts on success, `null` on failure.
 *
 * On success, invalidates the engineCache entry for this workspace so the
 * next getEngine*() call reloads the fresh graph.json from disk. Without
 * this, any engine cached BEFORE the build (e.g. bootstrap.ts calling
 * getEngine() at session start on an empty dir) will return null forever,
 * making analyzeProjectStructure() silently produce a 0/0/0 structure.
 */
export async function buildKnowledgeGraph(workspace: string): Promise<{ nodes: number; edges: number } | null> {
  try {
    const { buildGraph } = await import('../../../services/graphify/builder/index.ts')
    const { ensureGraphifyInGitignore } = await import('../../../services/graphify/gitignoreHelper.ts')
    ensureGraphifyInGitignore(workspace)
    const result = await buildGraph({ rootDir: workspace })
    if (result.success) {
      console.log('[project] Graph built:', result.nodes, 'nodes,', result.edges, 'edges')
      try {
        const { resetEngine } = await import('../../../services/graphify/engineLoader.js')
        resetEngine(workspace)
      } catch {
        // engineLoader import failure is non-fatal — the cache will heal
        // on the next reloadEngine call.
      }
      return { nodes: result.nodes, edges: result.edges }
    }
  } catch (e) {
    console.warn('[project] Graph build failed:', e)
  }
  return null
}

// ---------------------------------------------------------------------------
// 4. getGraphEngine
// ---------------------------------------------------------------------------

/**
 * Load (or reinitialise) the graph engine for the given workspace so
 * it can be used for querying communities, nodes, and paths.
 *
 * Always calls reinitialize() — the GraphEnhancer constructor uses a
 * fire-and-forget initialize() that may not have completed yet, and the
 * singleton may hold a stale engine from a previous workspace or from
 * bootstrap.ts running before graph.json existed.
 */
export async function getGraphEngine(workspace: string): Promise<any> {
  try {
    const { getGraphEnhancer } = await import('../../../services/systest/graphEnhancer.ts')
    const enhancer = getGraphEnhancer(workspace)
    // Force fresh load every time — cheaper than a stale/null engine silently
    // producing empty RAW_GRAPH_SUMMARY.md files.
    await enhancer.reinitialize()
    return enhancer.getEngine() || undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// 4b. autoDetectReferenceCode
// ---------------------------------------------------------------------------

/**
 * Candidate subdirectory names where users commonly place reference PoC code
 * before running /newproject. If any of these exist and contain source files,
 * we treat the first one with meaningful code as an implicit reference project.
 */
const REFERENCE_CODE_DIRS = ['docs', 'reference', 'legacy', 'old-code', 'poc', 'sample']
const REF_CODE_EXTS = new Set(['.py', '.ts', '.tsx', '.js', '.jsx', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.vue', '.svelte', '.html'])
const REF_CODE_THRESHOLD = 5

/**
 * Scan the workspace for an implicit reference code subdirectory.
 * Returns the absolute path of the first subdirectory under workspace that
 * contains at least REF_CODE_THRESHOLD source files (recursively).
 *
 * Returns null if no qualifying directory is found.
 */
export function autoDetectReferenceCode(workspace: string): string | null {
  // Use node:fs directly — synchronous is fine at Phase 0
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')

  for (const candidate of REFERENCE_CODE_DIRS) {
    const candidatePath = path.join(workspace, candidate)
    if (!fs.existsSync(candidatePath)) continue
    const stat = fs.statSync(candidatePath)
    if (!stat.isDirectory()) continue

    const count = countSourceFilesRecursive(candidatePath, REF_CODE_EXTS, REF_CODE_THRESHOLD)
    if (count >= REF_CODE_THRESHOLD) {
      return candidatePath
    }
  }
  return null
}

function countSourceFilesRecursive(dir: string, exts: Set<string>, stopAt: number): number {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  let count = 0
  const stack = [dir]
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', 'graphify-out'])

  while (stack.length > 0 && count < stopAt) {
    const current = stack.pop()!
    let entries: import('node:fs').Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue
        stack.push(path.join(current, entry.name))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (exts.has(ext)) count++
        if (count >= stopAt) return count
      }
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// 5. analyzeProjectStructure
// ---------------------------------------------------------------------------

/**
 * Use the knowledge graph to extract the project structure:
 * communities, god nodes, entities, routes, and services.
 *
 * Falls back gracefully when the graph engine is unavailable.
 */
export async function analyzeProjectStructure(workspace: string, graphEngine: any): Promise<ProjectStructure> {
  const techStack = detectTechStack(workspace)

  const base: ProjectStructure = {
    techStack,
    entities: [],
    routes: [],
    services: [],
    communities: [],
    graphStats: null,
  }

  if (!graphEngine) return base

  try {
    // --- stats ---
    const stats = graphEngine.getStats?.()
    if (stats) {
      base.graphStats = { nodes: stats.nodeCount ?? 0, edges: stats.edgeCount ?? 0 }
    }

    // --- communities ---
    const rawCommunities = graphEngine.getCommunities?.(15) ?? []
    base.communities = rawCommunities.map((c: any) => ({
      id: c.id,
      label: c.label,
      size: c.size,
      godNodes: (c.godNodes ?? []).map((g: any) => (typeof g === 'string' ? g : g.label)),
    }))

    // --- entities ---
    const entityQuery = graphEngine.query?.('model schema entity interface table drizzle prisma', 'bfs', 50)
    if (entityQuery?.nodes) {
      for (const n of entityQuery.nodes) {
        const fields = extractFields(graphEngine, n)
        base.entities.push({
          name: n.label,
          fields,
          sourceFile: n.source_file ?? '',
        })
      }
    }

    // --- routes ---
    const routeQuery = graphEngine.query?.('route controller handler endpoint router get post put delete', 'bfs', 50)
    if (routeQuery?.nodes) {
      for (const n of routeQuery.nodes) {
        base.routes.push({
          method: (n as any).httpMethod ?? 'GET',
          path: (n as any).urlPath ?? n.label,
          handler: n.label,
          sourceFile: n.source_file ?? '',
        })
      }
    }

    // --- services ---
    const serviceQuery = graphEngine.query?.('service repository provider', 'bfs', 50)
    if (serviceQuery?.nodes) {
      for (const n of serviceQuery.nodes) {
        base.services.push({
          name: n.label,
          sourceFile: n.source_file ?? '',
        })
      }
    }
  } catch (e) {
    console.warn('[project] Structure analysis partially failed:', e)
  }

  // Scan for UI screenshots in workspace (legacy screens, CICS maps, AS-400 displays)
  base.screenshots = scanScreenshots(workspace)

  // Persist for later phases
  try {
    const projectRoot = join(workspace, '.project')
    if (existsSync(join(projectRoot, 'config'))) {
      writeFileSync(
        join(projectRoot, 'config', 'project-structure.json'),
        JSON.stringify(base, null, 2),
      )
    }
  } catch { /* best-effort */ }

  return base
}

/**
 * Scan workspace for screenshot/image files and select representative ones.
 *
 * Strategy: group by inferred screen name (from filename), pick 1 per screen,
 * cap at 10 total. This gives AI a concrete, de-duplicated list to read.
 */
function scanScreenshots(workspace: string): ScreenshotInfo[] {
  const imageExts = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp']
  const all: ScreenshotInfo[] = []

  function walk(dir: string, depth: number) {
    if (depth > 5) return // don't recurse too deep
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
          walk(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const ext = ('.' + (entry.name.split('.').pop() || '')).toLowerCase()
          if (imageExts.includes(ext)) {
            const relPath = fullPath.replace(workspace, '').replace(/\\/g, '/').replace(/^\//, '')
            // Infer screen name: strip extension, numbers, suffixes like _v2, (1), etc.
            const screenName = entry.name
              .replace(/\.\w+$/, '')           // remove extension
              .replace(/[-_]\d+$/, '')          // remove trailing -1, _2, etc.
              .replace(/\s*\(\d+\)$/, '')       // remove (1), (2), etc.
              .replace(/[-_]?(v\d+|copy|final|old|new|backup)$/i, '')  // remove version suffixes
              .trim()
            all.push({ path: relPath, screenName })
          }
        }
      }
    } catch { /* permission errors, etc. */ }
  }

  walk(workspace, 0)

  if (all.length === 0) return []

  // De-duplicate: pick 1 image per unique screen name
  const byScreen = new Map<string, ScreenshotInfo>()
  for (const img of all) {
    const key = img.screenName.toLowerCase()
    if (!byScreen.has(key)) {
      byScreen.set(key, img)
    }
  }

  // Cap at 10 unique screens
  const selected = Array.from(byScreen.values()).slice(0, 10)
  console.log(`[project] Screenshots: ${all.length} found, ${byScreen.size} unique screens, ${selected.length} selected`)
  return selected
}

/**
 * Extract field nodes from a schema/entity node via graph neighbours.
 */
function extractFields(graphEngine: any, node: any): any[] {
  try {
    const neighbours = graphEngine.getNeighbors?.(node.label, 2)
    if (!neighbours?.successors) return []
    return neighbours.successors
      .filter((n: any) => n.kind === 'field' || n.kind === 'column' || n.kind === 'property')
      .map((n: any) => ({
        name: n.label,
        type: n.fieldType ?? n.type ?? 'unknown',
        optional: n.optional ?? false,
        constraints: n.constraints ?? {},
      }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 6. generateINITIAL
// ---------------------------------------------------------------------------

/**
 * Generate the INITIAL.md technical specification string.
 *
 * @param mode  'legacy' for modernize, 'new' for newproject
 */
export function generateINITIAL(
  structure: ProjectStructure,
  parsed: ProjectArgs,
  mode: 'legacy' | 'new',
): string {
  const projectName = basename(parsed.workspace)
  const lines: string[] = []

  const resolvedStack = resolveTechStack(parsed, structure, mode)

  // --- Overview ---
  lines.push('# INITIAL.md - Technical Specification')
  lines.push('')
  lines.push('## Overview')
  lines.push('')
  lines.push('| Key | Value |')
  lines.push('|-----|-------|')
  lines.push(`| Project | ${projectName} |`)
  lines.push(`| Mode | ${mode === 'legacy' ? 'Modernize (legacy migration)' : 'New project'} |`)
  lines.push(`| Workspace | ${parsed.workspace} |`)
  if (parsed.referenceProject) lines.push(`| Reference | ${parsed.referenceProject} |`)
  lines.push(`| Language | ${parsed.language} |`)
  lines.push('')

  // --- Tech Stack ---
  lines.push('## Architecture / Tech Stack')
  lines.push('')
  lines.push(`- **Language:** ${resolvedStack.language || 'unknown'}`)
  lines.push(`- **Backend:** ${resolvedStack.backend || 'unknown'}`)
  lines.push(`- **Frontend:** ${resolvedStack.frontend || 'unknown'}`)
  lines.push(`- **Database:** ${resolvedStack.database || 'unknown'}`)
  if (structure.graphStats) {
    lines.push(`- **Graph:** ${structure.graphStats.nodes} nodes, ${structure.graphStats.edges} edges`)
  }
  lines.push('')

  // --- Data Models ---
  lines.push('## Data Models')
  lines.push('')
  if (structure.entities.length === 0) {
    lines.push('_No entities detected from graph._')
  } else {
    for (const e of structure.entities) {
      lines.push(`### ${e.name}`)
      lines.push(`- Source: \`${e.sourceFile}\``)
      if (e.fields.length > 0) {
        lines.push('- Fields:')
        for (const f of e.fields) {
          const opt = f.optional ? ' (optional)' : ''
          lines.push(`  - \`${f.name}\`: ${f.type}${opt}`)
        }
      }
      lines.push('')
    }
  }

  // --- API Endpoints ---
  lines.push('## API Endpoints')
  lines.push('')
  if (structure.routes.length === 0) {
    lines.push('_No routes detected from graph._')
  } else {
    lines.push('| Method | Path | Handler | Source |')
    lines.push('|--------|------|---------|--------|')
    for (const r of structure.routes) {
      lines.push(`| ${r.method} | ${r.path} | ${r.handler} | \`${r.sourceFile}\` |`)
    }
    lines.push('')
  }

  // --- Frontend Design ---
  const frontendSection = buildFrontendDesignSection(structure, parsed, resolvedStack)
  lines.push('')
  lines.push(frontendSection)

  // --- Module Dependency Graph ---
  lines.push('## Module Dependency Graph (Communities)')
  lines.push('')
  if (structure.communities.length === 0) {
    lines.push('_No communities detected._')
  } else {
    for (const c of structure.communities) {
      const gods = c.godNodes.length > 0 ? c.godNodes.join(', ') : 'none'
      lines.push(`- **Community ${c.id}** (${c.label}): ${c.size} nodes, god nodes: ${gods}`)
    }
    lines.push('')
  }

  // --- Services ---
  lines.push('## Services')
  lines.push('')
  if (structure.services.length === 0) {
    lines.push('_No services detected._')
  } else {
    for (const s of structure.services) {
      lines.push(`- \`${s.name}\` (\`${s.sourceFile}\`)`)
    }
    lines.push('')
  }

  // --- Test Strategy ---
  lines.push('## Test Strategy')
  lines.push('')
  lines.push('1. **Unit tests** -- per-module, covering services and utilities')
  lines.push('2. **Integration tests** -- API endpoint testing (Layer 1 + Layer 2)')
  lines.push('3. **E2E tests** -- Frontend route smoke tests via browser automation')
  lines.push('4. **Regression** -- Bug-fix loop targeting >= 95 % pass rate')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 7. generatePRPs
// ---------------------------------------------------------------------------

/**
 * Split the INITIAL.md into modular PRP (Phase-Ready Plan) files based on
 * communities and write them into `{output}/.project/prps/`.
 *
 * Also writes `MODULE_INDEX.md` with the execution order and a dependency
 * diagram.
 */
export interface PRPResult {
  moduleCount: number
  prpDir: string
  indexPath: string
  modules: { name: string; path: string; priority: number }[]
  files: string[]
}

export function generatePRPs(
  initialMd: string,
  structure: ProjectStructure,
  parsed: ProjectArgs,
): PRPResult {
  const prpDir = join(parsed.output, '.project', 'prps')
  mkdirSync(prpDir, { recursive: true })

  // Build resolved tech stack using shared helper (includes DB URL inference + user params)
  const resolvedStack = resolveTechStack(parsed, structure, 'new')

  // ---------------------------------------------------------------------------
  // NEW APPROACH: Export raw graph summary for AI to analyze.
  // AI will generate module decomposition and PRP files itself.
  // Code should NOT try to interpret communities — that requires intelligence.
  // ---------------------------------------------------------------------------

  const lines: string[] = []
  lines.push('# RAW_GRAPH_SUMMARY.md')
  lines.push('')
  lines.push('> This file contains raw knowledge graph data for AI analysis.')
  lines.push('> AI should use this + graph tools (graph_communities, graph_query, graph_neighbors)')
  lines.push('> to design the module decomposition and write PRP files.')
  lines.push('')

  // Tech stack
  lines.push('## Target Tech Stack')
  lines.push('')
  lines.push(`- Language: ${resolvedStack.language}`)
  lines.push(`- Backend: ${resolvedStack.backend}`)
  lines.push(`- Frontend: ${resolvedStack.frontend}`)
  lines.push(`- Database: ${resolvedStack.database}`)
  if (parsed.databaseUrl) lines.push(`- Database URL: ${parsed.databaseUrl}`)
  if (parsed.designStyle) lines.push(`- Design Style: ${parsed.designStyle}`)
  lines.push('')

  // Graph statistics
  const gs = structure.graphStats
  lines.push('## Graph Statistics')
  lines.push('')
  lines.push(`- Nodes: ${gs?.nodes ?? 0}`)
  lines.push(`- Edges: ${gs?.edges ?? 0}`)
  lines.push(`- Communities: ${structure.communities?.length ?? 0}`)
  lines.push('')

  // Entities
  lines.push('## Detected Entities (data models)')
  lines.push('')
  if (structure.entities.length > 0) {
    for (const e of structure.entities) {
      const fields = e.fields.length > 0 ? ' — fields: ' + e.fields.map(f => f.name).join(', ') : ''
      lines.push(`- **${e.name}**${fields} (source: ${e.sourceFile})`)
    }
  } else {
    lines.push('_No entities auto-detected. Use graph_query to discover data models._')
  }
  lines.push('')

  // Routes
  lines.push('## Detected API Routes')
  lines.push('')
  if (structure.routes.length > 0) {
    for (const r of structure.routes) {
      lines.push(`- ${r.method} ${r.path} → ${r.handler} (source: ${r.sourceFile})`)
    }
  } else {
    lines.push('_No routes auto-detected. Use graph_query to discover endpoints._')
  }
  lines.push('')

  // Communities (raw dump for AI to interpret)
  lines.push('## Communities (raw — AI should interpret these)')
  lines.push('')
  if (structure.communities.length > 0) {
    for (const c of structure.communities) {
      const gods = (c.godNodes || []).join(', ') || 'none'
      lines.push(`- Community ${c.id}: size=${c.size}, godNodes=[${gods}]`)
    }
  } else {
    lines.push('_No communities available. Use graph_communities tool to discover module structure._')
  }
  lines.push('')

  // Screenshots
  if (structure.screenshots && structure.screenshots.length > 0) {
    lines.push('## Legacy UI Screenshots (pre-selected)')
    lines.push('')
    for (const s of structure.screenshots) {
      lines.push(`- **${s.screenName}** → ${s.path}`)
    }
    lines.push('')
  }

  // Directory structure snapshot
  lines.push('## Workspace Directory Structure')
  lines.push('')
  lines.push('```')
  const dirTree = buildDirTree(parsed.workspace, 0, 3)
  lines.push(dirTree)
  lines.push('```')
  lines.push('')

  // Write RAW_GRAPH_SUMMARY.md
  const summaryPath = join(prpDir, 'RAW_GRAPH_SUMMARY.md')
  writeFileSync(summaryPath, lines.join('\n'))
  console.log('[project] Wrote RAW_GRAPH_SUMMARY.md for AI analysis')

  // Write a placeholder MODULE_INDEX.md that instructs AI to generate it
  const indexPath = join(prpDir, 'MODULE_INDEX.md')
  writeFileSync(indexPath, `# MODULE_INDEX

> ⚠️ This file is a PLACEHOLDER. AI must generate the real module index.

## Instructions for AI

1. Read RAW_GRAPH_SUMMARY.md in this directory
2. Use graph_communities to see the full community structure
3. Use graph_query to understand each community's purpose
4. Design 5-15 modules based on business function (NOT by community ID)
5. For each module, write a PRP file: PRP-{NNN}-{module-name}.md
6. Update this MODULE_INDEX.md with the final execution order

## PRP Template

Each PRP file should contain:
- Module name and business purpose
- API endpoints (method, path, request/response schema)
- Data models (fields, types, constraints)
- Legacy code references (which source files to study)
- Frontend pages (route, components)
- Success criteria (testable acceptance criteria)
- Swagger documentation requirements
`)
  console.log('[project] Wrote placeholder MODULE_INDEX.md')

  return {
    moduleCount: 0, // AI will generate the actual modules
    prpDir,
    indexPath,
    modules: [], // placeholder — AI fills this in
    files: [summaryPath, indexPath],
  }
}

/**
 * Build a simple directory tree string for workspace overview.
 */
function buildDirTree(dir: string, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return ''
  const indent = '  '.repeat(depth)
  const lines: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'graphify-out')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        lines.push(`${indent}${entry.name}/`)
        lines.push(buildDirTree(join(dir, entry.name), depth + 1, maxDepth))
      } else {
        lines.push(`${indent}${entry.name}`)
      }
    }
  } catch {}
  return lines.filter(l => l).join('\n')
}

// ---------------------------------------------------------------------------
// buildFrontendDesignSection -- generate Frontend Design section for INITIAL.md
// ---------------------------------------------------------------------------

function buildFrontendDesignSection(structure: ProjectStructure, parsed: ProjectArgs, resolvedStack?: { language: string; backend: string; frontend: string; database: string }): string {
  const _stack = resolvedStack || structure.techStack
  const lines: string[] = []
  lines.push('## Frontend Design (Web UI)')
  lines.push('')
  lines.push('> This project MUST include a web frontend regardless of the legacy system type.')
  lines.push('')

  // Map entities to CRUD pages
  lines.push('### Page Inventory')
  lines.push('')
  lines.push('| Page | Route | Type | Based On |')
  lines.push('|------|-------|------|----------|')
  lines.push('| Login | /login | Auth | Authentication entry point |')
  lines.push('| Dashboard | /dashboard | Overview | Main landing after login |')

  for (const entity of structure.entities) {
    const name = entity.name
    const nameLower = name.toLowerCase()
    const namePlural = nameLower.endsWith('s') ? nameLower : nameLower + 's'
    lines.push(`| ${name} List | /${namePlural} | CRUD List | Entity: ${name} |`)
    lines.push(`| ${name} Detail | /${namePlural}/:id | CRUD Detail | Entity: ${name} |`)
    lines.push(`| ${name} Form | /${namePlural}/new | CRUD Create | Entity: ${name} |`)
  }

  lines.push('')

  // Routes from API endpoints
  if (structure.routes.length > 0) {
    lines.push('### API-Driven Pages')
    lines.push('')
    // Group routes by resource
    const groups = new Map<string, typeof structure.routes>()
    for (const route of structure.routes) {
      const resource = route.path?.split('/').filter(Boolean)[1] || 'general'
      const group = groups.get(resource) || []
      group.push(route)
      groups.set(resource, group)
    }
    for (const [resource, routes] of groups) {
      lines.push(`- **/${resource}** — ${routes.length} endpoints → List + Detail pages`)
    }
    lines.push('')
  }

  // Standard frontend structure
  lines.push('### Frontend Architecture')
  lines.push('')
  lines.push('```')
  lines.push('frontend/')
  lines.push('├── src/')
  lines.push('│   ├── main.tsx')
  lines.push('│   ├── App.tsx (routing + layout)')
  lines.push('│   ├── api/client.ts (axios + auth token)')
  lines.push('│   ├── components/layout/ (Sidebar, Header, Layout)')
  lines.push('│   ├── components/ui/ (Button, Card, Table, Form, Modal)')
  lines.push('│   ├── pages/ (one directory per entity)')
  lines.push('│   ├── hooks/ (useAuth, useApi)')
  lines.push('│   └── types/ (shared TypeScript types)')
  lines.push('└── package.json')
  lines.push('```')
  lines.push('')

  // Design system reference
  if (parsed.designStyle) {
    lines.push('### Design System: ' + parsed.designStyle)
    lines.push('See DESIGN.md for complete color palette, typography, components, and layout rules.')
  } else {
    lines.push('### Design System: Modern SaaS (default)')
    lines.push('Clean neutral palette, Inter font, 8px spacing scale, subtle shadows, responsive.')
  }
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// buildPrpContent -- generate template-compliant PRP markdown for a community
// ---------------------------------------------------------------------------

function buildPrpContent(
  community: { id: number; label: string; size: number; godNodes: string[] },
  structure: ProjectStructure,
  parsed: ProjectArgs,
  priority: number,
  totalModules: number,
  relatedEntities: Array<{ name: string; fields: any[]; sourceFile: string }>,
  relatedRoutes: Array<{ method: string; path: string; handler: string; sourceFile: string }>,
  relatedServices: Array<{ name: string; sourceFile: string }>,
): string {
  const projectName = parsed.workspace.replace(/\\/g, '/').split('/').pop() || 'project'
  const moduleName = community.label || `Module-${community.id}`
  const num = String(priority).padStart(3, '0')
  const { techStack } = structure

  // Deduplicate source files referenced by this community
  const sourceFiles = new Set<string>()
  for (const e of relatedEntities) sourceFiles.add(e.sourceFile)
  for (const r of relatedRoutes) sourceFiles.add(r.sourceFile)
  for (const s of relatedServices) sourceFiles.add(s.sourceFile)
  for (const g of community.godNodes) sourceFiles.add(g)

  // Build task counter
  let taskNum = 0
  const nextTask = () => `TASK ${++taskNum}`

  // -- Assemble sections --

  const lines: string[] = []

  // --- Header / Frontmatter ---
  lines.push(`name: "PRP-${num}: ${moduleName}"`)
  lines.push('description: |')
  lines.push('')
  lines.push('## Purpose')
  lines.push(`${moduleName} module -- part of the ${projectName} modernization project.`)
  lines.push(`Execution order: ${priority} / ${totalModules} | Community ID: ${community.id} | Size: ${community.size} nodes`)
  lines.push('')
  lines.push('## Core Principles')
  lines.push('1. **Context is King**: All legacy references and patterns included below')
  lines.push('2. **Validation Loops**: Executable tests provided for self-verification')
  lines.push('3. **TDD**: Write tests before implementation')
  lines.push('4. **Progressive Success**: Start simple, validate, then enhance')
  lines.push('5. **Global rules**: Be sure to follow all rules in CLAUDE.md')
  lines.push('')
  lines.push('---')
  lines.push('')

  // --- Goal ---
  lines.push('## Goal')
  lines.push('')
  lines.push(`Implement the **${moduleName}** module, migrating functionality from the legacy system into the modernized ${projectName} codebase.`)
  if (community.godNodes.length > 0) {
    lines.push(`Core components identified by the knowledge graph: \`${community.godNodes.join('`, `')}\``)
  }
  if (relatedServices.length > 0) {
    lines.push(`Service layer targets: ${relatedServices.map(s => `\`${s.name}\``).join(', ')}`)
  }
  lines.push('')

  // --- Why ---
  lines.push('## Why')
  lines.push('')
  lines.push(`- **Business value**: This module handles ${moduleName.toLowerCase()} operations critical to the application`)
  lines.push(`- **Legacy migration**: Replaces ${community.size} legacy components with modern, typed, testable code`)
  if (relatedEntities.length > 0) {
    lines.push(`- **Data layer**: Manages ${relatedEntities.length} data entit${relatedEntities.length === 1 ? 'y' : 'ies'} (${relatedEntities.map(e => e.name).join(', ')})`)
  }
  if (relatedRoutes.length > 0) {
    lines.push(`- **API surface**: Exposes ${relatedRoutes.length} endpoint${relatedRoutes.length === 1 ? '' : 's'} for client consumption`)
  }
  lines.push(`- **Integration**: Connects to ${relatedEntities.length} data entities and ${relatedServices.length} service${relatedServices.length === 1 ? '' : 's'}`)
  lines.push('')

  // --- What ---
  lines.push('## What')
  lines.push('')

  if (relatedRoutes.length > 0) {
    lines.push('### API Endpoints')
    lines.push('')
    for (const r of relatedRoutes) {
      lines.push(`- \`${r.method} ${r.path}\` -- handler: \`${r.handler}\` (source: \`${r.sourceFile}\`)`)
    }
    lines.push('')
  }

  if (relatedEntities.length > 0) {
    lines.push('### Data Models')
    lines.push('')
    for (const e of relatedEntities) {
      const fieldList = (e.fields || []).map((f: any) => f.name + (f.type ? `: ${f.type}` : '')).join(', ')
      lines.push(`- **${e.name}** (source: \`${e.sourceFile}\`)${fieldList ? ` -- fields: ${fieldList}` : ''}`)
    }
    lines.push('')
  }

  if (relatedServices.length > 0) {
    lines.push('### Services')
    lines.push('')
    for (const s of relatedServices) {
      lines.push(`- \`${s.name}\` (source: \`${s.sourceFile}\`)`)
    }
    lines.push('')
  }

  if (relatedRoutes.length === 0 && relatedEntities.length === 0 && relatedServices.length === 0) {
    lines.push('### Implementation Required')
    lines.push('')
    lines.push('- Implement module logic based on legacy code analysis of the god nodes listed above')
    lines.push('')
  }

  // --- Frontend Pages & Components ---
  lines.push('### Frontend Pages & Components')
  lines.push('')
  if (relatedEntities.length > 0) {
    for (const e of relatedEntities) {
      const lower = e.name.toLowerCase()
      const plural = lower.endsWith('s') ? lower : lower + 's'
      lines.push(`- **/${plural}** — List, Detail, Create/Edit pages for ${e.name}`)
    }
  } else {
    lines.push('- Implement corresponding UI page for this module')
  }
  lines.push('')
  if (relatedRoutes.length > 0) {
    for (const r of relatedRoutes) {
      const pathParts = (r.path || '').split('/').filter(Boolean)
      const resource = pathParts[1] || pathParts[0] || 'page'
      lines.push(`- ${r.method || 'GET'} ${r.path} → frontend displays result`)
    }
    lines.push('')
  }
  lines.push('**Component Requirements:**')
  lines.push('- List page with search, filter, pagination')
  lines.push('- Detail page showing all entity fields')
  lines.push('- Create/Edit form with validation')
  lines.push('- Delete confirmation modal')
  lines.push('- Loading states and error handling')
  if (parsed.designStyle) {
    lines.push('- Follow DESIGN.md (' + parsed.designStyle + ' style) for all styling')
  }
  lines.push('')

  // --- Success Criteria ---
  lines.push('### Success Criteria')
  lines.push('')
  lines.push('- [ ] All module functions implemented and exported')
  lines.push('- [ ] Unit tests written and passing (>= 80% coverage)')
  lines.push('- [ ] Integration with dependent modules verified')
  lines.push('- [ ] No TypeScript / linting errors')
  for (const r of relatedRoutes) {
    lines.push(`- [ ] \`${r.method} ${r.path}\` returns expected response shape`)
  }
  for (const e of relatedEntities) {
    lines.push(`- [ ] ${e.name} CRUD operations working correctly`)
  }
  for (const s of relatedServices) {
    lines.push(`- [ ] ${s.name} service methods callable and tested`)
  }
  lines.push('- [ ] Frontend page renders correctly')
  lines.push('- [ ] API calls from frontend to backend work')
  lines.push('- [ ] Responsive layout (mobile + desktop)')
  lines.push('')

  // --- All Needed Context ---
  lines.push('## All Needed Context')
  lines.push('')

  // Documentation & References
  lines.push('### Documentation & References')
  lines.push('```yaml')
  lines.push('# MUST READ - Include these in your context window')
  for (const g of community.godNodes) {
    lines.push(`- file: ${g}`)
    lines.push(`  why: Core component of ${moduleName} -- read before implementing`)
  }
  for (const e of relatedEntities) {
    if (!community.godNodes.includes(e.sourceFile)) {
      lines.push(`- file: ${e.sourceFile}`)
      lines.push(`  why: Contains ${e.name} entity definition`)
    }
  }
  for (const r of relatedRoutes) {
    if (!community.godNodes.includes(r.sourceFile) && !relatedEntities.some(e => e.sourceFile === r.sourceFile)) {
      lines.push(`- file: ${r.sourceFile}`)
      lines.push(`  why: Contains route ${r.method} ${r.path}`)
    }
  }
  for (const s of relatedServices) {
    if (!sourceFiles.has(s.sourceFile) || community.godNodes.includes(s.sourceFile)) continue
    lines.push(`- file: ${s.sourceFile}`)
    lines.push(`  why: Contains ${s.name} service logic`)
  }
  lines.push('```')
  lines.push('')

  // Legacy Code References
  lines.push('### Legacy Code References')
  lines.push('```yaml')
  if (sourceFiles.size > 0) {
    for (const f of sourceFiles) {
      lines.push(`- file: ${f}`)
      lines.push(`  why: Referenced by ${moduleName} community graph`)
    }
  } else {
    lines.push(`# No specific source files mapped -- review god nodes: ${community.godNodes.join(', ') || 'none'}`)
  }
  lines.push('```')
  lines.push('')

  // Database Mapping
  if (relatedEntities.length > 0) {
    lines.push('### Database Mapping')
    lines.push('```yaml')
    for (const e of relatedEntities) {
      lines.push(`Entity: ${e.name}`)
      lines.push(`Source: ${e.sourceFile}`)
      lines.push('Fields:')
      if (e.fields && e.fields.length > 0) {
        for (const f of e.fields) {
          lines.push(`  - ${f.name}: ${f.type || 'unknown'}`)
        }
      } else {
        lines.push('  - (fields not parsed -- inspect source file)')
      }
      lines.push('')
    }
    lines.push('```')
    lines.push('')
  }

  // Tech Stack context
  lines.push('### Tech Stack Context')
  lines.push('```yaml')
  lines.push(`Language: ${techStack.language}`)
  lines.push(`Backend: ${techStack.backend}`)
  lines.push(`Frontend: ${techStack.frontend}`)
  lines.push(`Database: ${techStack.database}`)
  if (structure.graphStats) {
    lines.push(`Graph: ${structure.graphStats.nodes} nodes, ${structure.graphStats.edges} edges`)
  }
  lines.push('```')
  lines.push('')

  // --- Known Gotchas ---
  lines.push('### Known Gotchas')
  lines.push('')
  lines.push('```')
  lines.push(`# CRITICAL: Follow patterns established in earlier PRPs (PRP-001 through PRP-${String(priority - 1).padStart(3, '0')})`)
  lines.push('# Ensure consistent error handling across all endpoints')
  lines.push('# Validate all inputs before database operations')
  if (techStack.backend === 'Hono' || techStack.backend === 'Express') {
    lines.push(`# ${techStack.backend}: Use middleware for auth/validation -- do not inline`)
  }
  if (techStack.database && techStack.database !== 'unknown') {
    lines.push(`# ${techStack.database}: Use parameterized queries -- never string-concatenate SQL`)
  }
  lines.push('# Do NOT copy legacy patterns verbatim -- modernize them')
  lines.push('```')
  lines.push('')

  // --- Implementation Blueprint ---
  lines.push('## Implementation Blueprint')
  lines.push('')

  // Data models
  if (relatedEntities.length > 0) {
    lines.push('### Data Models & Structure')
    lines.push('')
    lines.push('Create the core data models to ensure type safety and consistency.')
    lines.push('')
    lines.push('```yaml')
    for (const e of relatedEntities) {
      lines.push(`${e.name}:`)
      lines.push(`  source: ${e.sourceFile}`)
      lines.push('  fields:')
      for (const f of (e.fields || [])) {
        lines.push(`    - name: ${f.name}`)
        lines.push(`      type: ${f.type || 'unknown'}`)
      }
    }
    lines.push('```')
    lines.push('')
  }

  // Task list (detailed, ordered)
  lines.push('### Implementation Steps')
  lines.push('')
  lines.push('```yaml')

  // Step 1: Models
  if (relatedEntities.length > 0) {
    for (const e of relatedEntities) {
      lines.push(`${nextTask()}:`)
      lines.push(`  action: CREATE model for ${e.name}`)
      lines.push(`  location: src/models/ or equivalent`)
      lines.push(`  reference: ${e.sourceFile}`)
      lines.push(`  details:`)
      lines.push(`    - Define typed interface / schema for ${e.name}`)
      if (e.fields && e.fields.length > 0) {
        lines.push(`    - Include fields: ${e.fields.map((f: any) => f.name).join(', ')}`)
      }
      lines.push(`    - Add validation rules`)
      lines.push('')
    }
  }

  // Step 2: Services
  if (relatedServices.length > 0) {
    for (const s of relatedServices) {
      lines.push(`${nextTask()}:`)
      lines.push(`  action: CREATE / MIGRATE service ${s.name}`)
      lines.push(`  location: src/services/ or equivalent`)
      lines.push(`  reference: ${s.sourceFile}`)
      lines.push(`  details:`)
      lines.push(`    - Migrate business logic from legacy ${s.name}`)
      lines.push(`    - Add proper error handling and logging`)
      lines.push(`    - Use dependency injection where appropriate`)
      lines.push('')
    }
  } else if (community.godNodes.length > 0) {
    lines.push(`${nextTask()}:`)
    lines.push(`  action: CREATE service layer for ${moduleName}`)
    lines.push(`  location: src/services/ or equivalent`)
    lines.push(`  reference: ${community.godNodes[0]}`)
    lines.push(`  details:`)
    lines.push(`    - Extract business logic from god nodes`)
    lines.push(`    - Separate concerns into testable service methods`)
    lines.push('')
  }

  // Step 3: Routes
  if (relatedRoutes.length > 0) {
    for (const r of relatedRoutes) {
      lines.push(`${nextTask()}:`)
      lines.push(`  action: CREATE route ${r.method} ${r.path}`)
      lines.push(`  location: src/api/ or src/routes/`)
      lines.push(`  reference: ${r.sourceFile}`)
      lines.push(`  details:`)
      lines.push(`    - Handler: ${r.handler}`)
      lines.push(`    - Add input validation middleware`)
      lines.push(`    - Add proper HTTP status codes and error responses`)
      lines.push(`    - Add request/response type definitions`)
      lines.push('')
    }
  }

  // Step 4: Tests
  lines.push(`${nextTask()}:`)
  lines.push(`  action: WRITE unit tests`)
  lines.push('  location: tests/ or __tests__/')
  lines.push('  details:')
  lines.push('    - Test each service method in isolation')
  lines.push('    - Test edge cases (empty input, invalid data, missing fields)')
  lines.push('    - Mock external dependencies')
  if (relatedEntities.length > 0) {
    lines.push(`    - Test ${relatedEntities.map(e => e.name).join(', ')} CRUD operations`)
  }
  lines.push('')

  lines.push(`${nextTask()}:`)
  lines.push(`  action: WRITE integration tests`)
  lines.push('  location: tests/ or __tests__/')
  lines.push('  details:')
  if (relatedRoutes.length > 0) {
    lines.push(`    - Test each route end-to-end: ${relatedRoutes.map(r => `${r.method} ${r.path}`).join(', ')}`)
  }
  lines.push('    - Verify request/response contracts')
  lines.push('    - Test error scenarios (400, 401, 404, 500)')
  lines.push('    - Test with realistic data fixtures')
  lines.push('')

  // Step 5: Integration
  lines.push(`${nextTask()}:`)
  lines.push(`  action: INTEGRATE with dependent modules`)
  lines.push('  details:')
  lines.push('    - Register routes in the main router')
  lines.push('    - Wire up service dependencies')
  lines.push('    - Update module exports (index files)')
  lines.push('    - Verify no circular imports')
  lines.push('')

  lines.push('```')
  lines.push('')

  // Integration Points
  lines.push('### Integration Points')
  lines.push('```yaml')
  if (relatedEntities.length > 0 && techStack.database && techStack.database !== 'unknown') {
    lines.push('DATABASE:')
    for (const e of relatedEntities) {
      lines.push(`  - migration: "Create/update table for ${e.name}"`)
      if (e.fields && e.fields.length > 0) {
        const indexableFields = e.fields.filter((f: any) => f.name.endsWith('_id') || f.name === 'id' || f.name === 'email' || f.name === 'slug')
        for (const f of indexableFields) {
          lines.push(`  - index: "CREATE INDEX idx_${e.name.toLowerCase()}_${f.name} ON ${e.name.toLowerCase()}(${f.name})"`)
        }
      }
    }
    lines.push('')
  }
  if (relatedRoutes.length > 0) {
    lines.push('ROUTES:')
    lines.push('  - register: Add routes to main application router')
    for (const r of relatedRoutes) {
      lines.push(`  - endpoint: "${r.method} ${r.path}" -> ${r.handler}`)
    }
    lines.push('')
  }
  lines.push('CONFIG:')
  lines.push(`  - module: ${moduleName}`)
  lines.push('  - ensure environment variables are documented')
  lines.push('  - add feature flags if needed for gradual rollout')
  lines.push('```')
  lines.push('')

  // --- Tasks (detailed checklist) ---
  lines.push('## Tasks')
  lines.push('')
  let checkNum = 0
  const nextCheck = () => `${++checkNum}`

  // Model tasks
  for (const e of relatedEntities) {
    lines.push(`- [ ] ${nextCheck()}. Create \`${e.name}\` model with all fields and validation`)
  }

  // Service tasks
  for (const s of relatedServices) {
    lines.push(`- [ ] ${nextCheck()}. Migrate \`${s.name}\` service from \`${s.sourceFile}\``)
  }
  if (relatedServices.length === 0 && community.godNodes.length > 0) {
    lines.push(`- [ ] ${nextCheck()}. Create service layer for ${moduleName} (extract from god nodes)`)
  }

  // Route tasks
  for (const r of relatedRoutes) {
    lines.push(`- [ ] ${nextCheck()}. Implement \`${r.method} ${r.path}\` endpoint with validation`)
  }

  // Standard tasks
  lines.push(`- [ ] ${nextCheck()}. Write unit tests for all service methods`)
  lines.push(`- [ ] ${nextCheck()}. Write integration tests for all API endpoints`)
  lines.push(`- [ ] ${nextCheck()}. Add input validation and error handling`)
  lines.push(`- [ ] ${nextCheck()}. Register module in the main application`)
  lines.push(`- [ ] ${nextCheck()}. Verify all success criteria pass`)
  lines.push(`- [ ] ${nextCheck()}. Run linter and type checker with zero errors`)
  lines.push(`- [ ] ${nextCheck()}. Manual smoke test of primary flows`)

  // Frontend tasks
  lines.push(`- [ ] ${nextCheck()}. TASK: Create frontend page component`)
  lines.push(`- [ ] ${nextCheck()}. TASK: Create API hooks (React Query / fetch)`)
  lines.push(`- [ ] ${nextCheck()}. TASK: Write frontend tests (vitest)`)
  lines.push('')

  // --- Validation Loop ---
  lines.push('## Validation Loop')
  lines.push('')

  lines.push('### Level 1: Syntax & Types')
  lines.push('```bash')
  lines.push('# Run FIRST -- fix any errors before proceeding')
  if (techStack.language === 'TypeScript' || techStack.language === 'JavaScript') {
    lines.push('npx tsc --noEmit            # Type checking')
    lines.push('npx eslint src/ --fix       # Lint and auto-fix')
  } else if (techStack.language === 'Python') {
    lines.push('ruff check src/ --fix       # Lint and auto-fix')
    lines.push('mypy src/                   # Type checking')
  } else {
    lines.push('# Run the project linter and type checker')
  }
  lines.push('# Expected: No errors. If errors, READ the error and fix.')
  lines.push('```')
  lines.push('')

  lines.push('### Level 2: Unit Tests')
  lines.push('```bash')
  if (techStack.language === 'TypeScript' || techStack.language === 'JavaScript') {
    lines.push('npm test -- --coverage      # Run tests with coverage')
  } else if (techStack.language === 'Python') {
    lines.push('uv run pytest tests/ -v --cov  # Run tests with coverage')
  } else {
    lines.push('# Run the project test suite')
  }
  lines.push('# If failing: Read error, understand root cause, fix code, re-run')
  lines.push('# NEVER mock just to make a test pass')
  lines.push('```')
  lines.push('')

  lines.push('### Level 3: Integration Tests')
  lines.push('```bash')
  lines.push('# Start the service')
  if (techStack.language === 'TypeScript' || techStack.language === 'JavaScript') {
    lines.push('npm run dev')
  } else if (techStack.language === 'Python') {
    lines.push('uv run python -m src.main --dev')
  } else {
    lines.push('# Start the dev server')
  }
  lines.push('')
  lines.push('# Test endpoints manually')
  if (relatedRoutes.length > 0) {
    const sample = relatedRoutes[0]
    lines.push(`curl -X ${sample.method} http://localhost:8000${sample.path} \\`)
    lines.push('  -H "Content-Type: application/json" \\')
    lines.push('  -d \'{"example": "data"}\'')
    lines.push('')
    lines.push(`# Expected: 200 OK with valid response body`)
  } else {
    lines.push('# Test the module functions via REPL or test harness')
  }
  lines.push('# If error: Check logs for stack trace')
  lines.push('```')
  lines.push('')

  // --- Final Validation Checklist ---
  lines.push('## Final Validation Checklist')
  lines.push('')
  if (techStack.language === 'TypeScript' || techStack.language === 'JavaScript') {
    lines.push('- [ ] All tests pass: `npm test`')
    lines.push('- [ ] No lint errors: `npx eslint src/`')
    lines.push('- [ ] No type errors: `npx tsc --noEmit`')
  } else if (techStack.language === 'Python') {
    lines.push('- [ ] All tests pass: `uv run pytest tests/ -v`')
    lines.push('- [ ] No lint errors: `uv run ruff check src/`')
    lines.push('- [ ] No type errors: `uv run mypy src/`')
  } else {
    lines.push('- [ ] All tests pass')
    lines.push('- [ ] No lint errors')
    lines.push('- [ ] No type errors')
  }
  lines.push('- [ ] Manual test successful for primary flows')
  lines.push('- [ ] Error cases handled gracefully (400, 401, 404, 500)')
  lines.push('- [ ] Logs are informative but not verbose')
  lines.push('- [ ] No TODO/FIXME comments remaining')
  lines.push('')

  // --- Anti-Patterns ---
  lines.push('---')
  lines.push('')
  lines.push('## Anti-Patterns to Avoid')
  lines.push('')
  lines.push('- Do NOT copy legacy code patterns verbatim -- modernize them')
  lines.push('- Do NOT create new patterns when existing ones work -- check earlier PRPs')
  lines.push('- Do NOT skip validation because "it should work"')
  lines.push('- Do NOT skip error handling or use catch-all exception handlers')
  lines.push('- Do NOT leave TODO/FIXME comments -- implement fully')
  lines.push('- Do NOT hardcode values that should be config/environment variables')
  if (techStack.language === 'TypeScript' || techStack.language === 'JavaScript') {
    lines.push('- Do NOT use `any` type -- define proper interfaces')
    lines.push('- Do NOT use sync functions in async context')
  }
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 8a. inferTechFromDatabaseUrl
// ---------------------------------------------------------------------------

/**
 * Infer target tech stack from the database URL.
 * e.g., "mysql+pymysql://..." → Python + FastAPI + MySQL
 * e.g., "postgres://..." → PostgreSQL
 */
function inferTechFromDatabaseUrl(url: string): Partial<ProjectStructure['techStack']> {
  if (!url) return {}
  const lower = url.toLowerCase()
  const result: Partial<ProjectStructure['techStack']> = {}

  // Database type
  if (lower.includes('mysql')) result.database = 'MySQL'
  else if (lower.includes('postgres')) result.database = 'PostgreSQL'
  else if (lower.includes('sqlite')) result.database = 'SQLite'
  else if (lower.includes('mongodb') || lower.includes('mongo')) result.database = 'MongoDB'

  // Language inference from driver
  if (lower.includes('pymysql') || lower.includes('asyncpg') || lower.includes('psycopg') || lower.includes('aiomysql')) {
    result.language = 'Python'
    if (!result.database) result.database = 'MySQL'
  } else if (lower.includes('mysql2') || lower.match(/[+:]pg[:/]/) || lower.includes('better-sqlite')) {
    result.language = 'TypeScript'
  }

  return result
}

// ---------------------------------------------------------------------------
// 8b. detectTechStack
// ---------------------------------------------------------------------------

/** File-based patterns for tech stack detection. */
interface StackSignal {
  file: string
  detect: (content: string) => Partial<{ language: string; backend: string; frontend: string; database: string }>
}

const STACK_SIGNALS: StackSignal[] = [
  {
    file: 'package.json',
    detect(content) {
      const pkg = JSON.parse(content)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = {}

      // Language
      if (deps['typescript'] || deps['ts-node'] || pkg.devDependencies?.['typescript']) result.language = 'TypeScript'
      else result.language = 'JavaScript'

      // Backend
      if (deps['hono']) result.backend = 'Hono'
      else if (deps['express']) result.backend = 'Express'
      else if (deps['fastify']) result.backend = 'Fastify'
      else if (deps['koa']) result.backend = 'Koa'
      else if (deps['@nestjs/core']) result.backend = 'NestJS'
      else if (deps['next']) result.backend = 'Next.js'

      // Frontend
      if (deps['react'] || deps['react-dom']) result.frontend = 'React'
      else if (deps['vue']) result.frontend = 'Vue'
      else if (deps['@angular/core']) result.frontend = 'Angular'
      else if (deps['svelte']) result.frontend = 'Svelte'
      else if (deps['solid-js']) result.frontend = 'Solid'

      // Database
      if (deps['drizzle-orm']) result.database = 'Drizzle ORM'
      else if (deps['prisma'] || deps['@prisma/client']) result.database = 'Prisma'
      else if (deps['typeorm']) result.database = 'TypeORM'
      else if (deps['sequelize']) result.database = 'Sequelize'
      else if (deps['mongoose'] || deps['mongodb']) result.database = 'MongoDB'
      else if (deps['pg'] || deps['postgres']) result.database = 'PostgreSQL'
      else if (deps['mysql2'] || deps['mysql']) result.database = 'MySQL'
      else if (deps['better-sqlite3'] || deps['sqlite3']) result.database = 'SQLite'

      return result
    },
  },
  {
    file: 'requirements.txt',
    detect(content) {
      const lower = content.toLowerCase()
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = { language: 'Python' }

      if (lower.includes('fastapi')) result.backend = 'FastAPI'
      else if (lower.includes('django')) result.backend = 'Django'
      else if (lower.includes('flask')) result.backend = 'Flask'

      if (lower.includes('sqlalchemy')) result.database = 'SQLAlchemy'
      else if (lower.includes('pymongo')) result.database = 'MongoDB'
      else if (lower.includes('psycopg')) result.database = 'PostgreSQL'
      else if (lower.includes('mysql')) result.database = 'MySQL'

      return result
    },
  },
  {
    file: 'pyproject.toml',
    detect(content) {
      const lower = content.toLowerCase()
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = { language: 'Python' }

      if (lower.includes('fastapi')) result.backend = 'FastAPI'
      else if (lower.includes('django')) result.backend = 'Django'
      else if (lower.includes('flask')) result.backend = 'Flask'

      if (lower.includes('sqlalchemy')) result.database = 'SQLAlchemy'

      return result
    },
  },
  {
    file: 'go.mod',
    detect(content) {
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = { language: 'Go' }

      if (content.includes('github.com/gin-gonic/gin')) result.backend = 'Gin'
      else if (content.includes('github.com/labstack/echo')) result.backend = 'Echo'
      else if (content.includes('github.com/gofiber/fiber')) result.backend = 'Fiber'

      if (content.includes('gorm.io/gorm')) result.database = 'GORM'

      return result
    },
  },
  {
    file: 'pom.xml',
    detect(content) {
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = { language: 'Java' }

      if (content.includes('spring-boot')) result.backend = 'Spring Boot'
      else if (content.includes('quarkus')) result.backend = 'Quarkus'

      if (content.includes('hibernate')) result.database = 'Hibernate'
      else if (content.includes('mybatis')) result.database = 'MyBatis'

      return result
    },
  },
  {
    file: 'build.gradle',
    detect(content) {
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = {}

      if (content.includes('org.jetbrains.kotlin')) result.language = 'Kotlin'
      else result.language = 'Java'

      if (content.includes('spring-boot')) result.backend = 'Spring Boot'

      return result
    },
  },
  {
    file: 'Cargo.toml',
    detect(content) {
      const result: Partial<{ language: string; backend: string; frontend: string; database: string }> = { language: 'Rust' }

      if (content.includes('actix-web')) result.backend = 'Actix Web'
      else if (content.includes('axum')) result.backend = 'Axum'
      else if (content.includes('rocket')) result.backend = 'Rocket'

      if (content.includes('diesel')) result.database = 'Diesel'
      else if (content.includes('sqlx')) result.database = 'SQLx'

      return result
    },
  },
]

/**
 * Detect the technology stack of a workspace by reading manifest files
 * (package.json, requirements.txt, go.mod, pom.xml, etc.).
 */
export function detectTechStack(workspace: string): ProjectStructure['techStack'] {
  const result: ProjectStructure['techStack'] = {
    language: 'unknown',
    backend: 'unknown',
    frontend: 'unknown',
    database: 'unknown',
  }

  for (const signal of STACK_SIGNALS) {
    const filePath = join(workspace, signal.file)
    if (!existsSync(filePath)) continue

    try {
      const content = readFileSync(filePath, 'utf-8')
      const detected = signal.detect(content)

      if (detected.language && result.language === 'unknown') result.language = detected.language
      if (detected.backend && result.backend === 'unknown') result.backend = detected.backend
      if (detected.frontend && result.frontend === 'unknown') result.frontend = detected.frontend
      if (detected.database && result.database === 'unknown') result.database = detected.database
    } catch {
      // Ignore parse errors and continue to next signal
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Resume context detection
// ---------------------------------------------------------------------------

export interface ResumeContext {
  isResume: boolean
  completedModules: string[]  // PRP names that passed VERIFIED completion (code-side check)
  pendingModules: string[]    // PRP names that are unverified or missing
  invalidMarkers: string[]    // PRP names with .done but failed completion.json verification (AI cheat attempts)
  doneDir: string
  prpDir: string
}

/**
 * Collect all sourceFiles-looking arrays from a completion.json's artifacts.
 * Supports multiple shapes AI may emit:
 *   - flat:   artifacts.sourceFiles: [...]
 *   - nested: artifacts.backend.sourceFiles, artifacts.frontend.sourceFiles, artifacts.tests.sourceFiles
 *   - alt:    artifacts.testFiles, artifacts.frontend.routes (for route arrays we ignore)
 * Returns all string paths found under any sourceFiles / testFiles key.
 */
function collectSourceFiles(artifacts: any): string[] {
  if (!artifacts || typeof artifacts !== 'object') return []
  const out: string[] = []
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    for (const [key, val] of Object.entries(node)) {
      if ((key === 'sourceFiles' || key === 'testFiles' || key === 'files') && Array.isArray(val)) {
        for (const f of val) if (typeof f === 'string' && f.length > 0) out.push(f)
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        visit(val)
      }
    }
  }
  visit(artifacts)
  return out
}

/**
 * Code-side verification of a completion marker.
 *
 * Supports two schemas (tolerant during transition):
 *   NEW: { prpName, startedAt, completedAt, acceptanceCriteria: [...] }
 *        — evidence is re-executed at runtime via runtimeVerifier
 *   OLD: { verification: { reviewVerdict, testsPass, ... } }
 *        — back-compat for completions written before the refactor
 *
 * Common guards (both schemas):
 *   - Guard 2: timing sanity (<10s fail; <60s + >100 lines fail)
 *   - Guard 3: file ownership conflict detection (runs in detectResumeContext)
 */
export async function verifyCompletion(
  prpName: string,
  outputPath: string,
  doneDir: string,
): Promise<{ verified: boolean; reason?: string }> {
  try {
    // completion.json is the primary proof. Match by PRP number prefix to tolerate
    // AI format drift (case-insensitive, extra "-and-" words, etc.).
    let jsonPath = join(doneDir, prpName + '.completion.json')
    if (!existsSync(jsonPath)) {
      const prefixMatch = prpName.match(/^(PRP-\d+)/i)
      if (prefixMatch) {
        try {
          const prefix = prefixMatch[1].toLowerCase() + '-'
          const candidate = readdirSync(doneDir)
            .filter(f => f.toLowerCase().startsWith(prefix) && f.toLowerCase().endsWith('.completion.json'))
            .sort()[0]
          if (candidate) {
            jsonPath = join(doneDir, candidate)
          }
        } catch {}
      }
      if (!existsSync(jsonPath)) {
        return { verified: false, reason: 'completion.json missing' }
      }
    }

    let data: any
    try {
      data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    } catch {
      return { verified: false, reason: 'completion.json is not valid JSON' }
    }

    // --- Schema detection ---
    const isNewSchema = Array.isArray(data?.acceptanceCriteria)

    // --- Guard 2: timing sanity (shared between schemas) ---
    const timingFailure = checkTimingGuard(data, outputPath)
    if (timingFailure) return { verified: false, reason: timingFailure }

    if (isNewSchema) {
      // ---------- NEW SCHEMA ----------
      if (!data.prpName || typeof data.prpName !== 'string') {
        return { verified: false, reason: 'acceptanceCriteria schema: missing prpName' }
      }
      if (!data.startedAt || !data.completedAt) {
        return { verified: false, reason: 'acceptanceCriteria schema: missing startedAt/completedAt' }
      }
      if (data.acceptanceCriteria.length === 0) {
        return { verified: false, reason: 'acceptanceCriteria schema: empty acceptanceCriteria array' }
      }

      // Runtime re-execution of evidence.
      const runtime = await verifyAcceptanceCriteria(jsonPath, {
        workspace: outputPath,
        skipNetworkIfDown: true,
      })
      if (!runtime.valid) {
        const first = runtime.failed[0]
        const reasonStr = first
          ? `${first.criterion} / ${first.reason ?? 'no reason'}`
          : summarizeRuntimeResult(runtime)
        return { verified: false, reason: 'Runtime verification failed: ' + reasonStr }
      }

      // Secrets scan — combine filesystem-method evidence with a heuristic
      // source-file scan of common config directories. Without this fallback,
      // a completion.json without filesystem criteria would skip secrets
      // scanning entirely (the airlinesys2 hardcoded-SECRET_KEY regression).
      const acceptanceFiles = collectFilesFromAcceptance(data.acceptanceCriteria, outputPath)
      const heuristicFiles = collectHeuristicSecretsTargets(outputPath)
      const filesToScan = Array.from(new Set([...acceptanceFiles, ...heuristicFiles]))
      if (filesToScan.length > 0) {
        const secrets = scanForSecrets(outputPath, filesToScan)
        if (!secrets.valid) {
          const f = secrets.findings[0]
          return {
            verified: false,
            reason: `Hardcoded secrets detected: ${f.file}:${f.line} ${f.pattern}`,
          }
        }
      }

      return { verified: true }
    }

    // ---------- OLD SCHEMA (back-compat) ----------
    if (!data?.verification) {
      return { verified: false, reason: 'completion.json missing verification block' }
    }
    if (data.verification.reviewVerdict !== 'PASS') {
      return { verified: false, reason: 'review verdict is not PASS' }
    }
    if (data.verification.testsPass !== true) {
      return { verified: false, reason: 'tests did not pass' }
    }

    // Best practices record (relaxed basename tolerance for cross-machine resume).
    const bpChecked: any = data?.verification?.bestPracticesChecked
    if (bpChecked !== undefined && bpChecked !== null) {
      if (!Array.isArray(bpChecked)) {
        return { verified: false, reason: 'bestPracticesChecked must be an array' }
      }
      const KNOWN_BP_BASENAMES = new Set([
        'python-fastapi.md', 'react-nextjs.md', 'java-spring-boot.md',
        'php-laravel.md', 'go-zero.md', 'typescript-node.md',
      ])
      for (const bp of bpChecked) {
        if (typeof bp !== 'string' || bp.length === 0) {
          return { verified: false, reason: 'bestPracticesChecked contains invalid entry' }
        }
        if (!existsSync(bp)) {
          const base = bp.split(/[\\/]/).pop() || ''
          if (!KNOWN_BP_BASENAMES.has(base)) {
            console.warn(`[verifyCompletion] bestPracticesChecked: ${bp} not found locally; basename not in known bundled set — accepting as record only`)
          }
        }
      }
    }

    // Spot-check artifacts exist on disk.
    let sourceFiles = collectSourceFiles(data)
    if (sourceFiles.length === 0) {
      const moduleSlug = prpName.replace(/^PRP-\d+-/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const candidateDirs = [
        join(outputPath, 'src', moduleSlug),
        join(outputPath, 'src', moduleSlug.split('-')[0]),
        join(outputPath, 'tests', moduleSlug),
        join(outputPath, 'frontend', 'src', 'pages', moduleSlug),
      ]
      for (const d of candidateDirs) {
        if (existsSync(d)) {
          try {
            const entries = readdirSync(d)
            for (const e of entries) sourceFiles.push(join(d, e))
          } catch {}
        }
      }
      if (sourceFiles.length === 0) {
        return { verified: false, reason: 'no source files listed AND no matching module directory found on disk' }
      }
    }
    const anyExists = sourceFiles.some(rel => {
      if (/^[A-Za-z]:[\\/]|^\//.test(rel)) return existsSync(rel)
      const full = join(outputPath, rel.replace(/^\//, '').replace(/\\/g, '/'))
      return existsSync(full)
    })
    if (!anyExists) {
      return { verified: false, reason: 'none of the listed source files exist on disk' }
    }

    return { verified: true }
  } catch (e) {
    return { verified: false, reason: 'verification error: ' + (e instanceof Error ? e.message : String(e)) }
  }
}

/**
 * Guard 2 — timing sanity shared between old/new schemas.
 * Returns a reason string on failure, or null if OK (or unable to determine).
 */
function checkTimingGuard(data: any, outputPath: string): string | null {
  const startedAt = data.startedAt || data._startedAt || data.started_at
  const completedAt = data.completedAt || data._completedAt || data.completed_at
  if (!startedAt || !completedAt) return null
  const startMs = new Date(startedAt).getTime()
  const endMs = new Date(completedAt).getTime()
  if (isNaN(startMs) || isNaN(endMs)) return null
  const duration = endMs - startMs
  if (duration < 0) return null

  // ABSOLUTE FAIL: < 10s is impossible for any real implementation.
  if (duration < 10_000) {
    return `Duration ${Math.round(duration / 1000)}s < 10s absolute minimum — no legitimate implementation completes this fast`
  }
  // Relative check: < 60s + > 100 lines = likely fraud.
  if (duration < 60_000) {
    const listed: string[] = collectFileCandidatesForTiming(data)
    const totalLines = listed
      .map((f: string) => {
        try {
          const rel = typeof f === 'string' ? f : ''
          const full = /^[A-Za-z]:[\\/]|^\//.test(rel)
            ? rel
            : join(outputPath, rel.replace(/^\//, '').replace(/\\/g, '/'))
          return readFileSync(full, 'utf-8').split('\n').length
        } catch {
          return 0
        }
      })
      .reduce((a: number, b: number) => a + b, 0)
    if (totalLines > 100) {
      return `Duration ${Math.round(duration / 1000)}s < 60s but code has ${totalLines} lines — likely fraud`
    }
  }
  return null
}

/** Best-effort file list for timing guard — supports both schemas. */
function collectFileCandidatesForTiming(data: any): string[] {
  const files: string[] = []
  const legacy = data.artifacts?.sourceFiles || data.files_created
  if (Array.isArray(legacy)) for (const f of legacy) if (typeof f === 'string') files.push(f)
  if (Array.isArray(data.acceptanceCriteria)) {
    for (const c of data.acceptanceCriteria) {
      const f = c?.evidence?.file
      if (typeof f === 'string') files.push(f)
    }
  }
  return files
}

/** Collect relative file paths from filesystem-method acceptance-criteria evidence. */
function collectFilesFromAcceptance(criteria: any[], workspace: string): string[] {
  const out: string[] = []
  for (const c of criteria) {
    if (c?.method === 'filesystem' && typeof c?.evidence?.file === 'string') {
      const f = c.evidence.file
      // Only scan if file resolves inside the workspace.
      const abs = /^[A-Za-z]:[\\/]|^\//.test(f) ? f : join(workspace, f)
      if (existsSync(abs)) out.push(f)
    }
  }
  return out
}

/**
 * Heuristic list of common secret-bearing files to scan, regardless of whether
 * Meta Coder listed them in acceptance criteria. Protects against the airlinesys2
 * pattern: hardcoded SECRET_KEY in config.py when AI forgot a filesystem criterion.
 *
 * Intentionally shallow — only looks at well-known config paths, not a full
 * workspace scan. Fast, low false-positive.
 */
function collectHeuristicSecretsTargets(workspace: string): string[] {
  const candidates = [
    // Python / Django / FastAPI
    'src/core/config.py', 'src/config.py', 'app/config.py', 'config.py', 'settings.py',
    'src/core/settings.py', 'src/settings.py', 'app/settings.py',
    'src/core/security.py', 'src/security.py',
    // Django-style split settings
    'settings/base.py', 'settings/production.py', 'settings/local.py', 'settings/dev.py',
    'config/settings/base.py', 'config/settings/production.py', 'config/settings/local.py',
    // Node/TS
    'src/config.ts', 'src/config.js', 'config.ts', 'config.js',
    'src/lib/config.ts', 'backend/src/config.ts', 'backend/config.ts',
    'src/core/config.ts',
    // Java (Spring) — base + profiles
    'src/main/resources/application.properties',
    'src/main/resources/application.yml',
    'src/main/resources/application.yaml',
    'src/main/resources/application-prod.properties',
    'src/main/resources/application-prod.yml',
    'src/main/resources/application-dev.yml',
    // Go
    'config/config.go', 'internal/config/config.go', 'pkg/config/config.go',
    // PHP (Laravel)
    'config/app.php', 'config/database.php', 'config/auth.php',
    // Ruby on Rails
    'config/secrets.yml', 'config/database.yml', 'config/credentials.yml.enc', 'config/master.key',
    // .NET / C#
    'appsettings.json', 'appsettings.Production.json', 'appsettings.Development.json',
    'backend/appsettings.json',
    // WordPress
    'wp-config.php',
    // env-style files (these usually SHOULD have real values, but often committed by accident)
    '.env',
    'backend/.env',
    // Don't scan .env.example / .env.sample — secretsScanner demotes those to LOW anyway
  ]
  const out: string[] = []
  for (const rel of candidates) {
    try {
      if (existsSync(join(workspace, rel))) out.push(rel)
    } catch {}
  }
  return out
}

/**
 * Detect if this is a resume scenario by checking for done/ directory
 * and listing completed vs pending modules.
 *
 * Uses CODE-SIDE verification — AI cannot bypass by simply creating empty .done files.
 *
 * Called early in getPromptForCommand() to decide whether to skip Phase 1-3
 * or run the full pipeline.
 */
export async function detectResumeContext(outputPath: string): Promise<ResumeContext> {
  const prpDir = join(outputPath, '.project', 'prps')
  const doneDir = join(prpDir, 'done')
  const ctx: ResumeContext = {
    isResume: false,
    completedModules: [],
    pendingModules: [],
    invalidMarkers: [],
    doneDir,
    prpDir,
  }

  // Not a resume if .project/prps/ doesn't exist (fresh start)
  if (!existsSync(prpDir)) return ctx

  try {
    // List all PRP files
    const allPrps = readdirSync(prpDir)
      .filter(f => /^PRP-\d+.*\.md$/i.test(f))
      .map(f => f.replace(/\.md$/i, ''))

    // If no PRPs, not a resume
    if (allPrps.length === 0) return ctx

    // Verify each PRP's completion status with code-side checks
    for (const prp of allPrps) {
      const result = await verifyCompletion(prp, outputPath, doneDir)
      if (result.verified) {
        ctx.completedModules.push(prp)
      } else {
        // Check if there's a bogus marker (AI cheated) or just not started
        const donePath = join(doneDir, prp + '.md.done')
        // A module without completion.json is just "not started yet" — NOT an
        // invalid marker. Only flag as invalidMarkers when the done-file marker
        // exists (AI claims done) but verification found substantive problems.
        const isNotStarted = result.reason === 'completion.json missing'
        if (existsSync(donePath) && !isNotStarted) {
          ctx.invalidMarkers.push(prp + ' (' + result.reason + ')')
        }
        ctx.pendingModules.push(prp)
      }
    }

    // Guard 3: audit file ownership across all completion.json files.
    // Shared source files claimed by multiple PRPs = fraud signal.
    try {
      const ownershipAudit = auditFileOwnership(doneDir)
      if (!ownershipAudit.valid) {
        console.warn('[Phase 4 Verify] File ownership conflicts detected:')
        const conflictedPrps = new Set<string>()
        for (const c of ownershipAudit.conflicts) {
          console.warn('  ' + c.file + ' claimed by ' + c.claimedBy.length + ' PRPs: ' + c.claimedBy.join(', '))
          for (const prpFile of c.claimedBy) {
            const prpId = prpFile.replace(/\.completion\.json$/i, '')
            conflictedPrps.add(prpId)
          }
        }
        // Move conflicted PRPs from completedModules → pendingModules + invalidMarkers.
        // Use trailing-separator match to avoid PRP-001 being demoted when PRP-0010 conflicts.
        if (conflictedPrps.size > 0) {
          const stillCompleted: string[] = []
          for (const prp of ctx.completedModules) {
            const prpKey = prp.toLowerCase() + '-'
            const conflicted = Array.from(conflictedPrps).some(cp => {
              const cpKey = cp.toLowerCase() + '-'
              // Match only if one is a complete prefix of the other with separator boundary
              return cpKey === prpKey || cpKey.startsWith(prpKey) || prpKey.startsWith(cpKey)
            })
            if (conflicted) {
              ctx.invalidMarkers.push(prp + ' (file ownership conflict)')
              if (!ctx.pendingModules.includes(prp)) ctx.pendingModules.push(prp)
            } else {
              stillCompleted.push(prp)
            }
          }
          ctx.completedModules = stillCompleted
        }
      }
    } catch (e) {
      console.warn('[Phase 4 Verify] ownership audit error:', e instanceof Error ? e.message : String(e))
    }

    // Guard 2: timeline analysis — detect the airlinesys2 batch-completion pattern.
    try {
      const timeline = analyzeTimeline(doneDir)
      if (!timeline.valid) {
        console.warn('[Phase 4 Verify] Timeline anomalies detected:')
        for (const issue of timeline.issues) {
          console.warn('  ⚠ ' + issue)
        }
        // Flag (but don't demote) — verifyCompletion already handles per-PRP duration.
        // The batch pattern is a strong signal for the operator to investigate manually.
        for (const batch of timeline.stats.suspiciouslyBatched || []) {
          for (const prp of batch.prps) {
            if (!ctx.invalidMarkers.some(m => m.startsWith(prp))) {
              ctx.invalidMarkers.push(prp + ` (batched completion: ${Math.round(batch.spanMs / 1000)}s span)`)
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Phase 4 Verify] timeline analysis error:', e instanceof Error ? e.message : String(e))
    }

    // (Guard 5 static visual template scan removed — runtime verifier handles
    // frontend verification via chrome-mcp evidence in the new schema.)

    // Resume only if some modules are actually verified complete
    ctx.isResume = ctx.completedModules.length > 0
  } catch {
    // On error, treat as fresh start
  }

  return ctx
}

// ---------------------------------------------------------------------------
// Best practices file selection
// ---------------------------------------------------------------------------

export interface BestPracticesFiles {
  backend: string | null   // path to backend best practices file (relative to meta-coder root)
  frontend: string | null  // path to frontend best practices file
  backendLabel: string     // e.g., "Python/FastAPI"
  frontendLabel: string    // e.g., "React/Next.js"
}

/**
 * Resolve the EFFECTIVE tech stack by merging multiple sources with priority:
 *   1. User CLI params (--backend-lang, --frontend-lang)
 *   2. Database URL inference (e.g., pymysql → Python)
 *   3. Detected stack from manifest files (structure.techStack from detectTechStack)
 *   4. Sensible defaults based on mode
 *
 * Use this instead of reading structure.techStack directly — that raw value ignores
 * user intent expressed via CLI params and database URL.
 */
export function resolveTechStack(
  parsed: ProjectArgs,
  structure: ProjectStructure,
  mode: 'legacy' | 'new',
): { language: string; backend: string; frontend: string; database: string } {
  const dbInferred = inferTechFromDatabaseUrl(parsed.databaseUrl || '')
  const resolved = {
    language: parsed.backendLang || dbInferred.language || structure.techStack?.language || (mode === 'legacy' ? 'Python' : 'TypeScript'),
    backend: parsed.backendLang || (dbInferred.language === 'Python' ? 'FastAPI' : '') || structure.techStack?.backend || 'unknown',
    frontend: parsed.frontendLang || structure.techStack?.frontend || 'React',
    database: dbInferred.database || structure.techStack?.database || 'unknown',
  }
  // If backend is still unknown, assign sensible defaults based on language
  if (resolved.backend === 'unknown') {
    if (resolved.language === 'Python') resolved.backend = 'FastAPI'
    else if (resolved.language === 'TypeScript' || resolved.language === 'JavaScript') resolved.backend = 'Hono'
    else if (resolved.language === 'Java') resolved.backend = 'Spring Boot'
    else if (resolved.language === 'Go') resolved.backend = 'Go-Zero'
    else if (resolved.language === 'PHP') resolved.backend = 'Laravel'
  }
  return resolved
}

/**
 * Resolve absolute path to the meta-coder resources/bestpractices/ directory.
 * Tries multiple candidate locations to support dev, bundled exe, and installed modes.
 * Same pattern as src/commands/systest/phases/phase3.ts loadBestPractices().
 */
function resolveBestPracticesDir(): string | null {
  const candidates = [
    join(process.cwd(), 'resources', 'bestpractices'),
    join(dirname(process.argv[0] || ''), '..', 'resources', 'bestpractices'),
    // Also search up from this file's location (for dev mode and installed location)
    join(dirname(dirname(dirname(dirname(__dirname)))), 'resources', 'bestpractices'),
  ]
  return candidates.find(p => existsSync(p)) || null
}

/**
 * Pick the most relevant best practices file(s) for the resolved tech stack.
 * Returns ABSOLUTE paths so Coding/Reviewer agents can Read them regardless of cwd.
 *
 * Returns null for backend/frontend if:
 *   - the best practices directory cannot be located, OR
 *   - the stack doesn't match any known language/framework
 */
export function getBestPracticesFiles(
  stack: { language?: string; backend?: string; frontend?: string },
): BestPracticesFiles {
  const lang = (stack.language || '').toLowerCase()
  const be = (stack.backend || '').toLowerCase()
  const fe = (stack.frontend || '').toLowerCase()

  const result: BestPracticesFiles = {
    backend: null,
    frontend: null,
    backendLabel: 'unknown',
    frontendLabel: 'unknown',
  }

  const bpDir = resolveBestPracticesDir()
  if (!bpDir) {
    // Directory not found — caller should handle nulls gracefully
    return result
  }

  const abs = (name: string) => join(bpDir, name).replace(/\\/g, '/')

  // Backend selection
  if (lang.includes('python') || be.includes('fastapi') || be.includes('flask') || be.includes('django')) {
    result.backend = abs('python-fastapi.md')
    result.backendLabel = 'Python/FastAPI'
  } else if (lang.includes('java') || be.includes('spring')) {
    result.backend = abs('java-spring-boot.md')
    result.backendLabel = 'Java/Spring Boot'
  } else if (lang.includes('php') || be.includes('laravel')) {
    result.backend = abs('php-laravel.md')
    result.backendLabel = 'PHP/Laravel'
  } else if (lang.includes('go') || be.includes('go-zero') || be.includes('gin') || be.includes('echo')) {
    result.backend = abs('go-zero.md')
    result.backendLabel = 'Go/Go-Zero'
  } else if (
    lang.includes('typescript') || lang.includes('javascript') ||
    be.includes('hono') || be.includes('express') || be.includes('nest') || be.includes('fastify')
  ) {
    result.backend = abs('react-nextjs.md')
    result.backendLabel = 'TypeScript/Hono/Express'
  }
  // Unknown stack: result.backend stays null (no silent fallback to wrong file)

  // Frontend selection — react-nextjs covers React/Next.js/Vue/Svelte for our purposes
  if (fe.includes('react') || fe.includes('next') || fe.includes('vue') || fe.includes('svelte') || fe.includes('solid')) {
    result.frontend = abs('react-nextjs.md')
    result.frontendLabel = fe.includes('next') ? 'Next.js' :
                           fe.includes('vue') ? 'Vue' :
                           fe.includes('svelte') ? 'Svelte' :
                           fe.includes('solid') ? 'Solid' : 'React'
  }
  // Unknown frontend: result.frontend stays null

  return result
}
