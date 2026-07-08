/**
 * @fileoverview winclaw -> L20 VM audio sink (道B MuseTalk render path).
 *
 * The L20 VM is a pure MuseTalk renderer running in `input_mode:"passthrough"`.
 * It has no internal ASR/LLM/TTS — winclaw owns the Qwen pipeline and pushes the
 * resulting TTS PCM to the VM over the dh-saas control WebSocket. The VM lip-syncs
 * the injected audio and returns avatar video over a separate WebRTC connection.
 *
 * This module is the sole winclaw -> VM audio channel. It mirrors autoproject's
 * `ItcAvatarSession` (`itc_avatar_client.py`: `send_audio_data`, `reset_to_ready`,
 * `_DH_MIN_FRAME_SIZE`):
 *
 * - **Binary frames** = raw 24kHz/16-bit/mono PCM, sent in fixed
 *   {@link MuseTalkAudioSink.FRAME_SIZE}-byte chunks.
 * - **Text frames** = JSON control messages: `{"type":"audio_end"}` (release the
 *   pipeline back to idle) and `{"type":"interrupt"}` (barge-in).
 *
 * CRITICAL — NO RESAMPLE: Qwen emits 24kHz; the VM expects 24kHz verbatim. The
 * legacy `rawPcm24k -> 16k` resample path is BYTEPLUS-ONLY. Sending 16kHz to the
 * VM yields 1.5x slow playback / lip desync.
 *
 * @module musetalk-audio-sink
 */

import WebSocket from "ws";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Minimal logger surface so callers may inject a structured logger. */
export interface MuseTalkAudioSinkLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/** Constructor options for {@link MuseTalkAudioSink}. */
export interface MuseTalkAudioSinkOptions {
  /** dh-saas control WebSocket URL, e.g. "wss://avatar.myaiportal.net/ws/{sid}".
   *  Pass AvatarStreamInfo.controlWs verbatim. */
  controlWsUrl: string;
  /** Owner token from AvatarStreamInfo.ownerToken. Sent as the
   *  `Authorization: Bearer <ownerToken>` header on the WS upgrade. May be ""/undefined. */
  ownerToken?: string;
  /** Optional logger; defaults to a console-backed adapter tagged "[MuseTalkAudioSink]". */
  logger?: MuseTalkAudioSinkLogger;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Connect timeout for the control WS upgrade. */
const CONNECT_TIMEOUT_MS = 10_000;

/** dh-saas session heartbeat POST interval. The dh-saas room times out ~60s
 *  without a heartbeat — the control WS then closes (code=4408
 *  reason=heartbeat_timeout) and ALL subsequent TTS PCM is silently dropped, so
 *  the avatar renders but never lip-syncs. 25s gives ~2 beats per timeout window.
 *  Mirrors autoproject ItcAvatarSession's heartbeat loop (the byteplus path has
 *  its own keepAlive; the MuseTalk path previously had none). */
const HEARTBEAT_INTERVAL_MS = 25_000;

/** Delay before re-opening the control WS after an unexpected close. */
const RECONNECT_DELAY_MS = 2_000;

/** Cap on consecutive auto-reconnect attempts (reset on a successful open). */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Console-backed default logger tagged "[MuseTalkAudioSink]". */
const DEFAULT_LOGGER: MuseTalkAudioSinkLogger = {
  info: (msg) => console.info(`[MuseTalkAudioSink] ${msg}`),
  warn: (msg) => console.warn(`[MuseTalkAudioSink] ${msg}`),
  error: (msg, err) =>
    err === undefined
      ? console.error(`[MuseTalkAudioSink] ${msg}`)
      : console.error(`[MuseTalkAudioSink] ${msg}`, err),
};

// ---------------------------------------------------------------------------
// MuseTalkAudioSink
// ---------------------------------------------------------------------------

/**
 * Thin control-WS client that pushes winclaw's Qwen TTS PCM to the L20 VM for
 * MuseTalk lip-sync. Buffers incoming PCM and drains it in fixed-size binary
 * frames; emits JSON control frames for end-of-response and barge-in.
 *
 * @see ItcAvatarSession (autoproject `itc_avatar_client.py`)
 */
export class MuseTalkAudioSink {
  /** Frame size pushed to the VM: 4800 bytes = 100ms @ 24kHz/16-bit/mono.
   *  Public readonly so the integrator can assert the no-resample contract. */
  static readonly FRAME_SIZE = 4800;

  private readonly controlWsUrl: string;
  private readonly ownerToken: string;
  private readonly logger: MuseTalkAudioSinkLogger;

  private ws: WebSocket | null = null;
  /** Resolves once OPEN; reused by idempotent connect() calls. */
  private connectPromise: Promise<void> | null = null;
  /** Set once close() has run so a late connect() rejects cleanly. */
  private closed = false;
  /** Pending 24kHz PCM bytes waiting to be framed and sent. */
  private buffer: Buffer = Buffer.alloc(0);
  /** dh-saas session heartbeat POST loop handle (keeps the room/control WS alive). */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Pending auto-reconnect handle after an unexpected control-WS close. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Consecutive reconnect attempts; reset to 0 on a successful open. */
  private reconnectAttempts = 0;
  /** Derived `https://…/api/v1/sessions/<sid>/heartbeat` endpoint (null if not derivable). */
  private readonly heartbeatUrl: string | null;

