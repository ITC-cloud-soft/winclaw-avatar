/**
 * Streaming Output Helper for Systest
 * 
 * Enables real-time output during phase execution by capturing
 * and streaming console.log output immediately.
 */

import { writeFileSync, appendFileSync, openSync, closeSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface StreamingOutputOptions {
  outputDir: string
  phaseId: string
  phaseName: string
  enabled?: boolean
}

class StreamingOutputHelper {
  private outputFilePath: string!
  private consoleLogFilePath: string!
  private startTime: number
  private enabled: boolean
  private originalConsoleLog: typeof console.log!
  private originalConsoleError: typeof console.error!
  private originalConsoleWarn: typeof console.warn!
  
  constructor(options: StreamingOutputOptions) {
    this.enabled = options.enabled !== false
    this.startTime = Date.now()
    
    if (this.enabled) {
      const logsDir = join(options.outputDir, 'test-logs')
      this.outputFilePath = join(logsDir, `phase_${options.phaseId}_streaming.txt`)
      this.consoleLogFilePath = join(logsDir, `phase_${options.phaseId}_console.log`)
      
      this.initStreamingOutput(options.phaseId, options.phaseName)
      this.interceptConsole()
    }
  }
  
  private initStreamingOutput(phaseId: string, phaseName: string): void {
    const header = `
================================================================================
                    PHASE ${phaseId}: ${phaseName}
                    Real-time Streaming Output
================================================================================
Started: ${new Date().toISOString()}
Phase ID: ${phaseId}
Phase Name: ${phaseName}

--------------------------------------------------------------------------------
This file captures ALL output during phase execution in real-time.
For long-running phases (5B, 5C), this shows progress as it happens.

Last updated: ${new Date().toISOString()}

--------------------------------------------------------------------------------
`
    
    try {
      writeFileSync(this.outputFilePath, header, 'utf-8')
      writeFileSync(this.consoleLogFilePath, `Console log for Phase ${phaseId}: ${phaseName}\n\n`, 'utf-8')
    } catch (error) {
      console.error('[StreamingOutput] Failed to initialize:', error)
    }
  }
  
  private interceptConsole(): void {
    if (!this.enabled) return

    // Save original console methods
    this.originalConsoleLog = console.log.bind(console)
    this.originalConsoleError = console.error.bind(console)
    this.originalConsoleWarn = console.warn.bind(console)
    
    const self = this
    
    // Intercept console.log
    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
      const logEntry = `[${timestamp}] [LOG] ${message}\n`
      
      try {
        appendFileSync(self.consoleLogFilePath, logEntry, 'utf-8')
        appendFileSync(self.outputFilePath, logEntry, 'utf-8')
      } catch (error) {
        // Ignore write errors
      }
      
      // Call original console.log
      self.originalConsoleLog(...args)
    }
    
    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
      const logEntry = `[${timestamp}] [ERROR] ${message}\n`
      
      try {
        appendFileSync(self.consoleLogFilePath, logEntry, 'utf-8')
        appendFileSync(self.outputFilePath, logEntry, 'utf-8')
      } catch (error) {
        // Ignore write errors
      }
      
      // Call original console.error
      self.originalConsoleError(...args)
    }
    
    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
      const logEntry = `[${timestamp}] [WARN] ${message}\n`
      
      try {
        appendFileSync(self.consoleLogFilePath, logEntry, 'utf-8')
        appendFileSync(self.outputFilePath, logEntry, 'utf-8')
      } catch (error) {
        // Ignore write errors
      }
      
      // Call original console.warn
      self.originalConsoleWarn(...args)
    }
  }
  
  /**
   * Restore original console methods
   */
  restoreConsole(): void {
    if (!this.enabled) return

    console.log = this.originalConsoleLog
    console.error = this.originalConsoleError
    console.warn = this.originalConsoleWarn
  }
  
  /**
   * Finalize streaming output
   */
  finalize(summary: string): void {
    if (!this.enabled) return

    this.restoreConsole()

    const elapsed = Math.round((Date.now() - this.startTime) / 1000)
    const footer = `

--------------------------------------------------------------------------------
Phase Completed: ${new Date().toISOString()}
Total Duration: ${elapsed}s

Summary:
${summary}

================================================================================
`
    
    try {
      appendFileSync(this.outputFilePath, footer, 'utf-8')
    } catch (error) {
      console.error('[StreamingOutput] Failed to finalize:', error)
    }
  }
  
  /**
   * Get the streaming output file path
   */
  getOutputPath(): string {
    return this.outputFilePath
  }
  
  /**
   * Get the console log file path
   */
  getConsoleLogPath(): string {
    return this.consoleLogFilePath
  }
  
  /**
   * Write a progress update
   */
  progress(message: string): void {
    if (!this.enabled) return

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const elapsed = Math.round((Date.now() - this.startTime) / 1000)
    const progressEntry = `[${timestamp}] [PROGRESS] [${elapsed}s] ${message}\n`

    try {
      appendFileSync(this.outputFilePath, progressEntry, 'utf-8')
    } catch (error) {
      console.error('[StreamingOutput] Failed to write progress:', error)
    }
  }
}

/**
 * Create a streaming output helper
 */
export function createStreamingOutput(options: StreamingOutputOptions): StreamingOutputHelper {
  return new StreamingOutputHelper(options)
}

/**
 * Execute a phase with streaming output
 */
export async function executePhaseWithStreaming<T>(
  phaseId: string,
  phaseName: string,
  outputDir: string,
  phaseFunction: () => Promise<T>
): Promise<T> {
  const streaming = createStreamingOutput({
    outputDir,
    phaseId,
    phaseName,
    enabled: true
  })
  
  try {
    console.log(`[${phaseId}] Starting phase execution...`)
    const result = await phaseFunction()
    console.log(`[${phaseId}] Phase execution completed successfully.`)

    const elapsed = Math.round((Date.now() - streaming['startTime']) / 1000)
    streaming.finalize(`Status: ✓ SUCCESS
Duration: ${elapsed}s
Output: ${streaming.getOutputPath()}
Console Log: ${streaming.getConsoleLogPath()}`
    )
    
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[${phaseId}] Phase execution failed:`, errorMsg)

    const elapsed = Math.round((Date.now() - streaming['startTime']) / 1000)
    streaming.finalize(`Status: ✗ FAILED
Duration: ${elapsed}s
Error: ${errorMsg}`
    )
    
    throw error
  }
}

