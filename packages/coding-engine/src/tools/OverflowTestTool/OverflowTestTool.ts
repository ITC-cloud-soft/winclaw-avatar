import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const OVERFLOW_TEST_TOOL_NAME = 'OverflowTest'

const inputSchema = lazySchema(() =>
  z.strictObject({
    size_kb: z
      .number()
      .int()
      .optional()
      .describe('Size of output in kilobytes to generate for overflow testing.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: OVERFLOW_TEST_TOOL_NAME,
  description: 'Generate large output to test context window overflow handling',
  async prompt() { return 'Generate a large output to stress-test context overflow behavior.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return process.env.USER_TYPE === 'ant'
  },
  isReadOnly() {
    return true
  },
  async *call({ size_kb = 10 }) {
    const data = 'x'.repeat(size_kb * 1024)
    yield {
      type: 'result',
      data: { size_kb },
      resultForAssistant: data,
    }
  },
}

export const OverflowTestTool = buildTool(def)
