/**
 * Architecture detection for systest.
 * 
 * Analyzes the project to determine its architecture type:
 * - separated: Backend and frontend are in separate directories
 * - monolith: Single codebase with both frontend and backend
 * - ssr: Server-side rendered application (Next.js, Nuxt, etc.)
 * - static: Static site generator
 * - unknown: Cannot determine
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GraphEngine } from '../graphify/engine.js'

export interface ArchitectureDetectionResult {
  type: 'separated' | 'monolith' | 'ssr' | 'static' | 'unknown'
  confidence: number
  backendDirectory?: string
  frontendDirectory?: string
  evidence: string[]
}

/**
 * Detect the architecture of the project.
 */
export async function detectArchitecture(
  workspace: string,
  graphEngine: GraphEngine | null
): Promise<ArchitectureDetectionResult> {
  const result: ArchitectureDetectionResult = {
    type: 'unknown',
    confidence: 0,
    evidence: [],
  }

  // Method 1: Check for monorepo structure (separated architecture)
  const packageJsonPath = join(workspace, 'package.json')
  const appsApiPath = join(workspace, 'apps', 'api', 'package.json')
  const appsWebPath = join(workspace, 'apps', 'web', 'package.json')
  const packagesApiPath = join(workspace, 'packages', 'api', 'package.json')
  const packagesWebPath = join(workspace, 'packages', 'web', 'package.json')

  if (existsSync(appsApiPath) && existsSync(appsWebPath)) {
    result.type = 'separated'
    result.confidence = 0.9
    result.backendDirectory = 'apps/api'
    result.frontendDirectory = 'apps/web'
    result.evidence.push('Found apps/api and apps/web directories')
    return result
  }

  if (existsSync(packagesApiPath) && existsSync(packagesWebPath)) {
    result.type = 'separated'
    result.confidence = 0.9
    result.backendDirectory = 'packages/api'
    result.frontendDirectory = 'packages/web'
    result.evidence.push('Found packages/api and packages/web directories')
    return result
  }

  // Method 2: Use knowledge graph if available
  if (graphEngine && graphEngine.isReady?.()) {
    try {
      const graphResult = await detectFromGraph(graphEngine)
      if (graphResult.confidence > result.confidence) {
        return graphResult
      }
    } catch (error) {
      console.warn('[architectureDetector] Graph detection failed:', error)
    }
  }

  // Method 3: Analyze package.json dependencies
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const deps = packageJson.dependencies || {}
    const devDeps = packageJson.devDependencies || {}

    // Check for SSR frameworks
    if (deps.next || deps.nuxt || deps.sveltekit || deps.remix) {
      result.type = 'ssr'
      result.confidence = 0.8
      result.evidence.push('Found SSR framework: ' + Object.keys(deps).find(d => d in ['next', 'nuxt', 'sveltekit', 'remix']))
      return result
    }

    // Check for static site generators
    if (deps.gatsby || deps['@astrojs astro'] || deps.vite) {
      result.type = 'static'
      result.confidence = 0.7
      result.evidence.push('Found static site generator')
      return result
    }

    // Check for backend + frontend in same project (monolith)
    const hasBackend = Object.keys(deps).some(d => 
      d.includes('express') || d.includes('hono') || d.includes('fastify') || 
      d.includes('fastapi') || d.includes('flask') || d.includes('django')
    )
    const hasFrontend = Object.keys(deps).some(d => 
      d.includes('react') || d.includes('vue') || d.includes('svelte')
    )

    if (hasBackend && hasFrontend) {
      result.type = 'monolith'
      result.confidence = 0.6
      result.evidence.push('Found both backend and frontend dependencies in root package.json')
      return result
    }
  }

  // Method 4: Check directory structure
  const srcDir = join(workspace, 'src')
  if (existsSync(srcDir)) {
    const hasComponents = existsSync(join(srcDir, 'components'))
    const hasPages = existsSync(join(srcDir, 'pages')) || existsSync(join(srcDir, 'routes'))
    const hasApi = existsSync(join(srcDir, 'api')) || existsSync(join(workspace, 'api'))

    if (hasComponents && hasPages && !hasApi) {
      result.type = 'ssr'
      result.confidence = 0.5
      result.evidence.push('Found components and pages but no API directory')
    } else if (hasApi && (hasComponents || hasPages)) {
      result.type = 'monolith'
      result.confidence = 0.5
      result.evidence.push('Found both API and frontend directories in src/')
    }
  }

  return result
}

/**
 * Detect architecture from knowledge graph.
 */
async function detectFromGraph(graphEngine: GraphEngine): Promise<ArchitectureDetectionResult> {
  const result: ArchitectureDetectionResult = {
    type: 'unknown',
    confidence: 0,
    evidence: [],
  }

  try {
    // Query for community structure
    const communities = graphEngine.getCommunities(10)
    
    // Look for separate backend and frontend communities
    const backendCommunities = communities.filter(c => 
      c.label.toLowerCase().includes('api') || 
      c.label.toLowerCase().includes('backend') ||
      c.anchorDir?.toLowerCase().includes('api')
    )
    
    const frontendCommunities = communities.filter(c => 
      c.label.toLowerCase().includes('web') || 
      c.label.toLowerCase().includes('frontend') ||
      c.anchorDir?.toLowerCase().includes('web') ||
      c.anchorDir?.toLowerCase().includes('app')
    )

    if (backendCommunities.length > 0 && frontendCommunities.length > 0) {
      result.type = 'separated'
      result.confidence = 0.85
      result.evidence.push(`Graph analysis found ${backendCommunities.length} backend and ${frontendCommunities.length} frontend communities`)
      
      // Extract directory information
      const backendDir = backendCommunities[0].anchorDir
      const frontendDir = frontendCommunities[0].anchorDir
      
      if (backendDir) result.backendDirectory = backendDir
      if (frontendDir) result.frontendDirectory = frontendDir
      
      return result
    }

    // Check for SSR indicators (app router, pages router)
    const routeQuery = graphEngine.query('route handler page component', 'bfs', 30)
    const hasAppRouter = routeQuery.nodes.some(n => 
      n.label.includes('app') || n.source_file?.includes('app')
    )
    const hasPagesRouter = routeQuery.nodes.some(n => 
      n.label.includes('page') || n.source_file?.includes('pages')
    )

    if (hasAppRouter || hasPagesRouter) {
      result.type = 'ssr'
      result.confidence = 0.7
      result.evidence.push('Graph analysis found routing patterns indicative of SSR')
      return result
    }

    // Default to monolith if we have a mixed graph
    if (communities.length > 0) {
      result.type = 'monolith'
      result.confidence = 0.4
      result.evidence.push('Graph shows mixed communities without clear separation')
    }
  } catch (error) {
    console.warn('[architectureDetector] Graph analysis failed:', error)
  }

  return result
}