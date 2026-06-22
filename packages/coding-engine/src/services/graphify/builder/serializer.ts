/**
 * Graph serializer for the pure TypeScript graph builder.
 *
 * Converts an in-memory graph representation to the NetworkX node-link JSON
 * format consumed by `GraphEngine` and the MCP graph tools, then writes both
 * the JSON file and a human-readable `GRAPH_REPORT.md` to the output directory.
 *
 * NetworkX node-link schema (subset used here):
 * ```json
 * {
 *   "directed": true,
 *   "multigraph": false,
 *   "graph": {},
 *   "nodes": [ { "id": "...", "label": "...", ... } ],
 *   "links": [ { "source": "...", "target": "...", "relation": "...", ... } ],
 *   "hyperedges": []
 * }
 * ```
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Shape of a single node entry in the output graph.
 * Maps directly to the `nodes` array in the NetworkX node-link JSON.
 */
export interface GraphNode {
  /** Unique stable identifier (e.g. `"src/utils/auth:AuthService"`). */
  id: string
  /** Human-readable display name shown in the graph explorer UI. */
  label: string
  /**
   * Broad category for the node.
   * Always `"code"` for code-derived nodes.
   */
  file_type: string
  /**
   * Structural kind: file, function, class, interface, type, variable, method,
   * route, field, schema, column (Level 2).
   */
  kind?: string
  /** Project-relative path of the file that defines this node. */
  source_file: string
  /**
   * Location within the source file (e.g. `"L12"`).
   * Used by the graph tools to show jump-to-source links.
   */
  source_location: string
  /** Numeric community ID assigned by the community detection step. */
  community: number
  // --- Level 2 attributes ---
  /** Function/method signature (Level 2). */
  signature?: string
  /** Field or column type (Level 2). */
  fieldType?: string
  /** HTTP method for route nodes (Level 2). */
  httpMethod?: string
  /** URL path for route nodes (Level 2). */
  urlPath?: string
  /** Whether the field is optional (Level 2). */
  optional?: boolean
  /** Column constraints (Level 2). */
  constraints?: string
  /** ORM/framework type for schema nodes (Level 2). */
  schemaType?: string
  /** Database table name for schema nodes (Level 2). */
  tableName?: string
}

/**
 * Shape of a single edge entry in the output graph.
 * Maps directly to the `links` array in the NetworkX node-link JSON.
 */
export interface GraphLink {
  /** Source node ID. */
  source: string
  /** Target node ID. */
  target: string
  /**
   * Semantic relation label.
   * Examples: `"imports_from"`, `"calls"`, `"extends"`, `"implements"`.
   */
  relation: string
  /**
   * Provenance category.
   * `"EXTRACTED"` means statically derived from AST analysis.
   */
  confidence: string
  /**
   * Numeric confidence score in [0, 1].
   * `1.0` for deterministically extracted edges.
   */
  confidence_score: number
  /** Source file path where this edge was found. */
  source_file: string
  /** Source location of the edge (e.g. the import statement). */
  source_location: string
  /**
   * Edge weight used for layout algorithms.
   * Defaults to `1` for unweighted graphs.
   */
  weight: number
  /** Redundant source node ID copy used by some NetworkX utilities. */
  _src: string
  /** Redundant target node ID copy used by some NetworkX utilities. */
  _tgt: string
}

/**
 * Complete in-memory graph passed to the serializer.
 * Produced by the graph builder after running the parser, resolver,
 * and community detection steps.
 */
export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

/**
 * The raw NetworkX node-link JSON object produced by {@link serializeGraph}.
 * Suitable for direct `JSON.stringify` or passing to `GraphEngine.load`.
 */
export interface NodeLinkJson {
  directed: true
  multigraph: false
  graph: Record<string, never>
  nodes: GraphNode[]
  links: GraphLink[]
  hyperedges: never[]
}

/**
 * Paths of the files written by {@link saveGraph}.
 */
