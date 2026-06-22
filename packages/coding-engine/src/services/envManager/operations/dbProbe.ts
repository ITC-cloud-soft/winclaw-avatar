/**
 * Database connectivity probes for the /env doctor command.
 *
 * Phase 2 implementation: TCP probe is real; active (SELECT 1) probe is a
 * stub that detects whether the appropriate driver is installed.  Phase 2.5
 * will wire in the actual driver queries.
 */

import type { DbConn } from '../types.js'
import type { ProbeResult } from './endpointProbe.js'
import { probeTcp } from './endpointProbe.js'

export type { ProbeResult }

// ---------------------------------------------------------------------------
// Default ports per DB type
// ---------------------------------------------------------------------------

const DEFAULT_PORTS: Record<DbConn['type'], number> = {
  mysql: 3306,
  postgres: 5432,
  mongodb: 27017,
  sqlserver: 1433,
  redis: 6379,
  sqlite: 0, // local file — no TCP port
}

// ---------------------------------------------------------------------------
// Driver module names for active probe detection
// ---------------------------------------------------------------------------

const DRIVER_MODULE: Record<DbConn['type'], string | null> = {
  mysql: 'mysql2/promise',
  postgres: 'pg',
  mongodb: 'mongodb',
  sqlserver: 'mssql',
  redis: 'ioredis',
  sqlite: null, // no network probe possible
}

// ---------------------------------------------------------------------------
// TCP-level probe
// ---------------------------------------------------------------------------

/**
 * TCP-level probe: connect to conn.host:conn.port (or default port) and
 * immediately close.  Returns ok:false with detail:'no TCP port for sqlite'
 * for sqlite connections.
 */
export async function probeDbTcp(conn: DbConn, timeoutMs = 5000): Promise<ProbeResult> {
  if (conn.type === 'sqlite') {
    return { ok: false, durationMs: 0, detail: 'no TCP port for sqlite — local file only' }
  }

  const port = conn.port ?? DEFAULT_PORTS[conn.type]
  return probeTcp(conn.host, port, timeoutMs)
}

// ---------------------------------------------------------------------------
// Active probe (Phase 2 stub)
// ---------------------------------------------------------------------------

/**
 * Attempts to load the appropriate driver module for conn.type.
 *
 * Phase 2: if the driver is not installed, returns ok:false with detail
 * indicating the missing package.  The TCP probe is used as the best-effort
 * alternative so the check is not silently skipped.
 *
 * Phase 2.5 will replace this stub with an actual SELECT 1 / PING when the
 * driver is available.
 *
 * `password` is accepted for future use but currently unused by the stub.
 */
export async function probeDbActive(
  conn: DbConn,
  _password?: string,
  timeoutMs = 5000,
): Promise<ProbeResult> {
  if (conn.type === 'sqlite') {
    return { ok: false, durationMs: 0, detail: 'no active probe for sqlite — local file only' }
  }

  const moduleName = DRIVER_MODULE[conn.type]
  if (moduleName === null) {
    return { ok: false, durationMs: 0, detail: `no driver available for ${conn.type}` }
  }

  const start = Date.now()

  try {
    // Attempt dynamic import purely to detect presence of the driver package.
    // We do NOT actually connect — this is a Phase 2 placeholder.
    await import(moduleName)
    // Driver is installed: fall back to TCP probe and annotate as "driver found
    // but deep probe not yet wired (Phase 2.5)"
    const tcp = await probeDbTcp(conn, timeoutMs)
    return {
      ...tcp,
      durationMs: Date.now() - start,
      detail: tcp.ok
        ? `driver ${moduleName} installed; TCP ok (SELECT 1 pending Phase 2.5)`
        : `driver ${moduleName} installed; TCP failed: ${tcp.detail ?? 'unknown'}`,
    }
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error &&
      ('code' in err
        ? (err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND'
        : err.message.includes('Cannot find') || err.message.includes('Cannot resolve'))

    if (isNotFound) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        detail: `driver ${moduleName} not installed`,
      }
    }

    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, durationMs: Date.now() - start, detail: `driver check failed: ${msg}` }
  }
}

// ---------------------------------------------------------------------------
// Top-level dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch to TCP or active probe based on opts.active.
 * Defaults to TCP probe when opts.active is not set.
 */
export async function probeDatabase(
  conn: DbConn,
  opts?: { active?: boolean; password?: string; timeoutMs?: number },
): Promise<ProbeResult> {
  const timeout = opts?.timeoutMs ?? 5000

  if (opts?.active) {
    return probeDbActive(conn, opts.password, timeout)
  }

  return probeDbTcp(conn, timeout)
}
