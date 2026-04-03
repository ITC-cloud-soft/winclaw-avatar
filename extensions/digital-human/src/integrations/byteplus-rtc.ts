/**
 * BytePlus Digital Human Integration
 * =====================================
 * WebSocket client for BytePlus Virtual Human (avatar_live) service.
 * Ported from: backend/app/integrations/byteplus_rtc.py
 *
 * Architecture:
 *   - Backend → DH Service: WebSocket to wss://openspeech.bytedance.com/virtual_human/avatar_live/live
 *     Uses a text-based protocol with |CTL|xx| and |DAT|xx| headers.
 *   - Frontend → ByteRTC: Separate connection via @byteplus/rtc SDK to subscribe to the video stream.
 *
 * Protocol commands (sent to server):
 *   |CTL|00| + JSON  → Initialize session / keep-alive / restore idle state
 *   |CTL|01|         → Stop session (sent before closing WebSocket)
 *   |CTL|03|         → Interrupt current speech
 *   |CTL|12|         → End streaming (finalise current audio chunk)
 *   |DAT|01| + SSML  → Send SSML text for the avatar to speak
 *   |DAT|02| + PCM   → Send raw PCM audio (binary frame, minimum 1280 bytes = 40 ms @ 16 kHz/16-bit/mono)
 *
 * Protocol messages (received from server):
 *   |MSG|00| + JSON  → Control acknowledgement / error (code 1000 = connected, 4002 = concurrency limit)
 *   |MSG|02| + JSON  → Heartbeat / status ping
 *   |DAT|02| + JSON  → Audio lifecycle events: voice_start, voice_end, voice_continue, ready
 *
 * @module byteplus-rtc
 */

import crypto from "node:crypto";
import WebSocket from "ws";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** BytePlus Virtual Human WebSocket endpoint. */
const DH_WS_URL =
  "wss://openspeech.bytedance.com/virtual_human/avatar_live/live";

/** Minimum audio frame size: 1280 bytes = 40 ms of PCM16 @ 16 kHz mono. */
const MIN_AUDIO_FRAME_BYTES = 1280;

/** Idle threshold (ms) before keep-alive kicks in. */
const KEEP_ALIVE_IDLE_MS = 500;

/** Keep-alive polling interval (ms) — send silent audio frequently to maintain animation. */
const KEEP_ALIVE_POLL_MS = 500;

/** Number of silent frames per keep-alive tick (each 1280 bytes = 40ms audio). */
const KEEP_ALIVE_FRAMES_PER_TICK = 5;

/** Heartbeat monitoring interval (ms). */
const HEARTBEAT_POLL_MS = 5_000;

/** Time after connection with no heartbeat before a warning is logged (ms). */
const HEARTBEAT_INITIAL_GRACE_MS = 20_000;

/** Heartbeat timeout before a warning is logged (ms). */
const HEARTBEAT_TIMEOUT_MS = 15_000;

/** Connect timeout (ms). */
const CONNECT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// ByteRTC AccessToken constants
// ---------------------------------------------------------------------------

const TOKEN_VERSION = "001";

/** Privilege: publish full stream (audio + video + data). */
const PRIV_PUBLISH_STREAM = 0;
/** Privilege: publish audio stream only. */
const PRIV_PUBLISH_AUDIO_STREAM = 1;
/** Privilege: publish video stream only. */
const PRIV_PUBLISH_VIDEO_STREAM = 2;
/** Privilege: publish data stream only. */
const PRIV_PUBLISH_DATA_STREAM = 3;
/** Privilege: subscribe to stream. */
const PRIV_SUBSCRIBE_STREAM = 4;

// ---------------------------------------------------------------------------
// Interfaces & Types
// ---------------------------------------------------------------------------

/**
 * Configuration passed to the BytePlus DH service during session initialisation
 * (sent as the JSON body of the `|CTL|00|` frame).
 */
export interface DigitalHumanConfig {
  live: {
    /** Unique identifier for this live session. */
    live_id: string;
  };
  auth: {
    /** BytePlus Virtual Human application ID. */
    appid: string;
    /** BytePlus Virtual Human authentication token. */
    token: string;
  };
  avatar: {
    /**
     * Avatar type identifier.
     * Common values: `"3min"` (the short-form 3-minute avatar).
     */
    avatar_type: string;
    /**
     * Input modality.
     * `"audio"` → send PCM audio via `|DAT|02|`.
     * `"text"`  → send SSML text via `|DAT|01|`.
     */
    input_mode: "audio" | "text";
    /** Role / character identifier configured in the BytePlus console. */
    role: string;
  };
  streaming: {
    /** Must be `"bytertc"` for ByteRTC-backed streaming. */
    type: "bytertc";
    /** ByteRTC application ID (from the VolcEngine console). */
    rtc_app_id: string;
    /** ByteRTC room to join. */
    rtc_room_id: string;
    /** ByteRTC user ID for the digital-human publisher. */
    rtc_uid: string;
    /** ByteRTC publisher token (generated via `RTCTokenService`). */
    rtc_token: string;
  };
}

/**
 * Stream information returned from {@link BytePlusRTCEngine.startSession}.
 * Used by the frontend to connect to ByteRTC and render the video stream.
 */
export interface StreamInfo {
  /** Unique live session identifier. */
  liveId: string;
  /** ByteRTC room ID that the frontend should join. */
  roomId: string;
  /** ByteRTC viewer token for the frontend to subscribe to the video stream. */
  viewerToken: string;
  /** ByteRTC user ID the viewer should use when joining. */
  viewerUid: string;
  /** ByteRTC application ID (required by the @byteplus/rtc SDK). */
  rtcAppId: string;
  /** ByteRTC publisher user ID (the digital human's UID inside the room). */
  publisherUid: string;
  /** Session connection status. */
  status: "connected";
}

