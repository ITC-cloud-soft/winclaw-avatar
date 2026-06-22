/**
 * Stub: Skill search signal types.
 */

export type DiscoverySignal = {
  type: 'write' | 'read' | 'search'
  query: string
  filePaths?: string[]
}
