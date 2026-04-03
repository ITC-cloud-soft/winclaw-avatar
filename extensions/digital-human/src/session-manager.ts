/**
 * @fileoverview SessionManager — manages the lifecycle of RealtimeSessionHandler
 * instances for all active digital-human voice sessions.
 *
 * Responsibilities:
 *  1. Enforce the maximum concurrent session limit from the plugin config.
 *  2. Create, track, and destroy {@link RealtimeSessionHandler} instances.
 *  3. Run a periodic inactivity timeout check.
 *  4. Flush all sessions gracefully on gateway shutdown.
 *
 * Thread / concurrency model:
 *  All methods are synchronous or return Promises that do not require external
 *  locking because Node.js is single-threaded. The `sessions` Map is the
 *  authoritative registry; each entry is mutated only by `startSession` and
 *  `stopSession`.
 */

import type WebSocket from "ws";

import { RealtimeSessionHandler } from "./realtime-handler.js";
import type { HandlerDeps } from "./realtime-handler.js";
import type { DigitalHumanConfig } from "./config.js";
import type { GatewayBridge } from "./gateway-bridge.js";

// ---------------------------------------------------------------------------
// Internal record type
// ---------------------------------------------------------------------------

/**
 * Internal tracking record stored for every active session.
 */
interface SessionRecord {
  /** The session handler responsible for Qwen / DH / memory orchestration. */
  handler: RealtimeSessionHandler;
  /** Epoch-ms timestamp when the session was created. */
  createdAt: number;
  /** Epoch-ms timestamp of the most recent activity (audio/video/text message). */
  lastActivityAt: number;
  /** WebSocket associated with the session (used to close timed-out sessions). */
  ws: WebSocket;
}

// ---------------------------------------------------------------------------
// SessionManagerConfig
// ---------------------------------------------------------------------------

/**
 * Dependencies required to instantiate a {@link SessionManager}.
 */
export interface SessionManagerConfig {
  /** Validated plugin configuration. */
  config: DigitalHumanConfig;
  /** Absolute path to the WinClaw workspace directory. */
  workspaceDir: string;
  /** Gateway bridge for routing messages through the WinClaw agent pipeline. */
  gwBridge: GatewayBridge;
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

/**
 * Manages the lifecycle of all active digital-human realtime sessions.
 *
 * @example
 * ```typescript
 * const manager = new SessionManager({
 *   config,
 *   workspaceDir: '~/.winclaw/workspace',
 *   agentRunner,
 *   memoryPlugin,
 *   agentId: 'digital-human',
 * });
 *
 * // Start periodic timeout checks.
 * manager.startTimeoutChecker();
 *
 * // On new WebSocket connection:
 * const handler = await manager.startSession(sessionId, ws);
 *
 * // On message:
 * manager.touchActivity(sessionId);
 *
 * // On disconnect:
 * await manager.stopSession(sessionId);
 *
 * // On gateway shutdown:
 * await manager.shutdownAll();
 * manager.stopTimeoutChecker();
 * ```
 */
export class SessionManager {
  /** Active sessions keyed by their session ID. */
  private readonly sessions = new Map<string, SessionRecord>();

  private readonly config: DigitalHumanConfig;
  private readonly workspaceDir: string;
  private readonly gwBridge: GatewayBridge;

  /** Handle for the periodic timeout-check interval, or `null` when stopped. */
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;

  /** How often the timeout checker runs (ms). */
  private static readonly TIMEOUT_CHECK_INTERVAL_MS = 60_000; // 1 minute

  constructor(deps: SessionManagerConfig) {
    this.config = deps.config;
    this.workspaceDir = deps.workspaceDir;
    this.gwBridge = deps.gwBridge;
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create a new session, initialize the handler, and register it.
   *
   * Rejects if the concurrent-session cap (`config.session.maxConcurrent`) has
   * already been reached.
   *
   * @param sessionId - Unique session identifier (e.g. `crypto.randomUUID()`).
   * @param ws        - The already-upgraded WebSocket for this session.
   * @returns The fully initialized {@link RealtimeSessionHandler}.
   * @throws `Error` when the concurrent limit is exceeded.
   * @throws `Error` if handler initialization fails (Qwen / DH connect error).
   */
  async startSession(
    sessionId: string,
    ws: WebSocket,
  ): Promise<RealtimeSessionHandler> {
    // Enforce concurrent session cap.
    if (this.sessions.size >= this.config.session.maxConcurrent) {
      throw new Error(
        `[SessionManager] Maximum concurrent sessions (${this.config.session.maxConcurrent}) reached`,
      );
    }

    if (this.sessions.has(sessionId)) {
      throw new Error(
        `[SessionManager] Session "${sessionId}" already exists`,
      );
    }

    const deps: HandlerDeps = {
      sessionId,
      ws,
      config: this.config,
      workspaceDir: this.workspaceDir,
      gwBridge: this.gwBridge,
    };

    const handler = new RealtimeSessionHandler(deps);

    // Register before initialization so cleanup works even if init fails.
    const record: SessionRecord = {
      handler,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      ws,
    };
    this.sessions.set(sessionId, record);

    try {
      await handler.initialize();
      console.info(`[SessionManager] Session started: ${sessionId}`);
      return handler;
    } catch (err) {
      // Remove from registry and clean up the partially-initialized handler.
      this.sessions.delete(sessionId);
      await handler.cleanup().catch((cleanupErr) => {
        console.error(
          `[SessionManager] Cleanup error during failed start of ${sessionId}:`,
          cleanupErr,
        );
      });
      throw err;
    }
  }

  /**
   * Stop a session by ID, clean up its handler, and remove it from the registry.
   *
   * Safe to call even if the session has already been removed (e.g. by a
   * timeout expiry — the call is simply a no-op in that case).
   *
   * @param sessionId - ID of the session to stop.
   */
  async stopSession(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      console.warn(`[SessionManager] stopSession: session "${sessionId}" not found`);
      return;
    }

    this.sessions.delete(sessionId);

    try {
      await record.handler.cleanup();
      console.info(`[SessionManager] Session stopped: ${sessionId}`);
    } catch (err) {
      console.error(
        `[SessionManager] Error during cleanup of session "${sessionId}":`,
        err,
      );
    }
  }

