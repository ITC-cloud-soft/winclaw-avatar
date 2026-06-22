import type { Command } from '../types/command.js'

const torch = {
  type: 'local-jsx',
  name: 'torch',
  description: 'Run torch (experimental) mode',
  isHidden: true,
  load: async () => ({ default: null }),
} satisfies Command

export default torch
