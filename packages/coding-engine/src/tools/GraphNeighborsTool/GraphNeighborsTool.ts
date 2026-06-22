import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getNeighbors } from '../../services/graphify/client.js'
import {
  GRAPH_NEIGHBORS_TOOL_NAME,
  GRAPH_NEIGHBORS_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    node: z.string().describe('Label or ID of the node to expand'),
    depth: z.number().optional().describe('How many hops to expand (default 1, max 3)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

/**
 * Append Level-2/3 semantic attributes as `key=value` pairs so AI agents
 * can filter by kind/urlPath/signature without re-querying.
 */
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

function formatResult(r: Awaited<ReturnType<typeof getNeighbors>>): string {
  if (!r.target) {
    return `Node not found in the knowledge graph. Check the label/ID or use graph_query to search.`
  }

  const lines: string[] = []
  lines.push(`Node: ${kindTag(r.target)}${r.target.label} [${r.target.source_file}]${renderAttrs(r.target)}`)
  lines.push(`Query time: ${r.ms}ms`)
  lines.push('')

  // Outbound (successors)
  lines.push(`Outbound (${r.successors.length} successors):`)
  if (r.successors.length === 0) {
    lines.push('  (none)')
  }
  for (const s of r.successors.slice(0, 30)) {
    lines.push(`  -> ${kindTag(s)}${s.label} --${s.relation}--> [${s.source_file}]${renderAttrs(s)}`)
  }
  lines.push('')

  // Inbound (predecessors)
  lines.push(`Inbound (${r.predecessors.length} predecessors):`)
  if (r.predecessors.length === 0) {
    lines.push('  (none)')
  }
  for (const p of r.predecessors.slice(0, 30)) {
    lines.push(`  <- ${kindTag(p)}${p.label} --${p.relation}--> [${p.source_file}]${renderAttrs(p)}`)
  }

  return lines.join('\n')
}

export const GraphNeighborsTool = buildTool({
  name: GRAPH_NEIGHBORS_TOOL_NAME,
  searchHint: 'knowledge graph neighbors dependencies inbound outbound',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to explore neighbors of a graph node`
  },
  userFacingName() {
    return 'GraphNeighbors'
  },
  getToolUseSummary(input) {
    return input?.node ? `"${input.node}"` : null
  },
  getActivityDescription(input) {
    return input?.node
      ? `Expanding neighbors: ${input.node}`
      : 'Expanding graph neighbors'
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
    return GRAPH_NEIGHBORS_DESCRIPTION
  },
  async call({ node, depth }) {
    try {
      const clampedDepth = Math.min(depth ?? 1, 3)
      const result = await getNeighbors(node, clampedDepth)
      return { data: formatResult(result) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph neighbors query failed: ${msg}\n\nFallback: use Grep to search for references.` }
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
