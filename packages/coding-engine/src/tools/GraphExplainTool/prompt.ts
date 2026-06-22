export const GRAPH_EXPLAIN_TOOL_NAME = 'graph_explain'

export const GRAPH_EXPLAIN_DESCRIPTION = `
Deep dive into a single symbol in the knowledge graph.
Returns degree (inbound + outbound), all relations, source file, and community membership.

Use for:
- Understanding a symbol's role and importance in the codebase
- Seeing all inbound and outbound connections at once
- Checking which community/feature area a symbol belongs to
- Assessing the risk of modifying a highly-connected symbol
- Getting a full picture of a symbol before reading its source

Use this when you need to understand a symbol's role — how central it is,
what depends on it, and what it depends on — before diving into implementation details with Read.

Do NOT use for:
- Searching for symbols you don't know the name of (use graph_query)
- Multi-hop tracing (use graph_path)
- Exact text search (use Grep)
`.trim()
