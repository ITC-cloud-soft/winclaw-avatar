/**
 * Community detection for the pure TypeScript graph builder.
 *
 * Implements **label propagation** — a linear-time approximation that is
 * good enough for the graph sizes produced by the graphify builder
 * (typically a few thousand nodes).
 *
 * Algorithm overview:
 *   1. Initialize: each node is its own community (label = node index).
 *   2. Iterate up to `MAX_ITERATIONS` times:
 *        For every node in a random order, look at its direct neighbours
 *        (both successors and predecessors in the undirected view) and adopt
 *        the community label that is most popular among them. Ties are broken
 *        by taking the smallest label value.
 *   3. Stop early when no node changes its label in a full pass (stable state).
 *   4. Renumber communities by size: the largest community gets id 0,
 *      the second-largest gets id 1, and so on — consistent with the
 *      convention used by the Python graphify pipeline.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result returned by {@link detectCommunities}.
 */
export interface CommunityResult {
  /** Maps community ID (integer) to the list of node IDs it contains. */
  communities: Map<number, string[]>
  /**
   * Maps each node ID to its community ID.
   *
   * @note The property name intentionally preserves the spelling from the
   * task specification (`nodeToCommuntiy`) so that downstream consumers that
   * depend on the exact key name do not break.
   */
  nodeToCommuntiy: Map<string, number>
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Maximum number of label-propagation sweeps before we declare convergence. */
const MAX_ITERATIONS = 20

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build an undirected adjacency list from a directed edge array.
 *
 * Both directions of each directed edge are added so that the propagation
 * step operates on the undirected view of the graph.
 *
 * @param nodes - All node IDs in the graph (isolated nodes are included).
 * @param edges - Directed edge list.
 * @returns     - Map from node ID to the set of its undirected neighbours.
 */
function buildAdjacency(
  nodes: readonly string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>()

  // Seed with empty arrays so isolated nodes are represented.
  for (const id of nodes) {
    adj.set(id, [])
  }

  for (const { source, target } of edges) {
    if (source === target) continue // ignore self-loops

    const srcNeighbours = adj.get(source)
    if (srcNeighbours !== undefined) {
      srcNeighbours.push(target)
    } else {
      adj.set(source, [target])
    }

    const tgtNeighbours = adj.get(target)
    if (tgtNeighbours !== undefined) {
      tgtNeighbours.push(source)
    } else {
      adj.set(target, [source])
    }
  }

  return adj
}

/**
 * Return the most frequent value in `labels`, breaking ties by preferring
 * the smallest numeric value. Returns `undefined` for an empty array.
 *
 * @param labels - Array of community label integers.
 */
function mostFrequent(labels: readonly number[]): number | undefined {
  if (labels.length === 0) return undefined

  const counts = new Map<number, number>()
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  let bestLabel = Infinity
  let bestCount = 0
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label < bestLabel)) {
      bestCount = count
      bestLabel = label
    }
  }

  return bestLabel === Infinity ? undefined : bestLabel
}

/**
 * Fisher-Yates shuffle of an index array — used to randomise the propagation
 * order each iteration, which reduces the risk of oscillating partitions.
 *
 * Mutates `arr` in place and returns it.
 */
function shuffleIndices(arr: number[]): number[] {
  for (let i = arr.length - 1; i > 0; i--) {
    // Use Math.floor(Math.random()) for a simple, deterministic-enough shuffle.
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect communities in the given graph using label propagation.
 *
 * The algorithm is deterministic in structure (same graph → same community
 * structure) because random tie-breaking noise is minimal for typical
 * import-dependency graphs with clear module boundaries.
 *
 * Complexity: O(iterations × E) where E is the number of (undirected) edges.
 * In practice converges in far fewer than {@link MAX_ITERATIONS} sweeps for
 * real-world TypeScript codebases.
 *
 * @param nodes - All node IDs that should participate in detection.
 *               Nodes absent from `edges` are treated as isolated singletons.
 * @param edges - Directed edges. Both directions are used in neighbour lookup.
 * @returns     - {@link CommunityResult} with final community assignments
 *               renumbered by size (largest = 0).
 */
export function detectCommunities(
  nodes: string[],
  edges: Array<{ source: string; target: string }>,
): CommunityResult {
  if (nodes.length === 0) {
    return {
      communities: new Map(),
      nodeToCommuntiy: new Map(),
    }
  }

  const adj = buildAdjacency(nodes, edges)

  // Step 1 — initialise: each node gets a unique integer label = its index.
  const nodeIndex = new Map<string, number>()
  for (let i = 0; i < nodes.length; i++) {
    nodeIndex.set(nodes[i], i)
  }

  // `labels[i]` holds the community label for `nodes[i]`.
  const labels = new Int32Array(nodes.length)
  for (let i = 0; i < nodes.length; i++) {
    labels[i] = i
  }

  // Pre-build a shuffleable index array reused across iterations.
  const order = Array.from({ length: nodes.length }, (_, i) => i)

  // Step 2 — iterate label propagation.
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false

    shuffleIndices(order)

    for (const idx of order) {
      const nodeId = nodes[idx]
      const neighbours = adj.get(nodeId)
      if (neighbours === undefined || neighbours.length === 0) continue

      // Collect the current labels of all undirected neighbours.
      const neighbourLabels: number[] = []
      for (const nb of neighbours) {
        const nbIdx = nodeIndex.get(nb)
        if (nbIdx !== undefined) {
          neighbourLabels.push(labels[nbIdx])
        }
      }

      const dominant = mostFrequent(neighbourLabels)
      if (dominant !== undefined && dominant !== labels[idx]) {
        labels[idx] = dominant
        changed = true
      }
    }

    // Early termination when the partition is stable.
    if (!changed) break
  }

  // Step 3 — collect raw community groups.
  // Maps raw label integer → list of node IDs.
  const rawCommunities = new Map<number, string[]>()
  for (let i = 0; i < nodes.length; i++) {
    const label = labels[i]
    const members = rawCommunities.get(label)
    if (members !== undefined) {
      members.push(nodes[i])
    } else {
      rawCommunities.set(label, [nodes[i]])
    }
  }

  // Step 4 — renumber communities by descending size (largest → id 0).
  const sorted = [...rawCommunities.values()].sort(
    (a, b) => b.length - a.length,
  )

  const communities = new Map<number, string[]>()
  const nodeToCommuntiy = new Map<string, number>()

  for (let newId = 0; newId < sorted.length; newId++) {
    const members = sorted[newId]
    communities.set(newId, members)
    for (const nodeId of members) {
      nodeToCommuntiy.set(nodeId, newId)
    }
  }

  return { communities, nodeToCommuntiy }
}
