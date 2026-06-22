/**
 * Project structure analyzer for systest.
 * 
 * Reads project configuration files to understand the project structure
 * and determine which services are present.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ProjectStructure {
  projectType: 'monorepo' | 'single-package' | 'unknown'
  packageManager: 'npm' | 'bun' | 'yarn' | 'pnpm' | 'python' | 'unknown'
  backend?: {
    directory: string
    framework: string
    language: string
    runtime: string
    port: number
  }
  frontend?: {
    directory: string
    framework: string
    language: string
    bundler: string
    port: number
  }
  database?: {
    type: string
    connectionString?: string
  }
}

/**
 * Get project structure from workspace.
 */
export async function getProjectStructureJson(workspace: string): Promise<ProjectStructure> {
  const structure: ProjectStructure = {
    projectType: 'unknown',
    packageManager: 'unknown',
  }
  
  const packageJsonPath = join(workspace, 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    return structure
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Detect package manager
  if (existsSync(join(workspace, 'bun.lockb'))) {
    structure.packageManager = 'bun'
  } else if (existsSync(join(workspace, 'yarn.lock'))) {
    structure.packageManager = 'yarn'
  } else if (existsSync(join(workspace, 'pnpm-lock.yaml'))) {
    structure.packageManager = 'pnpm'
  } else if (existsSync(join(workspace, 'package-lock.json'))) {
    structure.packageManager = 'npm'
  }
  
  // Detect project type
  const workspaces = packageJson.workspaces
  structure.projectType = workspaces && workspaces.length > 0 ? 'monorepo' : 'single-package'
  
  // Detect backend
  const backend = detectBackend(workspace, packageJson)
  if (backend.detected) {
    structure.backend = backend.info
  }
  
  // Detect frontend
  const frontend = detectFrontend(workspace, packageJson)
  if (frontend.detected) {
    structure.frontend = frontend.info
  }
  
  // Detect database
  const database = detectDatabase(workspace)
  if (database.detected) {
    structure.database = database.info
  }
  
  return structure
}

interface DetectionResult<T> {
  detected: boolean
  info: T
}

function detectBackend(workspace: string, packageJson: any): DetectionResult<any> {
  const deps = packageJson.dependencies || {}
  
  // Backend framework detection
  const frameworks: Record<string, { info: any }> = {
    hono: {
      info: {
        framework: 'hono',
        language: 'typescript',
        runtime: 'bun',
        port: 3000,
        directory: 'apps/api',
      },
    },
    express: {
      info: {
        framework: 'express',
        language: 'javascript',
        runtime: 'node',
        port: 3000,
        directory: '.',
      },
    },
    '@hono/nodejs': {
      info: {
        framework: 'hono',
        language: 'typescript',
        runtime: 'node',
        port: 3000,
        directory: '.',
      },
    },
    fastify: {
      info: {
        framework: 'fastify',
        language: 'javascript',
        runtime: 'node',
        port: 3000,
        directory: '.',
      },
    },
  }
  
  for (const [dep, config] of Object.entries(frameworks)) {
    if (deps[dep]) {
      return { detected: true, info: config.info }
    }
  }
  
  return { detected: false, info: null }
}

function detectFrontend(workspace: string, packageJson: any): DetectionResult<any> {
  const deps = packageJson.dependencies || {}
  
  const frameworks: Record<string, { info: any }> = {
    'react': {
      info: {
        framework: 'react',
        language: 'typescript',
        bundler: 'vite',
        port: 5173,
        directory: 'apps/web',
      },
    },
    next: {
      info: {
        framework: 'next',
        language: 'typescript',
        bundler: 'next',
        port: 3000,
        directory: 'apps/web',
      },
    },
    'vite': {
      info: {
        framework: 'vite',
        language: 'typescript',
        bundler: 'vite',
        port: 5173,
        directory: 'apps/web',
      },
    },
  }
  
  for (const [dep, config] of Object.entries(frameworks)) {
    if (deps[dep] || deps[`${dep}*`]) {
      return { detected: true, info: config.info }
    }
  }
  
  return { detected: false, info: null }
}

function detectDatabase(workspace: string): DetectionResult<any> {
  // Check for database indicators
  const dbIndicators = [
    { file: 'drizzle.config.ts', type: 'Drizzle ORM' },
    { file: 'schema.prisma', type: 'Prisma ORM' },
    { file: 'docker-compose.yml', type: 'Docker Compose' },
    { file: 'docker-compose.yaml', type: 'Docker Compose' },
    { file: '.env', type: 'Environment Configured' },
  ]
  
  for (const indicator of dbIndicators) {
    const filePath = join(workspace, indicator.file)
    if (existsSync(filePath)) {
      return { detected: true, info: { type: indicator.type } }
    }
  }
  
  return { detected: false, info: null }
}
