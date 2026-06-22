/**
 * AI-Driven Service Detection using Knowledge Graph
 * 
 * Uses the semantic knowledge graph to detect services instead of hardcoded logic
 */

import type { GraphEngine } from '../graphify/types.js'

export interface ServiceDetection {
  hasBackend: boolean
  hasFrontend: boolean
  backend?: BackendInfo
  frontend?: FrontendInfo
  reasoning: string
}

export interface BackendInfo {
  type: string
  framework: string
  mainFile: string
  startScript: string
  port: number | null
  swaggerAvailable: boolean
  swaggerPath: string
}

export interface FrontendInfo {
  type: string
  framework: string
  mainFile: string
  startScript: string
  port: number | null
}

/**
 * Detect backend service using graph analysis
 */
export async function detectBackendWithGraph(
  workspace: string,
  graphEngine: GraphEngine | null
): Promise<ServiceDetection> {
  if (!graphEngine || !graphEngine.isReady?.()) {
    return {
      hasBackend: false,
      reasoning: 'Graph engine not available for backend detection'
    }
  }

  try {
    // Query graph for API-related files
    const apiFiles = await queryGraph(graphEngine, 'API routes handlers controllers endpoints')
    const serverFiles = await queryGraph(graphEngine, 'server main index app ts js')
    const packageFiles = await queryGraph(graphEngine, 'package.json')
    
    if (apiFiles.length === 0) {
      return {
        hasBackend: false,
        reasoning: 'No API routes or server files found in knowledge graph'
      }
    }

    // Analyze found files to determine backend type
    const backendInfo = analyzeBackendFiles(apiFiles, serverFiles, packageFiles)
    
    return {
      hasBackend: true,
      backend: backendInfo,
      reasoning: `Detected ${backendInfo.framework} backend with ${apiFiles.length} API files`
    }
  } catch (error) {
    return {
      hasBackend: false,
      reasoning: `Graph analysis failed: ${error}`
    }
  }
}

/**
 * Detect frontend service using graph analysis
 */
export async function detectFrontendWithGraph(
  workspace: string,
  graphEngine: GraphEngine | null
): Promise<ServiceDetection> {
  if (!graphEngine || !graphEngine.isReady?.()) {
    return {
      hasFrontend: false,
      reasoning: 'Graph engine not available for frontend detection'
    }
  }

  try {
    // Query graph for frontend-related files
    const componentFiles = await queryGraph(graphEngine, 'React Vue Svelte components pages')
    const templateFiles = await queryGraph(graphEngine, 'template html jsx tsx vue svelte')
    const packageFiles = await queryGraph(graphEngine, 'package.json')
    
    if (componentFiles.length === 0) {
      return {
        hasFrontend: false,
        reasoning: 'No frontend components or templates found in knowledge graph'
      }
    }

    // Analyze found files to determine frontend type
    const frontendInfo = analyzeFrontendFiles(componentFiles, templateFiles, packageFiles)
    
    return {
      hasFrontend: true,
      frontend: frontendInfo,
      reasoning: `Detected ${frontendInfo.framework} frontend with ${componentFiles.length} component files`
    }
  } catch (error) {
    return {
      hasFrontend: false,
      reasoning: `Graph analysis failed: ${error}`
    }
  }
}

/**
 * Query graph for files matching semantic search
 */
async function queryGraph(graphEngine: GraphEngine, query: string): Promise<string[]> {
  try {
    // Use graph_path or graph_query to find relevant files
    // This is a simplified implementation
    const results = await graphEngine.query?.(query) || []
    return results.map((r: any) => r.file || r.path).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Analyze backend files to determine framework and configuration
 */
function analyzeBackendFiles(apiFiles: string[], serverFiles: string[], packageFiles: string[]): BackendInfo {
  // Determine framework based on file patterns
  let framework = 'express'
  let type = 'rest-api'
  
  const allFiles = [...apiFiles, ...serverFiles].join(' ')
  
  if (allFiles.includes('nest') || allFiles.includes('controller')) {
    framework = 'nestjs'
    type = 'nestjs-api'
  } else if (allFiles.includes('fastify')) {
    framework = 'fastify'
  } else if (allFiles.includes('hono')) {
    framework = 'hono'
  } else if (allFiles.includes('next') && allFiles.includes('api')) {
    framework = 'nextjs-api'
    type = 'nextjs-api-routes'
  }
  
  // Find main server file
  const mainFile = serverFiles.find(f => 
    f.includes('server') || f.includes('main') || f.includes('index') || f.includes('app')
  ) || serverFiles[0] || 'src/server.ts'
  
  // Detect Swagger
  const swaggerAvailable = allFiles.includes('swagger') || allFiles.includes('openapi')
  let swaggerPath = '/swagger'
  if (framework === 'nestjs') swaggerPath = '/api'
  else if (swaggerAvailable && allFiles.includes('api-docs')) swaggerPath = '/api-docs'
  
  return {
    type,
    framework,
    mainFile,
    startScript: 'dev',
    port: null, // Will be detected from config or env
    swaggerAvailable,
    swaggerPath
  }
}

/**
 * Analyze frontend files to determine framework and configuration
 */
function analyzeFrontendFiles(componentFiles: string[], templateFiles: string[], packageFiles: string[]): FrontendInfo {
  // Determine framework based on file patterns
  let framework = 'react'
  
  const allFiles = [...componentFiles, ...templateFiles].join(' ')
  
  if (allFiles.includes('vue') || allFiles.endsWith('.vue')) {
    framework = 'vue'
  } else if (allFiles.includes('svelte')) {
    framework = 'svelte'
  } else if (allFiles.includes('next')) {
    framework = 'nextjs'
  } else if (allFiles.includes('nuxt')) {
    framework = 'nuxt'
  } else if (allFiles.includes('astro')) {
    framework = 'astro'
  }
  
  // Find main entry file
  const mainFile = componentFiles.find(f =>
    f.includes('App') || f.includes('main') || f.includes('index')
  ) || componentFiles[0] || 'src/App.tsx'
  
  // Determine default port based on framework
  let port = 3000
  if (framework === 'vue' || framework === 'svelte' || framework === 'astro') {
    port = 5173
  }
  
  return {
    type: 'spa',
    framework,
    mainFile,
    startScript: 'dev',
    port
  }
}