/**
 * Internal mutable state tracked for each {@link DigitalHumanSession}.
 */
export interface SessionStatus {
  /** Whether the WebSocket connection is currently open. */
  connected: boolean;
  /** Epoch-millisecond timestamp of the last received heartbeat message. */
  lastHeartbeatAt: number | null;
  /** The most recently emitted session event. */
  lastEvent: SessionEvent | null;
  /** Epoch-millisecond timestamp when audio was last sent to the service. */
  lastAudioSent: number;
  /** Whether the session is idle and ready to accept the next audio chunk. */
  readyForNext: boolean;
  /** Epoch-millisecond timestamp when the current audio playback started (0 if idle). */
  audioPlaybackStarted: number;
  /** Whether audio playback has fully finished. */
  playbackFinished: boolean;
  /** Running count of `voice_continue` events received during current playback. */
  voiceContinueCount: number;
  /** Epoch-millisecond timestamp when the last audio playback completed. */
  lastPlaybackCompleted: number;
}

/**
 * Typed server frame parsed from a raw text WebSocket message.
 */
export interface ServerFrame {
  /** The protocol header token, e.g. `"|MSG|00|"`, `"|DAT|02|"`. */
  header: string | null;
  /** Decoded body — a JSON object when parseable, otherwise a raw string. */
  body: Record<string, unknown> | string | null;
}

// ---------------------------------------------------------------------------
// Session events (emitted to registered listeners)
// ---------------------------------------------------------------------------

export type SessionEventType =
  | "socket_open"
  | "socket_close"
  | "socket_error"
  | "server_message"
  | "concurrency_limit_error";

/** Base shape for all session events. */
export interface BaseSessionEvent {
  type: SessionEventType;
}

export interface SocketOpenEvent extends BaseSessionEvent {
  type: "socket_open";
}

export interface SocketCloseEvent extends BaseSessionEvent {
  type: "socket_close";
}

export interface SocketErrorEvent extends BaseSessionEvent {
  type: "socket_error";
  error: string;
}

export interface ServerMessageEvent extends BaseSessionEvent {
  type: "server_message";
  raw: string;
  parsed: ServerFrame;
}

export interface ConcurrencyLimitErrorEvent extends BaseSessionEvent {
  type: "concurrency_limit_error";
  error: string;
}

export type SessionEvent =
  | SocketOpenEvent
  | SocketCloseEvent
  | SocketErrorEvent
  | ServerMessageEvent
  | ConcurrencyLimitErrorEvent;

/** Callback signature for session event listeners. */
export type SessionEventListener = (event: SessionEvent) => void;

// ---------------------------------------------------------------------------
// RTCTokenService configuration
// ---------------------------------------------------------------------------

/**
 * Configuration required to instantiate {@link RTCTokenService}.
 */
export interface RTCTokenServiceConfig {
  /** ByteRTC application ID. */
  appId: string;
  /** ByteRTC application secret key (used for HMAC-SHA256 signing). */
  appKey: string;
  /** Default room ID used when none is supplied to token methods. */
  defaultRoomId?: string;
  /** Default publisher user ID. */
  defaultPushUid?: string;
  /** Default viewer user ID. */
  defaultViewerUid?: string;
  /** Default token lifetime in hours (default: 24). */
  defaultExpireHours?: number;
}

// ---------------------------------------------------------------------------
// ByteRTC AccessToken
// ---------------------------------------------------------------------------

/**
 * ByteRTC AccessToken generator.
 *
 * Ports the Python `AccessToken` class from `rtc_token_service.py`.
 *
 * The token binary layout (little-endian):
 * ```
 * uint32  nonce
 * uint32  issuedAt
 * uint32  expireAt
 * string  roomId    (uint16 length prefix + UTF-8 bytes)
 * string  userId    (uint16 length prefix + UTF-8 bytes)
 * map     privileges (uint16 count + [uint16 key + uint32 value] entries, sorted by key)
 * ```
 * The entire message is HMAC-SHA256-signed with `appKey`.
 * Final token = `VERSION` + `appId` + base64(`packBytes(message)` + `packBytes(signature)`).
 */
class AccessToken {
  private readonly appId: string;
  private readonly appKey: string;
  private readonly roomId: string;
  private readonly userId: string;
  private readonly issuedAt: number;
  private readonly nonce: number;
  private expireAt: number = 0;
  private readonly privileges: Map<number, number> = new Map();

  constructor(appId: string, appKey: string, roomId: string, userId: string) {
    this.appId = appId;
    this.appKey = appKey;
    this.roomId = roomId;
    this.userId = userId;
    this.issuedAt = Math.floor(Date.now() / 1000);
    this.nonce = Math.floor(Math.random() * 99_999_999) + 1;
  }

  /**
   * Add a privilege and its expiration timestamp.
   *
   * Adding `PRIV_PUBLISH_STREAM` automatically includes the three sub-privileges
   * (`PRIV_PUBLISH_AUDIO_STREAM`, `PRIV_PUBLISH_VIDEO_STREAM`, `PRIV_PUBLISH_DATA_STREAM`).
   *
   * @param privilege - One of the `PRIV_*` constants.
   * @param expireTs  - Unix timestamp (seconds) when this privilege expires.
   */
  addPrivilege(privilege: number, expireTs: number): void {
    this.privileges.set(privilege, expireTs);
    if (privilege === PRIV_PUBLISH_STREAM) {
      this.privileges.set(PRIV_PUBLISH_VIDEO_STREAM, expireTs);
      this.privileges.set(PRIV_PUBLISH_AUDIO_STREAM, expireTs);
      this.privileges.set(PRIV_PUBLISH_DATA_STREAM, expireTs);
    }
  }

