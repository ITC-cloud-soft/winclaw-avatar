import { readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { logForDebugging } from '../../../utils/debug.js'
import { detectCommunities } from './community.js'
import { discoverCodeFiles } from './fileDiscovery.js'
import { isOpenApiFile, parseOpenApiFile } from './openApiParser.js'
import { parseFile } from './parser.js'
import { resolveImports } from './resolver.js'
import { type GraphData, saveGraph } from './serializer.js'

/**
 * Options controlling the graph build pipeline.
 */
export interface BuildOptions {
  /** Absolute path to the project root. */
  rootDir: string
  /** Directory where output files are written. Defaults to `<rootDir>/graphify-out`. */
  outputDir?: string
  /** Glob patterns selecting which files to include. */
  include?: string[]
  /** Glob patterns selecting which files to exclude. */
  exclude?: string[]
}

/**
 * Summary statistics returned after a successful build.
 */
export interface BuildResult {
  success: boolean
  nodes: number
  edges: number
  communities: number
  /** Wall-clock milliseconds elapsed during the build. */
  elapsed: number
  /** Absolute path to the written graph JSON file. */
  graphPath: string
}

/**
 * Derive a short, lowercase identifier from a file path, used as the stable
 * node ID for a source file.
 *
 * Using only the basename (minus extension) keeps IDs readable; the full
 * relative path is preserved in `source_file` on every node.
 */
function generateFileId(filePath: string): string {
  return basename(filePath, extname(filePath)).toLowerCase()
}

/**
 * Run the full graph-build pipeline:
 *
 * 1. Discover source files under `options.rootDir`
 * 2. Parse each file for symbols and intra-file relations
 * 3. Resolve cross-file import edges
 * 4. Detect communities with the Louvain-style algorithm
 * 5. Assemble `GraphData` and persist it to `outputDir`
 *
 * @returns A {@link BuildResult} describing what was written.
 */
export async function buildGraph(options: BuildOptions): Promise<BuildResult> {
  const t0 = performance.now()
  const outputDir = options.outputDir ?? join(options.rootDir, 'graphify-out')

  logForDebugging('[graphify:build] Starting graph build...')

  // ------------------------------------------------------------------
  // Step 1: Discover files
  // ------------------------------------------------------------------
  const files = await discoverCodeFiles(options.rootDir, {
    include: options.include,
    exclude: options.exclude,
  })
  logForDebugging(`[graphify:build] Discovered ${files.length} code files`)

  // SAFETY NET (airlinesys5 incident, 2026-04-28): if file discovery balloons
  // to absurd numbers, the rootDir is almost certainly wrong (HOME directory
  // hit, OS root hit, or a misrouted notifyFileChanged fallback). Abort with
  // a clear error rather than letting the parser loop chew through gigabytes.
  // Real projects fit in 50k files; the airlinesys5 misrouting hit 761,179.
  const MAX_FILES = 50_000
  if (files.length > MAX_FILES) {
    const msg =
      `[graphify:build] ABORT: rootDir "${options.rootDir}" yielded ` +
      `${files.length} files (threshold ${MAX_FILES}). This usually means the ` +
      `rootDir is wrong (e.g. HOME or filesystem root, not a project dir). ` +
      `No graph written.`
    logForDebugging(msg)
    // Surface to console so the user actually sees the cause if their session
    // suddenly goes silent. logForDebugging only writes to debug log file.
    console.error(msg)
    return {
      success: false,
      nodes: 0,
      edges: 0,
      communities: 0,
      elapsed: performance.now() - t0,
      graphPath: '',
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Parse all files into symbols + intra-file relations
  // ------------------------------------------------------------------
  const parsedFiles = new Map<string, ReturnType<typeof parseFile>>()
  const allSymbols: ReturnType<typeof parseFile>['symbols'] = []
  const allRelations: ReturnType<typeof parseFile>['relations'] = []

  for (const file of files) {
    try {
      let content: string | undefined = undefined
        const ext = file.extension.toLowerCase()
        const binaryExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.gif', '.webp']
        if (!binaryExtensions.includes(ext)) {
          content = readFileSync(file.absolutePath, 'utf-8')
        }
      // Pass absolutePath for binary files (PDF, docx, etc.) so parsers can read them
      // Pass detected extension for extensionless mainframe files (LOGIN-COB → .cob)
      // OpenAPI / Swagger specs get routed to the dedicated openApiParser so
      // paths / schemas / required fields become first-class graph entities.
      let result
      if (isOpenApiFile(file.path) && content !== undefined) {
        result = await parseOpenApiFile(file.path, content)
      } else {
        result = await parseFile(file.path, content, binaryExtensions.includes(ext) ? file.absolutePath : undefined, ext)
      }
      parsedFiles.set(file.path, result)
      allSymbols.push(...result.symbols)
      allRelations.push(...result.relations)
    } catch (err) {
      logForDebugging(`[graphify:build] Failed to parse ${file.path}: ${err}`)
    }
  }
  logForDebugging(
    `[graphify:build] Parsed ${allSymbols.length} symbols, ${allRelations.length} relations`,
  )

  // ------------------------------------------------------------------
  // Step 3: Build the file-path → file-ID lookup used by the resolver
  // ------------------------------------------------------------------
  const fileMap = new Map<string, string>()
  for (const file of files) {
    const id = generateFileId(file.path)
    const normalized = file.path.replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '')
    fileMap.set(normalized, id)
    // Also expose paths without the leading `src/` segment so imports such as
    // `import { foo } from 'utils/bar'` can still be resolved.
    if (normalized.startsWith('src/')) {
      fileMap.set(normalized.slice(4), id)
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Resolve cross-file import edges
  // ------------------------------------------------------------------
  const importEdges = resolveImports(parsedFiles, fileMap)
  logForDebugging(`[graphify:build] Resolved ${importEdges.length} import edges`)

  // ------------------------------------------------------------------
  // Step 5: Combine intra-file relations and cross-file import edges
  // ------------------------------------------------------------------
  const normaliseRelation = (
    r: (typeof allRelations)[number] | (typeof importEdges)[number],
  ) => ({
    source: r.sourceId,
    target: r.targetId,
    relation: r.relation,
    confidence: r.confidence,
    confidence_score: 1.0 as number,
    source_file: r.sourceFile,
    source_location: r.sourceLocation,
    weight: 1 as number,
    _src: r.sourceId,
    _tgt: r.targetId,
  })

  const allEdges = [
    ...allRelations.map(normaliseRelation),
    ...importEdges.map(normaliseRelation),
  ]

  // ------------------------------------------------------------------
  // Step 6: Community detection
  // ------------------------------------------------------------------
  const nodeIds = allSymbols.map(s => s.id)
  const edgePairs = allEdges.map(e => ({ source: e.source, target: e.target }))
  const communities = detectCommunities(nodeIds, edgePairs)
  logForDebugging(
    `[graphify:build] Detected ${communities.communities.size} communities`,
  )

  // ------------------------------------------------------------------
  // Step 7: Assemble final GraphData
  // ------------------------------------------------------------------
  const graphData: GraphData = {
    nodes: allSymbols.map(s => ({
      id: s.id,
      label: s.label,
      file_type: 'code' as const,
      kind: s.kind,
      source_file: s.sourceFile,
      source_location: s.sourceLocation,
      community: communities.nodeToCommuntiy.get(s.id) ?? 0,
      // Level 2 attributes — only included when present
      ...(s.signature && { signature: s.signature }),
      ...(s.fieldType && { fieldType: s.fieldType }),
      ...(s.httpMethod && { httpMethod: s.httpMethod }),
      ...(s.urlPath && { urlPath: s.urlPath }),
      ...(s.optional !== undefined && { optional: s.optional }),
      ...(s.constraints && { constraints: s.constraints }),
      ...(s.schemaType && { schemaType: s.schemaType }),
      ...(s.tableName && { tableName: s.tableName }),
    })),
    links: allEdges,
  }

  // ------------------------------------------------------------------
  // Step 8: Persist to disk
  // ------------------------------------------------------------------
  const { graphPath } = await saveGraph(graphData, outputDir)

  const elapsed = performance.now() - t0
  logForDebugging(
    `[graphify:build] Complete: ${graphData.nodes.length} nodes, ` +
      `${graphData.links.length} edges in ${Math.round(elapsed)}ms`,
  )

  return {
    success: true,
    nodes: graphData.nodes.length,
    edges: graphData.links.length,
    communities: communities.communities.size,
    elapsed,
    graphPath,
  }
}
