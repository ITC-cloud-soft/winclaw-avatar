import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'systest',
  description: 'Run system testing on a target project (code review, API/UI testing, doc generation)',
  isEnabled: () => true,
  supportsNonInteractive: true,
  argumentHint: '<run|status|resume|phase|report|init|config> [options]',
  aliases: ['st'],
  load: () => import('./systest.ts'),
} satisfies Command
