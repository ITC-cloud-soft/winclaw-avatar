/**
 * Stub: Context collapse service.
 * In a real implementation this collapses/compresses long context windows
 * by removing or summarizing older messages.
 */

export function isContextCollapseEnabled(): boolean {
  return false
}

export function initContextCollapse(): void {
  // Dev stub: no-op
}

export function isWithheldPromptTooLong(_message: unknown): boolean {
  return false
}

export async function applyCollapsesIfNeeded(
  messages: unknown[],
  ..._rest: unknown[]
): Promise<{ messages: unknown[] }> {
  return { messages }
}

export function recoverFromOverflow(_opts: {
  messages: unknown[]
  [key: string]: unknown
}): unknown[] {
  return []
}
