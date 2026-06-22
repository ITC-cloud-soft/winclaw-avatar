/**
 * Mode detection for systest.
 * 
 * Automatically determines the test mode (A, B, or C) based on available
 * workspace and design documentation.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type TestMode = 'A' | 'B' | 'C'

export interface ModeDetectionResult {
  mode: TestMode
  workspace: string
  designDocsDir?: string
  reason: string
}

/**
 * Detect the appropriate test mode based on available resources.
 */
export function detectMode(
  workspace?: string,
  designDocs?: string
): ModeDetectionResult {
  // Explicit mode selection via both parameters
  if (workspace && designDocs) {
    return {
      mode: 'B',
      workspace,
      designDocsDir: designDocs,
      reason: 'Explicit: workspace + design docs provided → Mode B (Source Code + Design Documents)',
    }
  }
  
  if (workspace) {
    // Check for docs/ subdirectory in workspace
    const docsDir = join(workspace, 'docs')
    if (existsSync(docsDir) && hasMarkdownFiles(docsDir)) {
      return {
        mode: 'B',
        workspace,
        designDocsDir: docsDir,
        reason: 'Auto-detected: workspace contains docs/ directory with markdown files → Mode B',
      }
    }
    
    return {
      mode: 'A',
      workspace,
      reason: 'Explicit: workspace provided only → Mode A (Source Code only)',
    }
  }
  
  if (designDocs) {
    return {
      mode: 'C',
      workspace: process.cwd(),
      designDocsDir: designDocs,
      reason: 'Explicit: design docs provided only → Mode C (Design Documents only)',
    }
  }
  
  // No explicit parameters - try to detect from current directory
  const cwd = process.cwd()
  const docsDir = join(cwd, 'docs')
  
  if (existsSync(docsDir) && hasMarkdownFiles(docsDir)) {
    return {
      mode: 'B',
      workspace: cwd,
      designDocsDir: docsDir,
      reason: 'Auto-detected: current directory has docs/ → Mode B',
    }
  }
  
  // Check if current directory looks like a code project
  if (looksLikeCodeProject(cwd)) {
    return {
      mode: 'A',
      workspace: cwd,
      reason: 'Auto-detected: current directory looks like a code project → Mode A',
    }
  }
  
  return {
    mode: 'A',
    workspace: cwd,
    reason: 'Default: using current directory as workspace → Mode A',
  }
}

/**
 * Check if a directory contains markdown files.
 */
function hasMarkdownFiles(dir: string): boolean {
  try {
    const files = readdirSync(dir)
    return files.some(f => f.endsWith('.md') || f.endsWith('.markdown'))
  } catch {
    return false
  }
}

/**
 * Check if a directory looks like a code project.
 */
function looksLikeCodeProject(dir: string): boolean {
  try {
    const files = readdirSync(dir)
    
    // Check for common code project indicators
    const indicators = [
      'package.json',
      'tsconfig.json',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'requirements.txt',
      'Gemfile',
      'composer.json',
      'src',
      'app',
      'lib',
    ]
    
    return indicators.some(indicator => {
      if (files.includes(indicator)) return true
      // Check subdirectories
      try {
        return existsSync(join(dir, indicator))
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

/**
 * Validate mode-specific requirements.
 */
export function validateModeRequirements(
  result: ModeDetectionResult
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (result.mode === 'A' || result.mode === 'B') {
    if (!existsSync(result.workspace)) {
      errors.push(`Workspace directory does not exist: ${result.workspace}`)
    }
  }
  
  if (result.mode === 'B' || result.mode === 'C') {
    if (result.designDocsDir && !existsSync(result.designDocsDir)) {
      errors.push(`Design docs directory does not exist: ${result.designDocsDir}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get mode description for display.
 */
export function getModeDescription(mode: TestMode): string {
  const descriptions: Record<TestMode, string> = {
    A: 'Mode A: Source Code Only — Code analysis, API/UI testing, implementation verification',
    B: 'Mode B: Source Code + Design Documents — Full testing with design-implementation gap analysis',
    C: 'Mode C: Design Documents Only — Design review, test planning, effort estimation',
  }
  return descriptions[mode]
}
