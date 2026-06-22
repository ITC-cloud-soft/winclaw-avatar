import type { Task } from '../../Task.js'

/**
 * Stub: Monitor MCP task handler.
 * Manages lifecycle of monitoring tasks that watch commands/resources.
 */
export const MonitorMcpTask: Task = {
  name: 'monitor_mcp',
  type: 'monitor_mcp',
  async kill(_taskId: string, _setAppState: unknown): Promise<void> {
    // Stub: no-op
  },
}
