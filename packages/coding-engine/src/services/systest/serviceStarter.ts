/**
 * Service detection and startup helper for systest.
 * 
 * Analyzes the project to detect required services and handles
 * automatic service startup with process management.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export interface ServiceRequirement {
  type: 'backend' | 'frontend' | 'database' | 'other'
  description: string
  detected: boolean
  directory?: string
  evidence?: string
  suggestedAction?: string
}

export interface ServiceStartupResult {
  backend?: { url: string; pid: number; startCommand: string; port: number }
  frontend?: { url: string; pid: number; startCommand: string; port: number }
  database?: { url: string; type: string }
}

export interface ArchitectureType {
  type: 'separated' | 'monolith' | 'ssr' | 'static' | 'unknown'
}

// Track started processes for cleanup
const startedProcesses: Map<number, { type: string; command: string }> = new Map()

/**
 * Detect services in the project that may need startup.
 */
export function detectServiceRequirements(workspace: string): ServiceRequirement[] {
  const requirements: ServiceRequirement[] = []
  
  // Check for package.json to understand the project
  const packageJsonPath = join(workspace, 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    return [{
      type: 'other',
      description: 'Check if project exists',
      detected: false,
      suggestedAction: 'Verify the workspace path',
    }]
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  const deps = packageJson.dependencies || {}
  
  // Detect backend
  const backendPatterns = [
    { deps: ['hono', '@hono/nodejs', 'express', 'fastify'], framework: 'Hono/Express', dir: 'apps/api', port: 3000 },
    { deps: ['fastapi', 'flask', 'django'], framework: 'FastAPI/Flask/Django', dir: '.', port: 8000 },
  ]
  
  for (const pattern of backendPatterns) {
    if (pattern.deps.some(d => deps[d] || Object.keys(deps).some(k => k.includes(d)))) {
      requirements.push({
        type: 'backend',
        description: pattern.framework + ' backend detected in ' + (pattern.dir || 'root'),
        detected: true,
        directory: pattern.dir,
        evidence: 'Found dependencies: ' + pattern.deps.filter(d => deps[d] || Object.keys(deps).some(k => k.includes(d))).join(', '),
        suggestedAction: 'Start with: cd ' + (pattern.dir || '.') + ' && npm install && npm run dev',
      })
      break
    }
  }
  
  // Detect frontend
  const frontendPatterns = [
    { deps: ['react', 'next', 'vite'], framework: 'React/Next/Vite', dir: 'apps/web', port: 5173 },
  ]
  
  for (const pattern of frontendPatterns) {
    if (pattern.deps.some(d => deps[d] || Object.keys(deps).some(k => k.includes(d)))) {
      requirements.push({
        type: 'frontend',
        description: pattern.framework + ' frontend detected in ' + (pattern.dir || 'root'),
        detected: true,
        directory: pattern.dir,
        evidence: 'Found dependencies: ' + pattern.deps.filter(d => deps[d] || Object.keys(deps).some(k => k.includes(d))).join(', '),
        suggestedAction: 'Start with: cd ' + (pattern.dir || '.') + ' && npm install && npm run dev',
      })
      break
    }
  }
  
  // Detect database
  const dbEvidence: string[] = []
  
  if (existsSync(join(workspace, 'docker-compose.yml'))) {
    dbEvidence.push('Found docker-compose.yml - check if it includes database services')
  }
  
  if (existsSync(join(workspace, 'drizzle.config.ts'))) {
    dbEvidence.push('Found drizzle.config.ts - database: Drizzle ORM')
  }
  
  if (existsSync(join(workspace, 'schema.prisma'))) {
    dbEvidence.push('Found schema.prisma - database: Prisma ORM')
  }
  
  if (dbEvidence.length > 0) {
    requirements.push({
      type: 'database',
      description: 'Database service detected',
      detected: true,
      evidence: dbEvidence.join('; '),
      suggestedAction: 'Check if database is running. May need to start with: docker-compose up, or run migrations',
    })
  }
  
  // Check if .env exists for database connection
  const envPath = join(workspace, '.env')
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf-8')
    if (env.includes('DATABASE') || env.includes('DB_')) {
      requirements.push({
        type: 'database',
        description: 'Database connection configured in .env',
        detected: true,
        suggestedAction: 'Verify database is accessible',
      })
    }
  }
  
  return requirements
}

/**
 * Prepare and start services for testing based on architecture.
 */
export async function prepareServicesForTesting(
  workspace: string,
  architecture: ArchitectureType
): Promise<ServiceStartupResult> {
  const result: ServiceStartupResult = {}
  
  try {
    switch (architecture.type) {
      case 'separated':
        // Start both backend and frontend
        result.backend = await startBackendService(workspace)
        result.frontend = await startFrontendService(workspace)
        break
        
      case 'monolith':
        // Start backend only
        result.backend = await startBackendService(workspace)
        break
        
      case 'ssr':
      case 'static':
        // Start frontend only
        result.frontend = await startFrontendService(workspace)
        break
        
      default:
        // Unknown architecture - try to detect and start
        const requirements = detectServiceRequirements(workspace)
        for (const req of requirements) {
          if (req.type === 'backend' && req.detected) {
            result.backend = await startBackendService(workspace, req.directory)
          }
          if (req.type === 'frontend' && req.detected) {
            result.frontend = await startFrontendService(workspace, req.directory)
          }
        }
    }
    
    // Check for database
    result.database = await detectDatabase(workspace)
    
    return result
  } catch (error) {
    console.error('[ServiceStarter] Error starting services:', error)
    // Cleanup any started processes
    await cleanupStartedProcesses()
    throw error
  }
}

