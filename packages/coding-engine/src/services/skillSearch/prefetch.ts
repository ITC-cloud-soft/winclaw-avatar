/**
 * Stub: Skill search prefetch service.
 * In a real implementation this runs skill discovery in the background
 * while the model streams, so results are ready when needed.
 */

export function startSkillDiscoveryPrefetch(
  _context: unknown,
  _messages: unknown[],
  _toolUseContext: unknown,
): Promise<unknown> {
  return Promise.resolve(null)
}

export async function collectSkillDiscoveryPrefetch(
  _pending: unknown,
): Promise<null> {
  return null
}

export async function getTurnZeroSkillDiscovery(
  _signal: unknown,
  _toolUseContext: unknown,
): Promise<null> {
  return null
}
