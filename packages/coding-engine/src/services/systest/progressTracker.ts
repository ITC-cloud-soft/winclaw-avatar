/**
 * Progress Display Utility
 * 
 * Provides progress bar and status display for systest phases.
 * Optimized for large-scale projects (100K+ files).
 */

export interface ProgressOptions {
  prefix?: string          // Prefix text (e.g., '[Phase 5B]')
  total: number            // Total items to process
  width?: number           // Bar width (default: 20)
  showCount?: boolean      // Show count (e.g., 100/500)
  showPercent?: boolean    // Show percentage (e.g., 80%)
  updateInterval?: number  // Minimum ms between updates (default: 100)
}

export class ProgressTracker {
  private current: number = 0
  private lastUpdate: number = 0
  private startTime: number = 0
  private options: Required<ProgressOptions>

  constructor(options: ProgressOptions) {
    this.options = {
      prefix: options.prefix || '',
      total: options.total,
      width: options.width || 20,
      showCount: options.showCount !== false,
      showPercent: options.showPercent !== false,
      updateInterval: options.updateInterval || 100,
    }
    this.startTime = Date.now()
  }

  /**
   * Update progress display
   */
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.options.total)
    const now = Date.now()

    // Throttle updates to avoid excessive console output
    if (now - this.lastUpdate < this.options.updateInterval && this.current < this.options.total) {
      return
    }
    this.lastUpdate = now

    const percent = Math.floor((this.current / this.options.total) * 100)
    const filled = Math.floor((percent / 100) * this.options.width)
    const empty = this.options.width - filled

    // Build progress bar
    const bar = '█'.repeat(filled) + '░'.repeat(empty)

    // Build output
    let output = this.options.prefix

    if (this.options.prefix && !this.options.prefix.endsWith(' ')) {
      output += ' '
    }

    output += `[${bar}]`

    if (this.options.showPercent) {
      output += ` ${percent}%`
    }

    if (this.options.showCount) {
      output += ` (${this.current}/${this.options.total})`
    }

    if (message) {
      output += ` - ${message}`
    }

    // Print with carriage return to overwrite previous line
    process.stdout.write('\r' + output)

    // New line when complete
    if (this.current >= this.options.total) {
      process.stdout.write('\n')
      const elapsed = Date.now() - this.startTime
      console.log(`${this.options.prefix} Completed in ${(elapsed / 1000).toFixed(1)}s`)
    }
  }

  /**
   * Increment progress by 1
   */
  increment(message?: string): void {
    this.update(this.current + 1, message)
  }

  /**
   * Get current progress as percentage
   */
  getPercent(): number {
    return Math.floor((this.current / this.options.total) * 100)
  }

  /**
   * Check if complete
   */
  isComplete(): boolean {
    return this.current >= this.options.total
  }

  /**
   * Complete the progress display
   */
  complete(message?: string): void {
    this.update(this.options.total, message || 'Complete')
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.current = 0
    this.lastUpdate = 0
    this.startTime = Date.now()
  }
}

/**
 * Simple step-by-step progress for multi-stage operations
 */
export class StepProgress {
  private steps: string[]
  private current: number = 0

  constructor(steps: string[]) {
    this.steps = steps
  }

  /**
   * Start next step
   */
  next(message?: string): void {
    if (this.current > 0) {
      console.log('  ✓ ' + (message || this.steps[this.current - 1]))
    }
    this.current++
    if (this.current <= this.steps.length) {
      console.log((this.current > 1 ? '\n' : '') + `[${this.current}/${this.steps.length}] ` + this.steps[this.current - 1])
    }
  }

  /**
   * Complete all steps
   */
  complete(): void {
    if (this.current > 0 && this.current <= this.steps.length) {
      console.log('  ✓ ' + this.steps[this.current - 1])
    }
    console.log('\nAll steps completed!')
  }
}

/**
 * Lightweight progress logging for large batches
 */
export class BatchProgressLogger {
  private logInterval: number
  private lastLog: number = 0
  private prefix: string

  constructor(prefix: string, logInterval: number = 100) {
    this.prefix = prefix
    this.logInterval = logInterval
  }

  /**
   * Log progress at intervals
   */
  log(current: number, total: number, message?: string): void {
    if (current % this.logInterval === 0 || current === total) {
      const percent = Math.floor((current / total) * 100)
      console.log(`${this.prefix} ${current}/${total} (${percent}%)${message ? ' - ' + message : ''}`)
    }
  }
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Create a progress tracker for a systest phase
 */
export function createPhaseProgress(phaseName: string, total: number): ProgressTracker {
  return new ProgressTracker({
    prefix: `[Phase ${phaseName}]`,
    total,
    width: 20,
    showCount: true,
    showPercent: true,
    updateInterval: 100,
  })
}
