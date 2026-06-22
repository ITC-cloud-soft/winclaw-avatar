export const GRAPH_QUERY_TOOL_NAME = 'graph_query'

export const GRAPH_QUERY_DESCRIPTION = `
Search the persistent knowledge graph for code symbols, files, and relationships.
**Use this BEFORE Grep/Glob** when looking for where a feature/module/concept lives.
Returns matching nodes, edges with relation types, and community context.

Use for:
- Finding the entry point for a feature area
- Understanding module dependencies
- Cross-cutting concerns (who uses X across the codebase)

Do NOT use for:
- Exact string matches (use Grep)
- Files you already know the path of (use Read)
- The graph may be slightly stale; verify with Read before editing

WHEN TO USE (prefer this over Grep/Glob):
- Finding where a symbol is defined or used
- Understanding module structure
- Discovering related code
- ANY "where is" or "find" question about the codebase

WHEN TO USE Grep/Read INSTEAD:
- Searching for exact string literals in file content
- Reading actual implementation code

Costs zero tokens and returns in <10ms.
`.trim()
