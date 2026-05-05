/**
 * @file qwen-realtime.ts
 * @description WebSocket client for the Qwen3.5-omni Realtime API (DashScope).
 *
 * Implements the OpenAI Realtime API compatible protocol used by DashScope's
 * `wss://dashscope.aliyuncs.com/api-ws/v1/inference` endpoint. Ported from
 * the reference Python implementation at
 * `autoproject/backend/app/integrations/qwen_realtime.py`.
 *
 * Key design decisions vs. the Python original:
 * - Native `ws` library (Node.js) instead of DashScope SDK — gives us full
 *   control over the WebSocket lifecycle without a Python-specific SDK wrapper.
 * - EventEmitter pattern replaces the asyncio callback-bridging dance needed in
 *   Python. Node.js event callbacks are already on the correct thread/microtask
 *   queue, so no `call_soon_threadsafe` equivalent is required.
 * - The anti-echo `isResponding` flag is set synchronously inside the `message`
 *   handler (same execution context as the ws library's emit), preserving the
 *   zero-latency guarantee of the Python implementation.
 * - Exponential back-off reconnection is added on top of the Python original.
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { DEFAULT_VOICE } from "./qwen-voices.js";

// ---------------------------------------------------------------------------
// Function-calling / tool types
// ---------------------------------------------------------------------------

/** JSON-schema style parameter block for a function tool. */
export interface QwenToolParameter {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * Tool definition sent inside `session.update.tools`.
 *
 * The Qwen 3.5 Realtime API expects flat function definitions (no nested
 * `function` envelope) — see reference implementation.
 */
export interface QwenToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: QwenToolParameter;
}

/** Completed function call event emitted by the Qwen server. */
export interface QwenFunctionCall {
  /** Opaque id used to correlate the result back to the call. */
  callId: string;
  /** Tool name as registered in {@link QwenToolDefinition.name}. */
  name: string;
  /** JSON-encoded arguments string — NOT parsed; consumer decides how to parse. */
  argumentsJson: string;
}

// ---------------------------------------------------------------------------
// Public configuration types
// ---------------------------------------------------------------------------

/**
 * Configuration for a {@link QwenRealtimeClient} instance.
 *
 * All audio format values reference the OpenAI Realtime API field names
 * accepted by the DashScope endpoint.
 */
export interface QwenConfig {
  /** DashScope API key (required). Passed as `Authorization: Bearer <apiKey>`. */
  apiKey: string;

  /**
   * Model identifier.
   * @default "qwen3.5-omni-flash-realtime"
   */
  model?: string;

  /**
   * TTS voice name for the AI response audio.
   * @default "Serena"
   */
  voice?: string;

  /**
   * ASR/voice model used for input audio transcription.
   * @default "gummy-realtime-v1"
   */
  voiceModel?: string;

  /**
   * Whether to enable server-side VAD (Voice Activity Detection).
   * When true, the server automatically detects utterance boundaries.
   * @default true
   */
  serverVad?: boolean;

  /**
   * Input audio format sent to DashScope.
   * @default "pcm16"
   */
  inputAudioFormat?: string;

  /**
   * Output audio format requested from DashScope.
   * @default "pcm16"
   */
  outputAudioFormat?: string;

  /**
   * Sample rate (Hz) of PCM16 audio sent via {@link QwenRealtimeClient.sendAudio}.
   * @default 16000
   */
  sampleRate?: number;

  /**
   * Maximum number of reconnection attempts before giving up.
   * Set to 0 to disable automatic reconnection.
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Base delay (ms) for exponential back-off reconnection.
   * @default 1000
   */
  reconnectBaseDelayMs?: number;
}

/**
 * Callback signatures exposed to consumers of {@link QwenRealtimeClient}.
 *
 * All callbacks are optional. Attach them before calling {@link QwenRealtimeClient.connect}.
 */
export interface QwenCallbacks {
  /**
   * Called for each streaming text fragment (isDelta=true) and once more with
   * the complete transcript when the response finishes (isDelta=false).
   */
  onTextResponse?: (text: string, isDelta: boolean) => void | Promise<void>;

  /**
   * Called for each streaming PCM audio chunk decoded from base-64.
   * The `sampleRate` value reflects the output sample rate returned by DashScope
   * (typically 24 000 Hz).
   */
  onAudioResponse?: (pcm: Buffer, sampleRate: number) => void | Promise<void>;

  /** Called with the completed user speech transcript from the ASR model. */
  onUserTranscript?: (transcript: string) => void | Promise<void>;

  /** Called once when the AI begins generating a response (`response.created`). */
  onResponseStarted?: () => void | Promise<void>;

  /** Called once when the AI finishes generating a response (`response.done`). */
  onResponseDone?: () => void | Promise<void>;

  /** Called when a recoverable or fatal error is received from DashScope. */
  onError?: (error: Error) => void | Promise<void>;

