import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  TERMINAL_CAPTURE_TOOL_NAME,
  TERMINAL_CAPTURE_TOOL_PROMPT,
} from './prompt.js'

const inputSchema = lazySchema(() => z.strictObject({}))

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: TERMINAL_CAPTURE_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return TERMINAL_CAPTURE_TOOL_PROMPT },
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
      resultForAssistant: 'Terminal capture not available in this environment.',
    }
  },
}

export const TerminalCaptureTool = buildTool(def)
