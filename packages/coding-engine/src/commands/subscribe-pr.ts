import type { Command } from '../types/command.js'

const subscribePr = {
  type: 'local-jsx',
  name: 'subscribe-pr',
  description: 'Subscribe to GitHub pull request events',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default subscribePr
