import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  SUBSCRIBE_PR_TOOL_NAME,
  SUBSCRIBE_PR_TOOL_PROMPT,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    repo: z
      .string()
      .describe(
        'GitHub repository in owner/repo format (e.g. "anthropics/claude-code").',
      ),
    pr_number: z.number().int().describe('Pull request number to subscribe to.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: SUBSCRIBE_PR_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return SUBSCRIBE_PR_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ repo, pr_number }) {
    yield {
      type: 'result',
      data: { repo, pr_number },
      resultForAssistant: `Subscribed to PR #${pr_number} in ${repo}`,
    }
  },
}

export const SubscribePRTool = buildTool(def)
