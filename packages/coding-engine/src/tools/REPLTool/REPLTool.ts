import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { REPL_TOOL_NAME } from './constants.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    code: z
      .string()
      .describe(
        'JavaScript/TypeScript code to execute in the REPL environment. Can use primitive tools (Read, Write, Edit, Bash, Glob, Grep) as async functions.',
      ),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: REPL_TOOL_NAME,
  description:
    'Execute code in a REPL environment with access to primitive tools',
  async prompt() {
    return 'Run JavaScript/TypeScript code in a sandboxed REPL. Access Read, Write, Edit, Bash, Glob, and Grep as async functions.'
  },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return process.env.USER_TYPE === 'ant'
  },
  isReadOnly() {
    return false
  },
  async *call({ code }) {
    yield {
      type: 'result',
      data: { code },
      resultForAssistant:
        'REPL execution not available in this environment stub.',
    }
  },
}

export const REPLTool = buildTool(def)
