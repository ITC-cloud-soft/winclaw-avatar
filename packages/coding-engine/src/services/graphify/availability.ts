import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolveGraphPath } from './client.js'

export function isGraphAvailable(): boolean {
  return existsSync(resolveGraphPath())
}

export function getGraphStats(): { nodes: number; edges: number; freshness: string } | null {
  const gp = resolveGraphPath()
  if (!existsSync(gp)) return null
  try {
    const data = JSON.parse(readFileSync(gp, 'utf-8'))
    const stat = statSync(gp)
    const ageMs = Date.now() - stat.mtime.getTime()
    const ageMin = Math.floor(ageMs / 60000)
    const freshness = ageMin < 1 ? 'just now' : ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin/60)}h ago`
    return {
      nodes: data.nodes?.length ?? 0,
      edges: (data.links ?? data.edges)?.length ?? 0,
      freshness,
    }
  } catch { return null }
}
