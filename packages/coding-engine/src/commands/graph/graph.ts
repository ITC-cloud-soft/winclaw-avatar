import { existsSync, statSync } from 'node:fs'
import type { LocalCommandCall } from '../../types/command.js'
import { resolveGraphPath } from '../../services/graphify/client.js'
import { getEngine, resetEngine } from '../../services/graphify/engineLoader.js'
import { detectGitChanges } from '../../services/graphify/gitEventDetector.js'
import { buildGraph } from '../../services/graphify/builder/index.js'
import { ensureGraphifyInGitignore } from '../../services/graphify/gitignoreHelper.js'
import { FILE_TYPE_CATEGORIES } from '../../services/graphify/graphModel.js'

// Extended options interface
interface GraphOptions {
  force?: boolean
  include?: string[]        // File type categories: code, docs, config, markup, style, data, image, all
  semantic?: boolean        // Enable semantic analysis
  confidence?: number       // Confidence threshold (0-1)
  output?: string           // Output format: json, html, stats
}

export const call: LocalCommandCall = async (args, _context) => {
  const parts = args.trim().split(/\s+/)
  const subcommand = parts[0] ?? 'status'
  const argsList = parts.slice(1)
  
  // Parse options
  const options = parseOptions(argsList)
  const hasForce = options.force || argsList.includes('--force')

  let text: string
  switch (subcommand) {
    case 'status':
      text = await graphStatus()
      break
    case 'rebuild':
      text = await graphRebuild(hasForce, options)
      break
    case 'init':
      text = await graphInit(options)
      break
    case 'update':
      text = await graphUpdate()
      break
    default:
      text = getHelpText()
  }

  return { type: 'text', value: text }
}

// Parse command-line options
function parseOptions(args: string[]): GraphOptions {
  const options: GraphOptions = {}
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--force':
      case '-f':
        options.force = true
        break
        
      case '--include':
      case '-i':
        const value = args[++i]
        if (value) {
          options.include = value.split(',').map(v => v.trim().toLowerCase())
        }
        break
        
      case '--semantic':
      case '-s':
        options.semantic = true

      case '--no-semantic':
        options.semantic = false
        break
        break
        
      case '--confidence':
      case '-c':
        const threshold = parseFloat(args[++i])
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          options.confidence = threshold
        }
        break
        
      case '--output':
      case '-o':
        options.output = args[++i]
        break
        
      case '--all':
      case '-a':
        options.include = ['all']
        break
    }
  }
  
  return options
}

