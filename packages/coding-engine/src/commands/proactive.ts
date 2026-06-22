import type { Command } from '../types/command.js'

/**
 * /proactive command - toggle proactive autonomous mode on/off.
 */
const proactiveCommand = {
  type: 'local-jsx',
  name: 'proactive',
  description: 'Toggle proactive autonomous mode',
  isHidden: false,
  load: async () => ({ default: null }),
} satisfies Command

export default proactiveCommand
