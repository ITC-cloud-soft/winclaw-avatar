/**
 * Stub: Job classifier for TEMPLATES feature.
 * In a real implementation this would classify assistant messages and write
 * a state.json file to CLAUDE_JOB_DIR.
 */
import type { AssistantMessage } from '../types/message.js'

export async function classifyAndWriteState(
  _jobDir: string | undefined,
  _messages: AssistantMessage[],
): Promise<void> {
  // Stub: no-op
}
