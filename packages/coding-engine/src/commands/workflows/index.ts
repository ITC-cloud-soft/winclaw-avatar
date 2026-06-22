import type { Command } from '../../types/command.js'

const workflowsCmd = {
  type: 'local-jsx',
  name: 'workflows',
  description: 'List and manage workflow scripts',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default workflowsCmd
