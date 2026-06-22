/**
 * Generic TCP and HTTP endpoint reachability probes.
 *
 * Used by the doctor module (standard + full levels) to validate connectivity
 * without performing any credential-sensitive operations.
 */

import { createConnection } from 'node:net'

// ---------------------------------------------------------------------------
// Shared result type (re-exported for consumers)
// ---------------------------------------------------------------------------

export type ProbeResult = {
  ok: boolean
  durationMs: number
  detail?: string
}

// ---------------------------------------------------------------------------
// TCP probe
// ---------------------------------------------------------------------------

/**
 * Open a TCP connection to host:port and immediately close it.
 * Returns ok:true on successful connect; ok:false with detail on failure or timeout.
 */
export async function probeTcp(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<ProbeResult> {
  const start = Date.now()

  return new Promise<ProbeResult>((resolve) => {
    let settled = false

    const done = (result: ProbeResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve({ ...result, durationMs: Date.now() - start })
    }

    const socket = createConnection({ host, port })

    const timer = setTimeout(() => {
      done({ ok: false, durationMs: 0, detail: `timeout after ${timeoutMs}ms` })
    }, timeoutMs)

    socket.on('connect', () => {
      done({ ok: true, durationMs: 0 })
    })

    socket.on('error', (err: Error) => {
      done({ ok: false, durationMs: 0, detail: err.message })
    })
  })
}

// ---------------------------------------------------------------------------
// HTTP HEAD probe
// ---------------------------------------------------------------------------

/**
 * Send an HTTP HEAD request to url.
 * Any HTTP response (including 4xx/5xx) is treated as ok:true — the point is
 * reachability, not authorization. Network-level failures return ok:false.
 */
export async function probeHttp(url: string, timeoutMs = 5000): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return { ok: true, durationMs: Date.now() - start, detail: `HTTP ${res.status}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, durationMs: Date.now() - start, detail: msg }
  }
}

// ---------------------------------------------------------------------------
// Endpoint parser
// ---------------------------------------------------------------------------

export type ParsedEndpoint = {
  host: string
  port: number
  protocol?: 'http' | 'https'
}

/**
 * Detect endpoint type from a string: URL, host:port, or bare hostname.
 *
 * Examples:
 *   "https://storage.example.com"   → { host: "storage.example.com", port: 443, protocol: "https" }
 *   "http://host:8080"              → { host: "host", port: 8080, protocol: "http" }
 *   "mydb.example.com:5432"         → { host: "mydb.example.com", port: 5432 }
 *   "mydb.example.com"              → { host: "mydb.example.com", port: 443 }
 */
export function parseEndpoint(s: string): ParsedEndpoint {
  // Full URL with protocol
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const url = new URL(s)
      const protocol = url.protocol === 'https:' ? 'https' : 'http'
      const defaultPort = protocol === 'https' ? 443 : 80
      const port = url.port ? parseInt(url.port, 10) : defaultPort
      return { host: url.hostname, port, protocol }
    } catch {
      // fall through to manual parse
    }
  }

  // host:port without protocol
  const colonIdx = s.lastIndexOf(':')
  if (colonIdx > 0) {
    const maybePort = parseInt(s.slice(colonIdx + 1), 10)
    if (!isNaN(maybePort) && maybePort > 0 && maybePort < 65536) {
      return { host: s.slice(0, colonIdx), port: maybePort }
    }
  }

  // Bare hostname — default to 443
  return { host: s, port: 443 }
}
