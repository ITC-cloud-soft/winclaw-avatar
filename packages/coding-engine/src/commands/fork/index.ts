import type { Command } from '../../types/command.js'

const forkCmd = {
  type: 'local-jsx',
  name: 'fork',
  description: 'Fork the current session into a subagent',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default forkCmd
