// Shim for bun:bundle's feature() function used for dead code elimination
// In dev mode, all features are disabled by default

export function feature(name: string): boolean {
  const enabledFeatures = new Set(
    (process.env.CLAUDE_CODE_FEATURES || '').split(',').filter(Boolean)
  )
  return enabledFeatures.has(name)
}
