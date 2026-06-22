import type { BackendSpec, ResolveResult } from '../types.js'

/**
 * Resolves a `{ backend: 'literal'; value: string }` spec.
 * Used exclusively for `vars` (not secrets — schema enforces this).
 */
export async function resolveLiteral(
  spec: BackendSpec & { backend: 'literal' },
): Promise<ResolveResult> {
  return { ok: true, value: spec.value }
}
