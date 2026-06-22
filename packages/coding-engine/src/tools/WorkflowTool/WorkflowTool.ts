import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    workflow_name: z.string().describe('Name of the workflow script to execute.'),
    args: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Arguments to pass to the workflow.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: WORKFLOW_TOOL_NAME,
  description: 'Execute a workflow script',
  async prompt() { return 'Run a named workflow script with optional arguments.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return false
  },
  async *call({ workflow_name, args }) {
    yield {
      type: 'result',
      data: { workflow_name, args: args ?? {} },
      resultForAssistant: `Workflow ${workflow_name} not available in this environment.`,
    }
  },
}

export const WorkflowTool = buildTool(def)
