import type { Command } from '../types/command.js'

const ultraplan = {
  type: 'local-jsx',
  name: 'ultraplan',
  description: 'Generate a comprehensive plan for a complex task',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default ultraplan
