/**
 * Phase 6: Report Generation
 * 
 * Generates comprehensive test reports with community-based organization.
 * Runs in all modes.
 */

import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'
import { getGraphEnhancer } from '../../../services/systest/graphEnhancer.js'

export async function executePhase6(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []
  
  try {
    // Ensure output directories exist
    const docsDir = join(ctx.outputDir, 'docs')
    try { mkdirSync(docsDir, { recursive: true }) } catch {}
    
    // Load test results
    const testResults = await loadTestResults(ctx)
    
    // Get graph coverage info
    const enhancer = getGraphEnhancer()
    const coverage = enhancer.isAvailable() ? await enhancer.getCoverageReport() : []
    
    // Generate comprehensive test report
    const testReport = await generateTestReport(ctx, testResults, coverage)
    
    // Write outputs
    const reportPath = join(docsDir, 'TEST_REPORT.md')
    writeFileSync(reportPath, testReport, 'utf-8')
    outputs.push(reportPath)
    
    // Mode B: Generate requirements traceability
    if (ctx.mode === 'B') {
      const traceability = await generateTraceabilityReport(ctx)
      const tracePath = join(docsDir, 'REQUIREMENTS_TRACEABILITY.md')
      writeFileSync(tracePath, traceability, 'utf-8')
      outputs.push(tracePath)
    }
    
    // Mode C: Generate design-specific reports
    if (ctx.mode === 'C') {
      const designReview = await generateDesignReviewReport(ctx)
      const reviewPath = join(docsDir, 'DESIGN_REVIEW_REPORT.md')
      writeFileSync(reviewPath, designReview, 'utf-8')
      outputs.push(reviewPath)
    }
    
    return {
      status: 'completed',
      outputs,
      duration: Date.now() - startTime,
      graphEnhanced: enhancer.isAvailable(),
    }
  } catch (error) {
    return {
      status: 'failed',
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function loadTestResults(ctx: SystestContext): Promise<any> {
  const logsDir = join(ctx.outputDir, 'test-logs')
  
  const results: any = {
    phase5b: null,
    phase5c: null,
    phase5a: null,
  }
  
  // Load Phase 5B results
  const p5bPath = join(logsDir, 'phase5b_results.json')
  if (existsSync(p5bPath)) {
    results.phase5b = JSON.parse(readFileSync(p5bPath, 'utf-8'))
  }
  
  // Load Phase 5C results
  const p5cPath = join(logsDir, 'phase5c_results.json')
  if (existsSync(p5cPath)) {
    results.phase5c = JSON.parse(readFileSync(p5cPath, 'utf-8'))
  }
  
  // Load Phase 5A results
  const p5aPath = join(logsDir, 'test_data_seed.json')
  if (existsSync(p5aPath)) {
    results.phase5a = JSON.parse(readFileSync(p5aPath, 'utf-8'))
  }
  
  return results
}

async function generateTestReport(ctx: SystestContext, testResults: any, coverage: any[]): Promise<string> {
  const lines: string[] = []
  
  // Calculate overall stats
  const totalTests = (testResults.phase5b?.total_tests || 0) + (testResults.phase5c?.total_tests || 0)
  const totalPassed = (testResults.phase5b?.passed || 0) + (testResults.phase5c?.passed || 0)
  const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0
  
  lines.push('# System Test Report')
  lines.push('')
  
  // ===== 1. Executive Summary =====
  lines.push('## 1. Executive Summary')
  lines.push('')
  lines.push(`**Project**: ${ctx.workspace.split(/[/\\\\]/).pop() || ctx.workspace}`)
  lines.push(`**Date**: ${new Date().toISOString().split('T')[0]}`)
  lines.push(`**Mode**: ${ctx.mode}`)
  lines.push(`**Overall Pass Rate**: **${overallPassRate}%**`)
  lines.push('')
  
  // Health score bar
  const healthScore = calculateHealthScore(overallPassRate, ctx)
  lines.push(`### 🎯 Health Score`)
  lines.push('')
  const filled = Math.floor(healthScore / 5)
  const empty = 20 - filled
  lines.push(`\`${'█'.repeat(filled)}${'░'.repeat(empty)}\` **${healthScore}/100**`)
  lines.push('')
  
  // Quick stats
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Total Tests | ${totalTests} |`)
  lines.push(`| Passed | ${totalPassed} |`)
  lines.push(`| Failed | ${totalTests - totalPassed} |`)
  lines.push(`| API Tests | ${testResults.phase5b?.total_tests || 0} (${testResults.phase5b?.pass_rate || 0}%) |`)
  lines.push(`| UI Tests | ${testResults.phase5c?.total_tests || 0} (${testResults.phase5c?.pass_rate || 0}%) |`)
  lines.push(`| Duration | ${formatDuration(ctx.workflowState)} |`)
  lines.push('')
  
  // ===== 2. Module-Level Results =====
  lines.push('## 2. Module-Level Results')
  lines.push('')
  
  if (coverage.length > 0) {
    for (const module of coverage) {
      const testedRatio = module.totalNodes > 0 ? Math.round((module.testedNodes / module.totalNodes) * 100) : 0
      const symbol = testedRatio >= 80 ? '✅' : testedRatio >= 50 ? '⚠️' : '❌'
      
      lines.push(`### ${symbol} ${module.communityName}`)
      lines.push('')
      lines.push(`| Metric | Value |`)
      lines.push('|--------|-------|')
      lines.push(`| Nodes | ${module.testedNodes}/${module.totalNodes} |`)
      lines.push(`| Coverage | ${testedRatio}% |`)
      lines.push('')
    }
  } else {
    lines.push('*Module coverage data not available. Enable graph for detailed module reporting.*')
    lines.push('')
  }
  
  // ===== 3. Failure Analysis =====
  lines.push('## 3. Failure Analysis')
  lines.push('')
  
  const failures: any[] = []
  if (testResults.phase5b?.crud_results?.details) {
    for (const detail of testResults.phase5b.crud_results.details) {
      if (detail.status === 'failed') {
        failures.push({
          type: 'API',
          test: `${detail.method} ${detail.endpoint}`,
          error: detail.error || 'Unknown error',
        })
      }
    }
  }
  
  if (failures.length > 0) {
    lines.push('| ID | Test | Type | Error |')
    lines.push('|----|------|------|-------|')
    failures.forEach((f, i) => {
      lines.push(`| F-${(i + 1).toString().padStart(3, '0')} | ${f.test} | ${f.type} | ${f.error} |`)
    })
    lines.push('')
  } else {
    lines.push('No failures detected. All tests passed!')
    lines.push('')
  }
  
  // ===== 4. Coverage Report =====
  lines.push('## 4. Coverage Report')
  lines.push('')
  
  lines.push('| Layer | Tested | Pass Rate |')
  lines.push('|-------|--------|-----------|')
  lines.push(`| API Endpoints | ${testResults.phase5b?.total_tests || 0} | ${testResults.phase5b?.pass_rate || 0}% |`)
  lines.push(`| UI Components | ${testResults.phase5c?.total_tests || 0} | ${testResults.phase5c?.pass_rate || 0}% |`)
  lines.push(`| Test Data Scenarios | ${testResults.phase5a?.scenarios ? Object.keys(testResults.phase5a.scenarios).reduce((sum, key) => sum + (testResults.phase5a.scenarios[key] || []).length, 0) : 0} | - |`)
  lines.push('')
  
  // ===== 5. Action Items =====
  lines.push('## 5. Action Items')
  lines.push('')
  
  if (failures.length > 0) {
    lines.push('| Priority | Action | Estimated Effort |')
    lines.push('|----------|--------|------------------|')
    failures.forEach((f, i) => {
      const priority = i === 0 ? 'P0' : 'P1'
      lines.push(`| ${priority} | Fix ${f.test}: ${f.error} | 30m |`)
    })
    lines.push('')
  } else {
    lines.push('No action items required. All tests passed!')
    lines.push('')
  }
  
  // ===== 6. Iteration History =====
  lines.push('## 6. Iteration History')
  lines.push('')
  
  lines.push('| Iteration | Pass Rate | Improvement |')
  lines.push('|-----------|-----------|-------------|')
  
  if (testResults.phase5b?.history) {
    let prevRate = 0
    for (const h of testResults.phase5b.history) {
      lines.push(`| ${h.iteration} | ${h.pass_rate}% | ${h.pass_rate - prevRate > 0 ? '+' : ''}${(h.pass_rate - prevRate).toFixed(1)}% |`)
      prevRate = h.pass_rate
    }
  } else {
    lines.push('| 1 | - | - |')
  }
  lines.push('')
  
  return lines.join('\n')
}

async function generateTraceabilityReport(ctx: SystestContext): Promise<string> {
  const lines: string[] = []
  
  lines.push('# Requirements Traceability Matrix')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push(`**Mode**: ${ctx.mode}`)
  lines.push('')
  
  lines.push('## Overview')
  lines.push('')
  lines.push('This document traces requirements from design documents through implementation to test coverage.')
  lines.push('')
  
  // Load design spec
  const designSpecPath = join(ctx.outputDir, 'config', 'design-spec.json')
  if (existsSync(designSpecPath)) {
    const designSpec = JSON.parse(readFileSync(designSpecPath, 'utf-8'))
    lines.push(`| Category | Documented | Tested |`)
    lines.push(`|----------|------------|--------|`)
    lines.push(`| API Specifications | ${designSpec.summary?.has_api_specs ? '✓' : '✗'} | ${ctx.workflowState.phases.phase5b.status === 'completed' ? '✓' : '✗'} |`)
    lines.push(`| Database Schema | ${designSpec.summary?.has_db_specs ? '✓' : '✗'} | - |`)
    lines.push(`| Business Requirements | ${designSpec.summary?.has_business_specs ? '✓' : '✗'} | - |`)
    lines.push('')
  }
  
  return lines.join('\n')
}

async function generateDesignReviewReport(ctx: SystestContext): Promise<string> {
  const lines: string[] = []
  
  lines.push('# Design Review Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push(`**Mode**: ${ctx.mode}`)
  lines.push('')
  
  // Load design analysis
  const designAnalysisPath = join(ctx.outputDir, 'DESIGN_ANALYSIS.md')
  if (existsSync(designAnalysisPath)) {
    lines.push('## Design Analysis Summary')
    lines.push('')
    lines.push('See [DESIGN_ANALYSIS.md](DESIGN_ANALYSIS.md) for full details.')
    lines.push('')
  }
  
  return lines.join('\n')
}

function calculateHealthScore(passRate: number, ctx: SystestContext): number {
  let score = passRate
  
  // Adjust for critical phase failures
  if (ctx.workflowState.phases.phase3.status === 'failed') {
    score -= 10
  }
  if (ctx.workflowState.phases.phase5b.status === 'failed') {
    score -= 15
  }
  if (ctx.workflowState.phases.phase5c.status === 'failed') {
    score -= 10
  }
  
  return Math.max(0, Math.min(100, score))
}

function formatDuration(state: any): string {
  if (!state.started_at) return '-'
  
  const start = new Date(state.started_at).getTime()
  const end = state.updated_at ? new Date(state.updated_at).getTime() : Date.now()
  const duration = Math.round((end - start) / 60000)
  
  if (duration < 60) {
    return `${duration}m`
  }
  
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  return `${hours}h ${mins}m`
}
