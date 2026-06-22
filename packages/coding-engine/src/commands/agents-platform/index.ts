import type { Command } from '../../commands.js'

/**
 * Stub: Agents Platform command (ant-only).
 * Provides management of agents on the Anthropic agents platform.
 */
const agentsPlatform = {
  type: 'local-jsx',
  name: 'agents-platform',
  description: 'Manage agents on the Anthropic agents platform (ant-only)',
  isHidden: true,
  load: async () => ({ default: null }),
} satisfies Command

export default agentsPlatform
