import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { explainNode } from '../../services/graphify/client.js'
import {
  GRAPH_EXPLAIN_TOOL_NAME,
  GRAPH_EXPLAIN_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    node: z.string().describe('Label or ID of the node to explain'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

function renderAttrs(n: {
  kind?: string
  urlPath?: string
  httpMethod?: string
  signature?: string
  fieldType?: string
  optional?: boolean
  constraints?: string
  schemaType?: string
  tableName?: string
}): string {
  const extras: string[] = []
  if (n.urlPath) extras.push(`urlPath=${n.urlPath}`)
  if (n.httpMethod) extras.push(`httpMethod=${n.httpMethod}`)
  if (n.signature) extras.push(`signature=${n.signature}`)
  if (n.fieldType) extras.push(`fieldType=${n.fieldType}`)
  if (n.optional !== undefined) extras.push(`optional=${n.optional}`)
  if (n.constraints) extras.push(`constraints=${n.constraints}`)
  if (n.schemaType) extras.push(`schemaType=${n.schemaType}`)
  if (n.tableName) extras.push(`tableName=${n.tableName}`)
  return extras.length > 0 ? ' ' + extras.join(' ') : ''
}

function kindTag(n: { kind?: string }): string {
  return n.kind ? `[${n.kind}] ` : ''
}

function formatResult(r: Awaited<ReturnType<typeof explainNode>>): string {
  if (!r.found) {
    return `Node not found in the knowledge graph. Check the label/ID or use graph_query to search.`
  }

  const lines: string[] = []
  lines.push(`NODE: ${kindTag(r)}${r.label}${renderAttrs(r)}`)
  lines.push(`  source: ${r.source_file}`)
  lines.push(`  degree: ${r.degree} (inbound=${r.degree_in}, outbound=${r.degree_out})`)
  lines.push(`  query: ${r.ms}ms`)
  lines.push('')

  // Inbound
  const preds = r.predecessors ?? []
  lines.push(`INBOUND (${preds.length}):`)
  if (preds.length === 0) {
    lines.push('  (none)')
  }
  for (const p of preds) {
    lines.push(`  --${p.relation}--> from ${kindTag(p)}${p.label} [${p.source_file}]${renderAttrs(p)}`)
  }
  lines.push('')

  // Outbound
  const succs = r.successors ?? []
  lines.push(`OUTBOUND (${succs.length}):`)
  if (succs.length === 0) {
    lines.push('  (none)')
  }
  for (const s of succs) {
    lines.push(`  --${s.relation}--> to ${kindTag(s)}${s.label} [${s.source_file}]${renderAttrs(s)}`)
  }

  return lines.join('\n')
}

export const GraphExplainTool = buildTool({
  name: GRAPH_EXPLAIN_TOOL_NAME,
  searchHint: 'knowledge graph explain node degree community detail',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to explain a graph node`
  },
  userFacingName() {
    return 'GraphExplain'
  },
  getToolUseSummary(input) {
    return input?.node ? `"${input.node}"` : null
  },
  getActivityDescription(input) {
    return input?.node
      ? `Explaining node: ${input.node}`
      : 'Explaining graph node'
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
    return GRAPH_EXPLAIN_DESCRIPTION
  },
  async call({ node }) {
    try {
      const result = await explainNode(node)
      return { data: formatResult(result) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph explain failed: ${msg}\n\nFallback: use Grep to search for the symbol.` }
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
