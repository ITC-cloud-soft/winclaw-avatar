/**
 * Stub: Local skill search index.
 * In a real implementation this builds and queries a local inverted index
 * over skill frontmatter/content for fast skill discovery.
 */

export function clearSkillIndexCache(): void {
  // Stub: no-op
}

export async function searchLocalSkills(
  _query: string,
  _cwd: string,
): Promise<unknown[]> {
  return []
}
