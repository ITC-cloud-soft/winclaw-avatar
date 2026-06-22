/**
 * Stub: Snip-based compact service.
 * In a real implementation this handles compaction triggered by SnipTool calls.
 */

export const SNIP_NUDGE_TEXT = ''

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: unknown[]): boolean {
  return false
}

export function isSnipMarkerMessage(_message: unknown): boolean {
  return false
}

export function snipCompactIfNeeded(
  _messages: unknown[],
  ..._rest: unknown[]
): { compacted: boolean; messages: unknown[] } {
  return { compacted: false, messages: _messages as unknown[] }
}