  /** Called when the WebSocket session ends (close or unrecoverable error). */
  onSessionEnd?: () => void | Promise<void>;

  /**
   * Called when the model emits a completed function call.
   *
   * The consumer is responsible for executing the tool and returning the result
   * via {@link QwenRealtimeClient.sendFunctionResult}.
   */
  onFunctionCall?: (call: QwenFunctionCall) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal wire-protocol message types
// ---------------------------------------------------------------------------

/** Union of every event type the DashScope Realtime API may send. */
type QwenServerEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | ResponseCreatedEvent
  | ResponseDoneEvent
  | ResponseAudioDeltaEvent
  | ResponseAudioDoneEvent
  | ResponseAudioTranscriptDeltaEvent
  | ResponseAudioTranscriptDoneEvent
  | InputAudioBufferSpeechStartedEvent
  | InputAudioBufferSpeechStoppedEvent
  | ConversationItemInputAudioTranscriptionCompletedEvent
  | ErrorEvent
  | UnknownEvent;

interface SessionCreatedEvent {
  type: "session.created";
  session: { id: string; [key: string]: unknown };
}

interface SessionUpdatedEvent {
  type: "session.updated";
  session: { id?: string; [key: string]: unknown };
}

interface ResponseCreatedEvent {
  type: "response.created";
  response?: { id?: string; [key: string]: unknown };
}

interface ResponseDoneEvent {
  type: "response.done";
  response?: { id?: string; [key: string]: unknown };
}

interface ResponseAudioDeltaEvent {
  type: "response.audio.delta";
  /** Base-64 encoded PCM audio chunk. */
  delta: string;
  item_id?: string;
  response_id?: string;
}

interface ResponseAudioDoneEvent {
  type: "response.audio.done";
}

interface ResponseAudioTranscriptDeltaEvent {
  type: "response.audio_transcript.delta";
  /** Incremental text fragment. */
  delta: string;
}

interface ResponseAudioTranscriptDoneEvent {
  type: "response.audio_transcript.done";
  /** Full completed transcript text. */
  transcript: string;
}

interface InputAudioBufferSpeechStartedEvent {
  type: "input_audio_buffer.speech_started";
}

interface InputAudioBufferSpeechStoppedEvent {
  type: "input_audio_buffer.speech_stopped";
}

interface ConversationItemInputAudioTranscriptionCompletedEvent {
  type: "conversation.item.input_audio_transcription.completed";
  transcript: string;
  item_id?: string;
}

interface ErrorEvent {
  type: "error";
  error?: {
    type?: string;
    code?: string;
    message?: string;
    param?: string | null;
  };
}

interface UnknownEvent {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Client-to-server message builders (internal helpers)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use {@link QwenToolDefinition}. Retained for backwards-compat
 * with callers that pre-dated Qwen 3.5 function calling.
 */
export interface QwenTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}

/** Full session configuration payload for `session.update`. */
interface SessionUpdatePayload {
  model?: string;
  modalities?: string[];
  voice?: string;
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: { model: string };
  turn_detection?:
    | { type: string; interrupt_response?: boolean; create_response?: boolean }
    | null;
  instructions?: string;
  tools?: QwenToolDefinition[];
  enable_search?: boolean;
  search_options?: { enable_source?: boolean };
}

// ---------------------------------------------------------------------------
// EventEmitter typed interface
// ---------------------------------------------------------------------------

/** Strongly-typed event map for {@link QwenRealtimeClient}. */
interface QwenClientEvents {
  connected: [];
  disconnected: [code: number, reason: string];
  /** Emitted when the session ends and no further reconnection will occur. */
  sessionEnd: [];
  sessionCreated: [sessionId: string];
  textDelta: [text: string];
  textDone: [transcript: string];
  audioDelta: [pcm: Buffer, sampleRate: number];
  audioDone: [];
  speechStarted: [];
  speechStopped: [];
  userTranscript: [transcript: string];
  responseStarted: [];
  responseDone: [];
  functionCall: [call: QwenFunctionCall];
  error: [error: Error];
}

// ---------------------------------------------------------------------------
// Main client class
// ---------------------------------------------------------------------------

/**
 * WebSocket client for the Qwen3.5-omni Realtime API (DashScope).
 *
 * @example
 * ```ts
 * const client = new QwenRealtimeClient(
 *   { apiKey: process.env.DASHSCOPE_API_KEY! },
 *   {
 *     onAudioResponse: (pcm) => speaker.write(pcm),
 *     onTextResponse: (text, isDelta) => console.log(text),
 *   },
 *   "You are WinClaw, a helpful digital assistant..."
 * );
 *
 * await client.connect();
 * client.sendAudio(micChunk);
 * // ...
 * await client.disconnect();
 * ```
 */
export class QwenRealtimeClient extends EventEmitter {
  // -------------------------------------------------------------------------
  // Resolved configuration
  // -------------------------------------------------------------------------

