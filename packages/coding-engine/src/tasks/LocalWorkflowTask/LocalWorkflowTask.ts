import type { Task } from '../../Task.js'

/**
 * Stub: Local workflow task handler.
 * Manages lifecycle of locally executing workflow script tasks.
 */
export const LocalWorkflowTask: Task = {
  name: 'local_workflow',
  type: 'local_workflow',
  async kill(_taskId: string, _setAppState: unknown): Promise<void> {
    // Stub: no-op
  },
}
