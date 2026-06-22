import type { Command } from '../../types/command.js'

const assistant = {
  type: 'local-jsx',
  name: 'assistant',
  description: 'Configure the AI assistant settings',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default assistant
