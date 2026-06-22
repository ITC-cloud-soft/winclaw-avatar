/**
 * Stub: Run Skill Generator skill (RUN_SKILL_GENERATOR feature).
 * In a real implementation this provides skill generation capabilities.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerRunSkillGeneratorSkill(): void {
  registerBundledSkill({
    name: 'run-skill-generator',
    description: 'Run skill generator',
    userInvocable: false,
    async getPromptForCommand(_args: string) {
      return [{ type: 'text' as const, text: '' }]
    },
  })
}
