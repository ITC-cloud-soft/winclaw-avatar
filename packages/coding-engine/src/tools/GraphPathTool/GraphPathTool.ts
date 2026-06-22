import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getShortestPath } from '../../services/graphify/client.js'
import {
  GRAPH_PATH_TOOL_NAME,
  GRAPH_PATH_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    from: z.string().describe('Start symbol label or ID'),
    to: z.string().describe('End symbol label or ID'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

function formatResult(
  r: Awaited<ReturnType<typeof getShortestPath>>,
  from: string,
  to: string,
): string {
  if (!r.found) {
    return `No path found between "${from}" and "${to}".\nThe symbols may be in disconnected components, or the labels may not match. Try graph_query to find the correct label.`
  }

  const lines: string[] = []
  lines.push(`Shortest path (${r.hops} hops) | ${r.ms}ms`)
  lines.push('')

  const pathNodes = r.path ?? []
  const pathEdges = r.pathEdges ?? []

  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i]
    const indent = '  '.repeat(i)
    const kindTag = node.kind ? `[${node.kind}] ` : ''
    const extras: string[] = []
    if (node.urlPath) extras.push(`urlPath=${node.urlPath}`)
    if (node.httpMethod) extras.push(`httpMethod=${node.httpMethod}`)
    if (node.signature) extras.push(`signature=${node.signature}`)
    if (node.fieldType) extras.push(`fieldType=${node.fieldType}`)
    const extrasStr = extras.length > 0 ? ' ' + extras.join(' ') : ''
    lines.push(`${indent}${kindTag}${node.label} [${node.source_file}]${extrasStr}`)
    if (i < pathEdges.length) {
      const edge = pathEdges[i]
      const conf = edge.confidence === 'EXTRACTED'
        ? ''
        : ` (${edge.confidence})`
      lines.push(`${indent}  --${edge.relation}${conf}-->`)
    }
  }

  return lines.join('\n')
}

export const GraphPathTool = buildTool({
  name: GRAPH_PATH_TOOL_NAME,
  searchHint: 'knowledge graph shortest path trace call chain dependency',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to find the path between two symbols`
  },
  userFacingName() {
    return 'GraphPath'
  },
  getToolUseSummary(input) {
    return input?.from && input?.to ? `"${input.from}" -> "${input.to}"` : null
  },
  getActivityDescription(input) {
    return input?.from && input?.to
      ? `Tracing path: ${input.from} -> ${input.to}`
      : 'Tracing graph path'
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
    return GRAPH_PATH_DESCRIPTION
  },
  async call({ from, to }) {
    try {
      const result = await getShortestPath(from, to)
      return { data: formatResult(result, from, to) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph path query failed: ${msg}\n\nFallback: use Grep to search for both symbols manually.` }
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