  /**
   * Set the overall token expiration timestamp.
   *
   * @param expireTs - Unix timestamp (seconds).
   */
  setExpireTime(expireTs: number): void {
    this.expireAt = expireTs;
  }

  /**
   * Serialise the token to a string ready for use in ByteRTC API calls.
   *
   * @returns Token string in the format `VERSION + appId + base64(message + signature)`.
   */
  serialize(): string {
    const message = this.packMessage();
    const signature = crypto
      .createHmac("sha256", this.appKey)
      .update(message)
      .digest();

    const content = Buffer.concat([
      this.packBytes(message),
      this.packBytes(signature),
    ]);

    return TOKEN_VERSION + this.appId + content.toString("base64");
  }

  // --- Private packing helpers (little-endian binary encoding) ---

  private packMessage(): Buffer {
    const parts: Buffer[] = [
      this.packUint32(this.nonce),
      this.packUint32(this.issuedAt),
      this.packUint32(this.expireAt),
      this.packString(this.roomId),
      this.packString(this.userId),
      this.packPrivilegesMap(),
    ];
    return Buffer.concat(parts);
  }

  private packUint16(value: number): Buffer {
    const buf = Buffer.allocUnsafe(2);
    buf.writeUInt16LE(value, 0);
    return buf;
  }

  private packUint32(value: number): Buffer {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32LE(value >>> 0, 0);
    return buf;
  }

  private packString(str: string): Buffer {
    return this.packBytes(Buffer.from(str, "utf8"));
  }

  private packBytes(data: Buffer): Buffer {
    return Buffer.concat([this.packUint16(data.length), data]);
  }

  /**
   * Pack the privileges map as: uint16 count + sorted [uint16 key, uint32 value] entries.
   * Keys are sorted in ascending order to produce a deterministic binary layout.
   */
  private packPrivilegesMap(): Buffer {
    const sorted = [...this.privileges.entries()].sort(([a], [b]) => a - b);
    const parts: Buffer[] = [this.packUint16(sorted.length)];
    for (const [key, value] of sorted) {
      parts.push(this.packUint16(key), this.packUint32(value));
    }
    return Buffer.concat(parts);
  }
}

// ---------------------------------------------------------------------------
// RTCTokenService
// ---------------------------------------------------------------------------

/**
 * Generates ByteRTC authentication tokens for digital-human sessions.
 *
 * Ports the Python `RTCTokenService` class.
 *
 * Two distinct tokens are produced per session:
 *  - **Publisher token** — used by the DH service to push the video/audio stream into a ByteRTC room.
 *  - **Viewer token** — used by the browser/Electron frontend to subscribe to and render the stream.
 *
 * @example
 * ```typescript
 * const svc = new RTCTokenService({
 *   appId: process.env.BYTERTC_APP_ID!,
 *   appKey: process.env.BYTERTC_APP_KEY!,
 * });
 * const publisherToken = svc.generatePublisherToken({ roomId: 'my-room', userId: 'dh-bot' });
 * const viewerToken    = svc.generateViewerToken({ roomId: 'my-room', userId: 'viewer-001' });
 * ```
 */
export class RTCTokenService {
  private readonly appId: string;
  private readonly appKey: string;
  private readonly defaultRoomId: string;
  private readonly defaultPushUid: string;
  private readonly defaultViewerUid: string;
  private readonly defaultExpireHours: number;

  constructor(config: RTCTokenServiceConfig) {
    this.appId = config.appId;
    this.appKey = config.appKey;
    this.defaultRoomId = config.defaultRoomId ?? "digital_human_room";
    this.defaultPushUid = config.defaultPushUid ?? "digital_human_publisher";
    this.defaultViewerUid = config.defaultViewerUid ?? "digital_human_viewer";
    this.defaultExpireHours = config.defaultExpireHours ?? 24;
  }

  /**
   * Generate a **publisher** token for the ByteDance digital-human service.
   *
   * The token grants `PRIV_PUBLISH_STREAM` (and its sub-privileges) so that
   * the DH service can push audio/video into the ByteRTC room.
   *
   * @param opts.roomId       - Room ID override (falls back to `defaultRoomId`).
   * @param opts.userId       - Publisher UID override (falls back to `defaultPushUid`).
   * @param opts.expireHours  - Token lifetime override (falls back to `defaultExpireHours`).
   * @returns Serialised token string.
   */
  generatePublisherToken(opts: {
    roomId?: string;
    userId?: string;
    expireHours?: number;
  } = {}): string {
    const roomId = opts.roomId ?? this.defaultRoomId;
    const userId = opts.userId ?? this.defaultPushUid;
    const expireHours = opts.expireHours ?? this.defaultExpireHours;
    const expireTs = Math.floor(Date.now() / 1000) + expireHours * 3600;

    const token = new AccessToken(this.appId, this.appKey, roomId, userId);
    token.addPrivilege(PRIV_PUBLISH_STREAM, expireTs);
    token.setExpireTime(expireTs);
    return token.serialize();
  }

  /**
   * Generate a **viewer** token for the frontend @byteplus/rtc SDK.
   *
   * The token grants `PRIV_SUBSCRIBE_STREAM` so the browser can receive and
   * render the digital-human video stream without publishing anything.
   *
   * @param opts.roomId       - Room ID override (falls back to `defaultRoomId`).
   * @param opts.userId       - Viewer UID override (falls back to `defaultViewerUid`).
   * @param opts.expireHours  - Token lifetime override (falls back to `defaultExpireHours`).
   * @returns Serialised token string.
   */
  generateViewerToken(opts: {
    roomId?: string;
    userId?: string;
    expireHours?: number;
  } = {}): string {
    const roomId = opts.roomId ?? this.defaultRoomId;
    const userId = opts.userId ?? this.defaultViewerUid;
    const expireHours = opts.expireHours ?? this.defaultExpireHours;
    const expireTs = Math.floor(Date.now() / 1000) + expireHours * 3600;

    const token = new AccessToken(this.appId, this.appKey, roomId, userId);
    token.addPrivilege(PRIV_SUBSCRIBE_STREAM, expireTs);
    token.setExpireTime(expireTs);
    return token.serialize();
  }
}

