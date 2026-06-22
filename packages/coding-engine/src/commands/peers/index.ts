import type { Command } from '../../types/command.js'

const peersCmd = {
  type: 'local-jsx',
  name: 'peers',
  description: 'List peer sessions connected via inbox',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default peersCmd
