/**
 * Lightweight graphify client for Meta Coder.
 *
 * MVP strategy: shell out to Python to query the in-process NetworkX graph.
 * Production strategy: replace with MCP stdio client to graphify.serve.
 *
 * All methods return structured JSON parsed from Python stdout.
 * All methods accept an optional AbortSignal for cancellation.
 * All methods return a typed result or throw.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { getEngine } from './engineLoader.js'

const execAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Semantic attributes carried on every node returned by graph_* tools.
 * All optional — only present when the parser extracted the corresponding
 * Level-2 / Level-3 structural metadata for the symbol.
 */
export type GraphNodeAttributes = {
  kind?: string
  urlPath?: string
  httpMethod?: string
  signature?: string
  fieldType?: string
  optional?: boolean
  constraints?: string
  schemaType?: string
  tableName?: string
  source_location?: string
}

export type GraphQueryResult = {
  starts: string[]
  nodes: Array<
    {
      id: string
      label: string
      source_file: string
      community?: string
    } & GraphNodeAttributes
  >
  edges: Array<{
    source: string
    target: string
    relation: string
    confidence: string
    confidence_score: number
  }>
  ms: number
}

export type GraphNeighborsResult = {
  target:
    | ({
        id: string
        label: string
        source_file: string
      } & GraphNodeAttributes)
    | null
  successors: Array<
    {
      id: string
      label: string
      relation: string
      source_file: string
    } & GraphNodeAttributes
  >
  predecessors: Array<
    {
      id: string
      label: string
      relation: string
      source_file: string
    } & GraphNodeAttributes
  >
  ms: number
}

export type GraphPathResult = {
  found: boolean
  path?: Array<
    { id: string; label: string; source_file: string } & GraphNodeAttributes
  >
  pathEdges?: Array<{ relation: string; confidence: string }>
  hops?: number
  ms: number
}

export type GraphExplainResult = {
  found: boolean
  label?: string
  source_file?: string
  degree?: number
  degree_in?: number
  degree_out?: number
  successors?: Array<
    {
      label: string
      relation: string
      source_file: string
    } & GraphNodeAttributes
  >
  predecessors?: Array<
    {
      label: string
      relation: string
      source_file: string
    } & GraphNodeAttributes
  >
  ms: number
} & GraphNodeAttributes

export type GraphCommunity = {
  id: number
  label: string
  size: number
  cohesion: number
  godNodes: Array<{ label: string; degree: number }>
  anchorDir: string
}

export type GraphGodNode = {
  label: string
  degree: number
  source_file: string
}

// ---------------------------------------------------------------------------
// Graph path resolution
// ---------------------------------------------------------------------------

export function resolveGraphPath(): string {
  return (
    process.env.GRAPHIFY_GRAPH_PATH ||
    path.join(process.cwd(), 'graphify-out', 'graph.json')
  )
}

// ---------------------------------------------------------------------------
// Python execution helper
// ---------------------------------------------------------------------------

const PYTHON_TIMEOUT_MS = 30_000

/**
 * Run a Python script string against the graph and return parsed JSON.
 * Throws on non-zero exit, stderr, or JSON parse failure.
 */
async function runGraphQuery<T>(pythonCode: string): Promise<T> {
  try {
    const { stdout, stderr } = await execAsync('python', ['-c', pythonCode], {
      timeout: PYTHON_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      windowsHide: true,
    })
    if (stderr && stderr.trim().length > 0) {
      // Python warnings go to stderr but aren't fatal; only throw if
      // stdout is empty (meaning the script actually failed).
      if (!stdout || stdout.trim().length === 0) {
        throw new Error(`Python stderr: ${stderr.slice(0, 500)}`)
      }
    }
    return JSON.parse(stdout) as T
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Unknown Python execution error'
    throw new Error(`graphify query failed: ${msg}`)
  }
}

/**
 * Build the common Python preamble that loads the graph.
 * Uses DiGraph (networkx.readwrite.json_graph.node_link_graph with directed=True).
 */