// Get help text
function getHelpText(): string {
  return [
    'Knowledge Graph Commands',
    '',
    'Usage: /graph <command> [options]',
    '',
    'Commands:',
    '  status        Show graph status',
    '  init          Initialize graph (auto-build if needed)',
    '  rebuild       Rebuild graph from scratch',
    '  update        Incremental update (git changes only)',
    '',
    'Options:',
    '  --include, -i  File type categories to include',
    '                Values: code, docs, config, markup, style, data, image, all',
    '                Example: /graph rebuild --include docs,config',
    '                         /graph rebuild --all',
    '  --semantic, -s Enable semantic analysis',
    '                Example: /graph rebuild --semantic',
    '  --confidence, -c Minimum confidence threshold (0-1)',
    '                Default: 0.5 for semantic, 1.0 for structural',
    '                Example: /graph rebuild --semantic --confidence 0.7',
    '  --output, -o   Output format: json, html, stats',
    '                Default: text',
    '  --force, -f    Force full rebuild (skip auto-update)',
    '  --all, -a      Include all file types (same as --include all)',
    '',
    'Examples:',
    '  /graph status                        Show graph status',
    '  /graph rebuild                       Rebuild with semantic analysis (default)',
    '  /graph rebuild --no-semantic         Rebuild code only (no semantic)',
    '  /graph rebuild --include docs,config  Include docs + configs',
    '  /graph rebuild --semantic --all      Full semantic analysis',
    '  /graph rebuild --all                 Include all file types',
    '  /graph rebuild --semantic --confidence 0.8  High confidence only',
    '',
    'File Type Categories:',
    '  code    - TypeScript, JavaScript, Python, Go, etc.',
    '  docs    - Markdown, text, reStructuredText',
    '  config  - JSON, YAML, TOML, INI',
    '  markup  - HTML, XML, SVG',
    '  style   - CSS, SCSS, SASS, LESS',
    '  data    - SQL, CSV, TSV',
    '  image   - PNG, JPEG, GIF, SVG (metadata only)',
    '',
    'For more information, see: C:\\work\\docs\\meta-coder\\semantic-graph-implementation-progress.md',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Subcommand implementations
// ---------------------------------------------------------------------------

async function graphStatus(): Promise<string> {
  const graphPath = resolveGraphPath()
  if (!existsSync(graphPath)) {
    return 'No knowledge graph found.\nRun /graph rebuild to create one.'
  }

  const engine = await getEngine()
  if (!engine) {
    return 'Knowledge graph file exists but could not be loaded.'
  }

  const stats = engine.getStats()
  const stat = statSync(graphPath)
  const ageMs = Date.now() - stat.mtime.getTime()
  const ageMin = Math.floor(ageMs / 60000)
  const freshness =
    ageMin < 1
      ? 'just now'
      : ageMin < 60
        ? `${ageMin}m ago`
        : `${Math.floor(ageMin / 60)}h ago`
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1)

  // Check for git changes since last build.
  let gitInfo = ''
  try {
    const gitChanges = await detectGitChanges()
    if (gitChanges.changed.length > 0) {
      gitInfo = `\n\n${gitChanges.changed.length} files changed since last build`
      if (gitChanges.isLargeChange) {
        gitInfo += ' (large change detected — consider /graph rebuild)'
      } else {
        gitInfo += ' (run /graph update to refresh)'
      }
    }
  } catch {
    /* git not available */
  }

  return [
    'Knowledge Graph Status',
    `  Path: ${graphPath}`,
    `  Size: ${sizeMB} MB`,
    `  Built: ${freshness}`,
    `  Nodes: ${stats.nodeCount.toLocaleString()}`,
    `  Edges: ${stats.edgeCount.toLocaleString()}`,
    `  Communities: ${stats.communityCount.toLocaleString()}`,
    `  Engine: TS in-memory (loaded)`,
    gitInfo,
  ]
    .filter(Boolean)
    .join('\n')
}

async function graphRebuild(force = false, options?: GraphOptions): Promise<string> {
  const graphPath = resolveGraphPath()

  // Smart mode: if graph exists and not forced, auto-switch to update
  if (!force && existsSync(graphPath)) {
    const updateResult = await graphUpdate()
    return `[auto-update] Graph already exists — running incremental update.\n(Use /graph rebuild --force for full rebuild)\n\n${updateResult}`
  }

  return doFullRebuild(options)
}

async function doFullRebuild(options?: GraphOptions): Promise<string> {
  try {
    const cwd = process.cwd()
    
    // Ensure graphify-out/ is present in .gitignore before writing anything.
    ensureGraphifyInGitignore(cwd)

    // Build include list based on options
      let includeList: string[] | undefined
      if (options?.include && options.include.length > 0) {
        includeList = buildIncludeList(options.include)
      }

    const result = await buildGraph({
      rootDir: cwd,
      include: includeList,
    })

    if (!result.success) {
      return 'Graph build failed.'
    }

    // Reload the engine with the freshly-written graph.
    resetEngine()
    await getEngine()

    const lines = [
      'Knowledge graph rebuilt successfully',
      `  Nodes: ${result.nodes.toLocaleString()}`,
      `  Edges: ${result.edges.toLocaleString()}`,
      `  Communities: ${result.communities.toLocaleString()}`,
      `  Time: ${Math.round(result.elapsed)}ms`,
      `  Path: ${result.graphPath}`,
    ]
    
    return lines.join('\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Rebuild failed: ${msg}`
  }
}

async function graphInit(options?: GraphOptions): Promise<string> {
  const graphPath = resolveGraphPath()
  if (existsSync(graphPath)) {
    // Graph exists → auto update
    const updateResult = await graphUpdate()
    return `[auto-update] Graph already exists — running incremental update.\n(Use /graph rebuild --force for full rebuild)\n\n${updateResult}`
  }
  return doFullRebuild(options)
}

async function graphUpdate(): Promise<string> {
  const engine = await getEngine()
  if (!engine) {
    return 'No knowledge graph loaded. Run /graph rebuild first.'
  }

  try {
    const gitChanges = await detectGitChanges()
    if (gitChanges.changed.length === 0) {
      return 'Knowledge graph is up to date. No changed files detected.'
    }

    if (gitChanges.isLargeChange) {
      // Large change → auto full rebuild for accuracy
      return `Large change detected (${gitChanges.changed.length} files) — auto full rebuild.\n\n${await doFullRebuild()}`
    }

    const removed = engine.incrementalUpdate(gitChanges.changed)
    return [
      `Graph updated: ${gitChanges.changed.length} files processed`,
      `  Nodes removed: ${removed}`,
      `  (Note: incremental update removes stale nodes; new symbols`,
      `   will be added when the graph is fully rebuilt)`,
    ].join('\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Update failed: ${msg}`
  }
}

// Build include list from category names
function buildIncludeList(categories: string[]): string[] {
  const extensions: string[] = []
  
  for (const category of categories) {
    if (category === 'all') {
      // Include all categories
      for (const exts of Object.values(FILE_TYPE_CATEGORIES)) {
        extensions.push(...exts)
      }
      break
    }
    
    const exts = FILE_TYPE_CATEGORIES[category.toUpperCase() as keyof typeof FILE_TYPE_CATEGORIES]
    if (exts) {
      extensions.push(...exts)
    }
  }
  
  // Add dots to extensions
  return extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext)
}

