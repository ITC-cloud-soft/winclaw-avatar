/**
 * Post-Write Hook for Automatic Graph Update
 * 
 * Automatically rebuilds the semantic knowledge graph after code changes.
 * This ensures the graph is always up-to-date for efficient code exploration.
 */

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface GraphUpdateConfig {
  enabled: boolean
  debounceMs: number
  monitoredPaths: string[]
}

export interface GraphUpdateResult {
  success: boolean
  timestamp: Date
  nodes?: number
  edges?: number
  error?: string
}

// Debounce state
let updateTimeout: NodeJS.Timeout | null = null
let pendingUpdatePath: string | null = null

/**
 * Default configuration for graph auto-update.
 */
export const DEFAULT_GRAPH_UPDATE_CONFIG: GraphUpdateConfig = {
  enabled: true,
  debounceMs: 5000, // 5 seconds
  monitoredPaths: [
    'src/commands/**/*.ts',
    'src/services/**/*.ts',
    'src/tools/**/*.ts',
  ],
}

/**
 * Check if a file path matches any of the monitored patterns.
 */
function isMonitoredPath(filePath: string, monitoredPaths: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  
  for (const pattern of monitoredPaths) {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.')
    
    const regex = new RegExp(regexPattern)
    if (regex.test(normalizedPath)) {
      return true
    }
  }
  
  return false
}

/**
 * Rebuild the semantic knowledge graph.
 */
export async function rebuildGraph(rootDir: string = process.cwd()): Promise<GraphUpdateResult> {
  const startTime = Date.now()
  
  try {
    // Dynamically import buildGraph to avoid circular dependencies
    const { buildGraph } = await import('../services/graphify/builder/index.js')
    
    console.log('[Graphify] Rebuilding knowledge graph...')
    
    const result = await buildGraph({ rootDir })
    
    if (result.success) {
      const duration = Date.now() - startTime
      console.log('[Graphify] Graph updated successfully in ' + duration + 'ms')
      console.log('[Graphify] ' + result.nodes?.toLocaleString() + ' nodes, ' + result.edges?.toLocaleString() + ' edges')
      
      return {
        success: true,
        timestamp: new Date(),
        nodes: result.nodes,
        edges: result.edges,
      }
    } else {
      return {
        success: false,
        timestamp: new Date(),
        error: result.error || 'Unknown build error',
      }
    }
  } catch (error) {
    return {
      success: false,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Post-write hook callback.
 * Call this after writing files to trigger automatic graph update.
 * 
 * @param filePath - The path of the file that was written
 * @param config - Optional configuration (uses defaults if not provided)
 * @param rootDir - Root directory of the project
 */
export async function postWriteHook(
  filePath: string,
  config: Partial<GraphUpdateConfig> = {},
  rootDir: string = process.cwd()
): Promise<GraphUpdateResult | null> {
  // Merge with default config
  const fullConfig: GraphUpdateConfig = {
    ...DEFAULT_GRAPH_UPDATE_CONFIG,
    ...config,
  }
  
  // Check if auto-update is enabled
  if (!fullConfig.enabled) {
    return null
  }
  
  // Check if the modified file is in a monitored path
  if (!isMonitoredPath(filePath, fullConfig.monitoredPaths)) {
    return null
  }
  
  // Clear any pending timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }
  
  // Set up debounced update
  return new Promise((resolve) => {
    pendingUpdatePath = filePath
    
    updateTimeout = setTimeout(async () => {
      console.log('[Graphify] Detected changes in monitored path: ' + filePath)
      
      const result = await rebuildGraph(rootDir)
      
      pendingUpdatePath = null
      updateTimeout = null
      
      resolve(result)
    }, fullConfig.debounceMs)
  })
}

/**
 * Force an immediate graph update (bypasses debounce).
 * Useful for manual triggers or critical updates.
 */
export async function forceGraphUpdate(
  rootDir: string = process.cwd()
): Promise<GraphUpdateResult> {
  // Clear any pending timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout)
    updateTimeout = null
  }
  
  pendingUpdatePath = null
  
  return rebuildGraph(rootDir)
}

/**
 * Check if there's a pending graph update.
 */
export function hasPendingUpdate(): boolean {
  return updateTimeout !== null || pendingUpdatePath !== null
}

/**
 * Get the path that triggered the pending update.
 */
export function getPendingUpdatePath(): string | null {
  return pendingUpdatePath
}
