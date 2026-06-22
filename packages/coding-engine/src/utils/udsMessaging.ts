/**
 * Stub: Unix Domain Socket (UDS) messaging server.
 * In a real implementation this creates a local socket server that allows
 * Claude instances to communicate as a swarm/team.
 *
 * On Windows this is a no-op since UDS support is limited.
 */
import path from 'path'
import os from 'os'

let _socketPath: string | null = null
let _onEnqueue: (() => void) | null = null

export function getDefaultUdsSocketPath(): string {
  return path.join(os.tmpdir(), `claude-code-${process.pid}.sock`)
}

export function getUdsMessagingSocketPath(): string | null {
  return _socketPath
}

export async function startUdsMessaging(
  socketPath: string,
  _opts: { isExplicit: boolean },
): Promise<void> {
  // On Windows, UDS is not fully supported — skip silently
  if (process.platform === 'win32') {
    return
  }
  _socketPath = socketPath
}

export function stopUdsMessaging(): void {
  _socketPath = null
}

export function setOnEnqueue(fn: () => void): void {
  _onEnqueue = fn
}

export function triggerEnqueue(): void {
  _onEnqueue?.()
}