function preamble(graphPath: string): string {
  // Escape backslashes for Windows paths inside Python strings
  const escaped = graphPath.replace(/\\/g, '\\\\')
  return `
import json, time, sys
from pathlib import Path
import networkx as nx
from networkx.readwrite import json_graph

_gp = Path(r"${escaped}")
if not _gp.exists():
    print(json.dumps({"error": "graph.json not found", "path": str(_gp)}))
    sys.exit(0)
_data = json.loads(_gp.read_text(encoding="utf-8"))
G = json_graph.node_link_graph(_data, edges="links")
if not G.is_directed():
    G = G.to_directed()
`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function queryGraph(
  question: string,
  opts?: { mode?: 'bfs' | 'dfs'; maxNodes?: number },
): Promise<GraphQueryResult> {
  const engine = await getEngine()
  if (engine) {
    return engine.query(question, opts?.mode ?? 'bfs', opts?.maxNodes ?? 30)
  }

  const gp = resolveGraphPath()
  const mode = opts?.mode ?? 'bfs'
  const maxNodes = opts?.maxNodes ?? 30
  // Escape the question for Python string literal
  const q = question.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const code = `${preamble(gp)}
t = time.perf_counter()
terms = [w.lower() for w in '${q}'.split() if len(w) > 2]
scored = []
for nid, nd in G.nodes(data=True):
    label = (nd.get("label") or str(nid)).lower()
    sf = (nd.get("source_file") or "").lower()
    s = sum(3 for t_ in terms if t_ in label) + sum(1 for t_ in terms if t_ in sf)
    if s > 0:
        scored.append((s, nid))
scored.sort(reverse=True)
starts = [nid for _, nid in scored[:3]]

sub = set(starts)
edge_list = []
if not starts:
    pass
elif '${mode}' == 'bfs':
    frontier = set(starts)
    for depth in range(3):
        nxt = set()
        for n in frontier:
            for nb in G.successors(n):
                if nb not in sub and len(sub) < ${maxNodes}:
                    nxt.add(nb)
                    edge_list.append((n, nb))
            for nb in G.predecessors(n):
                if nb not in sub and len(sub) < ${maxNodes}:
                    nxt.add(nb)
                    edge_list.append((nb, n))
        sub.update(nxt)
        frontier = nxt
        if len(sub) >= ${maxNodes}:
            break
else:
    stack = [(s, 0) for s in starts]
    visited = set()
    while stack and len(sub) < ${maxNodes}:
        node, d = stack.pop()
        if node in visited or d > 6:
            continue
        visited.add(node)
        sub.add(node)
        for nb in G.successors(node):
            if nb not in visited and len(sub) < ${maxNodes}:
                stack.append((nb, d + 1))
                edge_list.append((node, nb))

ms = (time.perf_counter() - t) * 1000

# Pass-through the full set of Level-2/3 semantic attributes so GATE prompts
# and downstream AI agents can filter nodes by kind, urlPath, signature, etc.
# Keys preserved verbatim from graph.json (camelCase) to match ParsedSymbol.
_ATTRS = (
    "kind",
    "urlPath",
    "httpMethod",
    "signature",
    "fieldType",
    "optional",
    "constraints",
    "schemaType",
    "tableName",
    "source_location",
)

def _enrich_node(nid, nd):
    out = {
        "id": str(nid),
        "label": nd.get("label", str(nid)),
        "source_file": nd.get("source_file", ""),
        "community": nd.get("community", ""),
    }
    for _a in _ATTRS:
        if _a in nd and nd[_a] is not None:
            out[_a] = nd[_a]
    return out

nodes_out = []
for nid in sub:
    nd = G.nodes[nid]
    nodes_out.append(_enrich_node(nid, nd))
edges_out = []
for s, t_ in edge_list:
    ed = G.edges.get((s, t_), {})
    edges_out.append({
        "source": G.nodes[s].get("label", str(s)),
        "target": G.nodes[t_].get("label", str(t_)),
        "relation": ed.get("relation", "related"),
        "confidence": ed.get("confidence", "EXTRACTED"),
        "confidence_score": float(ed.get("confidence_score", 1.0)),
    })
result = {
    "starts": [G.nodes[s].get("label", str(s)) for s in starts],
    "nodes": nodes_out,
    "edges": edges_out,
    "ms": round(ms, 1),
}
print(json.dumps(result))
`
  return runGraphQuery<GraphQueryResult>(code)
}

export async function getNeighbors(
  labelOrId: string,
  depth: number = 1,
): Promise<GraphNeighborsResult> {
  const engine = await getEngine()
  if (engine) {
    return engine.getNeighbors(labelOrId, depth)
  }

  const gp = resolveGraphPath()
  const q = labelOrId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const code = `${preamble(gp)}
t = time.perf_counter()
query = '${q}'
target = None
for nid, nd in G.nodes(data=True):
    if nd.get("label") == query or str(nid) == query:
        target = nid
        break
if target is None:
    for nid, nd in G.nodes(data=True):
        lbl = (nd.get("label") or "").lower()
        if query.lower() in lbl:
            target = nid
            break

_ATTRS = (
    "kind",
    "urlPath",
    "httpMethod",
    "signature",
    "fieldType",
    "optional",
    "constraints",
    "schemaType",
    "tableName",
    "source_location",
)

def _attr_dict(nd):
    out = {}
    for _a in _ATTRS:
        if _a in nd and nd[_a] is not None:
            out[_a] = nd[_a]
    return out

if target is None:
    ms = (time.perf_counter() - t) * 1000
    print(json.dumps({"target": None, "successors": [], "predecessors": [], "ms": round(ms, 1)}))
else:
    succs = []
    preds = []
    visited_s = {target}
    visited_p = {target}
    frontier_s = {target}
    frontier_p = {target}
    for _ in range(${depth}):
        nxt_s = set()
        for n in frontier_s:
            for nb in G.successors(n):
                if nb not in visited_s:
                    visited_s.add(nb)
                    nxt_s.add(nb)
                    ed = G.edges.get((n, nb), {})
                    nb_nd = G.nodes[nb]
                    entry = {
                        "id": str(nb),
                        "label": nb_nd.get("label", str(nb)),
                        "relation": ed.get("relation", "related"),
                        "source_file": nb_nd.get("source_file", ""),
                    }
                    entry.update(_attr_dict(nb_nd))
                    succs.append(entry)
        frontier_s = nxt_s
        nxt_p = set()
        for n in frontier_p:
            for nb in G.predecessors(n):
                if nb not in visited_p:
                    visited_p.add(nb)
                    nxt_p.add(nb)
                    ed = G.edges.get((nb, n), {})
                    nb_nd = G.nodes[nb]
                    entry = {
                        "id": str(nb),
                        "label": nb_nd.get("label", str(nb)),
                        "relation": ed.get("relation", "related"),
                        "source_file": nb_nd.get("source_file", ""),
                    }
                    entry.update(_attr_dict(nb_nd))
                    preds.append(entry)
        frontier_p = nxt_p
    tnd = G.nodes[target]
    ms = (time.perf_counter() - t) * 1000
    target_out = {
        "id": str(target),
        "label": tnd.get("label", str(target)),
        "source_file": tnd.get("source_file", ""),
    }
    target_out.update(_attr_dict(tnd))
    print(json.dumps({
        "target": target_out,
        "successors": succs,
        "predecessors": preds,
        "ms": round(ms, 1),
    }))
`
  return runGraphQuery<GraphNeighborsResult>(code)
}

export async function getShortestPath(
  aLabel: string,
  bLabel: string,
): Promise<GraphPathResult> {
  const engine = await getEngine()
  if (engine) {
    return engine.shortestPath(aLabel, bLabel)
  }

  const gp = resolveGraphPath()
  const a = aLabel.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const b = bLabel.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const code = `${preamble(gp)}
t = time.perf_counter()

def find_node(term):
    term_l = term.lower()
    best, bid = 0, None
    for nid, nd in G.nodes(data=True):
        lbl = (nd.get("label") or "").lower()
        s = sum(1 for w in term_l.split() if w in lbl)
        if s > best:
            best, bid = s, nid
    return bid

src = find_node('${a}')
tgt = find_node('${b}')
if not src or not tgt:
    ms = (time.perf_counter() - t) * 1000
    print(json.dumps({"found": False, "ms": round(ms, 1)}))
else:
    try:
        UG = G.to_undirected()
        path = nx.shortest_path(UG, src, tgt)
        _ATTRS = (
            "kind",
            "urlPath",
            "httpMethod",
            "signature",
            "fieldType",
            "optional",
            "constraints",
            "schemaType",
            "tableName",
            "source_location",
        )
        path_nodes = []
        for nid in path:
            nd = G.nodes[nid]
            entry = {
                "id": str(nid),
                "label": nd.get("label", str(nid)),
                "source_file": nd.get("source_file", ""),
            }
            for _a in _ATTRS:
                if _a in nd and nd[_a] is not None:
                    entry[_a] = nd[_a]
            path_nodes.append(entry)
        path_edges = []
        for i in range(len(path) - 1):
            ed = G.edges.get((path[i], path[i+1]), G.edges.get((path[i+1], path[i]), {}))
            path_edges.append({
                "relation": ed.get("relation", "related"),
                "confidence": ed.get("confidence", "EXTRACTED"),
            })
        ms = (time.perf_counter() - t) * 1000
        print(json.dumps({
            "found": True,
            "path": path_nodes,
            "pathEdges": path_edges,
            "hops": len(path) - 1,
            "ms": round(ms, 1),
        }))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        ms = (time.perf_counter() - t) * 1000
        print(json.dumps({"found": False, "ms": round(ms, 1)}))
`
  return runGraphQuery<GraphPathResult>(code)
}

export async function explainNode(
  labelOrId: string,
): Promise<GraphExplainResult> {
  const engine = await getEngine()
  if (engine) {
    return engine.explainNode(labelOrId)
  }

  const gp = resolveGraphPath()
  const q = labelOrId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const code = `${preamble(gp)}
t = time.perf_counter()
query = '${q}'
target = None
for nid, nd in G.nodes(data=True):
    if nd.get("label", "").lower() == query.lower() or str(nid) == query:
        target = nid
        break
if target is None:
    for nid, nd in G.nodes(data=True):
        lbl = (nd.get("label") or "").lower()
        if query.lower() in lbl:
            target = nid
            break

_ATTRS = (
    "kind",
    "urlPath",
    "httpMethod",
    "signature",
    "fieldType",
    "optional",
    "constraints",
    "schemaType",
    "tableName",
    "source_location",
)

def _attr_dict(nd):
    out = {}
    for _a in _ATTRS:
        if _a in nd and nd[_a] is not None:
            out[_a] = nd[_a]
    return out

if target is None:
    ms = (time.perf_counter() - t) * 1000
    print(json.dumps({"found": False, "ms": round(ms, 1)}))
else:
    nd = G.nodes[target]
    succs = []
    for v in G.successors(target):
        ed = G.edges[target, v]
        v_nd = G.nodes[v]
        entry = {
            "label": v_nd.get("label", str(v)),
            "relation": ed.get("relation", "related"),
            "source_file": v_nd.get("source_file", ""),
        }
        entry.update(_attr_dict(v_nd))
        succs.append(entry)
    preds = []
    for u in G.predecessors(target):
        ed = G.edges[u, target]
        u_nd = G.nodes[u]
        entry = {
            "label": u_nd.get("label", str(u)),
            "relation": ed.get("relation", "related"),
            "source_file": u_nd.get("source_file", ""),
        }
        entry.update(_attr_dict(u_nd))
        preds.append(entry)
    ms = (time.perf_counter() - t) * 1000
    out = {
        "found": True,
        "label": nd.get("label", str(target)),
        "source_file": nd.get("source_file", ""),
        "degree": G.degree(target),
        "degree_in": G.in_degree(target),
        "degree_out": G.out_degree(target),
        "successors": succs[:20],
        "predecessors": preds[:20],
        "ms": round(ms, 1),
    }
    out.update(_attr_dict(nd))
    print(json.dumps(out))
`
  return runGraphQuery<GraphExplainResult>(code)
}

export async function getCommunities(
  top: number = 15,
): Promise<GraphCommunity[]> {
  const engine = await getEngine()
  if (engine) {
    return engine.getCommunities(top)
  }

  const gp = resolveGraphPath()

  const code = `${preamble(gp)}
t = time.perf_counter()
from collections import Counter, defaultdict
import os

# Group nodes by community attribute
comm_nodes = defaultdict(list)
for nid, nd in G.nodes(data=True):
    c = nd.get("community", "")
    if c:
        comm_nodes[c].append(nid)

communities = []
for cid, (clabel, members) in enumerate(sorted(comm_nodes.items(), key=lambda x: -len(x[1]))[:${top}]):
    # Find god nodes (highest degree) within community
    degs = [(G.nodes[n].get("label", str(n)), G.degree(n)) for n in members]
    degs.sort(key=lambda x: -x[1])
    god = [{"label": l, "degree": d} for l, d in degs[:3]]

    # Find anchor directory (most common directory prefix)
    dirs = [os.path.dirname(G.nodes[n].get("source_file", "")) for n in members]
    dirs = [d for d in dirs if d]
    anchor = Counter(dirs).most_common(1)[0][0] if dirs else ""

    # Compute simple cohesion: internal edges / possible edges
    member_set = set(members)
    internal_edges = sum(1 for u, v in G.edges() if u in member_set and v in member_set)
    possible = len(members) * (len(members) - 1)
    cohesion = round(internal_edges / possible, 2) if possible > 0 else 0.0

    communities.append({
        "id": cid,
        "label": str(clabel),
        "size": len(members),
        "cohesion": cohesion,
        "godNodes": god,
        "anchorDir": anchor,
    })

ms = (time.perf_counter() - t) * 1000
print(json.dumps(communities))
`
  return runGraphQuery<GraphCommunity[]>(code)
}

export async function getGodNodes(top: number = 10): Promise<GraphGodNode[]> {
  const engine = await getEngine()
  if (engine) {
    return engine.getGodNodes(top)
  }

  const gp = resolveGraphPath()

  const code = `${preamble(gp)}
t = time.perf_counter()
deg = sorted(G.degree, key=lambda x: x[1], reverse=True)[:${top}]
result = []
for n, d in deg:
    nd = G.nodes[n]
    result.append({
        "label": nd.get("label", str(n)),
        "degree": d,
        "source_file": nd.get("source_file", ""),
    })
print(json.dumps(result))
`
  return runGraphQuery<GraphGodNode[]>(code)
}
