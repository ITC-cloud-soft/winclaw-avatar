/**
 * Graph Update Prompt Module
 * 
 * Displays warnings when the semantic knowledge graph is stale
 * and prompts the user to rebuild it.
 */

import { existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface GraphTimestamp {
  graphFile: string
  lastModified: Date
}

export interface CodeTimestamp {
  newestFile: string
  lastModified: Date
}

export interface GraphFreshnessStatus {
  isStale: boolean
  graphTimestamp: Date
  codeTimestamp: Date
  ageMs: number
  ageHuman: string
}

/**
 * Get the timestamp of the knowledge graph file.
 */
export function getGraphTimestamp(rootDir: string = process.cwd()): Date | null {
  const graphPath = join(rootDir, 'graphify-out', 'graph.json')
  
  if (!existsSync(graphPath)) {
    return null
  }
  
  try {
    const stats = statSync(graphPath)
    return stats.mtime
  } catch {
    return null
  }
}

/**
 * Get the timestamp of the most recently modified code file.
 * Searches src/ directory for TypeScript files.
 */
export function getLastCodeChange(rootDir: string = process.cwd()): Date {
  const srcPath = join(rootDir, 'src')
  
  if (!existsSync(srcPath)) {
    return new Date(0)
  }
  
  let newestTime = new Date(0)
  
  try {
    // Recursively find all .ts files
    const findTsFiles = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            findTsFiles(fullPath)
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          try {
            const stats = statSync(fullPath)
            if (stats.mtime > newestTime) {
              newestTime = stats.mtime
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }
    
    findTsFiles(srcPath)
  } catch {
    // If scanning fails, return current time
    return new Date()
  }
  
  return newestTime
}

/**
 * Check if the graph is stale and return detailed status.
 */
export function checkGraphFreshness(rootDir: string = process.cwd()): GraphFreshnessStatus | null {
  const graphTime = getGraphTimestamp(rootDir)
  
  if (!graphTime) {
    return null // No graph exists
  }
  
  const codeTime = getLastCodeChange(rootDir)
  const ageMs = codeTime.getTime() - graphTime.getTime()
  
  // Consider graph stale if code is newer than graph by more than 1 minute
  // (1 minute grace period for normal operation)
  const isStale = ageMs > 60000
  
  return {
    isStale,
    graphTimestamp: graphTime,
    codeTimestamp: codeTime,
    ageMs,
    ageHuman: formatTimeAgo(ageMs),
  }
}

/**
 * Format a duration in milliseconds as human-readable time ago.
 */
export function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return days + 'd ' + (hours % 24) + 'h'
  } else if (hours > 0) {
    return hours + 'h ' + (minutes % 60) + 'm'
  } else if (minutes > 0) {
    return minutes + 'm'
  } else {
    return seconds + 's'
  }
}

/**
 * Display a warning if the graph is stale.
 * Returns true if a warning was shown.
 */
export function showGraphUpdateWarning(rootDir: string = process.cwd()): boolean {
  const status = checkGraphFreshness(rootDir)
  
  if (!status) {
    console.log('[Graphify] No knowledge graph found. Run /graphify to create one.')
    return true
  }
  
  if (!status.isStale) {
    return false
  }
  
  const graphTimeStr = status.graphTimestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
  const codeTimeStr = status.codeTimestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
  
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════════════════╗')
  console.log('║  ⚠️  Knowledge graph is stale!                                            ║')
  console.log('║  Graph: ' + graphTimeStr + '  Code: ' + codeTimeStr + '  (' + status.ageHuman.padEnd(8) + ' old) ║')
  console.log('║  Run: /graphify to update before continuing                              ║')
  console.log('╚════════════════════════════════════════════════════════════════════════════╝')
  console.log('')
  
  return true
}

/**
 * Check graph freshness and return a brief message.
 * Useful for integration with command output.
 */
export function getGraphFreshnessMessage(rootDir: string = process.cwd()): string | null {
  const status = checkGraphFreshness(rootDir)
  
  if (!status) {
    return null
  }
  
  if (status.isStale) {
    return 'Graph is stale (' + status.ageHuman + ' old). Run /graphify to update.'
  }
  
  return 'Graph is up to date.'
}
