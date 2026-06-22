import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { DESCRIPTION, SLEEP_TOOL_NAME, SLEEP_TOOL_PROMPT } from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    duration_ms: z
      .number()
      .int()
      .describe('Duration to sleep in milliseconds.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: SLEEP_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return SLEEP_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ duration_ms }) {
    await new Promise<void>((resolve) => setTimeout(resolve, duration_ms))
    yield {
      type: 'result',
      data: { slept_ms: duration_ms },
      resultForAssistant: `Slept for ${duration_ms}ms`,
    }
  },
}

export const SleepTool = buildTool(def)
