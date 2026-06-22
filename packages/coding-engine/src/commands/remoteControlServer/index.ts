import type { Command } from '../../types/command.js'

const remoteControlServer = {
  type: 'local-jsx',
  name: 'remote-control-server',
  description: 'Start the remote control server daemon',
  isHidden: true,
  load: async () => ({ default: null }),
} satisfies Command

export default remoteControlServer
