import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { DESCRIPTION, SNIP_TOOL_NAME, SNIP_TOOL_PROMPT } from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    start_index: z.number().int().describe('Start index of messages to snip.'),
    end_index: z.number().int().describe('End index of messages to snip.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: SNIP_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return SNIP_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ start_index, end_index }) {
    yield {
      type: 'result',
      data: { start_index, end_index },
      resultForAssistant: `Snipped messages ${start_index}-${end_index}`,
    }
  },
}

export const SnipTool = buildTool(def)
