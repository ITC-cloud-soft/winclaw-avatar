/**
 * Stub: Reactive compact service.
 * In a real implementation this would trigger compaction when the context
 * window fills up or when the prompt is too long (withheld 413/media errors).
 */

export function isReactiveCompactEnabled(): boolean {
  return false
}

export function isWithheldPromptTooLong(_message: unknown): boolean {
  return false
}

export function isWithheldMediaSizeError(_message: unknown): boolean {
  return false
}

export async function tryReactiveCompact(_opts: {
  hasAttempted: boolean
  querySource: string
  aborted: boolean
  messages: unknown[]
  cacheSafeParams: unknown
}): Promise<null> {
  return null
}
