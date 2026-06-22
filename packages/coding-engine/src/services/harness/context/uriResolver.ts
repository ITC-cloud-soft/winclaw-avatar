/**
 * uriResolver.ts — Resolve context source specs to text content.
 *
 * Supported schemes:
 *   - Workspace-relative file path (no scheme) → read file
 *   - graphify://query?q=...&depth=N → run graphify query
 *   - graphify://neighbors?node=...&depth=N → run graphify neighbors
 *
 * graphify is loaded via dynamic import so it is an optional peer dependency.
 * If unavailable, a stub note is returned.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createGraphifyResolver } from './graphifyResolverImpl.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Injectable graphify resolver for testing. */
export type GraphifyResolver = {
  query(q: string, depth: number): Promise<string>
  neighbors(node: string, depth: number): Promise<string>
  /** Optional path method — present on the production resolver (Advanced phase). */
  path?(from: string, to: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Graphify dynamic-import loader
// ---------------------------------------------------------------------------

let cachedResolver: GraphifyResolver | null = null
let resolverLoadAttempted = false

async function loadGraphifyResolver(): Promise<GraphifyResolver | null> {
  if (resolverLoadAttempted) return cachedResolver
  resolverLoadAttempted = true

  try {
    // Use the production implementation from graphifyResolverImpl.
    // createGraphifyResolver() handles dynamic import and graceful fallback internally.
    cachedResolver = createGraphifyResolver()
    return cachedResolver
  } catch {
    cachedResolver = null
    return null
  }
}

function formatGraphResult(kind: string, input: string, result: unknown): string {
  const lines: string[] = [`## graphify:${kind} — \`${input}\``, '']

  if (result === null || result === undefined) {
    lines.push('_No results._')
    return lines.join('\n')
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    // Handle GraphQueryResult { nodes: [...], edges: [...] }
    if (Array.isArray(obj['nodes'])) {
      const nodes = obj['nodes'] as Array<Record<string, unknown>>
      if (nodes.length === 0) {
        lines.push('_No matching nodes._')
      } else {
        lines.push('### Nodes')
        for (const n of nodes.slice(0, 20)) {
          const label = (n['label'] as string | undefined) ?? (n['id'] as string) ?? '?'
          const file = (n['file'] as string | undefined) ?? ''
          lines.push(`- **${label}**${file ? ` — \`${file}\`` : ''}`)
        }
      }
      return lines.join('\n')
    }

    // Handle GraphNeighborsResult { predecessors: [...], successors: [...] }
    if (obj['predecessors'] !== undefined || obj['successors'] !== undefined) {
      const preds = (obj['predecessors'] as Array<Record<string, unknown>>) ?? []
      const succs = (obj['successors'] as Array<Record<string, unknown>>) ?? []
      if (preds.length > 0) {
        lines.push('### Predecessors (imports this)')
        for (const n of preds.slice(0, 10)) {
          lines.push(`- ${(n['label'] as string | undefined) ?? (n['id'] as string) ?? '?'}`)
        }
      }
      if (succs.length > 0) {
        lines.push('### Successors (imported by this)')
        for (const n of succs.slice(0, 10)) {
          lines.push(`- ${(n['label'] as string | undefined) ?? (n['id'] as string) ?? '?'}`)
        }
      }
      if (preds.length === 0 && succs.length === 0) {
        lines.push('_No neighbors found._')
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

// ---------------------------------------------------------------------------
// URI parsing
// ---------------------------------------------------------------------------

type GraphifySpec =
  | { kind: 'query'; q: string; depth: number }
  | { kind: 'neighbors'; node: string; depth: number }
  | { kind: 'path'; from: string; to: string }

function parseGraphifyUri(uri: string): GraphifySpec {
  // Strip scheme: graphify://query?... or graphify://neighbors?... or graphify://path?...
  const withoutScheme = uri.replace(/^graphify:\/\//, '')
  const qMark = withoutScheme.indexOf('?')
  const pathPart = qMark >= 0 ? withoutScheme.slice(0, qMark) : withoutScheme
  const queryPart = qMark >= 0 ? withoutScheme.slice(qMark + 1) : ''

  const params = new URLSearchParams(queryPart)
  const depthStr = params.get('depth') ?? '2'
  const depth = Math.max(1, parseInt(depthStr, 10) || 2)

  if (pathPart === 'query') {
    const q = params.get('q') ?? ''
    if (!q) throw new Error(`graphify://query URI missing required ?q= parameter: ${uri}`)
    return { kind: 'query', q, depth }
  }

  if (pathPart === 'neighbors') {
    const node = params.get('node') ?? ''
    if (!node) throw new Error(`graphify://neighbors URI missing required ?node= parameter: ${uri}`)
    return { kind: 'neighbors', node, depth }
  }

  if (pathPart === 'path') {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    if (!from) throw new Error(`graphify://path URI missing required ?from= parameter: ${uri}`)
    if (!to) throw new Error(`graphify://path URI missing required ?to= parameter: ${uri}`)
    return { kind: 'path', from, to }
  }

  throw new Error(
    `Unknown graphify path "${pathPart}" in URI "${uri}". Supported: query, neighbors, path`,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for resolveUri. Allows injecting a graphify resolver in tests.
 */
export type ResolveOptions = {
  workspacePath: string
  /** Override graphify resolver (for testing). */
  graphifyResolver?: GraphifyResolver
}

/**
 * Resolve a context source specification to its text content.
 *
 * @param source - Workspace-relative file path OR a graphify:// URI
 * @param opts - Resolution options (workspacePath, optional resolver override)
 * @returns Resolved markdown/text content
 * @throws Error if the file is not found, scheme is unsupported, or graphify params are invalid
 */
export async function resolveUri(source: string, opts: ResolveOptions): Promise<string> {
  const { workspacePath, graphifyResolver: injectedResolver } = opts

  // ------------------------------------------------------------------
  // graphify:// URI
  // ------------------------------------------------------------------
  if (source.startsWith('graphify://')) {
    const spec = parseGraphifyUri(source)
    const resolver = injectedResolver ?? (await loadGraphifyResolver())

    if (!resolver) {
      // Graphify unavailable — return a clear stub note
      return [
        `## graphify — Unavailable`,
        '',
        `> **Note**: graphify service could not be loaded. The context entry for`,
        `> \`${source}\` is not available in this session.`,
        `>`,
        `> To enable graphify context injection, ensure the graphify service`,
        `> is initialized (run \`/graphify\`).`,
      ].join('\n')
    }

    if (spec.kind === 'query') {
      return resolver.query(spec.q, spec.depth)
    }
    if (spec.kind === 'path') {
      if (typeof resolver.path === 'function') {
        return resolver.path(spec.from, spec.to)
      }
      // Resolver doesn't support path — return a clear note
      return [
        `## graphify:path — \`${spec.from}\` → \`${spec.to}\``,
        '',
        `> **Note**: The active graphify resolver does not support the \`path\` method.`,
        `> Upgrade to a production resolver or pass a resolver with \`path\` support.`,
      ].join('\n')
    }
    return resolver.neighbors(spec.node, spec.depth)
  }

  // ------------------------------------------------------------------
  // Unknown scheme
  // ------------------------------------------------------------------
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(source) && !source.startsWith('graphify://')) {
    throw new Error(
      `Unknown URI scheme in context source "${source}". ` +
        `Supported: workspace-relative file paths, graphify://query?q=..., graphify://neighbors?node=..., graphify://path?from=...&to=...`,
    )
  }

  // ------------------------------------------------------------------
  // Workspace-relative file path
  // ------------------------------------------------------------------
  const filePath = path.isAbsolute(source) ? source : path.join(workspacePath, source)

  let content: string
  try {
    content = await fs.readFile(filePath, 'utf8')
  } catch {
    throw new Error(
      `Context source file not found: "${source}" (resolved to "${filePath}")`,
    )
  }

  return content
}
