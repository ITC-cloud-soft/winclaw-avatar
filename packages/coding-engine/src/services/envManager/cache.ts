/**
 * In-memory cache for resolved credential values with TTL support.
 */

interface CacheEntry {
  value: string
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

/**
 * Returns a cached value if present and not expired, otherwise null.
 */
export function getCached(key: string): string | null {
  const entry = store.get(key)
  if (entry === undefined) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value
}

/**
 * Stores a value in the cache with the given TTL in milliseconds.
 */
export function setCached(key: string, value: string, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Clears all cache entries. Intended for use in tests.
 */
export function invalidateAll(): void {
  store.clear()
}

/**
 * Parses a TTL string like "5m", "30m", "1h" into milliseconds.
 * Returns the default of 1 800 000 ms (30 min) for undefined/empty input.
 */
export function parseTtl(s?: string): number {
  const DEFAULT_MS = 30 * 60 * 1000 // 30 min

  if (!s || s.trim() === '') return DEFAULT_MS

  const trimmed = s.trim()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(m|h|s)$/)
  if (!match) return DEFAULT_MS

  const num = parseFloat(match[1])
  const unit = match[2]

  switch (unit) {
    case 's': return Math.round(num * 1000)
    case 'm': return Math.round(num * 60 * 1000)
    case 'h': return Math.round(num * 3600 * 1000)
    default:  return DEFAULT_MS
  }
}
