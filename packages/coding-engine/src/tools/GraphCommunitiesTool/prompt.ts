export const GRAPH_COMMUNITIES_TOOL_NAME = 'graph_communities'

export const GRAPH_COMMUNITIES_DESCRIPTION = `
List the top N communities (feature clusters) in the knowledge graph.
Each community represents a cohesive group of related symbols (a module, feature area, or subsystem).

Provides a "map" of the codebase showing:
- Community label and size (number of nodes)
- Cohesion score (how tightly coupled the community is)
- God nodes (most connected symbols within each community)
- Anchor directory (primary file path for the community)

Use for high-level codebase overview before diving into details.

Use when:
- You don't know where to start exploring the codebase
- You need a high-level overview of the project structure
- You want to understand feature boundaries
- The user asks "what does this codebase do?"
- Starting a new task and need to orient yourself in the codebase

Do NOT use for:
- Finding a specific symbol (use graph_query)
- Detailed node information (use graph_explain)
`.trim()
