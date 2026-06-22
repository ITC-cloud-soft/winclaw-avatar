export const GRAPH_PATH_TOOL_NAME = 'graph_path'

export const GRAPH_PATH_DESCRIPTION = `
Find the shortest path between two symbols in the knowledge graph.
Grep cannot do this. Use for tracing call chains and dependency paths.

Returns a hop-by-hop path with the relation at each step, showing exactly
how symbol A connects to symbol B through the codebase.

UNIQUE CAPABILITY — Grep cannot trace dependency chains.
- Traces how symbol A eventually connects to symbol B
- Shows intermediate files and relationship types
- Essential for understanding layered architectures

Use for:
- Tracing how a controller reaches a database call
- Understanding the dependency chain between two modules
- Finding indirect connections between seemingly unrelated code
- "How does the API layer connect to the database?"
- "What's the call chain from main() to this utility?"
- Debugging unexpected dependencies

Do NOT use for:
- Finding a single symbol (use graph_query or graph_explain)
- Listing all dependencies of a symbol (use graph_neighbors)
- Exact string search (use Grep)
`.trim()
