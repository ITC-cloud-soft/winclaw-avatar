/**
 * Phase Progress Tracker
 * 
 * Provides real-time progress updates for long-running phases (5B, 5C)
 * with live updates that can be queried asynchronously.
 */

export interface PhaseProgress {
  phaseId: string
  phaseName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: number
  elapsed?: number
  currentStep?: string
  totalSteps?: number
  completedSteps?: number
  percentage?: number
  details?: string[]
  errors?: string[]
}

class PhaseProgressTracker {
  private progress: Map<string, PhaseProgress> = new Map()
  private listeners: Set<(progress: PhaseProgress) => void> = new Set()

  /**
   * Initialize progress tracking for a phase
   */
  initPhase(phaseId: string, phaseName: string): void {
    this.progress.set(phaseId, {
      phaseId,
      phaseName,
      status: 'pending',
      details: [],
      errors: [],
    })
    this.notifyListeners(phaseId)
  }

  /**
   * Start a phase
   */
  startPhase(phaseId: string): void {
    const progress = this.progress.get(phaseId)
    if (progress) {
      progress.status = 'running'
      progress.startTime = Date.now()
      this.notifyListeners(phaseId)
    }
  }

  /**
   * Update progress for a phase
   */
  updateProgress(
    phaseId: string,
    update: {
      currentStep?: string
      totalSteps?: number
      completedSteps?: number
      details?: string
      error?: string
    }
  ): void {
    const progress = this.progress.get(phaseId)
    if (!progress || progress.status !== 'running') return

    if (update.currentStep) progress.currentStep = update.currentStep
    if (update.totalSteps !== undefined) progress.totalSteps = update.totalSteps
    if (update.completedSteps !== undefined) {
      progress.completedSteps = update.completedSteps
      if (progress.totalSteps) {
        progress.percentage = Math.round((progress.completedSteps / progress.totalSteps) * 100)
      }
    }
    if (update.details) {
      if (!progress.details) progress.details = []
      progress.details.push(update.details)
      // Keep only last 20 details
      if (progress.details.length > 20) progress.details = progress.details.slice(-20)
    }
    if (update.error) {
      if (!progress.errors) progress.errors = []
      progress.errors.push(update.error)
    }

    // Update elapsed time
    if (progress.startTime) {
      progress.elapsed = Date.now() - progress.startTime
    }

    this.notifyListeners(phaseId)
  }

  /**
   * Complete a phase
   */
  completePhase(phaseId: string, status: 'completed' | 'failed' | 'skipped'): void {
    const progress = this.progress.get(phaseId)
    if (progress) {
      progress.status = status
      if (progress.startTime) {
        progress.elapsed = Date.now() - progress.startTime
      }
      this.notifyListeners(phaseId)
    }
  }

  /**
   * Get progress for a phase
   */
  getProgress(phaseId: string): PhaseProgress | undefined {
    const progress = this.progress.get(phaseId)
    if (progress && progress.startTime) {
      progress.elapsed = Date.now() - progress.startTime
    }
    return progress
  }

  /**
   * Get all progress
   */
  getAllProgress(): PhaseProgress[] {
    const now = Date.now()
    return Array.from(this.progress.values()).map(p => {
      if (p.startTime && !p.elapsed) {
        return { ...p, elapsed: now - p.startTime }
      }
      return p
    })
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(listener: (progress: PhaseProgress) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Format progress as human-readable string
   */
  formatProgress(phaseId: string): string {
    const progress = this.getProgress(phaseId)
    if (!progress) return ''

    const lines: string[] = []
    lines.push(`[${progress.phaseId}] ${progress.phaseName}`)
    
    const statusIcon = progress.status === 'completed' ? '✓'
                      : progress.status === 'failed' ? '✗'
                      : progress.status === 'running' ? '▶'
                      : progress.status === 'skipped' ? '○'
                      : '○'
    
    lines.push(`  Status: ${statusIcon} ${progress.status}`)
    
    if (progress.elapsed !== undefined) {
      const elapsedSec = Math.round(progress.elapsed / 1000)
      lines.push(`  Time: ${elapsedSec}s`)
    }
    
    if (progress.currentStep) {
      lines.push(`  Step: ${progress.currentStep}`)
    }
    
    if (progress.percentage !== undefined) {
      const bar = this.createProgressBar(progress.percentage, 20)
      lines.push(`  Progress: ${bar} ${progress.percentage}%`)
    }
    
    if (progress.completedSteps !== undefined && progress.totalSteps) {
      lines.push(`  Steps: ${progress.completedSteps}/${progress.totalSteps}`)
    }
    
    if (progress.details && progress.details.length > 0) {
      lines.push('  Latest:')
      const recentDetails = progress.details.slice(-3)
      recentDetails.forEach(d => lines.push(`    • ${d}`))
    }
    
    if (progress.errors && progress.errors.length > 0) {
      lines.push('  Errors:')
      progress.errors.slice(-3).forEach(e => lines.push(`    ✗ ${e}`))
    }
    
    return lines.join('\n')
  }

  /**
   * Create a text progress bar
   */
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    return '█'.repeat(filled) + '░'.repeat(empty)
  }

  /**
   * Notify all listeners of progress update
   */
  private notifyListeners(phaseId: string): void {
    const progress = this.getProgress(phaseId)
    if (progress) {
      this.listeners.forEach(listener => listener(progress))
    }
  }

  /**
   * Clear completed phases
   */
  clearCompleted(): void {
    const now = Date.now()
    for (const [id, progress] of this.progress.entries()) {
      if (
        (progress.status === 'completed' || progress.status === 'skipped') &&
        progress.elapsed &&
        now - (progress.startTime || 0) - progress.elapsed > 60000 // Clear after 1 minute
      ) {
        this.progress.delete(id)
      }
    }
  }

  /**
   * Reset all progress
   */
  reset(): void {
    this.progress.clear()
    this.listeners.clear()
  }
}

// Singleton instance
const tracker = new PhaseProgressTracker()

export function usePhaseProgressTracker(): PhaseProgressTracker {
  return tracker
}

export type { PhaseProgress }
