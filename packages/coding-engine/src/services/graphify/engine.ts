/**
 * Pure TypeScript in-memory graph engine for graphify.
 *
 * Replicates the Python NetworkX query logic from client.ts using Map/Set
 * data structures for O(1) lookups. All query methods are synchronous once
 * the graph has been loaded via `load()`.
 *
 * Level 2 (Structural Semantics): Extended with attribute indexing, kind-based
 * lookups, route/schema queries, and enhanced scoring that considers semantic
 * node attributes (httpMethod, urlPath, signature, fieldType, etc.).
 */

import { readFile } from 'node:fs/promises'
import type {
  GraphQueryResult,
  GraphNeighborsResult,
  GraphPathResult,
  GraphExplainResult,
  GraphCommunity,
  GraphGodNode,
} from './client.js'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Internal node representation. Fields map to NetworkX node attributes. */
export interface GraphNode {
  id: string
  label: string
  /** Maps to `source_file` in the NetworkX JSON format. */
  sourceFile: string
  community: string
  /** Node kind, e.g. "file", "function", "route", "schema", "field", "column". */
  kind?: string
  /** Function/method parameter list and return type. */
  signature?: string
  /** Field or column type. */
  fieldType?: string
  /** HTTP method for route nodes. */
  httpMethod?: string
  /** URL path for route nodes. */
  urlPath?: string
  /** Whether the field is optional. */
  optional?: boolean
  /** Column constraints. */
  constraints?: string
  /** ORM/framework type for schema nodes. */
  schemaType?: string
  /** Database table name for schema nodes. */
  tableName?: string
}

/** Internal edge representation. Fields map to NetworkX edge attributes. */
export interface GraphEdge {
  source: string
  target: string
  relation: string
  confidence: string
  confidenceScore: number
}

/** Raw node-link JSON shape as written by NetworkX json_graph.node_link_data. */
interface RawNodeLinkGraph {
  directed?: boolean
  nodes: Array<Record<string, unknown>>
  links?: Array<Record<string, unknown>>
  edges?: Array<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// GraphEngine
// ---------------------------------------------------------------------------

export class GraphEngine {
  /** id -> node */
  private nodes: Map<string, GraphNode> = new Map()
  /** lowercase label -> node ids */
  private labelIndex: Map<string, string[]> = new Map()
  /** node id -> set of successor ids */
  private successors: Map<string, Set<string>> = new Map()
  /** node id -> set of predecessor ids */
  private predecessors: Map<string, Set<string>> = new Map()
  /** "src|tgt" -> edge data */
  private edges: Map<string, GraphEdge> = new Map()
  /** community label -> node ids */
  private communities: Map<string, string[]> = new Map()
  /** kind -> node ids (Level 2 attribute index) */
  private kindIndex: Map<string, string[]> = new Map()
  /** source_file -> node ids (Level 2 optimized file lookup) */
  private sourceFileIndex: Map<string, string[]> = new Map()

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  async load(graphPath: string): Promise<void> {
    this.nodes.clear()
    this.labelIndex.clear()
    this.successors.clear()
    this.predecessors.clear()
    this.edges.clear()
    this.communities.clear()
    this.kindIndex.clear()
    this.sourceFileIndex.clear()

    const raw = JSON.parse(
      await readFile(graphPath, 'utf-8'),
    ) as RawNodeLinkGraph

    for (const node of raw.nodes ?? []) {
      const id = String(node['id'])
      const label = String(node['label'] ?? id)
      const sourceFile = String(node['source_file'] ?? '')
      const community = String(node['community'] ?? '')

      const graphNode: GraphNode = { id, label, sourceFile, community }

      // Level 2 attributes — read from JSON if present.
      // graph.json is written by serializer.ts directly from ParsedSymbol/
      // GraphNode (camelCase). Accept both camelCase and snake_case so this
      // engine stays robust across historic graph.json shapes.
      if (node['kind']) graphNode.kind = String(node['kind'])
      if (node['signature']) graphNode.signature = String(node['signature'])
      const fieldType = node['fieldType'] ?? node['field_type']
      if (fieldType) graphNode.fieldType = String(fieldType)
      const httpMethod = node['httpMethod'] ?? node['http_method']
      if (httpMethod) graphNode.httpMethod = String(httpMethod)
      const urlPath = node['urlPath'] ?? node['url_path']
      if (urlPath) graphNode.urlPath = String(urlPath)
      if (node['optional'] !== undefined) graphNode.optional = Boolean(node['optional'])
      if (node['constraints']) graphNode.constraints = String(node['constraints'])
      const schemaType = node['schemaType'] ?? node['schema_type']
      if (schemaType) graphNode.schemaType = String(schemaType)
      const tableName = node['tableName'] ?? node['table_name']
      if (tableName) graphNode.tableName = String(tableName)

      this.nodes.set(id, graphNode)

      // Build label index
      const lower = label.toLowerCase()
      const existing = this.labelIndex.get(lower) ?? []
      existing.push(id)
      this.labelIndex.set(lower, existing)

      if (!this.successors.has(id)) this.successors.set(id, new Set())
      if (!this.predecessors.has(id)) this.predecessors.set(id, new Set())

      // Build community index
      if (community) {
        const members = this.communities.get(community) ?? []
        members.push(id)
        this.communities.set(community, members)
      }

      // Level 2: Build kind index
      const kind = graphNode.kind ?? inferKindFromLabel(label)
      if (kind) {
        const kindIds = this.kindIndex.get(kind) ?? []
        kindIds.push(id)
        this.kindIndex.set(kind, kindIds)
      }

      // Level 2: Build source file index
      if (sourceFile) {
        const sfIds = this.sourceFileIndex.get(sourceFile) ?? []
        sfIds.push(id)
        this.sourceFileIndex.set(sourceFile, sfIds)
      }
    }

    for (const link of raw.links ?? raw.edges ?? []) {
      const src = String(link['source'])
      const tgt = String(link['target'])

      if (!this.successors.has(src)) this.successors.set(src, new Set())
      this.successors.get(src)!.add(tgt)

      if (!this.predecessors.has(tgt)) this.predecessors.set(tgt, new Set())
      this.predecessors.get(tgt)!.add(src)

      this.edges.set(`${src}|${tgt}`, {
        source: src,
        target: tgt,
        relation: String(link['relation'] ?? 'related'),
        confidence: String(link['confidence'] ?? 'EXTRACTED'),
        confidenceScore: Number(link['confidence_score'] ?? 1.0),
      })
    }
  }

