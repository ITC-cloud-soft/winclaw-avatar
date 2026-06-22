import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const LIST_PEERS_TOOL_NAME = 'ListPeers'

const inputSchema = lazySchema(() => z.strictObject({}))

type InputSchema = ReturnType<typeof inputSchema>

const def: ToolDef<InputSchema> = {
  name: LIST_PEERS_TOOL_NAME,
  description: 'List peers connected via the Unix Domain Socket inbox',
  async prompt() { return 'Return a list of currently connected peer sessions.' },
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
      data: { peers: [] },
      resultForAssistant: 'No peers connected.',
    }
  },
}

export const ListPeersTool = buildTool(def)
