/**
 * Stub: Snip projection — history snip view projection (HISTORY_SNIP feature).
 * In a real implementation this filters snipped messages from the view.
 */
import type { Message } from '../../types/message.js'

/**
 * Returns true if this message is a snip boundary marker.
 */
export function isSnipBoundaryMessage(message: Message): boolean {
  return false
}

/**
 * Project snipped messages out of the view.
 * Stub: returns messages as-is.
 */
export function projectSnippedView<T extends Message>(messages: T[]): T[] {
  return messages
}