export interface SaveGraphResult {
  /** Absolute path to the written `graph.json` file. */
  graphPath: string
  /** Absolute path to the written `GRAPH_REPORT.md` file. */
  reportPath: string
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a {@link GraphData} object to a NetworkX node-link JSON string.
 *
 * The output is pretty-printed with 2-space indentation to match the format
 * produced by the Python `json.dumps(data, indent=2)` pipeline step, keeping
 * diffs readable when the file is committed to version control.
 *
 * @param data - The graph to serialize.
 * @returns    - JSON string ready to be written to `graph.json`.
 */
export function serializeGraph(data: GraphData): string {
  const payload: NodeLinkJson = {
    directed: true,
    multigraph: false,
    graph: {},
    nodes: data.nodes,
    links: data.links,
    hyperedges: [],
  }
  return JSON.stringify(payload, null, 2)
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Compute the undirected degree of each node from the edge list.
 *
 * @param nodes - All node records.
 * @param links - All edge records.
 * @returns     - Map from node ID to total degree (in + out).
 */
function computeDegrees(
  nodes: readonly GraphNode[],
  links: readonly GraphLink[],
): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const node of nodes) {
    degrees.set(node.id, 0)
  }
  for (const link of links) {
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1)
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1)
  }
  return degrees
}

/**
 * Generate the Markdown content for `GRAPH_REPORT.md`.
 *
 * Sections:
 * - Summary (node count, edge count, timestamp)
 * - Top 10 god nodes by total degree
 * - Top 15 communities by member count
 *
 * @param data      - The graph data.
 * @param timestamp - ISO 8601 build timestamp string.
 */
function generateReport(data: GraphData, timestamp: string): string {
  const nodeCount = data.nodes.length
  const edgeCount = data.links.length

  // --- God nodes (top 10 by total degree) ---
  const degrees = computeDegrees(data.nodes, data.links)
  const nodeById = new Map<string, GraphNode>()
  for (const node of data.nodes) {
    nodeById.set(node.id, node)
  }

  const sortedByDegree = [...degrees.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const godNodesSection = sortedByDegree
    .map(([id, degree], rank) => {
      const node = nodeById.get(id)
      const label = node?.label ?? id
      const sourceFile = node?.source_file ?? ''
      return `| ${rank + 1} | \`${label}\` | ${degree} | \`${sourceFile}\` |`
    })
    .join('\n')

  // --- Community summary (top 15 by size) ---
  const communityMap = new Map<number, { ids: string[]; label?: string }>()
  for (const node of data.nodes) {
    const cid = node.community
    const existing = communityMap.get(cid)
    if (existing !== undefined) {
      existing.ids.push(node.id)
    } else {
      communityMap.set(cid, { ids: [node.id] })
    }
  }

  const topCommunities = [...communityMap.entries()]
    .sort((a, b) => b[1].ids.length - a[1].ids.length)
    .slice(0, 15)

  const communitySection = topCommunities
    .map(([cid, info], rank) => {
      return `| ${rank + 1} | ${cid} | ${info.ids.length} |`
    })
    .join('\n')

  return `# Graph Report

> Generated: ${timestamp}

## Summary

| Metric | Value |
|--------|-------|
| Total nodes | ${nodeCount.toLocaleString()} |
| Total edges | ${edgeCount.toLocaleString()} |
| Communities | ${communityMap.size.toLocaleString()} |

## Top 10 God Nodes (by degree)

| Rank | Label | Degree | Source File |
|------|-------|--------|-------------|
${godNodesSection || '| — | No nodes | — | — |'}

## Community Summary (top 15 by size)

| Rank | Community ID | Members |
|------|-------------|---------|
${communitySection || '| — | No communities | — |'}
`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write the serialized graph and a human-readable report to `outputDir`.
 *
 * Creates the following files:
 * - `<outputDir>/graph.json`        — NetworkX node-link JSON
 * - `<outputDir>/GRAPH_REPORT.md`   — Markdown summary report
 *
 * The output directory is created recursively if it does not already exist.
 *
 * @param data      - Graph data to persist.
 * @param outputDir - Absolute path to the output directory (e.g. `graphify-out`).
 * @returns         - Absolute paths of both written files.
 *
 * @example
 * ```ts
 * const result = await saveGraph(graphData, '/project/graphify-out')
 * console.log(`Graph written to ${result.graphPath}`)
 * console.log(`Report written to ${result.reportPath}`)
 * ```
 */
export async function saveGraph(
  data: GraphData,
  outputDir: string,
): Promise<SaveGraphResult> {
  // Ensure the output directory exists (no-op if already present).
  await mkdir(outputDir, { recursive: true })

  const graphPath = path.join(outputDir, 'graph.json')
  const reportPath = path.join(outputDir, 'GRAPH_REPORT.md')

  const timestamp = new Date().toISOString()

  // Write graph.json
  await writeFile(graphPath, serializeGraph(data), 'utf-8')

  // Write GRAPH_REPORT.md
  await writeFile(reportPath, generateReport(data, timestamp), 'utf-8')

  return { graphPath, reportPath }
}
