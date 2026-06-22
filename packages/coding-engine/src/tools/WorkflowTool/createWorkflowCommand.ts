import type { Command } from '../../commands.js'

/**
 * Stub: returns an empty list of workflow commands.
 * Real implementation would scan .claude/workflows/ for workflow scripts.
 */
export async function getWorkflowCommands(_cwd: string): Promise<Command[]> {
  return []
}
