export const GRAPH_GOD_NODES_TOOL_NAME = 'graph_god_nodes'

export const GRAPH_GOD_NODES_DESCRIPTION = `
Return the highest-degree symbols in the knowledge graph.
These are the most connected files, classes, or functions in the codebase.

God nodes are critical entry points: modifying them has the widest impact.
Use this to assess risk before making changes or to find the backbone of the architecture.

Use for risk assessment — modifying high-degree nodes has the most impact.

Use for:
- Identifying the most critical/risky files to modify
- Finding architectural entry points
- Understanding what holds the codebase together
- Risk assessment before refactoring
- Deciding where to focus a large-scale change for maximum effect

Do NOT use for:
- Finding a specific symbol (use graph_query)
- Understanding relationships (use graph_neighbors or graph_path)
`.trim()