// ---------------------------------------------------------------------------
// DigitalHumanSession
// ---------------------------------------------------------------------------

/**
 * A single live Digital Human session.
 *
 * Manages the WebSocket connection to the BytePlus DH service, the custom
 * binary/text framing protocol, and all background tasks (heartbeat monitor,
 * keep-alive audio sender).
 *
 * Ports the Python `DigitalHumanSession` class from `byteplus_rtc.py`.
 *
 * **Lifecycle:**
 * ```
 * const session = new DigitalHumanSession(liveId, config);
 * session.onEvent(e => console.log(e));
 * await session.connect();       // opens WS + sends |CTL|00| init
 * await session.sendAudioData(pcm);  // send PCM chunks
 * await session.interrupt();     // stop current speech mid-stream
 * await session.stop();          // graceful shutdown
 * ```
 */
export class DigitalHumanSession {
  /** Unique session identifier (used by the DH service as `live_id`). */
  readonly liveId: string;

  private readonly config: DigitalHumanConfig;

  /** Active WebSocket connection, or `null` before `connect()` / after `stop()`. */
  private ws: WebSocket | null = null;

  /** Mutable session state snapshot. */
  private readonly _status: SessionStatus = {
    connected: false,
    lastHeartbeatAt: null,
    lastEvent: null,
    lastAudioSent: 0,
    readyForNext: true,
    audioPlaybackStarted: 0,
    playbackFinished: true,
    voiceContinueCount: 0,
    lastPlaybackCompleted: 0,
  };

  /** Registered event listener callbacks. */
  private readonly listeners: Set<SessionEventListener> = new Set();

  /** Epoch-millisecond timestamp when the WebSocket was opened. */
  private connectionTime: number | null = null;

  /** Handle for the heartbeat monitoring `setInterval`. */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Handle for the keep-alive audio `setInterval`. */
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(liveId: string, config: DigitalHumanConfig) {
    this.liveId = liveId;
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Register an event listener.
   *
   * @param listener - Callback invoked for every {@link SessionEvent}.
   * @returns An unsubscribe function that removes this listener.
   */
  onEvent(listener: SessionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Open the WebSocket connection to the BytePlus DH service and send the
   * `|CTL|00|` initialisation frame with the session configuration.
   *
   * Starts background tasks: heartbeat monitor and keep-alive sender.
   *
   * @param timeoutMs - Connect timeout in milliseconds (default: 15 000).
   * @throws If the WebSocket cannot be established within `timeoutMs`.
   */
  async connect(timeoutMs: number = CONNECT_TIMEOUT_MS): Promise<void> {
    await this.openWebSocket(timeoutMs);

    this._status.connected = true;
    this.connectionTime = Date.now();
    this.emit({ type: "socket_open" });

    // Send the initialisation control frame with the full session config.
    this.sendTextFrame("|CTL|00|", JSON.stringify(this.config));

    // Start background monitoring tasks.
    this.startHeartbeatMonitor();
    this.startKeepAliveLoop();
  }

  /**
   * Send raw PCM audio data for the digital human's lip-sync.
   *
   * Frames shorter than {@link MIN_AUDIO_FRAME_BYTES} are zero-padded to
   * exactly 1280 bytes (40 ms @ 16 kHz / 16-bit / mono).
   *
   * @param audioData - Raw PCM16 audio bytes (16 kHz, 16-bit, mono).
   * @throws If the WebSocket is not connected.
   */
  sendAudioData(audioData: Buffer): void {
    this.ensureConnected();

    let frame = audioData;
    if (frame.length < MIN_AUDIO_FRAME_BYTES) {
      const padding = Buffer.alloc(MIN_AUDIO_FRAME_BYTES - frame.length, 0);
      frame = Buffer.concat([frame, padding]);
    }

    this.sendBinaryFrame("|DAT|02|", frame);

    const now = Date.now();
    this._status.lastAudioSent = now;
    this._status.lastHeartbeatAt = now;
  }

  /**
   * Send SSML text for the digital human to speak (text-input mode).
   *
   * @param ssml - SSML-formatted speech string.
   * @throws If the WebSocket is not connected.
   */
  say(ssml: string): void {
    this.ensureConnected();
    this.sendTextFrame("|DAT|01|", ssml);
  }

  /**
   * Interrupt the digital human's current speech mid-stream.
   *
   * Sends a `|CTL|03|` control frame.
   *
   * @throws If the WebSocket is not connected.
   */
  interrupt(): void {
    this.ensureConnected();
    this.sendTextFrame("|CTL|03|", "");
  }

  /**
   * Reset the digital human to its natural idle/ready animation state after
   * audio playback completes.
   *
   * Sends `|CTL|12|` (end streaming) followed by `|CTL|00|` (re-enter idle).
   * Runs asynchronously and swallows errors — failure to reset is non-fatal.
   */
  async resetToReady(): Promise<void> {
    try {
      if (!this.isWsOpen()) return;
      this.sendTextFrame("|CTL|12|", "");
      // Small delay before the idle signal to let the service process the end command.
      await sleep(100);
      this.sendTextFrame("|CTL|00|", "");

      // Send a burst of silent frames to smooth the transition back to idle
      const silentFrame = Buffer.alloc(MIN_AUDIO_FRAME_BYTES, 0);
      for (let i = 0; i < 10; i++) {
        this.sendBinaryFrame("|DAT|02|", silentFrame);
      }

      const now = Date.now();
      this._status.readyForNext = true;
      this._status.audioPlaybackStarted = 0;
      this._status.playbackFinished = true;
      this._status.voiceContinueCount = 0;
      this._status.lastHeartbeatAt = now;
      this._status.lastAudioSent = now;
    } catch (err) {
      console.warn("[DH] Failed to reset to ready state:", err);
    }
  }

  /**
   * Gracefully stop the session.
   *
   * Cancels background tasks, sends `|CTL|01|` to the service, then closes
   * the WebSocket with code 1000 (normal closure).
   */
  async stop(): Promise<void> {
    try {
      console.info(`[DH] Stopping session: ${this.liveId}`);
      this.stopBackgroundTasks();

      if (this.ws && this.isWsOpen()) {
        try {
          this.ws.send("|CTL|01|");
          await sleep(500);
          this.ws.close(1000, "Normal closure");
        } catch (err) {
          console.warn("[DH] Error during stop:", err);
        }
      }

      this._status.connected = false;
      this.ws = null;
      console.info(`[DH] Session ${this.liveId} stopped`);
    } catch (err) {
      console.error(`[DH] Error stopping session ${this.liveId}:`, err);
      this._status.connected = false;
      this.ws = null;
    }
  }

  /** Read-only snapshot of the current session status. */
  getStatus(): Readonly<SessionStatus> & { liveId: string } {
    return { ...this._status, liveId: this.liveId };
  }

  /** Whether the WebSocket connection is currently open. */
  get isConnected(): boolean {
    return this._status.connected;
  }

  // -------------------------------------------------------------------------
  // WebSocket setup
  // -------------------------------------------------------------------------

  /**
   * Open the WebSocket connection with an optional timeout.
   */
  private openWebSocket(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(DH_WS_URL);
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.terminate();
          reject(new Error(`[DH] Connect timeout after ${timeoutMs} ms`));
        }
      }, timeoutMs);

