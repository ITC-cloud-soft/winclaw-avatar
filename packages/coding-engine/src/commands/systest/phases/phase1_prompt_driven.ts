/**
 * Phase 1: Design Document Analysis (Simplified Implementation)
 * 
 * Uses Meta Coder's built-in graph functionality for semantic analysis
 */

import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'

/**
 * Execute Phase 1: Design Document Analysis
 */
export async function executePhase1(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  console.log('[Phase 1] ================================================')
  console.log('[Phase 1] Phase 1: Design Document Analysis')
  console.log('[Phase 1] ================================================')
  console.log('[Phase 1]')

  const logsDir = join(ctx.outputDir, 'config')
  try { mkdirSync(logsDir, { recursive: true }) } catch {}

  try {
    // Step 1: Scan design documents
    console.log('[Phase 1] Step 1: Scanning design documents...')
    const designDocs = await scanDesignDocuments(ctx)
    console.log('[Phase 1]   Found', designDocs.length, 'documents')

    // Step 2: Extract structured information
    console.log('[Phase 1] Step 2: Extracting structured information...')
    const analysis = await extractDesignInfo(designDocs, ctx)
    
    // Step 3: Save results
    const outputPath = join(logsDir, 'design-analysis.json')
    writeFileSync(outputPath, JSON.stringify(analysis, null, 2), 'utf-8')
    outputs.push(outputPath)
    
    console.log('[Phase 1] ================================================')
    console.log('[Phase 1] Phase 1 Complete!')
    console.log('[Phase 1]   Documents analyzed:', analysis.totalDocuments)
    console.log('[Phase 1]   APIs found:', analysis.apiSpecifications?.length || 0)
    console.log('[Phase 1]   Entities found:', analysis.entityDefinitions?.length || 0)
    console.log('[Phase 1]   Output:', outputPath)
    console.log('[Phase 1] ================================================')

    return {
      status: 'completed',
      outputs,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[Phase 1] Error:', error)
    return {
      status: 'failed',
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Scan design documents directory
 */
async function scanDesignDocuments(ctx: SystestContext): Promise<string[]> {
  const docs: string[] = []
  const designDocsDir = ctx.designDocsDir

  if (!designDocsDir || !existsSync(designDocsDir)) {
    console.warn('[Phase 1] Design docs directory not found:', designDocsDir)
    return docs
  }

  const fs = await import('node:fs')
  const path = await import('node:path')

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.isFile() && /\.(md|txt|json|pdf)$/i.test(entry.name)) {
        docs.push(fullPath)
      }
    }
  }

  scanDir(designDocsDir)
  return docs
}

/**
 * Extract structured information from design documents
 */
async function extractDesignInfo(documents: string[], ctx: SystestContext): Promise<any> {
  const analysis = {
    totalDocuments: documents.length,
    documentTypes: {} as Record<string, number>,
    apiSpecifications: [] as any[],
    entityDefinitions: [] as any[],
    businessRules: [] as any[],
    screenSpecifications: [] as any[],
    qualityIssues: [] as any[]
  }

  for (const docPath of documents) {
    try {
      const content = readFileSync(docPath, 'utf-8')
      const ext = docPath.split('.').pop()?.toLowerCase() || 'unknown'
      
      analysis.documentTypes[ext] = (analysis.documentTypes[ext] || 0) + 1

      // Extract based on file type
      if (ext === 'json') {
        try {
          const json = JSON.parse(content)
          if (json.openapi || json.swagger) {
            // OpenAPI/Swagger spec
            analysis.apiSpecifications.push(...extractOpenApiSpec(json, docPath))
          }
        } catch {}
      }

      // Simple text extraction for markdown/txt
      if (/\.(md|txt)$/i.test(docPath)) {
        extractFromText(content, docPath, analysis)
      }
    } catch (error) {
      console.warn('[Phase 1] Failed to read:', docPath)
    }
  }

  return analysis
}

/**
 * Extract OpenAPI specification
 */
function extractOpenApiSpec(json: any, source: string): any[] {
  const specs: any[] = []
  const paths = json.paths || {}

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, spec] of Object.entries(methods as any)) {
      specs.push({
        endpoint: `${method.toUpperCase()} ${path}`,
        description: (spec as any).summary || (spec as any).description || '',
        source,
        tags: (spec as any).tags || []
      })
    }
  }

  return specs
}

/**
 * Extract information from text files
 */
function extractFromText(content: string, source: string, analysis: any): void {
  const lines = content.split('\n')

  // Extract API endpoints
  const apiPattern = /(GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]+/g
  const matches = content.match(apiPattern)
  if (matches) {
    for (const match of matches) {
      const parts = match.split(' ')
      analysis.apiSpecifications.push({
        endpoint: match,
        source
      })
    }
  }

  // Extract entities (simple heuristic)
  const entityPattern = /(?:entity|model|table):\s*(\w+)/gi
  for (const line of lines) {
    const match = entityPattern.exec(line)
    if (match) {
      analysis.entityDefinitions.push({
        name: match[1],
        source
      })
    }
  }

  // Extract business rules
  const rulePattern = /(?:rule|requirement|constraint):\s*(.+)/gi
  for (const line of lines) {
    const match = rulePattern.exec(line)
    if (match) {
      analysis.businessRules.push({
        description: match[1].trim(),
        source
      })
    }
  }
}