/**
 * Stub: Hunter skill (REVIEW_ARTIFACT feature).
 * In a real implementation this provides artifact review capabilities.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerHunterSkill(): void {
  registerBundledSkill({
    name: 'hunter',
    description: 'Review artifact skill',
    userInvocable: false,
    async getPromptForCommand(_args: string) {
      return [{ type: 'text' as const, text: '' }]
    },
  })
}
