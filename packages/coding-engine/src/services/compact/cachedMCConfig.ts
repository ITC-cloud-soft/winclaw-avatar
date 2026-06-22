/**
 * Stub: Cached microcompact configuration.
 * In a real implementation this provides a cached configuration object
 * for the cached-microcompact feature (cache-editing beta).
 */

export type CachedMCConfig = {
  supportedModels: string[]
  enabled: boolean
}

const DEFAULT_CONFIG: CachedMCConfig = {
  supportedModels: [],
  enabled: false,
}

export function getCachedMCConfig(): CachedMCConfig {
  return DEFAULT_CONFIG
}