      ws.once("open", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.ws = ws;
          this.attachWsListeners();
          resolve();
        }
      });

      ws.once("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /**
   * Attach the persistent WebSocket event handlers for the receive loop and
   * disconnect handling.
   */
  private attachWsListeners(): void {
    const ws = this.ws!;

    ws.on("message", (data) => {
      this.handleMessage(data);
    });

    ws.on("close", (code, reason) => {
      const reasonStr = reason?.toString() ?? "";
      console.warn(`[DH] WebSocket closed: code=${code} reason=${reasonStr}`);

      const isConcurrency =
        code === 4002 ||
        reasonStr.includes("concurrency over limit") ||
        reasonStr.includes("4002");

      if (isConcurrency) {
        this.emit({
          type: "concurrency_limit_error",
          error: "Concurrency limit exceeded",
        });
      } else {
        this.emit({ type: "socket_close" });
      }

      this.teardown();
    });

    ws.on("error", (err) => {
      console.error("[DH] WebSocket error:", err);
      this.emit({ type: "socket_error", error: String(err) });
    });
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  /**
   * Process an incoming WebSocket message (text or binary).
   *
   * Binary messages are decoded as UTF-8 before parsing, since the DH service
   * sends its status frames as UTF-8 text even over a binary WS message.
   */
  private handleMessage(data: WebSocket.RawData): void {
    let text: string;
    if (Buffer.isBuffer(data)) {
      text = data.toString("utf8");
    } else if (data instanceof ArrayBuffer) {
      text = Buffer.from(data).toString("utf8");
    } else {
      // Buffer[]
      text = Buffer.concat(data as Buffer[]).toString("utf8");
    }

    const parsed = parseServerFrame(text);

    // Update heartbeat timestamp on heartbeat / control-ack messages.
    if (
      parsed.header === "|MSG|02|" ||
      parsed.header === "|MSG|00|"
    ) {
      this._status.lastHeartbeatAt = Date.now();
    }

    // Connection confirmation (code 1000 in the body).
    if (
      parsed.header === "|MSG|00|" &&
      parsed.body !== null &&
      typeof parsed.body === "object" &&
      (parsed.body as Record<string, unknown>)["code"] === 1000
    ) {
      this._status.lastHeartbeatAt = Date.now();
    }

    // Audio lifecycle events from |DAT|02| server frames.
    if (parsed.header === "|DAT|02|") {
      const body = parsed.body;
      if (body !== null && typeof body === "object") {
        const eventType = (body as Record<string, unknown>)["type"];
        this.handleVoiceLifecycleEvent(eventType as string | undefined);
      }
    }

    // Concurrency limit error via |MSG|00| with code 4002.
    if (parsed.header === "|MSG|00|") {
      const body = parsed.body;
      if (
        body !== null &&
        typeof body === "object" &&
        (body as Record<string, unknown>)["code"] === 4002
      ) {
        console.error("[DH] Concurrency limit exceeded");
        this.emit({
          type: "concurrency_limit_error",
          error: "Digital human service concurrency limit exceeded",
        });
      }
    }

    console.debug(`[DH] Message: ${text.slice(0, 100)}...`);
    this.emit({ type: "server_message", raw: text, parsed });
  }

  /**
   * Handle `voice_start`, `voice_end`, and `voice_continue` audio lifecycle
   * events received from the DH service.
   */
  private handleVoiceLifecycleEvent(eventType: string | undefined): void {
    if (!eventType) return;

    if (eventType === "voice_start") {
      console.info("[DH] Audio playback started");
      this._status.audioPlaybackStarted = Date.now();
      this._status.readyForNext = false;
      this._status.voiceContinueCount = 0;
      this._status.playbackFinished = false;
    } else if (eventType === "voice_end") {
      console.info("[DH] Audio playback completed");
      this._status.lastPlaybackCompleted = Date.now();
      this._status.audioPlaybackStarted = 0;
      this._status.readyForNext = true;
      this._status.playbackFinished = true;
      // Fire-and-forget reset: errors are logged inside resetToReady.
      void this.resetToReady();
    } else if (eventType === "voice_continue") {
      void this.sendPlaybackContinueSignal();
    }
  }

  // -------------------------------------------------------------------------
  // Background tasks
  // -------------------------------------------------------------------------

  /**
   * Start the heartbeat monitor.
   *
   * Logs a warning if no heartbeat is received within:
   *   - 20 s of initial connection (grace period), or
   *   - 15 s since the last heartbeat message.
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this._status.connected) return;

      const now = Date.now();
      const lastHb = this._status.lastHeartbeatAt;

      if (lastHb === null) {
        if (
          this.connectionTime !== null &&
          now - this.connectionTime > HEARTBEAT_INITIAL_GRACE_MS
        ) {
          console.warn("[DH] No heartbeat within 20 s of connection");
        }
        return;
      }

      const elapsed = now - lastHb;
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[DH] Heartbeat timeout: ${elapsed} ms since last heartbeat`);
      }
    }, HEARTBEAT_POLL_MS);
  }

  /**
   * Start the keep-alive loop.
   *
   * When the session has been idle (no audio sent) for more than
   * {@link KEEP_ALIVE_IDLE_MS}, sends a silent PCM frame (1280 zero bytes)
   * to maintain the DH service connection and keep the avatar in its natural
   * idle animation.
   */
  private startKeepAliveLoop(): void {
    console.log("[DH] Keep-alive loop started (poll every " + KEEP_ALIVE_POLL_MS + "ms, idle threshold " + KEEP_ALIVE_IDLE_MS + "ms)");
    this.keepAliveInterval = setInterval(() => {
      if (!this._status.connected || !this.isWsOpen()) return;

      const now = Date.now();
      const lastAction = this._status.lastAudioSent;
      const idleMs = now - lastAction;

      // Send multiple silent frames to keep avatar animated with natural gestures.
      if (idleMs > KEEP_ALIVE_IDLE_MS) {
        const silentFrame = Buffer.alloc(MIN_AUDIO_FRAME_BYTES, 0);
        for (let i = 0; i < KEEP_ALIVE_FRAMES_PER_TICK; i++) {
          this.sendBinaryFrame("|DAT|02|", silentFrame);
        }
        this._status.lastAudioSent = now;
        this._status.lastHeartbeatAt = now;
      }
    }, KEEP_ALIVE_POLL_MS);
  }

  /**
   * Send an idle/continue signal to keep the avatar animated during playback.
   *
   * Only fires every 5th `voice_continue` event to avoid flooding the service.
   */
  private async sendPlaybackContinueSignal(): Promise<void> {
    try {
      const count = this._status.voiceContinueCount;
      this._status.voiceContinueCount = count + 1;
      if (count % 5 !== 0) return;
      if (!this.isWsOpen()) return;
      this.sendTextFrame("|CTL|00|", "");
      console.debug(`[DH] Sent playback continue signal (count: ${count})`);
    } catch (err) {
      console.warn("[DH] Failed to send continue signal:", err);
    }
  }

  /**
   * Clear all background interval handles.
   */
  private stopBackgroundTasks(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.keepAliveInterval !== null) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // -------------------------------------------------------------------------
  // Low-level frame helpers
  // -------------------------------------------------------------------------

  /**
   * Send a text protocol frame: `header + body`.
   *
   * @param header   - Protocol header, e.g. `"|CTL|00|"`.
   * @param bodyText - Body string (may be empty).
   */
  private sendTextFrame(header: string, bodyText: string): void {
    const payload = `${header}${bodyText}`;
    this.ws!.send(payload);
  }

  /**
   * Send a binary protocol frame: `UTF-8 header bytes` + `raw audio bytes`.
   *
   * @param header    - Protocol header, e.g. `"|DAT|02|"`.
   * @param audioData - Raw PCM audio bytes.
   */
  private sendBinaryFrame(header: string, audioData: Buffer): void {
    const headerBytes = Buffer.from(header, "utf8");
    const payload = Buffer.concat([headerBytes, audioData]);
    this.ws!.send(payload);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Emit a session event to all registered listeners and update `lastEvent`.
   */
  private emit(event: SessionEvent): void {
    this._status.lastEvent = event;
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[DH] Event listener threw:", err);
      }
    }
  }

  /**
   * Throw if the WebSocket is not open.
   */
  private ensureConnected(): void {
    if (!this.ws || !this.isWsOpen()) {
      throw new Error("Digital human WebSocket not connected");
    }
  }

  /**
   * Return `true` if the WebSocket is in the OPEN state.
   */
  private isWsOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Clean up all resources after disconnect.
   */
  private teardown(): void {
    this.stopBackgroundTasks();
    this._status.connected = false;
    this.emit({ type: "socket_close" });
  }
}

