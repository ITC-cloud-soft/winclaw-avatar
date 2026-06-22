/**
 * Stub: Cached microcompact module (CACHED_MICROCOMPACT feature).
 * In a real implementation this manages cache-editing mode for microcompaction.
 */

export type CacheEditsBlock = {
  type: 'cache_edits'
  content: string
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCState = {
  pinnedEdits: PinnedCacheEdits[]
}

export type CachedMCConfig = {
  supportedModels: string[]
  enabled: boolean
}

export function createCachedMCState(): CachedMCState {
  return { pinnedEdits: [] }
}

export function isCachedMicrocompactEnabled(): boolean {
  return false
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false
}

export function getCachedMCConfig(): CachedMCConfig {
  return { supportedModels: [], enabled: false }
}