  private readonly _apiKey: string;
  private readonly _model: string;
  private readonly _voice: string;
  private readonly _voiceModel: string;
  private readonly _serverVad: boolean;
  private readonly _inputAudioFormat: string;
  private readonly _outputAudioFormat: string;
  private readonly _sampleRate: number;
  private readonly _maxReconnectAttempts: number;
  private readonly _reconnectBaseDelayMs: number;

  /** Output sample rate advertised to audio callbacks. DashScope typically sends 24 000 Hz. */
  private readonly _outputSampleRate = 24_000;

  // -------------------------------------------------------------------------
  // Runtime state
  // -------------------------------------------------------------------------

  private _ws: WebSocket | null = null;
  private _sessionId: string | null = null;
  private _isConnected = false;
  private _isConnecting = false;

  /**
   * Anti-echo gate.
   *
   * Set to `true` synchronously on `response.created` and back to `false` on
   * `response.done`. While true, {@link sendAudio} and {@link sendVideo}
   * silently discard incoming data so that speaker output cannot feed back
   * into the microphone and create an echo/duplicate-response loop.
   *
   * Matching the Python original, this flag is mutated **synchronously** inside
   * the `message` WebSocket handler — no async bridging is involved, giving
   * zero-latency echo suppression.
   */
  private _isResponding = false;

  /**
   * Latched when a caller requested a `response.create` while Qwen was
   * already generating. Flushed on the next `response.done`. Prevents the
   * "Conversation already has an active response" API error in Phase C's
   * async-receipt flow (notification/tool-result injection during ACK).
   */
  private _pendingResponseCreate = false;

  /**
   * When true, Qwen is used only for STT + TTS. VAD-triggered auto-responses
   * are immediately cancelled. Only explicit sendText("[TTS] ...") triggers audio.
   */
  private _ttsOnly = false;
  /** Number of pending explicit TTS requests (sendText increments, response.created decrements) */
  private _pendingTtsCount = 0;
  /** When true, current response is a suppressed VAD auto-response — don't emit audio/text callbacks */
  private _suppressCurrentResponse = false;

  /**
   * Guards against sending video frames before any audio has been sent.
   * DashScope requires audio to be appended before it will accept image/video
   * data within the same turn.
   */
  private _audioAppended = false;

  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _disconnectRequested = false;

  /**
   * Manual keep-alive ping timer. The `ws` client (unlike `ws.Server`) does
   * not support a `pingInterval` ClientOption, so we drive pings ourselves.
   */
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly _PING_INTERVAL_MS = 20_000;

  /** Current instructions string — kept so `updateInstructions` can diff. */
  private _currentInstructions: string;

  /** Currently registered tool definitions; sent with `session.update`. */
  private _tools: QwenToolDefinition[] = [];

  /** Registered callbacks (optional convenience layer on top of EventEmitter). */
  private readonly _callbacks: QwenCallbacks;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * Create a new Qwen Realtime client.
   *
   * @param config - Connection and model configuration.
   * @param callbacks - Optional callback object. Equivalent to calling `.on()`
   *   on the EventEmitter but typed and registered before the first connect.
   * @param instructions - Initial system instructions injected into
   *   `session.update`. Hot-reload via {@link updateInstructions}.
   */
  constructor(
    config: QwenConfig,
    callbacks: QwenCallbacks = {},
    instructions = ""
  ) {
    super();

    this._apiKey = config.apiKey;
    this._model = config.model ?? "qwen3.5-omni-flash-realtime";
    this._voice = config.voice ?? DEFAULT_VOICE;
    this._voiceModel = config.voiceModel ?? "gummy-realtime-v1";
    this._serverVad = config.serverVad ?? true;
    this._inputAudioFormat = config.inputAudioFormat ?? "pcm16";
    this._outputAudioFormat = config.outputAudioFormat ?? "pcm16";
    this._sampleRate = config.sampleRate ?? 16_000;
    this._maxReconnectAttempts = config.maxReconnectAttempts ?? 5;
    this._reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? 1_000;

    this._callbacks = callbacks;
    this._currentInstructions = instructions;

    // Wire optional callback object to EventEmitter events.
    this._bridgeCallbacks();
  }

  // -------------------------------------------------------------------------
  // Public lifecycle API
  // -------------------------------------------------------------------------

  /**
   * Establish the WebSocket connection to DashScope and send `session.update`.
   *
   * Safe to call multiple times — a no-op if already connected or connecting.
   *
   * @returns Resolves to `true` on success, `false` on timeout or error.
   */
  async connect(): Promise<boolean> {
    if (this._isConnected) {
      console.warn("[Qwen] Already connected — ignoring connect() call");
      return true;
    }
    if (this._isConnecting) {
      console.warn("[Qwen] Connection already in progress");
      return false;
    }

    this._disconnectRequested = false;
    return this._doConnect();
  }

