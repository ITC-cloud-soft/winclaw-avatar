/**
 * Session bootstrap module for graphify integration.
 *
 * Builds a markdown section summarizing the codebase structure from the
 * knowledge graph. Injected into the system prompt at session start so
 * the agent has a "map" of the repository without needing 20 Glob calls.
 *
 * Gracefully degrades: returns [] if graph.json doesn't exist or Python fails.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getGodNodes, getCommunities, resolveGraphPath } from './client.js'
import { getEngine } from './engineLoader.js'
import { startGraphFileWatcher } from './fileWatcher.js'

/**
 * Format a relative time string from a timestamp.
 */
function relativeTime(mtime: Date): string {
  const diffMs = Date.now() - mtime.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * Build the graphify bootstrap section for the system prompt.
 *
 * @param graphPath - Override path to graph.json (defaults to resolveGraphPath())
 * @returns Array of markdown lines, or empty array if graph unavailable
 */
export async function buildGraphBootstrapSection(
  graphPath?: string,
): Promise<string[]> {
  const gp = graphPath ?? resolveGraphPath()

  // Check if graph.json exists
  if (!fs.existsSync(gp)) {
    return []
  }

  // Get graph freshness
  let freshnessStr = 'unknown'
  try {
    const stat = fs.statSync(gp)
    freshnessStr = `built ${relativeTime(stat.mtime)}`
  } catch {
    // ignore stat errors
  }

  try {
    // Prefer the TS engine (in-memory, no Python spawn overhead).
    // Fall back to the Python-shell client functions when the engine is unavailable.
    const engine = await getEngine()
    const [godNodes, communities] = engine
      ? await Promise.all([
          Promise.resolve(engine.getGodNodes(10)),
          Promise.resolve(engine.getCommunities(15)),
        ])
      : await Promise.all([getGodNodes(10), getCommunities(15)])

    const lines: string[] = []
    lines.push('## Repository map (from graphify)')
    lines.push('')

    // Communities
    if (communities.length > 0) {
      lines.push('Top communities:')
      for (let i = 0; i < communities.length; i++) {
        const c = communities[i]
        lines.push(
          `  ${(i + 1).toString().padStart(2)}. [${c.label}] ${c.size} nodes — ${c.anchorDir || '(mixed)'}`,
        )
      }
      lines.push('')
    }

    // God nodes
    if (godNodes.length > 0) {
      lines.push('Top god nodes (most connected):')
      for (const g of godNodes) {
        const sf = g.source_file
          ? ` [${g.source_file}]`
          : ''
        lines.push(`  * ${g.label} (${g.degree} edges)${sf}`)
      }
      lines.push('')
    }

    lines.push(`Graph freshness: ${freshnessStr}`)

    lines.push('')
    lines.push('## Graph tool usage guide')
    lines.push('')
    lines.push('When navigating this codebase, prefer graph tools over Grep/Glob:')
    lines.push('- "Where is X defined?" → graph_query first, then Read for details')
    lines.push('- "What calls X?" → graph_neighbors (predecessors)')
    lines.push('- "How does A connect to B?" → graph_path')
    lines.push('- "What are the main modules?" → graph_communities')
    lines.push('- "What are the critical files?" → graph_god_nodes')
    lines.push('- For implementation details → Read (graph gives location, Read gives content)')
    lines.push('')
    lines.push('Graph tools return in <10ms with zero token cost. Use them liberally.')

    // Start file watcher for auto-incremental updates (fire-and-forget).
    // Phase C: explicitly pass process.cwd() so the watcher is keyed on the
    // same workspace that autoUpdate.ts infers for tool-layer notifications.
    // When GRAPHIFY_GRAPH_PATH points outside process.cwd() we still fall
    // back to the directory containing graph.json.
    try {
      const watchRoot =
        process.env['GRAPHIFY_GRAPH_PATH'] && path.dirname(gp) !== process.cwd()
          ? path.dirname(gp)
          : process.cwd()
      startGraphFileWatcher(watchRoot)
    } catch {
      /* ignore */
    }

    return lines
  } catch {
    // Python not available or graph query failed — graceful degradation
    return []
  }
}