  // -------------------------------------------------------------------------
  // Node lookup helpers
  // -------------------------------------------------------------------------

  private findNode(term: string): string | null {
    const lower = term.toLowerCase()

    const exact = this.labelIndex.get(lower)
    if (exact !== undefined && exact.length > 0) return exact[0]

    if (this.nodes.has(term)) return term

    for (const [id, node] of this.nodes) {
      if (node.label.toLowerCase().includes(lower)) return id
    }

    return null
  }

  private findNodeByWordScore(term: string): string | null {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean)
    let bestScore = 0
    let bestId: string | null = null

    for (const [id, node] of this.nodes) {
      const lbl = node.label.toLowerCase()
      const score = words.reduce((s, w) => s + (lbl.includes(w) ? 1 : 0), 0)
      if (score > bestScore) {
        bestScore = score
        bestId = id
      }
    }

    return bestId
  }

  /**
   * Project all Level-2/3 semantic attributes off a node into a plain object.
   * Keys are camelCase to match the shape of graph.json (and `GraphNodeAttributes`
   * in client.ts). Undefined fields are omitted so JSON output stays compact.
   */
  private attrs(node: GraphNode): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (node.kind) out.kind = node.kind
    if (node.urlPath) out.urlPath = node.urlPath
    if (node.httpMethod) out.httpMethod = node.httpMethod
    if (node.signature) out.signature = node.signature
    if (node.fieldType) out.fieldType = node.fieldType
    if (node.optional !== undefined) out.optional = node.optional
    if (node.constraints) out.constraints = node.constraints
    if (node.schemaType) out.schemaType = node.schemaType
    if (node.tableName) out.tableName = node.tableName
    return out
  }

  private allNeighbors(id: string): Set<string> {
    const result = new Set<string>()
    for (const nb of this.successors.get(id) ?? []) result.add(nb)
    for (const nb of this.predecessors.get(id) ?? []) result.add(nb)
    return result
  }

  private degree(id: string): number {
    return (
      (this.successors.get(id)?.size ?? 0) +
      (this.predecessors.get(id)?.size ?? 0)
    )
  }

  // -------------------------------------------------------------------------
  // Public query API
  // -------------------------------------------------------------------------

  query(
    question: string,
    mode: 'bfs' | 'dfs' = 'bfs',
    maxNodes = 30,
  ): GraphQueryResult {
    const t0 = performance.now()
    const terms = question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)

    // Score all nodes — Level 2: also score against semantic attributes
    const scored: [number, string][] = []
    for (const [id, node] of this.nodes) {
      const label = node.label.toLowerCase()
      const sf = node.sourceFile.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (label.includes(term)) score += 3
        if (sf.includes(term)) score += 1
        // Level 2 attribute scoring
        if (node.httpMethod && node.httpMethod.includes(term)) score += 3
        if (node.urlPath && node.urlPath.toLowerCase().includes(term)) score += 3
        if (node.signature && node.signature.toLowerCase().includes(term)) score += 2
        if (node.fieldType && node.fieldType.toLowerCase().includes(term)) score += 2
        if (node.tableName && node.tableName.toLowerCase().includes(term)) score += 3
        if (node.kind && node.kind.includes(term)) score += 1
        if (node.schemaType && node.schemaType.includes(term)) score += 1
      }
      if (score > 0) scored.push([score, id])
    }
    scored.sort((a, b) => b[0] - a[0])
    const starts = scored.slice(0, 3).map((s) => s[1])

    const visited = new Set<string>(starts)
    const edgeList: [string, string][] = []

    if (mode === 'bfs') {
      let frontier = new Set<string>(starts)
      for (let depth = 0; depth < 3 && visited.size < maxNodes; depth++) {
        const next = new Set<string>()
        for (const n of frontier) {
          for (const nb of this.successors.get(n) ?? []) {
            if (!visited.has(nb) && visited.size < maxNodes) {
              next.add(nb)
              edgeList.push([n, nb])
            }
          }
          for (const nb of this.predecessors.get(n) ?? []) {
            if (!visited.has(nb) && visited.size < maxNodes) {
              next.add(nb)
              edgeList.push([nb, n])
            }
          }
        }
        for (const n of next) visited.add(n)
        frontier = next
      }
    } else {
      const stack: [string, number][] = starts.map((s) => [s, 0])
      const dfsVisited = new Set<string>()
      while (stack.length > 0 && visited.size < maxNodes) {
        const [node, depth] = stack.pop()!
        if (dfsVisited.has(node) || depth > 6) continue
        dfsVisited.add(node)
        visited.add(node)
        for (const nb of this.successors.get(node) ?? []) {
          if (!dfsVisited.has(nb) && visited.size < maxNodes) {
            stack.push([nb, depth + 1])
            edgeList.push([node, nb])
          }
        }
      }
    }

    const nodes: GraphQueryResult['nodes'] = []
    for (const id of visited) {
      const node = this.nodes.get(id)
      if (node) {
        nodes.push({
          id: node.id,
          label: node.label,
          source_file: node.sourceFile,
          community: node.community,
          ...this.attrs(node),
        })
      }
    }

    const edges: GraphQueryResult['edges'] = []
    for (const [s, t] of edgeList) {
      const ed = this.edges.get(`${s}|${t}`)
      const sNode = this.nodes.get(s)
      const tNode = this.nodes.get(t)
      if (ed && sNode && tNode) {
        edges.push({
          source: sNode.label,
          target: tNode.label,
          relation: ed.relation,
          confidence: ed.confidence,
          confidence_score: ed.confidenceScore,
        })
      }
    }

    return {
      starts: starts.map((id) => this.nodes.get(id)?.label ?? id),
      nodes,
      edges,
      ms: Math.round((performance.now() - t0) * 10) / 10,
    }
  }

  getNeighbors(labelOrId: string, depth = 1): GraphNeighborsResult {
    const t0 = performance.now()
    const targetId = this.findNode(labelOrId)

    if (targetId === null) {
      return {
        target: null,
        successors: [],
        predecessors: [],
        ms: Math.round((performance.now() - t0) * 10) / 10,
      }
    }

    const succs: GraphNeighborsResult['successors'] = []
    const preds: GraphNeighborsResult['predecessors'] = []

    const visitedS = new Set<string>([targetId])
    const visitedP = new Set<string>([targetId])
    let frontierS = new Set<string>([targetId])
    let frontierP = new Set<string>([targetId])

    for (let d = 0; d < depth; d++) {
      const nextS = new Set<string>()
      for (const n of frontierS) {
        for (const nb of this.successors.get(n) ?? []) {
          if (!visitedS.has(nb)) {
            visitedS.add(nb)
            nextS.add(nb)
            const ed = this.edges.get(`${n}|${nb}`)
            const nbNode = this.nodes.get(nb)
            if (nbNode) {
              succs.push({
                id: nb,
                label: nbNode.label,
                relation: ed?.relation ?? 'related',
                source_file: nbNode.sourceFile,
                ...this.attrs(nbNode),
              })
            }
          }
        }
      }
      frontierS = nextS

      const nextP = new Set<string>()
      for (const n of frontierP) {
        for (const nb of this.predecessors.get(n) ?? []) {
          if (!visitedP.has(nb)) {
            visitedP.add(nb)
            nextP.add(nb)
            const ed = this.edges.get(`${nb}|${n}`)
            const nbNode = this.nodes.get(nb)
            if (nbNode) {
              preds.push({
                id: nb,
                label: nbNode.label,
                relation: ed?.relation ?? 'related',
                source_file: nbNode.sourceFile,
                ...this.attrs(nbNode),
              })
            }
          }
        }
      }
      frontierP = nextP
    }

    const tNode = this.nodes.get(targetId)!
    return {
      target: {
        id: targetId,
        label: tNode.label,
        source_file: tNode.sourceFile,
        ...this.attrs(tNode),
      },
      successors: succs,
      predecessors: preds,
      ms: Math.round((performance.now() - t0) * 10) / 10,
    }
  }

  shortestPath(fromLabel: string, toLabel: string): GraphPathResult {
    const t0 = performance.now()
    const srcId = this.findNodeByWordScore(fromLabel)
    const tgtId = this.findNodeByWordScore(toLabel)

    if (!srcId || !tgtId) {
      return { found: false, ms: Math.round((performance.now() - t0) * 10) / 10 }
    }

    const parent = new Map<string, string | null>([[srcId, null]])
    const queue: string[] = [srcId]
    let found = false

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === tgtId) {
        found = true
        break
      }
      for (const nb of this.allNeighbors(current)) {
        if (!parent.has(nb)) {
          parent.set(nb, current)
          queue.push(nb)
        }
      }
    }

    if (!found) {
      return { found: false, ms: Math.round((performance.now() - t0) * 10) / 10 }
    }

    const pathIds: string[] = []
    let cur: string | null = tgtId
    while (cur !== null) {
      pathIds.unshift(cur)
      cur = parent.get(cur) ?? null
    }

    const pathNodes: GraphPathResult['path'] = pathIds.map((id) => {
      const node = this.nodes.get(id)!
      return {
        id,
        label: node.label,
        source_file: node.sourceFile,
        ...this.attrs(node),
      }
    })

    const pathEdges: GraphPathResult['pathEdges'] = []
    for (let i = 0; i < pathIds.length - 1; i++) {
      const s = pathIds[i]
      const t = pathIds[i + 1]
      const ed =
        this.edges.get(`${s}|${t}`) ?? this.edges.get(`${t}|${s}`)
      pathEdges.push({
        relation: ed?.relation ?? 'related',
        confidence: ed?.confidence ?? 'EXTRACTED',
      })
    }

    return {
      found: true,
      path: pathNodes,
      pathEdges,
      hops: pathIds.length - 1,
      ms: Math.round((performance.now() - t0) * 10) / 10,
    }
  }

  explainNode(labelOrId: string): GraphExplainResult {
    const t0 = performance.now()
    const targetId = this.findNode(labelOrId)

    if (targetId === null) {
      return { found: false, ms: Math.round((performance.now() - t0) * 10) / 10 }
    }

    const node = this.nodes.get(targetId)!
    const succsRaw = [...(this.successors.get(targetId) ?? [])]
    const predsRaw = [...(this.predecessors.get(targetId) ?? [])]

    const successors: GraphExplainResult['successors'] = succsRaw
      .slice(0, 20)
      .map((v) => {
        const ed = this.edges.get(`${targetId}|${v}`)
        const vNode = this.nodes.get(v)
        return {
          label: vNode?.label ?? v,
          relation: ed?.relation ?? 'related',
          source_file: vNode?.sourceFile ?? '',
          ...(vNode ? this.attrs(vNode) : {}),
        }
      })

    const predecessors: GraphExplainResult['predecessors'] = predsRaw
      .slice(0, 20)
      .map((u) => {
        const ed = this.edges.get(`${u}|${targetId}`)
        const uNode = this.nodes.get(u)
        return {
          label: uNode?.label ?? u,
          relation: ed?.relation ?? 'related',
          source_file: uNode?.sourceFile ?? '',
          ...(uNode ? this.attrs(uNode) : {}),
        }
      })

    return {
      found: true,
      label: node.label,
      source_file: node.sourceFile,
      degree: succsRaw.length + predsRaw.length,
      degree_in: predsRaw.length,
      degree_out: succsRaw.length,
      successors,
      predecessors,
      ...this.attrs(node),
      ms: Math.round((performance.now() - t0) * 10) / 10,
    }
  }

  getCommunities(top = 15): GraphCommunity[] {
    const sorted = [...this.communities.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )

    return sorted.slice(0, top).map((entry, cid) => {
      const [communityLabel, members] = entry
      const memberSet = new Set(members)

      const degs: [string, number][] = members.map((id) => [id, this.degree(id)])
      degs.sort((a, b) => b[1] - a[1])
      const godNodes: GraphCommunity['godNodes'] = degs.slice(0, 3).map(([id, deg]) => ({
        label: this.nodes.get(id)?.label ?? id,
        degree: deg,
      }))

      const dirCounts = new Map<string, number>()
      for (const id of members) {
        const sf = this.nodes.get(id)?.sourceFile ?? ''
        if (sf) {
          const dir = sf.replace(/[\\/][^\\/]+$/, '')
          if (dir && dir !== sf) {
            dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1)
          }
        }
      }
      let anchorDir = ''
      let maxCount = 0
      for (const [dir, count] of dirCounts) {
        if (count > maxCount) {
          maxCount = count
          anchorDir = dir
        }
      }

      let internalEdges = 0
      for (const id of members) {
        for (const nb of this.successors.get(id) ?? []) {
          if (memberSet.has(nb)) internalEdges++
        }
      }
      const possible = members.length * (members.length - 1)
      const cohesion = possible > 0 ? Math.round((internalEdges / possible) * 100) / 100 : 0

      return {
        id: cid,
        label: communityLabel,
        size: members.length,
        cohesion,
        godNodes,
        anchorDir,
      }
    })
  }

  // -------------------------------------------------------------------------
  // Level 2: Kind-based queries
  // -------------------------------------------------------------------------

  /** Get all nodes of a specific kind (e.g. "route", "schema", "field", "column"). */
  getNodesByKind(kind: string): Array<{ id: string; label: string; source_file: string; [key: string]: unknown }> {
    const ids = this.kindIndex.get(kind) ?? []
    return ids.map(id => {
      const node = this.nodes.get(id)!
      const result: Record<string, unknown> = {
        id: node.id,
        label: node.label,
        source_file: node.sourceFile,
      }
      if (node.signature) result.signature = node.signature
      if (node.fieldType) result.field_type = node.fieldType
      if (node.httpMethod) result.http_method = node.httpMethod
      if (node.urlPath) result.url_path = node.urlPath
      if (node.schemaType) result.schema_type = node.schemaType
      if (node.tableName) result.table_name = node.tableName
      if (node.constraints) result.constraints = node.constraints
      if (node.optional !== undefined) result.optional = node.optional
      return result as { id: string; label: string; source_file: string; [key: string]: unknown }
    })
  }

  /** Get all route nodes in the graph. */
  getRoutes(): Array<{ id: string; label: string; source_file: string; http_method: string; url_path: string }> {
    return this.getNodesByKind('route').filter((n): n is { id: string; label: string; source_file: string; http_method: string; url_path: string } =>
      'http_method' in n && 'url_path' in n
    )
  }

  /** Get all schema nodes in the graph. */
  getSchemas(): Array<{ id: string; label: string; source_file: string; schema_type: string; table_name?: string }> {
    return this.getNodesByKind('schema').filter((n): n is { id: string; label: string; source_file: string; schema_type: string; table_name?: string } =>
      'schema_type' in n
    )
  }

  // -------------------------------------------------------------------------
  // Mutation / serialization
  // -------------------------------------------------------------------------

  incrementalUpdate(changedFiles: string[]): number {
    const fileSet = new Set(changedFiles)
    const toRemove: string[] = []
    for (const [id, node] of this.nodes) {
      if (fileSet.has(node.sourceFile)) toRemove.push(id)
    }
    for (const id of toRemove) this.removeNode(id)
    return toRemove.length
  }

  getNodesByFile(file: string): string[] {
    return this.sourceFileIndex.get(file) ?? []
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id)
    if (node === undefined) return

    for (const tgt of this.successors.get(id) ?? []) {
      this.edges.delete(`${id}|${tgt}`)
      this.predecessors.get(tgt)?.delete(id)
    }
    this.successors.delete(id)

    for (const src of this.predecessors.get(id) ?? []) {
      this.edges.delete(`${src}|${id}`)
      this.successors.get(src)?.delete(id)
    }
    this.predecessors.delete(id)

    const lower = node.label.toLowerCase()
    const labelIds = this.labelIndex.get(lower)
    if (labelIds !== undefined) {
      const filtered = labelIds.filter((lid) => lid !== id)
      if (filtered.length === 0) {
        this.labelIndex.delete(lower)
      } else {
        this.labelIndex.set(lower, filtered)
      }
    }

    if (node.community) {
      const commIds = this.communities.get(node.community)
      if (commIds !== undefined) {
        const filtered = commIds.filter((cid) => cid !== id)
        if (filtered.length === 0) {
          this.communities.delete(node.community)
        } else {
          this.communities.set(node.community, filtered)
        }
      }
    }

    // Level 2: Clean up kind index
    const kind = node.kind ?? inferKindFromLabel(node.label)
    if (kind) {
      const kindIds = this.kindIndex.get(kind)
      if (kindIds !== undefined) {
        const filtered = kindIds.filter((kid) => kid !== id)
        if (filtered.length === 0) {
          this.kindIndex.delete(kind)
        } else {
          this.kindIndex.set(kind, filtered)
        }
      }
    }

    // Level 2: Clean up source file index
    if (node.sourceFile) {
      const sfIds = this.sourceFileIndex.get(node.sourceFile)
      if (sfIds !== undefined) {
        const filtered = sfIds.filter((fid) => fid !== id)
        if (filtered.length === 0) {
          this.sourceFileIndex.delete(node.sourceFile)
        } else {
          this.sourceFileIndex.set(node.sourceFile, filtered)
        }
      }
    }

    this.nodes.delete(id)
  }

  toJSON(): RawNodeLinkGraph {
    const nodes = [...this.nodes.values()].map((node) => {
      const base: Record<string, unknown> = {
        id: node.id,
        label: node.label,
        source_file: node.sourceFile,
        community: node.community,
      }
      // Level 2: Serialize semantic attributes (camelCase to match serializer.ts
      // and the graph.json written by the pure-TS builder)
      if (node.kind) base.kind = node.kind
      if (node.signature) base.signature = node.signature
      if (node.fieldType) base.fieldType = node.fieldType
      if (node.httpMethod) base.httpMethod = node.httpMethod
      if (node.urlPath) base.urlPath = node.urlPath
      if (node.optional !== undefined) base.optional = node.optional
      if (node.constraints) base.constraints = node.constraints
      if (node.schemaType) base.schemaType = node.schemaType
      if (node.tableName) base.tableName = node.tableName
      return base
    })

    const links = [...this.edges.values()].map((edge) => ({
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      confidence: edge.confidence,
      confidence_score: edge.confidenceScore,
    }))

    return { directed: true, nodes, links }
  }


  /** Check if the engine has loaded data and is ready for queries */
  isReady(): boolean {
    return this.nodes.size > 0
  }

  getStats(): { nodeCount: number; edgeCount: number; communityCount: number; kindBreakdown: Record<string, number> } {
    const kindBreakdown: Record<string, number> = {}
    for (const [kind, ids] of this.kindIndex) {
      kindBreakdown[kind] = ids.length
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      communityCount: this.communities.size,
      kindBreakdown,
    }
  }

  getGodNodes(top = 10): GraphGodNode[] {
    const degs: [string, number][] = []
    for (const [id] of this.nodes) {
      const out = this.successors.get(id)?.size ?? 0
      const inn = this.predecessors.get(id)?.size ?? 0
      degs.push([id, out + inn])
    }
    degs.sort((a, b) => b[1] - a[1])

    return degs.slice(0, top).map(([id, degree]) => {
      const node = this.nodes.get(id)!
      return {
        label: node.label,
        degree,
        source_file: node.sourceFile,
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer kind from label suffix when no explicit kind is stored. */
function inferKindFromLabel(label: string): string {
  if (label.endsWith('()')) return 'function'
  if (label.startsWith('@Entity')) return 'schema'
  if (/^(GET|POST|PUT|PATCH|DELETE|ALL)\s/.test(label)) return 'route'
  if (label.includes(' → ')) return 'schema'
  return 'unknown'
}
