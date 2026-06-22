/**
 * Real-time Logger for Systest
 * 
 * Provides streaming log output during phase execution,
 * especially for long-running phases like 5B and 5C.
 */

import { writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface RealtimeLoggerOptions {
  outputDir: string
  phaseId: string
  phaseName: string
  enabled?: boolean
}

export class RealtimeLogger {
  private logFilePath: string
  private startTime: number
  private enabled: boolean
  
  constructor(options: RealtimeLoggerOptions) {
    this.enabled = options.enabled !== false
    this.startTime = Date.now()
    
    if (this.enabled) {
      const logsDir = join(options.outputDir, 'test-logs')
      this.logFilePath = join(logsDir, `phase_${options.phaseId}_realtime.log`)
      
      // Initialize log file with header
      this.initLog(options.phaseId, options.phaseName)
    }
  }
  
  private initLog(phaseId: string, phaseName: string): void {
    const header = `
================================================================================
                     PHASE ${phaseId}: ${phaseName}
                     Real-time Execution Log
================================================================================
Started: ${new Date().toISOString()}
Phase ID: ${phaseId}
Phase Name: ${phaseName}

--------------------------------------------------------------------------------
This log captures real-time output during phase execution.
For long-running phases (5B, 5C), this shows progress as it happens.

--------------------------------------------------------------------------------
`
    
    try {
      writeFileSync(this.logFilePath, header, 'utf-8')
    } catch (error) {
      console.error(`[RealtimeLogger] Failed to initialize log file: ${error}`)
    }
  }
  
  /**
   * Log a message with timestamp
   */
  log(message: string, category: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.enabled) return
    
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const elapsed = this.getElapsed()
    const prefix = this.getPrefix(category)
    const logEntry = `[${timestamp}] [${elapsed}] ${prefix} ${message}\n`
    
    // Write to log file
    try {
      appendFileSync(this.logFilePath, logEntry, 'utf-8')
    } catch (error) {
      console.error(`[RealtimeLogger] Failed to write log: ${error}`)
    }
    
    // Also output to console for immediate visibility
    console.log(`[Phase ${this.getPhaseId()}] ${message}`)
  }
  
  /**
   * Log a section header
   */
  section(title: string): void {
    if (!this.enabled) return
    
    const separator = '='.repeat(Math.min(title.length + 4, 80))
    const section = `
${separator}
  ${title}
${separator}
`
    
    try {
      appendFileSync(this.logFilePath, section, 'utf-8')
    } catch (error) {
      console.error(`[RealtimeLogger] Failed to write section: ${error}`)
    }
    
    console.log(`[Phase ${this.getPhaseId()}] ${title}`)
  }
  
  /**
   * Log test result
   */
  testResult(testName: string, passed: boolean, details?: string): void {
    if (!this.enabled) return
    
    const status = passed ? '✓ PASS' : '✗ FAIL'
    const message = `Test: ${testName} - ${status}`
    
    this.log(message, passed ? 'success' : 'error')
    
    if (details) {
      this.log(`  Details: ${details}`, 'info')
    }
  }
  
  /**
   * Log API request
   */
  apiRequest(method: string, url: string, statusCode?: number): void {
    if (!this.enabled) return
    
    const status = statusCode ? ` ${statusCode}` : '...'
    const message = `API: ${method} ${url} →${status}`
    
    this.log(message, statusCode ? (statusCode < 400 ? 'success' : 'error') : 'info')
  }
  
  /**
   * Log console error
   */
  consoleError(error: string): void {
    if (!this.enabled) return
    
    this.log(`Console Error: ${error}`, 'error')
  }
  
  /**
   * Log network error
   */
  networkError(url: string, error: string): void {
    if (!this.enabled) return
    
    this.log(`Network Error: ${url} - ${error}`, 'error')
  }
  
  /**
   * Log progress for long-running operations
   */
  progress(current: number, total: number, operation: string): void {
    if (!this.enabled) return
    
    const percentage = Math.round((current / total) * 100)
    const message = `Progress: ${operation} - ${current}/${total} (${percentage}%)`
    
    this.log(message, 'info')
  }
  
  /**
   * Log bug discovery
   */
  bugDiscovered(bug: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    if (!this.enabled) return
    
    const severityIcon = {
      low: '⚠',
      medium: '⚠⚠',
      high: '⚠⚠⚠',
      critical: '🚨'
    }[severity]
    
    this.log(`${severityIcon} BUG DISCOVERED: ${bug}`, 'error')
  }
  
  /**
   * Log screenshot capture
   */
  screenshot(action: string, screenshotId: string): void {
    if (!this.enabled) return
    
    this.log(`Screenshot: ${action} - ID: ${screenshotId}`, 'info')
  }
  
  /**
   * Finalize log file
   */
  finalize(summary: string): void {
    if (!this.enabled) return
    
    const footer = `
--------------------------------------------------------------------------------
Phase Completed: ${new Date().toISOString()}
Total Duration: ${this.getElapsed()}

${summary}

================================================================================
`
    
    try {
      appendFileSync(this.logFilePath, footer, 'utf-8')
    } catch (error) {
      console.error(`[RealtimeLogger] Failed to finalize log: ${error}`)
    }
  }
  
  /**
   * Get the log file path for external access
   */
  getLogPath(): string {
    return this.logFilePath
  }
  
  /**
   * Get elapsed time as formatted string
   */
  private getElapsed(): string {
    const elapsed = Date.now() - this.startTime
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${seconds}s`
    }
  }
  
  /**
   * Get prefix based on log category
   */
  private getPrefix(category: string): string {
    const prefixes = {
      info: '[INFO]',
      success: '[✓]',
      warning: '[⚠]',
      error: '[✗]'
    }
    return prefixes[category as keyof typeof prefixes] || '[INFO]'
  }
  
  /**
   * Extract phase ID from log file path
   */
  private getPhaseId(): string {
    const match = this.logFilePath.match(/phase_([^_]+)_realtime\.log/)
    return match ? match[1] : 'unknown'
  }
}

/**
 * Create a realtime logger instance
 */
export function createRealtimeLogger(options: RealtimeLoggerOptions): RealtimeLogger {
  return new RealtimeLogger(options)
}
