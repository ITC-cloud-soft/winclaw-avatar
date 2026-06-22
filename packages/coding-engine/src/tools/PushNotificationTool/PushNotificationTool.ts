import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  PUSH_NOTIFICATION_TOOL_NAME,
  PUSH_NOTIFICATION_TOOL_PROMPT,
} from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    title: z.string().describe('Title of the push notification.'),
    body: z.string().describe('Body text of the push notification.'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: PUSH_NOTIFICATION_TOOL_NAME,
  description: DESCRIPTION,
  async prompt() { return PUSH_NOTIFICATION_TOOL_PROMPT },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ title, body }) {
    yield {
      type: 'result',
      data: { title, body },
      resultForAssistant: `Push notification sent: ${title}`,
    }
  },
}

export const PushNotificationTool = buildTool(def)
