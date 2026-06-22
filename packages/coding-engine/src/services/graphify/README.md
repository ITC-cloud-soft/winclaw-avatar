# Graphify Integration for Meta Coder

## Overview

This module integrates the [graphify](https://pypi.org/project/graphify/) knowledge graph
into Meta Coder's tool system. It provides 6 native graph tools and a session bootstrap
module that gives the agent a structural overview of the codebase at session start.

## Architecture

### Client (`client.ts`)

A lightweight TypeScript client that shells out to Python to query the NetworkX graph
stored in `graphify-out/graph.json`. Each method constructs a small Python script, runs
it via `child_process.execFile`, and parses the JSON output.

For production use, this client can be replaced with an MCP stdio client that connects
to `graphify.serve` (the graphify MCP server).

### Tools (6 tools under `src/tools/Graph*Tool/`)

| Tool | Purpose | When to use |
|------|---------|-------------|
| `graph_query` | Natural language search across the graph | First choice for "where is X?" questions |
| `graph_neighbors` | Expand a node: inbound + outbound edges | Impact/dependency analysis for a known symbol |
| `graph_path` | Shortest path between two symbols | Tracing call chains (Grep cannot do this) |
| `graph_explain` | Deep dive into one node | Understanding a symbol's role and connections |
| `graph_communities` | List feature clusters | High-level codebase overview |
| `graph_god_nodes` | Highest-degree symbols | Finding critical files, risk assessment |

Each tool follows the Meta Coder convention:
- `prompt.ts` — tool name constant + description text
- `<Name>Tool.ts` — the Tool object built via `buildTool()`

### Bootstrap (`bootstrap.ts`)

`buildGraphBootstrapSection()` is called at session start. It queries the graph for
the top communities and god nodes, then formats them as markdown lines for injection
into the system prompt. This gives the agent immediate structural awareness without
any tool calls.

If `graph.json` doesn't exist or Python is unavailable, it returns an empty array
(graceful degradation).

## Connecting to graphify MCP server

For production use with the MCP protocol:

1. Start the graphify MCP server: `graphify serve --stdio`
2. Configure in `.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "graphify": {
         "command": "graphify",
         "args": ["serve", "--stdio"]
       }
     }
   }
   ```
3. The MCP server exposes the same 6 tools with identical schemas.

## Rebuilding the graph

```bash
# Full rebuild
graphify . --output graphify-out

# Incremental update (faster, only processes changed files)
graphify . --update

# Update specific directory
graphify . --update src/pricing/
```

The graph is stored as `graphify-out/graph.json` (NetworkX node-link format).
Community detection and god node analysis are computed during the build.

## Environment variables

- `GRAPHIFY_GRAPH_PATH` — Override the path to `graph.json` (default: `<cwd>/graphify-out/graph.json`)

  ⚠️ **Multi-worktree caveat**: When this env var is set, *every* workspace
  (every cwd / worktree) resolves to the same on-disk `graph.json`. The
  in-memory engine cache is still keyed per workspace, but concurrent
  `/graphify` rebuilds from different worktrees will race on write, and the
  on-disk state becomes ambiguous.

  - Single workspace or CI: setting this is fine.
  - Multi-worktree agent sessions: **leave unset**; the default resolves to
    `<workspace>/graphify-out/graph.json` per worktree, giving real isolation.

  `resolveGraphPathForWorkspace()` prints a one-shot `console.warn` after the
  second distinct workspace resolves to the env-var path, so stray
  misconfigurations surface in logs without being silently ignored.
