import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  DISCOVER_SKILLS_TOOL_NAME,
  DISCOVER_SKILLS_TOOL_PROMPT,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z
      .string()
      .describe('Natural language query describing the capability you need.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: DISCOVER_SKILLS_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return DISCOVER_SKILLS_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ query }) {
    yield {
      type: 'result',
      data: { query, results: [] },
      resultForAssistant: `No skills found matching: ${query}`,
    }
  },
}

export const DiscoverSkillsTool = buildTool(def)
