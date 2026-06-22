/**
 * Stub: Task summary generation for background sessions.
 * In a real implementation this generates a concise summary of completed work
 * to persist across session boundaries.
 */

export function shouldGenerateTaskSummary(): boolean {
  return false
}

export async function maybeGenerateTaskSummary(_opts: {
  [key: string]: unknown
}): Promise<void> {
  // Stub: no-op
}
