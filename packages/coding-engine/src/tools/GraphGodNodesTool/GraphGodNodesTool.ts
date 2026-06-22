import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getGodNodes } from '../../services/graphify/client.js'
import {
  GRAPH_GOD_NODES_TOOL_NAME,
  GRAPH_GOD_NODES_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    top: z.number().optional().describe('Number of god nodes to return (default 10)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

function formatResult(nodes: Awaited<ReturnType<typeof getGodNodes>>): string {
  if (nodes.length === 0) {
    return `No nodes found in the knowledge graph.`
  }

  const lines: string[] = []
  lines.push(`Top god nodes (most connected symbols):`)
  lines.push('')

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    lines.push(
      `  ${(i + 1).toString().padStart(2)}. ${n.label.padEnd(40)} deg=${String(n.degree).padStart(4)}  [${n.source_file}]`,
    )
  }

  return lines.join('\n')
}

export const GraphGodNodesTool = buildTool({
  name: GRAPH_GOD_NODES_TOOL_NAME,
  searchHint: 'knowledge graph god nodes highest degree critical symbols',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to find the most connected symbols`
  },
  userFacingName() {
    return 'GraphGodNodes'
  },
  getToolUseSummary(input) {
    return input?.top ? `top ${input.top}` : 'top god nodes'
  },
  getActivityDescription() {
    return 'Finding most connected symbols'
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
    return GRAPH_GOD_NODES_DESCRIPTION
  },
  async call({ top }) {
    try {
      const result = await getGodNodes(top ?? 10)
      return { data: formatResult(result) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph god nodes query failed: ${msg}` }
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