  /**
   * Gracefully close the WebSocket connection and cancel any pending
   * reconnection timers.
   */
  async disconnect(): Promise<void> {
    this._disconnectRequested = true;
    this._cancelReconnect();
    this._closeSocket(1000, "Client requested disconnect");
    this._isConnected = false;
    this._isConnecting = false;
  }

  // -------------------------------------------------------------------------
  // Public messaging API
  // -------------------------------------------------------------------------

  /**
   * Send a raw PCM-16 audio chunk to the server's input audio buffer.
   *
   * Audio is silently discarded when:
   * - The client is not connected.
   * - `_isResponding` is true (anti-echo gate active).
   *
   * @param pcm - Raw PCM-16 mono audio bytes at {@link QwenConfig.sampleRate}.
   * @returns `true` if the chunk was accepted and sent, `false` otherwise.
   */
  sendAudio(pcm: Buffer): boolean {
    if (!this._isConnected || !this._ws) return false;

    // Anti-echo: silently discard mic audio while the AI is responding.
    if (this._isResponding) return true;

    try {
      this._sendMessage({
        type: "input_audio_buffer.append",
        audio: pcm.toString("base64"),
      });

      if (!this._audioAppended) {
        this._audioAppended = true;
        console.log("[Qwen] First audio chunk sent — video frames now permitted");
      }

      return true;
    } catch (err) {
      console.error("[Qwen] sendAudio failed:", err);
      return false;
    }
  }

  /**
   * Send a JPEG/PNG video frame as base-64 to the server.
   *
   * Frames are silently dropped when:
   * - No audio has been sent yet (DashScope requires audio before video).
   * - `_isResponding` is true (anti-echo gate).
   *
   * @param frameData - Raw JPEG or PNG image bytes.
   * @returns `true` if the frame was accepted and sent, `false` on error.
   */
  sendVideo(frameData: Buffer): boolean {
    if (!this._isConnected || !this._ws) {
      this._logVideoDrop("not_connected");
      return false;
    }

    // DashScope requires audio to precede video in the same turn.
    if (!this._audioAppended) {
      this._logVideoDrop("no_audio_yet");
      return true;
    }

    // Anti-echo gate.
    if (this._isResponding) {
      this._logVideoDrop("is_responding");
      return true;
    }

    try {
      // Qwen 3.5-omni-flash-realtime uses `input_image_buffer.append` for
      // continuous video frames (confirmed via scripts/test-qwen35-video.ts).
      // The legacy `input_audio_buffer.append_video` name was rejected with
      // "Invalid value" so no frame reached the model previously.
      this._sendMessage({
        type: "input_image_buffer.append",
        image: frameData.toString("base64"),
      });
      this._videoFrameCount++;
      // Log every 10th frame to confirm the video stream reaches Qwen without spamming.
      if (this._videoFrameCount % 10 === 1) {
        console.log(
          `[Qwen] 📹 video frame sent  seq=${this._videoFrameCount}  bytes=${frameData.length}`,
        );
      }
      return true;
    } catch (err) {
      console.error("[Qwen] sendVideo failed:", err);
      return false;
    }
  }

  private _videoFrameCount = 0;
  private _videoDropReasonCounts: Record<string, number> = {};
  private _logVideoDrop(reason: string): void {
    const prev = this._videoDropReasonCounts[reason] ?? 0;
    const next = prev + 1;
    this._videoDropReasonCounts[reason] = next;
    // Log the first drop of each reason + every 30th after that.
    if (next === 1 || next % 30 === 0) {
      console.warn(
        `[Qwen] 📹 video frame dropped  reason=${reason}  count=${next}`,
      );
    }
  }

  /**
   * Send a plain-text message from the user and request an AI response.
   *
   * Equivalent to `conversation.item.create` + `response.create`.
   *
   * @param text - The user message content.
   * @returns `true` if both messages were queued successfully.
   */
  sendText(text: string): boolean {
    if (!this._isConnected || !this._ws) {
      console.error("[Qwen] sendText called while not connected");
      return false;
    }
    if (this._isResponding) {
      console.warn("[Qwen] sendText called while responding — queuing may fail");
    }

    try {
      // Increment pending TTS counter so response.created knows this is explicit
      this._pendingTtsCount++;
      console.log(`[Qwen] sendText: "${text.substring(0, 50)}..." isResponding=${this._isResponding} wsState=${this._ws?.readyState}`);

      this._sendMessage({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });

      this._sendMessage({ type: "response.create" });
      console.log("[Qwen] sendText: conversation.item.create + response.create sent");
      return true;
    } catch (err) {
      this._pendingTtsCount = Math.max(0, this._pendingTtsCount - 1);
      console.error("[Qwen] sendText failed:", err);
      return false;
    }
  }

