import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { logForDebugging } from '../../utils/debug.js'
import { resetEngine, getEngine } from './engineLoader.js'

const exec = promisify(execFile)

export interface TeamInitOptions {
  builderCount?: number
  teamMode?: boolean
}

export interface TeamInitResult {
  success: boolean
  nodes: number
  edges: number
  communities: number
  elapsed: number
  teamMode: boolean
  builderCount: number
}

/**
 * Calculate number of builders based on project file count.
 */
function calculateBuilderCount(fileCount: number): number {
  if (fileCount < 500) return 1
  if (fileCount < 2000) return 2
  if (fileCount < 5000) return 4
  if (fileCount < 20000) return 6
  return Math.min(16, Math.ceil(fileCount / 5000))
}

/**
 * Count code files in a directory recursively.
 */
function countCodeFiles(dir: string, extensions = /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp)$/): number {
  let count = 0
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'graphify-out', '.claude', 'vendor'])

  function walk(d: string) {
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIP.has(entry.name)) walk(join(d, entry.name))
        } else if (extensions.test(entry.name)) {
          count++
        }
      }
    } catch { /* permission errors, etc */ }
  }

  walk(dir)
  return count
}

/**
 * Partition files by top-level directory for parallel processing.
 */
function partitionByDirectory(dir: string, targetChunks: number): Array<{ directory: string; files: string[] }> {
  const groups = new Map<string, string[]>()
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'graphify-out', '.claude', 'vendor'])
  const extensions = /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp)$/

  function walk(d: string) {
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const fullPath = join(d, entry.name)
        if (entry.isDirectory()) {
          if (!SKIP.has(entry.name)) walk(fullPath)
        } else if (extensions.test(entry.name)) {
          const rel = relative(dir, fullPath)
          const topDir = rel.split(/[/\\]/).slice(0, 2).join('/')
          const list = groups.get(topDir) ?? []
          list.push(rel)
          groups.set(topDir, list)
        }
      }
    } catch { /* ignore */ }
  }
  walk(dir)

  // Sort by size descending, then greedily assign to chunks
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  const chunks: Array<{ directory: string; files: string[] }> =
    Array.from({ length: targetChunks }, () => ({ directory: '', files: [] }))

  for (const [dirName, files] of sorted) {
    const smallest = chunks.reduce((min, c) => c.files.length < min.files.length ? c : min)
    smallest.files.push(...files)
    smallest.directory += (smallest.directory ? ', ' : '') + dirName
  }

  return chunks.filter(c => c.files.length > 0)
}

/**
 * Initialize knowledge graph with optional team mode.
 * Team mode partitions the project and could use multiple agents in the future.
 * For now, it provides the infrastructure and falls back to single-thread rebuild.
 */
export async function graphInitWithTeam(
  options: TeamInitOptions = {}
): Promise<TeamInitResult> {
  const t0 = performance.now()
  const cwd = process.cwd()

  // Analyze project
  const fileCount = countCodeFiles(cwd)
  const builderCount = options.builderCount ?? calculateBuilderCount(fileCount)
  const useTeam = (options.teamMode ?? true) && builderCount > 1

  logForDebugging(`[graphify:team] Project: ${fileCount} code files, ${builderCount} builders, team=${useTeam}`)

  if (useTeam) {
    const chunks = partitionByDirectory(cwd, builderCount)
    logForDebugging(`[graphify:team] Partitioned into ${chunks.length} chunks: ${chunks.map(c => `${c.directory}(${c.files.length})`).join(', ')}`)
  }

  // For now, use the existing Python rebuild (single-threaded)
  // Team mode infrastructure is ready for future parallel agent execution
  try {
    const rebuildScript = join(cwd, 'rebuild_graph.py')
    if (!existsSync(rebuildScript)) {
      return {
        success: false, nodes: 0, edges: 0, communities: 0,
        elapsed: performance.now() - t0,
        teamMode: useTeam, builderCount,
      }
    }

    await exec('python', ['rebuild_graph.py'], {
      cwd,
      timeout: 300_000,
      windowsHide: true,
    })

    await resetEngine()
    const engine = await getEngine()
    const stats = engine?.getStats() ?? { nodeCount: 0, edgeCount: 0, communityCount: 0 }

    return {
      success: true,
      nodes: stats.nodeCount,
      edges: stats.edgeCount,
      communities: stats.communityCount,
      elapsed: performance.now() - t0,
      teamMode: useTeam,
      builderCount,
    }
  } catch (err) {
    logForDebugging(`[graphify:team] Init failed: ${err}`)
    return {
      success: false, nodes: 0, edges: 0, communities: 0,
      elapsed: performance.now() - t0,
      teamMode: useTeam, builderCount,
    }
  }
}

export { calculateBuilderCount, countCodeFiles, partitionByDirectory }
