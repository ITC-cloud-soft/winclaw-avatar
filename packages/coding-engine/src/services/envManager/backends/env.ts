import type { BackendSpec, ResolveResult } from '../types.js'

/**
 * Resolves a `{ backend: 'env'; name: string }` spec by reading process.env.
 * Returns `not-declared` when the variable is absent or empty.
 */
export async function resolveEnv(
  spec: BackendSpec & { backend: 'env' },
): Promise<ResolveResult> {
  const raw = process.env[spec.name]

  if (raw === undefined || raw === '') {
    return {
      ok: false,
      key: spec.name,
      kind: 'var',
      reason: 'not-declared',
    }
  }

  return { ok: true, value: raw }
}