  /**
   * Look up an active session handler by its ID.
   *
   * @param sessionId - The session ID to look up.
   * @returns The {@link RealtimeSessionHandler}, or `undefined` if not found.
   */
  getSession(sessionId: string): RealtimeSessionHandler | undefined {
    return this.sessions.get(sessionId)?.handler;
  }

  /**
   * Update the last-activity timestamp for a session.
   *
   * Call this whenever an audio, video, or text message is received to
   * prevent premature inactivity timeout.
   *
   * @param sessionId - ID of the session to touch.
   */
  touchActivity(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (record) {
      record.lastActivityAt = Date.now();
    }
  }

  /**
   * Return the number of currently active sessions.
   */
  get activeCount(): number {
    return this.sessions.size;
  }

  /**
   * Return a snapshot of all active session IDs and their start times.
   */
  listSessions(): Array<{ sessionId: string; createdAt: number; lastActivityAt: number }> {
    return [...this.sessions.entries()].map(([id, rec]) => ({
      sessionId: id,
      createdAt: rec.createdAt,
      lastActivityAt: rec.lastActivityAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Timeout management
  // ---------------------------------------------------------------------------

  /**
   * Start the periodic inactivity timeout checker.
   *
   * Runs every {@link TIMEOUT_CHECK_INTERVAL_MS} milliseconds and closes any
   * session that has been idle for longer than `config.session.timeoutMinutes`.
   *
   * Safe to call multiple times — subsequent calls are no-ops when the checker
   * is already running.
   */
  startTimeoutChecker(): void {
    if (this.timeoutCheckInterval !== null) return;

    this.timeoutCheckInterval = setInterval(() => {
      void this.checkTimeout();
    }, SessionManager.TIMEOUT_CHECK_INTERVAL_MS);

    console.info("[SessionManager] Timeout checker started");
  }

  /**
   * Stop the periodic timeout checker.
   *
   * Call this as part of gateway shutdown, after {@link shutdownAll}.
   */
  stopTimeoutChecker(): void {
    if (this.timeoutCheckInterval !== null) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
      console.info("[SessionManager] Timeout checker stopped");
    }
  }

  /**
   * Inspect all active sessions and close any that have exceeded the
   * configured inactivity timeout.
   *
   * Timed-out sessions have their WebSocket closed with code 1001 (Going Away)
   * which triggers the normal disconnect → `stopSession` flow on the route
   * handler side.
   */
  async checkTimeout(): Promise<void> {
    const timeoutMs = this.config.session.timeoutMinutes * 60_000;
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [sessionId, record] of this.sessions) {
      if (now - record.lastActivityAt > timeoutMs) {
        timedOut.push(sessionId);
      }
    }

    for (const sessionId of timedOut) {
      console.info(
        `[SessionManager] Session "${sessionId}" timed out after ${this.config.session.timeoutMinutes} minutes of inactivity`,
      );

      const record = this.sessions.get(sessionId);
      if (record) {
        try {
          // Closing the WebSocket triggers the 'close' event on the route
          // handler, which calls stopSession().
          record.ws.close(1001, "Session timed out due to inactivity");
        } catch (err) {
          console.error(
            `[SessionManager] Error closing timed-out session "${sessionId}":`,
            err,
          );
          // Fall back to direct stop if close() fails.
          await this.stopSession(sessionId);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /**
   * Stop all active sessions gracefully.
   *
   * Called on gateway shutdown. Runs all cleanup operations concurrently
   * with `Promise.allSettled` so a single failing cleanup does not block
   * the others.
   */
  async shutdownAll(): Promise<void> {
    const sessionIds = [...this.sessions.keys()];
    console.info(
      `[SessionManager] Shutting down ${sessionIds.length} active session(s)…`,
    );

    const results = await Promise.allSettled(
      sessionIds.map((id) => this.stopSession(id)),
    );

    let errors = 0;
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[SessionManager] Shutdown error:", result.reason);
        errors++;
      }
    }

    console.info(
      `[SessionManager] Shutdown complete (${sessionIds.length - errors} ok, ${errors} error(s))`,
    );
  }
}
