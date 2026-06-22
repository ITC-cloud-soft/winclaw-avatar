/**
 * Stub: Remote skill state management.
 * Tracks the state of remotely loaded skills (from MCP or remote sources).
 */

export type RemoteSkillEntry = {
  name: string
  uri: string
  content: string
  loadedAt: number
}

const _remoteSkills = new Map<string, RemoteSkillEntry>()

export function getRemoteSkill(name: string): RemoteSkillEntry | undefined {
  return _remoteSkills.get(name)
}

export function setRemoteSkill(name: string, entry: RemoteSkillEntry): void {
  _remoteSkills.set(name, entry)
}

export function clearRemoteSkills(): void {
  _remoteSkills.clear()
}

export function getRemoteSkillNames(): string[] {
  return Array.from(_remoteSkills.keys())
}

/**
 * Strip the canonical prefix (e.g. "plugin:name:") from a command name
 * to get the bare skill slug.
 */
export function stripCanonicalPrefix(commandName: string): string {
  // Remove common prefixes: "plugin:category:name" → "name"
  const parts = commandName.split(':')
  return parts[parts.length - 1] ?? commandName
}

/**
 * Get a discovered remote skill by slug.
 */
export function getDiscoveredRemoteSkill(slug: string): RemoteSkillEntry | undefined {
  // Try exact match first
  const exact = _remoteSkills.get(slug)
  if (exact) return exact
  // Try matching by slug suffix
  for (const [key, entry] of _remoteSkills) {
    if (key.endsWith(slug) || key.endsWith(':' + slug)) return entry
  }
  return undefined
}