  constructor(opts: MuseTalkAudioSinkOptions) {
    this.controlWsUrl = opts.controlWsUrl;
    this.ownerToken = opts.ownerToken ?? "";
    this.logger = opts.logger ?? DEFAULT_LOGGER;
    this.heartbeatUrl = MuseTalkAudioSink.deriveHeartbeatUrl(this.controlWsUrl);
  }

  /** True once the WS is OPEN and not yet closed. */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Open the control WS and resolve once OPEN (rejects on connect error/timeout,
   * ~10s). Idempotent: a second call while connected resolves immediately.
   */
  connect(): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    if (this.closed) {
      return Promise.reject(
        new Error("[MuseTalkAudioSink] connect() called after close()"),
      );
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      // Control-WS auth (CONFIRMED against the dh-saas gateway): the
      // Authorization: Bearer <ownerToken> header alone succeeds. A `?token=`
      // query param must NOT be appended — the gateway returns HTTP 500 on the
      // WS upgrade when it is present.
      const url = this.controlWsUrl;
      const headers: Record<string, string> = {};
      if (this.ownerToken) {
        headers.authorization = `Bearer ${this.ownerToken}`;
      }

      let settled = false;
      const ws = new WebSocket(url, { headers });
      this.ws = ws;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.logger.error(
          `connect() timed out after ${CONNECT_TIMEOUT_MS} ms (${this.controlWsUrl})`,
        );
        try {
          ws.terminate();
        } catch {
          /* ignore */
        }
        this.connectPromise = null;
        reject(
          new Error(
            `[MuseTalkAudioSink] connect timed out after ${CONNECT_TIMEOUT_MS} ms`,
          ),
        );
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.info(`control WS open (${this.controlWsUrl})`);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      });

      // ★制御WS keepalive — OAC worker の JSON ping に pong で応答する（autoproject
      //   itc_avatar_client.py:490-507 と同等）。未応答だと worker が ~60s で idle 判定し
      //   `4408 heartbeat_timeout` で切断 → 再接続間隙の TTS PCM が drop し口型滞后/反応遅延
      //   になる。HTTP /heartbeat(startHeartbeat) は room TTL 延長のみで制御WSの keepalive は
      //   満たさない（autoproject は両方持つ）。媒体は binary なので JSON 制御フレームのみ消費。
      ws.on("message", (raw, isBinary) => {
        if (isBinary) return;
        let evt: { type?: string } | undefined;
        try {
          evt = JSON.parse(raw.toString()) as { type?: string };
        } catch {
          return;
        }
        if (evt?.type === "ping") {
          try {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          } catch (err) {
            this.logger.warn(`control WS pong failed: ${String(err)}`);
          }
        }
      });