// ---------------------------------------------------------------------------
// DigitalHumanManager
// ---------------------------------------------------------------------------

/**
 * Configuration required to instantiate {@link DigitalHumanManager}.
 */
export interface DigitalHumanManagerConfig {
  /** BytePlus Virtual Human application ID (from the BytePlus console). */
  virtualHumanAppId: string;
  /** BytePlus Virtual Human authentication token. */
  virtualHumanToken: string;
  /** Default digital-human role / character ID. */
  virtualHumanRole: string;
  /** ByteRTC application ID. */
  byteRtcAppId: string;
  /** ByteRTC application secret key. */
  byteRtcAppKey: string;
  /** Default ByteRTC room ID. */
  defaultRoomId?: string;
  /** Default ByteRTC publisher UID. */
  defaultPushUid?: string;
  /** Default ByteRTC viewer UID. */
  defaultViewerUid?: string;
}

/**
 * Manager for Digital Human sessions.
 *
 * Handles session lifecycle, RTC token generation, and session lookup.
 * Ports the Python `DigitalHumanManager` class.
 *
 * @example
 * ```typescript
 * const manager = new DigitalHumanManager({
 *   virtualHumanAppId: process.env.VIRTUAL_HUMAN_APPID!,
 *   virtualHumanToken: process.env.VIRTUAL_HUMAN_TOKEN!,
 *   virtualHumanRole:  process.env.VIRTUAL_HUMAN_ROLE!,
 *   byteRtcAppId:      process.env.BYTERTC_APP_ID!,
 *   byteRtcAppKey:     process.env.BYTERTC_APP_KEY!,
 * });
 *
 * const info = await manager.startSession();
 * const session = manager.getSession(info.liveId);
 * await session!.sendAudioData(pcmBuffer);
 * await manager.stopSession(info.liveId);
 * ```
 */