/**
 * Start backend service.
 */
async function startBackendService(
  workspace: string,
  directory?: string
): Promise<{ url: string; pid: number; startCommand: string; port: number }> {
  const workDir = directory ? join(workspace, directory) : workspace
  const port = 3000
  
  // Check if service is already running
  if (await isServiceRunning('http://localhost:' + port)) {
    console.log('[ServiceStarter] Backend already running on port ' + port)
    return { url: 'http://localhost:' + port, pid: 0, startCommand: 'already running', port }
  }
  
  // Start the service
  const startCommand = 'npm run dev'
  console.log('[ServiceStarter] Starting backend: ' + startCommand + ' in ' + workDir)
  
  const process = spawn('npm', ['run', 'dev'], {
    cwd: workDir,
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
  
  // Track for cleanup
  startedProcesses.set(process.pid, { type: 'backend', command: startCommand })
  
  // Wait for service to be ready
  await waitForServiceReady('http://localhost:' + port, 30000)
  
  return { url: 'http://localhost:' + port, pid: process.pid, startCommand, port }
}

/**
 * Start frontend service.
 */
async function startFrontendService(
  workspace: string,
  directory?: string
): Promise<{ url: string; pid: number; startCommand: string; port: number }> {
  const workDir = directory ? join(workspace, directory) : workspace
  const port = 5173
  
  // Check if service is already running
  if (await isServiceRunning('http://localhost:' + port)) {
    console.log('[ServiceStarter] Frontend already running on port ' + port)
    return { url: 'http://localhost:' + port, pid: 0, startCommand: 'already running', port }
  }
  
  // Start the service
  const startCommand = 'npm run dev'
  console.log('[ServiceStarter] Starting frontend: ' + startCommand + ' in ' + workDir)
  
  const process = spawn('npm', ['run', 'dev'], {
    cwd: workDir,
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
  
  // Track for cleanup
  startedProcesses.set(process.pid, { type: 'frontend', command: startCommand })
  
  // Wait for service to be ready
  await waitForServiceReady('http://localhost:' + port, 30000)
  
  return { url: 'http://localhost:' + port, pid: process.pid, startCommand, port }
}

/**
 * Detect database configuration.
 */
async function detectDatabase(workspace: string): Promise<{ url: string; type: string } | undefined> {
  const envPath = join(workspace, '.env')
  
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf-8')
    
    // Look for DATABASE_URL or DB_* variables
    const dbUrlMatch = env.match(/DATABASE_URL=([^\n\r]+)/)
    if (dbUrlMatch) {
      return { url: dbUrlMatch[1].trim(), type: 'database-url' }
    }
    
    // Look for individual DB variables
    const dbHost = env.match(/DB_HOST=([^\n\r]+)/)
    const dbPort = env.match(/DB_PORT=([^\n\r]+)/)
    const dbName = env.match(/DB_NAME=([^\n\r]+)/)
    
    if (dbHost || dbPort || dbName) {
      const host = dbHost ? dbHost[1].trim() : 'localhost'
      const port = dbPort ? dbPort[1].trim() : '5432'
      const name = dbName ? dbName[1].trim() : 'postgres'
      return { url: 'postgresql://' + host + ':' + port + '/' + name, type: 'postgres' }
    }
  }
  
  // Check for drizzle or prisma config
  if (existsSync(join(workspace, 'drizzle.config.ts'))) {
    return { url: 'file:./local.db', type: 'sqlite-drizzle' }
  }
  
  if (existsSync(join(workspace, 'schema.prisma'))) {
    return { url: 'file:./dev.db', type: 'sqlite-prisma' }
  }
  
  return undefined
}

/**
 * Check if a service is already running.
 */
async function isServiceRunning(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    
    const response = await fetch(url, { 
      signal: controller.signal,
      method: 'HEAD'
    })
    
    clearTimeout(timeout)
    return true
  } catch {
    return false
  }
}

/**
 * Wait for a service to be ready.
 */
async function waitForServiceReady(url: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isServiceRunning(url)) {
      console.log('[ServiceStarter] Service ready: ' + url)
      return
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  throw new Error('Service did not become ready within timeout: ' + url)
}

/**
 * Cleanup started processes.
 */
export async function cleanupStartedProcesses(): Promise<void> {
  console.log('[ServiceStarter] Cleaning up ' + startedProcesses.size + ' started processes')
  
  for (const [pid, info] of startedProcesses) {
    try {
      process.kill(-pid, 'SIGTERM')
      console.log('[ServiceStarter] Killed process ' + pid + ' (' + info.type + ')')
    } catch (error) {
      // Process may have already exited
    }
  }
  
  startedProcesses.clear()
}

/**
 * Generate prompt for AI to handle service startup (fallback).
 */
export function generateServicePrompt(requirements: ServiceRequirement[]): string {
  const lines: string[] = []
  
  lines.push('')
  lines.push('=== Service Startup Required ===')
  lines.push('')
  lines.push('The following services need to be started before testing can proceed:')
  lines.push('')
  
  for (const req of requirements) {
    lines.push('## ' + req.type.toUpperCase())
    lines.push('**Description**: ' + req.description)
    if (req.evidence) {
      lines.push('**Evidence**: ' + req.evidence)
    }
    if (req.suggestedAction) {
      lines.push('**Suggested Action**: ' + req.suggestedAction)
    }
    lines.push('')
  }
  
  lines.push('Please:')
  lines.push('1. Start the required services in separate terminals')
  lines.push('2. Wait for services to be ready (check for \"server listening on port XXXX\" messages)')
  lines.push('3. Then run: /systest resume')
  lines.push('')
  
  return lines.join('\n')
}
