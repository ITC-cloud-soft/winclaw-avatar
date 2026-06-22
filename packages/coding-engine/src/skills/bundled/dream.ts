/**
 * Stub: Dream skill (KAIROS / KAIROS_DREAM feature).
 * In a real implementation this provides the /dream command for the KAIROS assistant.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerDreamSkill(): void {
  registerBundledSkill({
    name: 'dream',
    description: 'KAIROS dream skill',
    userInvocable: false,
    async getPromptForCommand(_args: string) {
      return [{ type: 'text' as const, text: '' }]
    },
  })
}
