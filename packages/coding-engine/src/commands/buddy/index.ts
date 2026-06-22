import type { Command } from '../../types/command.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Configure your Claude Buddy (pair-programming assistant)',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default buddy