      ws.on("error", (err) => {
        if (settled) {
          // Post-open transport error — log; isConnected will flip via "close".
          this.logger.error("control WS error", err);
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.connectPromise = null;
        this.logger.error("control WS connect failed", err);
        reject(
          err instanceof Error
            ? err
            : new Error(`[MuseTalkAudioSink] connect failed: ${String(err)}`),
        );
      });

      ws.on("close", (code, reason) => {
        const why = reason?.toString() || "";
        this.logger.info(`control WS closed (code=${code}${why ? ` reason=${why}` : ""})`);
        if (this.ws === ws) {
          this.ws = null;
          this.connectPromise = null;
        }
        this.stopHeartbeat();
        this.scheduleReconnect();
      });
    });

    return this.connectPromise;
  }

  /**
   * Derive the dh-saas session heartbeat endpoint from the control WS URL:
   * `wss://DOMAIN/ws/<sid>` → `https://DOMAIN/api/v1/sessions/<sid>/heartbeat`.
   * Returns null if the URL doesn't match (heartbeat then disabled with a warn).
   */
  private static deriveHeartbeatUrl(controlWsUrl: string): string | null {
    try {
      const u = new URL(controlWsUrl);
      const m = u.pathname.match(/\/ws\/([^/]+)/);
      if (!m) return null;
      const scheme = u.protocol === "wss:" ? "https:" : "http:";
      return `${scheme}//${u.host}/api/v1/sessions/${m[1]}/heartbeat`;
    } catch {
      return null;
    }
  }

  /**
   * Start the dh-saas session heartbeat loop (idempotent). Fires once immediately
   * then every {@link HEARTBEAT_INTERVAL_MS}. Without it the room times out ~60s and
   * the control WS closes (code=4408 heartbeat_timeout), silently dropping all TTS.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    const url = this.heartbeatUrl;
    if (!url) {
      this.logger.warn(
        `session heartbeat disabled — cannot derive endpoint from ${this.controlWsUrl}`,
      );
      return;
    }
    const headers: Record<string, string> = {};
    if (this.ownerToken) headers.authorization = `Bearer ${this.ownerToken}`;
    const tick = async (): Promise<void> => {
      try {
        const resp = await fetch(url, { method: "POST", headers });
        if (!resp.ok) {
          this.logger.warn(`session heartbeat ${resp.status} (${url})`);
        }
      } catch (err) {
        this.logger.error("session heartbeat failed", err);
      }
    };
    void tick();
    this.heartbeatTimer = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);
    this.logger.info(`session heartbeat started (every ${HEARTBEAT_INTERVAL_MS}ms → ${url})`);
  }

  /** Stop the session heartbeat loop. Idempotent. */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule a single bounded auto-reconnect after an unexpected control-WS close
   * (no-op if closed, already scheduled, or attempts exhausted). The HTTP heartbeat
   * keeps the dh-saas room alive across the gap, so re-attaching resumes lip-sync.
   */
  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.warn(
        `control WS not reconnecting — ${MAX_RECONNECT_ATTEMPTS} attempts exhausted`,
      );
      return;
    }
    this.reconnectAttempts += 1;
    const attempt = this.reconnectAttempts;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closed || this.isConnected) return;
      this.logger.info(
        `control WS reconnecting… (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      this.connect().catch((err) => {
        this.logger.error("control WS reconnect failed", err);
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Buffer 24kHz PCM (NO resample). Drains in {@link MuseTalkAudioSink.FRAME_SIZE}-byte
   * binary frames via ws.send(frame). Bytes < FRAME_SIZE stay buffered until the
   * next call or {@link audioEnd}. Never throws; if not OPEN the data is dropped
   * with a warn log.
   */
  sendAudioData(pcm: Buffer): void {
    if (!this.isConnected || this.ws === null) {
      this.logger.warn(
        `sendAudioData dropped ${pcm.length} bytes — control WS not open`,
      );
      return;
    }
    if (pcm.length === 0) {
      return;
    }

    this.buffer = this.buffer.length === 0 ? pcm : Buffer.concat([this.buffer, pcm]);

    // Drain whole frames; keep the trailing partial frame buffered.
    let offset = 0;
    while (this.buffer.length - offset >= MuseTalkAudioSink.FRAME_SIZE) {
      const frame = this.buffer.subarray(offset, offset + MuseTalkAudioSink.FRAME_SIZE);
      offset += MuseTalkAudioSink.FRAME_SIZE;
      try {
        this.ws.send(frame);
      } catch (err) {
        this.logger.error("sendAudioData frame send failed", err);
        // Re-buffer the unsent remainder so audioEnd()/next call can retry.
        this.buffer = this.buffer.subarray(offset - MuseTalkAudioSink.FRAME_SIZE);
        return;
      }
    }
    this.buffer = offset === 0 ? this.buffer : this.buffer.subarray(offset);
  }

  /**
   * Flush any partial buffered frame (zero-padded to {@link MuseTalkAudioSink.FRAME_SIZE}),
   * then send the JSON control frame `{"type":"audio_end"}` so MuseTalk releases
   * the pipeline -> idle. No-op + warn if not OPEN.
   */
  audioEnd(): void {
    if (!this.isConnected || this.ws === null) {
      this.logger.warn("audioEnd() called but control WS not open");
      this.buffer = Buffer.alloc(0);
      return;
    }

    // Zero-pad the residual partial frame to FRAME_SIZE and send it.
    if (this.buffer.length > 0) {
      const padded = Buffer.alloc(MuseTalkAudioSink.FRAME_SIZE);
      this.buffer.copy(padded);
      this.buffer = Buffer.alloc(0);
      try {
        this.ws.send(padded);
      } catch (err) {
        this.logger.error("audioEnd() residual frame send failed", err);
      }
    }

    try {
      this.ws.send(JSON.stringify({ type: "audio_end" }));
      this.logger.info("sent audio_end (release MuseTalk -> idle)");
    } catch (err) {
      this.logger.error("audioEnd() control frame send failed", err);
    }
  }

  /**
   * Drop the internal buffer and send JSON `{"type":"interrupt"}` to barge-in.
   * No-op + warn if not OPEN.
   */
  interrupt(): void {
    this.buffer = Buffer.alloc(0);
    if (!this.isConnected || this.ws === null) {
      this.logger.warn("interrupt() called but control WS not open");
      return;
    }
    try {
      this.ws.send(JSON.stringify({ type: "interrupt" }));
      this.logger.info("sent interrupt (barge-in)");
    } catch (err) {
      this.logger.error("interrupt() control frame send failed", err);
    }
  }

  /**
   * Close the WS and clear buffers. Idempotent; safe to call after connect()
   * rejected or before connect(). Never throws.
   */
  close(): void {
    this.closed = true;
    this.buffer = Buffer.alloc(0);
    this.connectPromise = null;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws === null) {
      return;
    }
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "Normal closure");
      }
    } catch (err) {
      this.logger.error("close() failed", err);
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
    }
  }
}