  /**
   * Hot-reload the session instructions without reconnecting.
   *
   * Sends `session.update` with only the `instructions` field so that the
   * model's identity/personality can be refreshed at runtime (e.g. after the
   * user edits `SOUL.md`).
   *
   * @param newInstructions - Updated system-prompt string.
   * @returns `true` if the update was sent, `false` if not connected.
   */
  updateInstructions(newInstructions: string): boolean {
    if (!this._isConnected || !this._ws) {
      // Store for next connect().
      this._currentInstructions = newInstructions;
      return false;
    }

    this._currentInstructions = newInstructions;
    this._sendSessionUpdate({ instructions: newInstructions });
    return true;
  }

  // -------------------------------------------------------------------------
  // Public function-calling API
  // -------------------------------------------------------------------------

  /**
   * Register tool definitions for the session.
   *
   * Can be called before {@link connect} to seed the initial session, or at any
   * point afterwards to hot-swap the tool catalogue.
   *
   * @param tools - Full list of tools. Replaces any previously-registered set.
   */
  setTools(tools: QwenToolDefinition[]): void {
    this._tools = tools;
    if (this._isConnected && this._ws) {
      this._sendSessionUpdate({ tools });
    }
  }

  /** Read-only view of the currently registered tools. */
  get tools(): readonly QwenToolDefinition[] {
    return this._tools;
  }

  /**
   * Send a function-call result back to the model and request a new response.
   *
   * @param callId - The `callId` from the {@link QwenFunctionCall} received on
   *   the `functionCall` event / `onFunctionCall` callback.
   * @param resultJson - JSON-encoded result payload (conventionally a
   *   `{ status, ... }` object — see proposal doc §3.5).
   */
  async sendFunctionResult(callId: string, resultJson: string): Promise<void> {
    this._sendMessage({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: resultJson,
      },
    });
    // Safety: Qwen may still be speaking an ACK ("承知しました") when the
    // tool result arrives. Defer `response.create` to `response.done` to
    // avoid "Conversation already has an active response".
    this._triggerResponseSafely();
  }

