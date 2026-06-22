import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  SEND_USER_FILE_TOOL_NAME,
  SEND_USER_FILE_TOOL_PROMPT,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    path: z
      .string()
      .describe('Absolute or relative path to the file to send to the user.'),
    caption: z
      .string()
      .optional()
      .describe('Optional caption or description for the file.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: SEND_USER_FILE_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return SEND_USER_FILE_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ path, caption }) {
    yield {
      type: 'result',
      data: { path, caption: caption ?? null },
      resultForAssistant: `File sent: ${path}${caption ? ` (${caption})` : ''}`,
    }
  },
}

export const SendUserFileTool = buildTool(def)
