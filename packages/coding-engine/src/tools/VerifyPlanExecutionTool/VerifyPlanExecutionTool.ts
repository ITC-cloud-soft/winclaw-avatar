import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { VERIFY_PLAN_EXECUTION_TOOL_NAME } from './constants.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    plan_id: z.string().describe('ID of the plan to verify execution for.'),
    result: z
      .enum(['success', 'failure', 'partial'])
      .describe('Execution result of the plan.'),
    notes: z.string().optional().describe('Optional notes about the execution.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: VERIFY_PLAN_EXECUTION_TOOL_NAME,
  description: 'Verify the execution of a plan step',
  async prompt() { return 'Verify whether a plan was executed correctly and record the result.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return process.env.CLAUDE_CODE_VERIFY_PLAN === 'true'
  },
  isReadOnly() {
    return true
  },
  async *call({ plan_id, result, notes }) {
    yield {
      type: 'result',
      data: { plan_id, result, notes: notes ?? null },
      resultForAssistant: `Plan ${plan_id} verified: ${result}${notes ? ` — ${notes}` : ''}`,
    }
  },
}

export const VerifyPlanExecutionTool = buildTool(def)