export class DigitalHumanManager {
  private readonly sessions: Map<string, DigitalHumanSession> = new Map();
  private readonly rtcTokenService: RTCTokenService;
  private readonly config: DigitalHumanManagerConfig;

  constructor(config: DigitalHumanManagerConfig) {
    this.config = config;
    this.rtcTokenService = new RTCTokenService({
      appId: config.byteRtcAppId,
      appKey: config.byteRtcAppKey,
      defaultRoomId: config.defaultRoomId,
      defaultPushUid: config.defaultPushUid,
      defaultViewerUid: config.defaultViewerUid,
    });

    console.info("[DH] DigitalHumanManager initialised");
  }

  /**
   * Start a new digital-human session.
   *
   * Generates RTC tokens, builds the session config, opens the WebSocket
   * connection, and registers the session. Retries up to 3 times on
   * concurrency-limit errors with exponential back-off.
   *
   * @param opts.roleId   - Override the avatar role ID (defaults to `virtualHumanRole`).
   * @param opts.liveId   - Override the live ID (auto-generated if omitted).
   * @param opts.roomId   - Override the ByteRTC room ID (defaults to `defaultRoomId`).
   * @param opts.rtcUid   - Override the publisher UID (defaults to `defaultPushUid`).
   * @returns {@link StreamInfo} for the frontend to connect to ByteRTC.
   * @throws If the session cannot be established after 3 attempts.
   */
  async startSession(opts: {
    roleId?: string;
    liveId?: string;
    roomId?: string;
    rtcUid?: string;
  } = {}): Promise<StreamInfo> {
    const liveId = opts.liveId ?? generateLiveId();
    const roleId = opts.roleId ?? this.config.virtualHumanRole;
    const roomId =
      opts.roomId ??
      this.config.defaultRoomId ??
      "digital_human_room";
    const rtcUid =
      opts.rtcUid ??
      this.config.defaultPushUid ??
      "digital_human_publisher";

    // Generate publisher token for the DH service.
    let publisherToken = "";
    try {
      publisherToken = this.rtcTokenService.generatePublisherToken({
        roomId,
        userId: rtcUid,
      });
    } catch (err) {
      console.warn("[DH] Failed to generate publisher RTC token:", err);
    }

    // Build the full DH session config.
    const dhConfig: DigitalHumanConfig = {
      live: { live_id: liveId },
      auth: {
        appid: this.config.virtualHumanAppId,
        token: this.config.virtualHumanToken,
      },
      avatar: {
        avatar_type: "3min",
        input_mode: "audio",
        role: roleId,
      },
      streaming: {
        type: "bytertc",
        rtc_app_id: this.config.byteRtcAppId,
        rtc_room_id: roomId,
        rtc_uid: rtcUid,
        rtc_token: publisherToken,
      },
    };

    const session = new DigitalHumanSession(liveId, dhConfig);

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await session.connect();
        this.sessions.set(liveId, session);
        console.info(
          `[DH] Session started: ${liveId} (attempt ${attempt + 1})`
        );

        // Generate viewer token for the frontend.
        const viewerUid =
          this.config.defaultViewerUid ?? "digital_human_viewer";
        let viewerToken = "";
        try {
          viewerToken = this.rtcTokenService.generateViewerToken({
            roomId,
            userId: viewerUid,
          });
        } catch (err) {
          console.warn("[DH] Failed to generate viewer RTC token:", err);
        }

        return {
          liveId,
          roomId,
          viewerToken,
          viewerUid,
          rtcAppId: this.config.byteRtcAppId,
          publisherUid: rtcUid,
          status: "connected",
        };
      } catch (err) {
        const errMsg = String(err);
        const isConcurrency =
          errMsg.includes("concurrency over limit") ||
          errMsg.includes("4002");

        if (isConcurrency && attempt < MAX_RETRIES - 1) {
          const delaySec = Math.min(10 * Math.pow(2, attempt), 60);
          console.warn(
            `[DH] Concurrency limit hit, retrying in ${delaySec} s…`
          );
          await sleep(delaySec * 1000);
          continue;
        }

        throw new Error(`Failed to start digital human session: ${errMsg}`);
      }
    }

    throw new Error("Failed to start digital human session after retries");
  }

  /**
   * Retrieve an active session by its live ID.
   *
   * @param liveId - The `liveId` returned by {@link startSession}.
   * @returns The {@link DigitalHumanSession}, or `undefined` if not found.
   */
  getSession(liveId: string): DigitalHumanSession | undefined {
    return this.sessions.get(liveId);
  }

  /**
   * Stop a session and remove it from the registry.
   *
   * @param liveId - The `liveId` of the session to stop.
   */
  async stopSession(liveId: string): Promise<void> {
    const session = this.sessions.get(liveId);
    this.sessions.delete(liveId);

    if (session) {
      await session.stop();
      console.info(`[DH] Session stopped: ${liveId}`);
    } else {
      console.warn(`[DH] Session not found: ${liveId}`);
    }
  }

  /**
   * Stop all active sessions.
   *
   * Useful for graceful server shutdown. Errors from individual sessions are
   * caught and logged so that all sessions are attempted.
   */
  async cleanupAll(): Promise<void> {
    const liveIds = [...this.sessions.keys()];
    await Promise.allSettled(
      liveIds.map(async (id) => {
        try {
          await this.stopSession(id);
        } catch (err) {
          console.error(`[DH] Error cleaning up session ${id}:`, err);
        }
      })
    );
  }
}

