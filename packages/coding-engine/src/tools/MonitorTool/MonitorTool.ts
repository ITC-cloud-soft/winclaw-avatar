import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const MONITOR_TOOL_NAME = 'Monitor'

const inputSchema = lazySchema(() =>
  z.strictObject({
    command: z.string().describe('Shell command whose output to monitor.'),
    interval_ms: z
      .number()
      .int()
      .optional()
      .describe('Polling interval in milliseconds. Defaults to 1000.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: MONITOR_TOOL_NAME,
  description: 'Monitor a command or resource for changes',
  async prompt() {
    return 'Monitor a shell command output for changes at a given polling interval.'
  },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ command, interval_ms }) {
    yield {
      type: 'result',
      data: { command, interval_ms: interval_ms ?? 1000 },
      resultForAssistant: `Monitoring started for: ${command}`,
    }
  },
}

export const MonitorTool = buildTool(def)
