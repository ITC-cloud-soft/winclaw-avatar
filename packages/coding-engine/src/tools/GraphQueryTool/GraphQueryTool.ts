import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { queryGraph } from '../../services/graphify/client.js'
import {
  GRAPH_QUERY_TOOL_NAME,
  GRAPH_QUERY_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    question: z.string().describe('Natural language query about code symbols, files, or concepts'),
    mode: z.enum(['bfs', 'dfs']).optional().describe('Traversal mode: "bfs" (broad, default) or "dfs" (trace a specific chain)'),
    max_results: z.number().optional().describe('Maximum nodes to return (default 30)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

/**
 * Render a single node line with its Level-2/3 semantic attributes so that
 * GATE prompts (Round 6/7) and downstream AI agents can filter by kind,
 * urlPath, signature, etc. — not just substring-match the label.
 *
 * Format: `  NODE [<kind>] <label> [<source_file> [community=N]] key=value ...`
 */
function formatNodeLine(
  n: {
    label: string
    source_file: string
    community?: string
    kind?: string
    urlPath?: string
    httpMethod?: string
    signature?: string
    fieldType?: string
    optional?: boolean
    constraints?: string
    schemaType?: string
    tableName?: string
  },
  prefix = '  ',
): string {
  const kindTag = n.kind ? `[${n.kind}] ` : ''
  const community = n.community ? ` community=${n.community}` : ''

  const extras: string[] = []
  if (n.urlPath) extras.push(`urlPath=${n.urlPath}`)
  if (n.httpMethod) extras.push(`httpMethod=${n.httpMethod}`)
  if (n.signature) extras.push(`signature=${n.signature}`)
  if (n.fieldType) extras.push(`fieldType=${n.fieldType}`)
  if (n.optional !== undefined) extras.push(`optional=${n.optional}`)
  if (n.constraints) extras.push(`constraints=${n.constraints}`)
  if (n.schemaType) extras.push(`schemaType=${n.schemaType}`)
  if (n.tableName) extras.push(`tableName=${n.tableName}`)
  const extrasStr = extras.length > 0 ? ' ' + extras.join(' ') : ''

  return `${prefix}NODE ${kindTag}${n.label} [${n.source_file}${community}]${extrasStr}`
}

function formatResult(r: Awaited<ReturnType<typeof queryGraph>>): string {
  if (r.nodes.length === 0) {
    return `No matching nodes found in the knowledge graph. Try broader terms or use Grep for exact string matches.`
  }

  const lines: string[] = []
  lines.push(`Traversal: ${r.starts.length > 0 ? 'BFS' : 'none'} | Start: [${r.starts.join(', ')}] | ${r.nodes.length} nodes | ${r.ms}ms`)
  lines.push('')

  // Nodes — include kind + semantic attributes so GATE prompts can filter
  for (const n of r.nodes.slice(0, 30)) {
    lines.push(formatNodeLine(n))
  }
  lines.push('')

  // Edges
  for (const e of r.edges.slice(0, 30)) {
    const conf = e.confidence === 'EXTRACTED'
      ? '[EXTRACTED]'
      : `[INFERRED ${e.confidence_score.toFixed(2)}]`
    lines.push(`  EDGE ${e.source} --${e.relation} ${conf}--> ${e.target}`)
  }

  return lines.join('\n')
}

export const GraphQueryTool = buildTool({
  name: GRAPH_QUERY_TOOL_NAME,
  searchHint: 'knowledge graph code symbols relationships query',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to query the knowledge graph`
  },
  userFacingName() {
    return 'GraphQuery'
  },
  getToolUseSummary(input) {
    return input?.question ? `"${input.question}"` : null
  },
  getActivityDescription(input) {
    return input?.question
      ? `Querying graph: ${input.question}`
      : 'Querying knowledge graph'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  async prompt() {
    return GRAPH_QUERY_DESCRIPTION
  },
  async call({ question, mode, max_results }) {
    try {
      const result = await queryGraph(question, {
        mode: mode ?? 'bfs',
        maxNodes: max_results ?? 30,
      })
      return { data: formatResult(result) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph query failed: ${msg}\n\nFallback: use Grep or Glob to search the codebase.` }
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: content,
    }
  },
  renderToolUseMessage() {
    return null
  },
} satisfies ToolDef<InputSchema, string>)
