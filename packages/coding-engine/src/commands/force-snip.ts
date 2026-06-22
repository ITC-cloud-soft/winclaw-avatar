import type { Command } from '../types/command.js'

const forceSnip = {
  type: 'local-jsx',
  name: 'force-snip',
  description: 'Force snip (compress) conversation history',
  isHidden: true,
  load: async () => ({ default: null }),
} satisfies Command

export default forceSnip