  /**
   * Inject a system-role event into the conversation and trigger a response.
   *
   * Primary use case: owner notifications pushed from Winclaw (new mail, task
   * completion, calendar reminders) that should be spoken out loud.
   *
   * Safety: if Qwen is currently generating a response, the `response.create`
   * is deferred until `response.done` fires — sending it now would yield
   * `Conversation already has an active response` from the API.
   *
   * @param text - System message content (often prefixed with a tag such as
   *   `[OWNER NOTIFICATION]`).
   */
  async sendSystemEvent(text: string): Promise<void> {
    this._sendMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text }],
      },
    });
    this._triggerResponseSafely();
  }

  /**
   * Trigger a response without injecting any new conversation item.
   *
   * Safety: defers to `response.done` if Qwen is mid-speech.
   */
  async createResponse(): Promise<void> {
    this._triggerResponseSafely();
  }

  /**
   * Schedule a `response.create` — send immediately if idle, else defer
   * until the current response completes. Prevents the Qwen API error
   * "Conversation already has an active response".
   */
  private _triggerResponseSafely(): void {
    if (this._isResponding) {
      this._pendingResponseCreate = true;
      console.log(
        "[Qwen] response.create deferred (active response in flight) — will fire on response.done",
      );
      return;
    }
    this._sendMessage({ type: "response.create" });
  }

  // -------------------------------------------------------------------------
  // Public read-only state
  // -------------------------------------------------------------------------

  /** `true` while the WebSocket is open and `session.created` has been received. */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /** The DashScope session ID assigned at session creation, or `null`. */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** `true` while the server is generating a response (anti-echo gate is active). */
  get isResponding(): boolean {
    return this._isResponding;
  }

  /** Enable TTS-only mode: VAD auto-responses are cancelled, only explicit TTS works. */
  set ttsOnly(value: boolean) {
    this._ttsOnly = value;
  }

  // -------------------------------------------------------------------------
  // Internal: connection management
  // -------------------------------------------------------------------------

  /** Core connection routine. Returns `true` on success. */
  private async _doConnect(): Promise<boolean> {
    this._isConnecting = true;

    try {
      await this._openWebSocket();
      // _onOpen() / _onMessage() will fire asynchronously from here.
      return true;
    } catch (err) {
      console.error("[Qwen] _doConnect error:", err);
      this._isConnecting = false;
      await this._scheduleReconnect();
      return false;
    }
  }

  /**
   * Open the WebSocket and attach all event handlers.
   * Returns a Promise that resolves once the socket is open (or rejects on
   * connection failure).
   */
  private _openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(this._model)}`;
      // NOTE: the `ws` client does NOT support a `pingInterval` ClientOption
      // (that option only exists on `ws.Server`). Keep-alive pings are driven
      // manually via `_startPingLoop()` once the socket is open.
      const ws = new WebSocket(
        wsUrl,
        {
          headers: {
            Authorization: `Bearer ${this._apiKey}`,
          },
        }
      );
      console.log(`[Qwen] Connecting to ${wsUrl.replace(/Bearer .{8}/, 'Bearer ****')}`);

      let settled = false;

      ws.once("open", () => {
        if (!settled) {
          settled = true;
          resolve();
        }
        this._onOpen(ws);
      });

      ws.once("error", (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
        this._onError(err);
      });

      ws.on("message", (data) => {
        this._onMessage(data);
      });

      ws.once("close", (code, reason) => {
        this._onClose(code, reason.toString());
      });

      this._ws = ws;
    });
  }

  /** Handle WebSocket open — send `session.update`. */
  private _onOpen(ws: WebSocket): void {
    console.log("[Qwen] WebSocket open — sending session.update");
    this._isConnecting = false;
    this._reconnectAttempts = 0;

    this._sendSessionUpdate(this._buildFullSessionPayload(), ws);
    this._startPingLoop();
    // Connection is considered established once session.created arrives.
  }

  /** Start manual keep-alive ping loop. No-op if already running. */
  private _startPingLoop(): void {
    this._stopPingLoop();
    this._pingTimer = setInterval(() => {
      const ws = this._ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (err) {
          console.warn("[Qwen] ping failed:", err);
        }
      }
    }, QwenRealtimeClient._PING_INTERVAL_MS);
  }

  /** Stop the manual keep-alive ping loop. Idempotent. */
  private _stopPingLoop(): void {
    if (this._pingTimer !== null) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  /** Handle incoming WebSocket messages. */
  private _onMessage(raw: WebSocket.RawData): void {
    let event: QwenServerEvent;
    try {
      event = JSON.parse(raw.toString()) as QwenServerEvent;
    } catch {
      console.error("[Qwen] Received non-JSON message — ignored");
      return;
    }

    const type = event.type;
    console.log(`[Qwen] event: ${type}`);

    try {
      switch (type) {
        // -------------------------------------------------------
        // Session lifecycle
        // -------------------------------------------------------
        case "session.created": {
          const ev = event as SessionCreatedEvent;
          this._sessionId = ev.session.id;
          this._isConnected = true;
          console.log(`[Qwen] Session created: ${this._sessionId}`);
          this.emit("sessionCreated", this._sessionId);
          this.emit("connected");
          break;
        }

        case "session.updated":
          // Informational — no action required.
          break;

        // -------------------------------------------------------
        // VAD events
        // -------------------------------------------------------
        case "input_audio_buffer.speech_started":
          console.debug("[Qwen] VAD: speech started");
          this.emit("speechStarted");
          break;

        case "input_audio_buffer.speech_stopped":
          console.debug("[Qwen] VAD: speech stopped");
          this.emit("speechStopped");
          break;

        // -------------------------------------------------------
        // User transcription
        // -------------------------------------------------------
        case "conversation.item.input_audio_transcription.completed": {
          const ev =
            event as ConversationItemInputAudioTranscriptionCompletedEvent;
          const transcript = ev.transcript ?? "";
          console.log(`[Qwen] User transcript (${transcript.length} chars)`);
          this.emit("userTranscript", transcript);
          break;
        }

        // -------------------------------------------------------
        // Streaming text response
        // -------------------------------------------------------
        case "response.audio_transcript.delta": {
          const ev = event as ResponseAudioTranscriptDeltaEvent;
          const delta = ev.delta ?? "";
          if (delta) this.emit("textDelta", delta);
          break;
        }

        case "response.audio_transcript.done": {
          const ev = event as ResponseAudioTranscriptDoneEvent;
          const full = ev.transcript ?? "";
          console.log(`[Qwen] Assistant transcript complete (${full.length} chars)`);
          this.emit("textDone", full);
          break;
        }

        // -------------------------------------------------------
        // Streaming audio response
        // -------------------------------------------------------
        case "response.audio.delta": {
          const ev = event as ResponseAudioDeltaEvent;
          if (ev.delta) {
            try {
              const pcm = Buffer.from(ev.delta, "base64");
              const listeners = this.listenerCount("audioDelta");
              if (listeners === 0) {
                console.warn("[Qwen] audioDelta has 0 listeners!");
              }
              this.emit("audioDelta", pcm, this._outputSampleRate);
            } catch (decodeErr) {
              console.error("[Qwen] Audio base-64 decode failed:", decodeErr);
            }
          }
          break;
        }

        case "response.audio.done":
          this.emit("audioDone");
          break;

        // -------------------------------------------------------
        // Response lifecycle
        // -------------------------------------------------------
        case "response.created": {
          // In TTS-only mode: if no pending TTS request, this is a VAD auto-response.
          // Suppress its callbacks so no unwanted audio reaches the DH engine.
          if (this._ttsOnly && this._pendingTtsCount <= 0) {
            this._suppressCurrentResponse = true;
            console.log(`[Qwen] response.created — SUPPRESSED (VAD auto, pendingTts=${this._pendingTtsCount})`);
          } else {
            this._pendingTtsCount--;
            this._suppressCurrentResponse = false;
            console.log(`[Qwen] response.created — TTS accepted (remaining=${this._pendingTtsCount})`);
          }

          this._isResponding = true;
          this._audioAppended = false;
          if (!this._suppressCurrentResponse) {
            this.emit("responseStarted");
          }
          break;
        }

        case "response.done": {
          const wasSuppressed = this._suppressCurrentResponse;
          this._isResponding = false;
          this._suppressCurrentResponse = false;
          console.log(`[Qwen] response.done — mic unblocked${wasSuppressed ? " (was suppressed VAD)" : ""}`);
          // Always emit responseDone so TTS queue can proceed.
          // Handler checks ttsInProgress to decide what to do.
          this.emit("responseDone");
          // If a caller requested `response.create` while we were mid-speech,
          // flush it now. See {@link _triggerResponseSafely}.
          if (this._pendingResponseCreate) {
            this._pendingResponseCreate = false;
            console.log("[Qwen] flushing deferred response.create");
            try {
              this._sendMessage({ type: "response.create" });
            } catch (err) {
              console.warn("[Qwen] deferred response.create failed:", err);
            }
          }
          break;
        }

        // -------------------------------------------------------
        // Function calling
        // -------------------------------------------------------
        case "response.function_call_arguments.done": {
          const ev = event as UnknownEvent;
          const call: QwenFunctionCall = {
            callId: String(ev.call_id ?? ""),
            name: String(ev.name ?? ""),
            argumentsJson:
              typeof ev.arguments === "string" ? ev.arguments : "",
          };
          console.log(
            `[Qwen] function_call: ${call.name} (${call.callId}) args=${call.argumentsJson.slice(0, 120)}`
          );
          this.emit("functionCall", call);
          break;
        }

        // -------------------------------------------------------
        // Errors
        // -------------------------------------------------------
        case "error": {
          const ev = event as ErrorEvent;
          const msg = ev.error?.message ?? "Unknown Qwen error";
          const code = ev.error?.code ?? "";
          const errStr = code ? `[${code}] ${msg}` : msg;
          console.error(`[Qwen] API error: ${errStr}`);
          this.emit("error", new Error(`Qwen API error: ${errStr}`));
          break;
        }

        default:
          console.debug(`[Qwen] Unhandled event type: ${type}`);
      }
    } catch (handlerErr) {
      console.error("[Qwen] Error inside message handler:", handlerErr);
    }
  }

  /** Handle WebSocket error events. */
  private _onError(err: Error): void {
    console.error("[Qwen] WebSocket error:", err.message);
    this.emit("error", err);
  }

  /** Handle WebSocket close. Triggers reconnection if appropriate. */
  private _onClose(code: number, reason: string): void {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    this._isConnecting = false;
    this._isResponding = false;
    this._stopPingLoop();
    this._ws = null;

    console.warn(
      `[Qwen] WebSocket closed: code=${code} reason="${reason}" wasConnected=${wasConnected}`
    );

    this.emit("disconnected", code, reason);
    this.emit("sessionEnd");

    if (!this._disconnectRequested) {
      this._scheduleReconnect().catch(console.error);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: reconnection
  // -------------------------------------------------------------------------

  /**
   * Schedule an exponential back-off reconnection attempt.
   * If `maxReconnectAttempts` is 0 or exhausted, emits `sessionEnd` and stops.
   */
  private async _scheduleReconnect(): Promise<void> {
    if (this._disconnectRequested) return;
    if (this._maxReconnectAttempts === 0) return;
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error(
        `[Qwen] Reconnect limit (${this._maxReconnectAttempts}) reached — giving up`
      );
      return;
    }

    this._reconnectAttempts++;
    const delay =
      this._reconnectBaseDelayMs * Math.pow(2, this._reconnectAttempts - 1);

    console.log(
      `[Qwen] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`
    );

    await new Promise<void>((resolve) => {
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        resolve();
      }, delay);
    });

    if (!this._disconnectRequested) {
      await this._doConnect();
    }
  }

  /** Cancel any pending reconnect timer. */
  private _cancelReconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /** Attempt to close the socket gracefully. */
  private _closeSocket(code = 1000, reason = ""): void {
    this._stopPingLoop();
    if (this._ws) {
      try {
        this._ws.close(code, reason);
      } catch {
        // Ignore errors during close.
      }
      this._ws = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internal: protocol helpers
  // -------------------------------------------------------------------------

  /**
   * Build a complete `session.update` session payload from the current config.
   */
  private _buildFullSessionPayload(): SessionUpdatePayload {
    const payload: SessionUpdatePayload = {
      modalities: ["text", "audio"],
      voice: this._voice,
      input_audio_format: this._inputAudioFormat,
      output_audio_format: this._outputAudioFormat,
      input_audio_transcription: { model: this._voiceModel },
      turn_detection: this._serverVad
        ? { type: "server_vad", interrupt_response: true, create_response: true }
        : null,
      instructions: this._currentInstructions || undefined,
      // NOTE: enable_search is only supported by qwen3.5-omni-plus-realtime,
      // NOT by qwen3.5-omni-flash-realtime (causes "Access denied" disconnect).
      // Uncomment when upgrading to plus model:
      // enable_search: true,
      // search_options: { enable_source: true },
    };
    if (this._tools.length > 0) {
      payload.tools = this._tools;
    }
    return payload;
  }

  /**
   * Send a `session.update` message with an arbitrary partial payload.
   *
   * @param payload - Fields to include in `session`.
   * @param ws - Optional socket override (used during `_onOpen` before
   *   `this._ws` is stable).
   */
  private _sendSessionUpdate(
    payload: SessionUpdatePayload,
    ws?: WebSocket
  ): void {
    this._sendMessage({ type: "session.update", session: payload }, ws);
  }

  /**
   * Serialise and send a JSON message over the active WebSocket.
   *
   * @param msg - Any JSON-serialisable object.
   * @param ws - Socket override; defaults to `this._ws`.
   * @throws If the socket is null or not open.
   */
  private _sendMessage(msg: unknown, ws?: WebSocket): void {
    const socket = ws ?? this._ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    socket.send(JSON.stringify(msg));
  }

  // -------------------------------------------------------------------------
  // Internal: callback bridge
  // -------------------------------------------------------------------------

  /**
   * Wire the {@link QwenCallbacks} object to EventEmitter events so that
   * consumers can use either interface style interchangeably.
   */
  private _bridgeCallbacks(): void {
    const cb = this._callbacks;

    if (cb.onTextResponse) {
      this.on("textDelta", (text: string) => {
        void this._invoke(cb.onTextResponse!, text, true);
      });
      this.on("textDone", (transcript: string) => {
        void this._invoke(cb.onTextResponse!, transcript, false);
      });
    }

    if (cb.onAudioResponse) {
      this.on("audioDelta", (pcm: Buffer, sampleRate: number) => {
        void this._invoke(cb.onAudioResponse!, pcm, sampleRate);
      });
    }

    if (cb.onUserTranscript) {
      this.on("userTranscript", (transcript: string) => {
        void this._invoke(cb.onUserTranscript!, transcript);
      });
    }

    if (cb.onResponseStarted) {
      this.on("responseStarted", () => {
        void this._invoke(cb.onResponseStarted!);
      });
    }

    if (cb.onResponseDone) {
      this.on("responseDone", () => {
        void this._invoke(cb.onResponseDone!);
      });
    }

    if (cb.onError) {
      this.on("error", (err: Error) => {
        void this._invoke(cb.onError!, err);
      });
    }

    if (cb.onSessionEnd) {
      this.on("sessionEnd", () => {
        void this._invoke(cb.onSessionEnd!);
      });
    }

    if (cb.onFunctionCall) {
      this.on("functionCall", (call: QwenFunctionCall) => {
        void this._invoke(cb.onFunctionCall!, call);
      });
    }
  }

  /**
   * Safely invoke a callback that may return a Promise, swallowing errors so
   * that a failing callback never crashes the WebSocket message handler.
   */
  private async _invoke<TArgs extends unknown[]>(
    fn: (...args: TArgs) => void | Promise<void>,
    ...args: TArgs
  ): Promise<void> {
    try {
      const result = fn(...args);
      if (result instanceof Promise) await result;
    } catch (err) {
      console.error("[Qwen] Callback threw an error:", err);
    }
  }

  // -------------------------------------------------------------------------
  // EventEmitter typed overrides
  // -------------------------------------------------------------------------

  // The overloads below provide IDE auto-complete for event names / argument
  // types without requiring a third-party typed EventEmitter library.

  emit<K extends keyof QwenClientEvents>(
    event: K,
    ...args: QwenClientEvents[K]
  ): boolean;
  emit(event: string, ...args: unknown[]): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof QwenClientEvents>(
    event: K,
    listener: (...args: QwenClientEvents[K]) => void
  ): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  once<K extends keyof QwenClientEvents>(
    event: K,
    listener: (...args: QwenClientEvents[K]) => void
  ): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this {
    return super.once(event, listener);
  }

  off<K extends keyof QwenClientEvents>(
    event: K,
    listener: (...args: QwenClientEvents[K]) => void
  ): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}
