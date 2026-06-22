import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const CTX_INSPECT_TOOL_NAME = 'CtxInspect'

const inputSchema = lazySchema(() => z.strictObject({}))

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: CTX_INSPECT_TOOL_NAME,
  description: 'Inspect the current context window usage and structure',
  async prompt() { return 'Return a summary of the current context window token usage.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call(_input) {
    yield {
      type: 'result',
      data: {},
      resultForAssistant: 'Context inspection not available in this environment.',
    }
  },
}

export const CtxInspectTool = buildTool(def)
