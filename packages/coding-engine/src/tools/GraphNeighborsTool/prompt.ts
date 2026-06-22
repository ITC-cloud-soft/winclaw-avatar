export const GRAPH_NEIGHBORS_TOOL_NAME = 'graph_neighbors'

export const GRAPH_NEIGHBORS_DESCRIPTION = `
Expand a single symbol in the knowledge graph to see its immediate connections.
Returns BOTH successors (what X calls/uses) and predecessors (what calls/uses X).

Better than Grep for dependency analysis because:
- Automatically separates inbound vs outbound relationships
- Includes relation types (calls, imports, implements, etc.)
- Includes confidence levels for inferred edges
- Filters out noise (comments, string literals)

Better than Grep for dependency analysis — shows semantic relationships, not text matches.

Use for:
- Impact analysis: what will break if I change X?
- Dependency tracing: what does X depend on?
- Understanding a symbol's role in the architecture
- Understanding a module's API surface
- Finding all consumers of a class/function

Do NOT use for:
- Broad searches (use graph_query with a question)
- Exact text search (use Grep)
- Tracing multi-hop chains (use graph_path)
`.trim()
