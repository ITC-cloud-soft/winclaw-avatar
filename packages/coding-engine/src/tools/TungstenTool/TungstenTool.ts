// Stub file for TungstenTool
import { z } from 'zod/v4'

export const TungstenTool = {
  name: 'Tungsten',
  isEnabled: () => false,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  inputSchema: z.object({ command: z.string() }),
  description: async () => 'Tungsten tool (stub)',
  call: async () => ({ type: 'result' as const, resultForAssistant: '' }),
}
