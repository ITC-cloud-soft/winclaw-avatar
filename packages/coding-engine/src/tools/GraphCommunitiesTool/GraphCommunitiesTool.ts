import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getCommunities } from '../../services/graphify/client.js'
import {
  GRAPH_COMMUNITIES_TOOL_NAME,
  GRAPH_COMMUNITIES_DESCRIPTION,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    top: z.number().optional().describe('Number of communities to return (default 15)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

function formatResult(communities: Awaited<ReturnType<typeof getCommunities>>): string {
  if (communities.length === 0) {
    return `No communities found in the knowledge graph. The graph may not have community labels.`
  }

  const lines: string[] = []
  lines.push(`Top communities (sorted by size):`)
  lines.push('')

  for (let i = 0; i < communities.length; i++) {
    const c = communities[i]
    const godLabels = c.godNodes
      .map((g) => `${g.label} (${g.degree})`)
      .join(', ')
    lines.push(
      `  ${(i + 1).toString().padStart(2)}. ${c.label.padEnd(30)} | ${String(c.size).padStart(4)} nodes | cohesion ${c.cohesion.toFixed(2)}`,
    )
    lines.push(`      God nodes: ${godLabels}`)
    lines.push(`      Anchor dir: ${c.anchorDir}`)
    lines.push('')
  }

  return lines.join('\n')
}

export const GraphCommunitiesTool = buildTool({
  name: GRAPH_COMMUNITIES_TOOL_NAME,
  searchHint: 'knowledge graph communities clusters modules overview map',
  maxResultSizeChars: 50_000,
  shouldDefer: true,
  async description() {
    return `Claude wants to list codebase communities`
  },
  userFacingName() {
    return 'GraphCommunities'
  },
  getToolUseSummary(input) {
    return input?.top ? `top ${input.top}` : 'top communities'
  },
  getActivityDescription() {
    return 'Listing codebase communities'
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
    return GRAPH_COMMUNITIES_DESCRIPTION
  },
  async call({ top }) {
    try {
      const result = await getCommunities(top ?? 15)
      return { data: formatResult(result) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `Graph communities query failed: ${msg}` }
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
