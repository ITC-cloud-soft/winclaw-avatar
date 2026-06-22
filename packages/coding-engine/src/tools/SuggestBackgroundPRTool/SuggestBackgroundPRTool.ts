import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const SUGGEST_BACKGROUND_PR_TOOL_NAME = 'SuggestBackgroundPR'

const inputSchema = lazySchema(() =>
  z.strictObject({
    description: z
      .string()
      .describe('Description of the background PR work to suggest.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: SUGGEST_BACKGROUND_PR_TOOL_NAME,
  description: 'Suggest a background pull request task',
  async prompt() { return 'Suggest creating a pull request as a background task.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ description }) {
    yield {
      type: 'result',
      data: { description },
      resultForAssistant: `Background PR suggestion created: ${description}`,
    }
  },
}

export const SuggestBackgroundPRTool = buildTool(def)
