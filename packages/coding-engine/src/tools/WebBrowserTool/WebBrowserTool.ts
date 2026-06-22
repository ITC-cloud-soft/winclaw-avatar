import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const WEB_BROWSER_TOOL_NAME = 'WebBrowser'

const inputSchema = lazySchema(() =>
  z.strictObject({
    url: z.string().url().describe('URL to open in the browser.'),
    action: z
      .enum(['navigate', 'screenshot', 'extract_text'])
      .optional()
      .describe('Browser action to perform. Defaults to "navigate".'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: WEB_BROWSER_TOOL_NAME,
  description: 'Control a web browser to navigate and interact with pages',
  async prompt() { return 'Navigate to a URL, take screenshots, or extract text from web pages using an automated browser.' },
  get inputSchema() { return inputSchema() },
  isEnabled() {
    return true
  },
  isReadOnly() {
    return true
  },
  async *call({ url, action = 'navigate' }) {
    yield {
      type: 'result',
      data: { url, action },
      resultForAssistant: `Browser ${action} on ${url} not available in this environment.`,
    }
  },
}

export const WebBrowserTool = buildTool(def)
