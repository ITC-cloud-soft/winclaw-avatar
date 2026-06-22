import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'graph',
  description: 'Manage the project knowledge graph (status, init, rebuild, update)',
  isEnabled: () => true,
  supportsNonInteractive: true,
  argumentHint: '<status|init|rebuild|update>',
  load: () => import('./graph.js'),
} satisfies Command