// ---------------------------------------------------------------------------
// BytePlusRTCEngine (backward-compatible facade)
// ---------------------------------------------------------------------------

/**
 * Configuration required to instantiate {@link BytePlusRTCEngine}.
 */
export interface BytePlusRTCEngineConfig extends DigitalHumanManagerConfig {}

/**
 * Backward-compatible façade over {@link DigitalHumanManager}.
 *
 * Matches the interface expected by the realtime session handler.
 * Ports the Python `BytePlusRTCEngine` class.
 *
 * @example
 * ```typescript
 * const engine = new BytePlusRTCEngine(config);
 * const info = await engine.startSession(roleId);
 * await engine.sendAudio(pcmBuffer);
 * await engine.interrupt();
 * await engine.stopSession();
 * ```
 */
export class BytePlusRTCEngine {
  private session: DigitalHumanSession | null = null;
  private sessionInfo: StreamInfo | null = null;
  private readonly manager: DigitalHumanManager;

  constructor(config: BytePlusRTCEngineConfig) {
    this.manager = new DigitalHumanManager(config);
  }

  /**
   * Start a digital-human session.
   *
   * @param roleId - The avatar role / character ID to use.
   * @returns {@link StreamInfo} for the frontend.
   */
  async startSession(roleId: string): Promise<StreamInfo> {
    const info = await this.manager.startSession({ roleId });
    this.session = this.manager.getSession(info.liveId) ?? null;
    this.sessionInfo = info;
    return info;
  }

  /**
   * Send raw PCM16 audio for lip-sync.
   *
   * @param audioData - Raw PCM16 bytes (16 kHz, 16-bit, mono).
   * @returns `true` on success, `false` if the session is disconnected.
   */
  sendAudio(audioData: Buffer): boolean {
    if (!this.session?.isConnected) return false;
    try {
      this.session.sendAudioData(audioData);
      return true;
    } catch (err) {
      console.error("[DH] Failed to send audio:", err);
      return false;
    }
  }

  /**
   * Send SSML text for the avatar to speak.
   *
   * @param text - SSML-formatted speech string.
   * @returns `true` on success, `false` if the session is disconnected.
   */
  sendText(text: string): boolean {
    if (!this.session?.isConnected) return false;
    try {
      this.session.say(text);
      return true;
    } catch (err) {
      console.error("[DH] Failed to send text:", err);
      return false;
    }
  }

  /**
   * Reset the avatar to its natural idle animation.
   *
   * @returns `true` on success, `false` if the session is disconnected.
   */
  async resetToReady(): Promise<boolean> {
    if (!this.session?.isConnected) return false;
    try {
      await this.session.resetToReady();
      return true;
    } catch (err) {
      console.error("[DH] Failed to reset to ready:", err);
      return false;
    }
  }

  /**
   * Interrupt the avatar's current speech.
   *
   * @returns `true` on success, `false` if the session is disconnected.
   */
  interrupt(): boolean {
    if (!this.session?.isConnected) return false;
    try {
      this.session.interrupt();
      return true;
    } catch (err) {
      console.error("[DH] Failed to interrupt:", err);
      return false;
    }
  }

  /**
   * Stop the current session.
   */
  async stopSession(): Promise<void> {
    if (this.sessionInfo) {
      await this.manager.stopSession(this.sessionInfo.liveId);
    }
    this.session = null;
    this.sessionInfo = null;
  }

  /**
   * Register an event listener on the underlying session.
   *
   * Returns a no-op function if there is no active session.
   *
   * @param listener - Callback for {@link SessionEvent} objects.
   * @returns Unsubscribe function.
   */
  onEvent(listener: SessionEventListener): () => void {
    if (!this.session) return () => {};
    return this.session.onEvent(listener);
  }

  /** Whether the session WebSocket is currently open. */
  get isConnected(): boolean {
    return this.session?.isConnected ?? false;
  }

  /** The {@link StreamInfo} from the most recent `startSession` call, or `null`. */
  get currentStreamInfo(): StreamInfo | null {
    return this.sessionInfo;
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw server text frame into a typed {@link ServerFrame}.
 *
 * Frame format: `|AAA|NN|<body>`
 *   - Header is exactly 9 characters: `|` + 3 letters + `|` + 2 digits + `|`.
 *   - Body is the remaining text, parsed as JSON when possible.
 *
 * @param text - Raw text received from the WebSocket.
 * @returns Parsed header and body.
 */
function parseServerFrame(text: string): ServerFrame {
  const HEADER_PATTERN = /^(\|[A-Z]{3}\|\d{2}\|)/;
  const match = HEADER_PATTERN.exec(text);
  const header = match ? match[1] : null;
  const rest = header ? text.slice(header.length) : text;

  let body: ServerFrame["body"];
  try {
    body = rest ? (JSON.parse(rest) as Record<string, unknown>) : null;
  } catch {
    body = rest || null;
  }

  return { header, body };
}

/**
 * Generate a unique live session ID.
 *
 * Format: `live_<epoch_ms>_<6 random alphanumeric chars>`.
 */
function generateLiveId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `live_${Date.now()}_${suffix}`;
}

/**
 * Promisified `setTimeout` helper for async back-off delays.
 *
 * @param ms - Delay in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
