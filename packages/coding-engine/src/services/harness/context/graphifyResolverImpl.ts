/**
 * graphifyResolverImpl.ts — Production GraphifyResolver backed by the real graphify engine.
 *
 * Provides createGraphifyResolver() which wires query/neighbors/path methods
 * to the graphify client's queryGraph / getNeighbors / getShortestPath functions.
 *
 * Features:
 *   - Per-snapshot result cache keyed by (uri, args)
 *   - Compact markdown formatting for all three result types
 *   - Graceful fallback: if graphify is unavailable, returns a clear stub note
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.3
 */

import path from 'node:path'
import type { GraphifyResolver } from './uriResolver.js'

// ---------------------------------------------------------------------------
// Extended resolver type (adds path method)
// ---------------------------------------------------------------------------

/**
 * Extended resolver with the `path` method added in the Advanced phase.
 * Callers that want the path method can cast to this type.
 */
export type GraphifyResolverExtended = GraphifyResolver & {
  path(from: string, to: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Types imported lazily from graphify/client.js
// ---------------------------------------------------------------------------

type GraphifyClientModule = {
  queryGraph: (
    question: string,
    opts?: { mode?: 'bfs' | 'dfs'; maxNodes?: number },
  ) => Promise<unknown>
  getNeighbors: (labelOrId: string, depth?: number) => Promise<unknown>
  getShortestPath: (aLabel: string, bLabel: string) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Result formatters
// ---------------------------------------------------------------------------

function formatQueryResult(q: string, result: unknown): string {
  const lines: string[] = [`## graphify:query — \`${q}\``, '']

  if (result === null || result === undefined) {
    lines.push('_No results._')
    return lines.join('\n')
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    if (Array.isArray(obj['nodes'])) {
      const nodes = obj['nodes'] as Array<Record<string, unknown>>
      if (nodes.length === 0) {
        lines.push('_No matching nodes._')
      } else {
        lines.push(`### Nodes (${nodes.length})`)
        for (const n of nodes.slice(0, 20)) {
          const label = (n['label'] as string | undefined) ?? (n['id'] as string | undefined) ?? '?'
          const file = (n['source_file'] as string | undefined) ?? ''
          const kind = (n['kind'] as string | undefined) ?? ''
          lines.push(
            `- **${label}**${kind ? ` *(${kind})*` : ''}${file ? ` — \`${file}\`` : ''}`,
          )
        }
        if (nodes.length > 20) {
          lines.push(`- _… ${nodes.length - 20} more nodes_`)
        }
      }
      return lines.join('\n')
    }
  }

  // Fallback: dump JSON
  lines.push('```json')
  lines.push(JSON.stringify(result, null, 2).slice(0, 2000))
  lines.push('```')
  return lines.join('\n')
}

function formatNeighborsResult(node: string, result: unknown): string {
  const lines: string[] = [`## graphify:neighbors — \`${node}\``, '']

  if (result === null || result === undefined) {
    lines.push('_No results._')
    return lines.join('\n')
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const preds = (obj['predecessors'] as Array<Record<string, unknown>>) ?? []
    const succs = (obj['successors'] as Array<Record<string, unknown>>) ?? []

    if (preds.length > 0) {
      lines.push('### Predecessors (imports this)')
      for (const n of preds.slice(0, 10)) {
        const label = (n['label'] as string | undefined) ?? (n['id'] as string | undefined) ?? '?'
        const rel = (n['relation'] as string | undefined) ?? 'related'
        lines.push(`- **${label}** _(${rel})_`)
      }
    }

    if (succs.length > 0) {
      lines.push('### Successors (imported by this)')
      for (const n of succs.slice(0, 10)) {
        const label = (n['label'] as string | undefined) ?? (n['id'] as string | undefined) ?? '?'
        const rel = (n['relation'] as string | undefined) ?? 'related'
        lines.push(`- **${label}** _(${rel})_`)
      }
    }

    if (preds.length === 0 && succs.length === 0) {
      lines.push('_No neighbors found._')
    }
    return lines.join('\n')
  }

  lines.push('```json')
  lines.push(JSON.stringify(result, null, 2).slice(0, 2000))
  lines.push('```')
  return lines.join('\n')
}

function formatPathResult(from: string, to: string, result: unknown): string {
  const lines: string[] = [`## graphify:path — \`${from}\` → \`${to}\``, '']

  if (result === null || result === undefined) {
    lines.push('_No results._')
    return lines.join('\n')
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    if (!obj['found']) {
      lines.push(`_No path found between \`${from}\` and \`${to}\`._`)
      return lines.join('\n')
    }

    const pathNodes = obj['path'] as Array<Record<string, unknown>> | undefined
    const pathEdges = obj['pathEdges'] as Array<Record<string, unknown>> | undefined
    const hops = obj['hops'] as number | undefined

    if (pathNodes && pathNodes.length > 0) {
      lines.push(`**Hops**: ${hops ?? pathNodes.length - 1}`)
      lines.push('')
      lines.push('### Path')
      for (let i = 0; i < pathNodes.length; i++) {
        const n = pathNodes[i]
        const label = (n['label'] as string | undefined) ?? (n['id'] as string | undefined) ?? '?'
        const file = (n['source_file'] as string | undefined) ?? ''
        lines.push(`${i + 1}. **${label}**${file ? ` — \`${file}\`` : ''}`)

        if (pathEdges && pathEdges[i]) {
          const edge = pathEdges[i]
          const rel = (edge['relation'] as string | undefined) ?? 'related'
          if (i < pathNodes.length - 1) {
            lines.push(`   → _(${rel})_`)
          }
        }
      }
    } else {
      lines.push('_Path found but no node details available._')
    }

    return lines.join('\n')
  }

  lines.push('```json')
  lines.push(JSON.stringify(result, null, 2).slice(0, 2000))
  lines.push('```')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Fallback stub
// ---------------------------------------------------------------------------

function makeUnavailableNote(reason: string, uri?: string): string {
  return [
    `## graphify — Unavailable`,
    '',
    `> **Note**: graphify service could not be loaded.${uri ? ` The context entry for \`${uri}\` is not available.` : ''}`,
    `>`,
    `> Reason: ${reason}`,
    `>`,
    `> To enable graphify context injection, ensure the graphify service is initialized (run \`/graphify\`).`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type GraphifyResolverOptions = {
  /** Workspace path used to locate graph.json when GRAPHIFY_GRAPH_PATH is not set. */
  workspacePath?: string
}

/**
 * Create a production GraphifyResolver backed by the real graphify client.
 *
 * Results are cached per (kind, key, depth) for the lifetime of the returned
 * resolver instance (one snapshot build). Instantiate a new resolver per snapshot
 * to avoid stale results across multiple builds.
 *
 * If the graphify client cannot be dynamically imported (no graph.json, engine
 * not initialized, etc.), all methods return a clear stub note instead of throwing.
 *
 * @param opts - Optional configuration (workspacePath for locating the graph)
 * @returns GraphifyResolverExtended (query + neighbors + path)
 */
export function createGraphifyResolver(opts?: GraphifyResolverOptions): GraphifyResolverExtended {
  // Per-resolver cache: Map from cache key string → resolved markdown
  const cache = new Map<string, string>()

  if (opts?.workspacePath) {
    const graphPath = path.join(opts.workspacePath, 'graphify-out', 'graph.json')
    // Hint to the engine via environment so dynamic-import graphify picks up the right path
    if (!process.env['GRAPHIFY_GRAPH_PATH']) {
      process.env['GRAPHIFY_GRAPH_PATH'] = graphPath
    }
  }

  /** Attempt to dynamically import the graphify client. Returns null on failure. */
  async function loadClient(): Promise<GraphifyClientModule | null> {
    try {
      const mod = (await import('../../graphify/client.js')) as unknown
      const m = mod as Record<string, unknown>
      if (
        typeof m['queryGraph'] === 'function' &&
        typeof m['getNeighbors'] === 'function' &&
        typeof m['getShortestPath'] === 'function'
      ) {
        return m as unknown as GraphifyClientModule
      }
      return null
    } catch {
      return null
    }
  }

  return {
    async query(q: string, depth: number): Promise<string> {
      const cacheKey = `query:${q}:${depth}`
      if (cache.has(cacheKey)) return cache.get(cacheKey)!

      const client = await loadClient()
      if (!client) {
        const note = makeUnavailableNote(
          'graphify client module could not be loaded',
          `graphify://query?q=${encodeURIComponent(q)}&depth=${depth}`,
        )
        cache.set(cacheKey, note)
        return note
      }

      try {
        const result = await client.queryGraph(q, { mode: 'bfs', maxNodes: depth * 10 })
        const formatted = formatQueryResult(q, result)
        cache.set(cacheKey, formatted)
        return formatted
      } catch (err: unknown) {
        const reason =
          err instanceof Error ? err.message : 'Unknown graphify query error'
        const note = makeUnavailableNote(reason, `graphify://query?q=${encodeURIComponent(q)}`)
        cache.set(cacheKey, note)
        return note
      }
    },

    async neighbors(node: string, depth: number): Promise<string> {
      const cacheKey = `neighbors:${node}:${depth}`
      if (cache.has(cacheKey)) return cache.get(cacheKey)!

      const client = await loadClient()
      if (!client) {
        const note = makeUnavailableNote(
          'graphify client module could not be loaded',
          `graphify://neighbors?node=${encodeURIComponent(node)}&depth=${depth}`,
        )
        cache.set(cacheKey, note)
        return note
      }

      try {
        const result = await client.getNeighbors(node, depth)
        const formatted = formatNeighborsResult(node, result)
        cache.set(cacheKey, formatted)
        return formatted
      } catch (err: unknown) {
        const reason =
          err instanceof Error ? err.message : 'Unknown graphify neighbors error'
        const note = makeUnavailableNote(
          reason,
          `graphify://neighbors?node=${encodeURIComponent(node)}`,
        )
        cache.set(cacheKey, note)
        return note
      }
    },

    async path(from: string, to: string): Promise<string> {
      const cacheKey = `path:${from}:${to}`
      if (cache.has(cacheKey)) return cache.get(cacheKey)!

      const client = await loadClient()
      if (!client) {
        const note = makeUnavailableNote(
          'graphify client module could not be loaded',
          `graphify://path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        cache.set(cacheKey, note)
        return note
      }

      try {
        const result = await client.getShortestPath(from, to)
        const formatted = formatPathResult(from, to, result)
        cache.set(cacheKey, formatted)
        return formatted
      } catch (err: unknown) {
        const reason =
          err instanceof Error ? err.message : 'Unknown graphify path error'
        const note = makeUnavailableNote(
          reason,
          `graphify://path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        cache.set(cacheKey, note)
        return note
      }
    },
  }
}
