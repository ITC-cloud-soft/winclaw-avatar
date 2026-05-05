/**
 * @fileoverview RealtimeSessionHandler — orchestrates a single digital-human
 * voice session.
 *
 * Two runtime modes are supported, selected by `config.dhMode` (overridable via
 * the `DH_MODE` env var — see {@link resolveDhMode}):
 *
 * 1. **`"function_calling"`** (default, new) — Qwen 3.5 Realtime handles
 *    speech understanding, reasoning, and TTS in a single WebSocket. Tool
 *    calls are dispatched through {@link ToolRouter} against winclaw's
 *    memory-core, task runner, and channel registry. Instructions are built
 *    by {@link buildInstructions} so SOUL.md / IDENTITY.md drive personality.
 *
 *    ```
 *    User audio ──► Qwen 3.5 Realtime ──┬─► audio out ─► ByteDance DH
 *                                        └─► function_call ─► ToolRouter
 *                                                              ↳ memory / task / channel
 *    ```
 *
 *    Phase 3 (NotifyBridge) hooks into the live `QwenRealtimeClient` via the
 *    {@link RealtimeSessionHandler.getQwenClient} getter to inject owner
 *    notifications with `sendSystemEvent` + `createResponse`.
 *
 * 2. **`"legacy_pipeline"`** (fallback) — the original three-stage flow:
 *
 *    ```
 *    User audio → Qwen STT → transcript → Gateway chat.send → Agent
 *      → Agent answer → chat event → Qwen TTS → audio → ByteDance DH
 *    ```
 *
 *    Preserved unchanged so we can A/B-switch or roll back instantly.
 */

import type { EventEmitter } from "node:events";
import WebSocket from "ws";

import { QwenRealtimeClient } from "./integrations/qwen-realtime.js";
import { NotifyBridge } from "./notify-bridge.js";
import { DigitalHumanManager } from "./integrations/byteplus-rtc.js";
import { AudioResampler } from "./integrations/audio-resampler.js";
import { IdentityLoader } from "./identity-loader.js";
import { resolveDhMode, type DhMode, type DigitalHumanConfig } from "./config.js";
import type { GatewayBridge, ChatEventPayload } from "./gateway-bridge.js";
import { synthesizeSpeech } from "./integrations/qwen-tts.js";
import { WINCLAW_DH_TOOLS } from "./tools/catalog.js";
import { ToolRouter } from "./tool-router.js";
import type { WebSearchResult } from "./tool-router.js";
import type { MemoryCorePlugin } from "./memory-bridge.js";
import { buildInstructions } from "./instructions-builder.js";

/**
 * Dependencies for constructing a RealtimeSessionHandler.
 */
export interface HandlerDeps {
  sessionId: string;
  ws: WebSocket;
  config: DigitalHumanConfig;
  workspaceDir: string;
  gwBridge: GatewayBridge;
  /**
   * Memory-core plugin instance — required when running in
   * `function_calling` mode (ToolRouter dispatches `memory_search` /
   * `memory_get` against it). Ignored in `legacy_pipeline` mode.
   */
  memory?: MemoryCorePlugin;
  /**
   * Optional Winclaw event bus. When provided alongside
   * `dhMode === "function_calling"`, the handler constructs a
   * {@link NotifyBridge} that injects owner notifications (email, task,
   * calendar, channel) into the live Qwen session. Omitting the bus is
   * graceful — no bridge is created and voice operates exactly as before.
   */
  winclawBus?: EventEmitter;
  /**
   * Optional web-search adapter backed by a Winclaw-native search capability.
   * When supplied, the `internet_search` tool uses it. Note: this is
   * mutually exclusive with Qwen's built-in `enable_search` flag (which we
   * do NOT use in function_calling mode — tools and enable_search cannot
   * coexist on Qwen Realtime).
   */
  webSearchFn?: (query: string) => Promise<WebSearchResult>;
}

// Wire-protocol message shapes sent to the browser client
type ClientMessage =
  | { type: "dh_stream_info"; data: Record<string, unknown> }
  | { type: "ai_audio"; data: { audio: string; format: "pcm16"; sample_rate: number } }
  | { type: "ai_text"; data: { content: string; is_delta: boolean } }
  | { type: "ai_thinking"; data: { thinking: boolean } }
  | { type: "user_transcript"; data: { content: string } }
  | { type: "ai_response_started" }
  | { type: "ai_response_done" }
  | { type: "tool_call"; data: { name: string; args: string; callId: string } }
  | {
      type: "tool_result";
      data: {
        name: string;
        callId: string;
        status: "ok" | "failed";
        summary?: string;
        error?: string;
      };
    }
  | { type: "error"; data: { message: string } };

// ---------------------------------------------------------------------------
// RealtimeSessionHandler
// ---------------------------------------------------------------------------

export class RealtimeSessionHandler {
  private readonly sessionId: string;
  private readonly ws: WebSocket;
  private readonly config: DigitalHumanConfig;
  private readonly workspaceDir: string;
  private readonly gwBridge: GatewayBridge;
  private readonly memory: MemoryCorePlugin | undefined;
  private readonly winclawBus: EventEmitter | undefined;
  private readonly webSearchFn:
    | ((query: string) => Promise<WebSearchResult>)
    | undefined;
  /** Resolved mode after env-override. See {@link resolveDhMode}. */
  private readonly dhMode: DhMode;

  /** Gateway session key — unified with webchat for full context sharing. */
  readonly sessionKey: string;
  /**
   * Dedicated notification session key for this DH session. Winclaw
   * components can call `gateway.request("notify.dh", { sessionId, ... })`
   * to target this avatar specifically.
   */
  readonly notifySessionKey: string;
  /**
   * Well-known broadcast key subscribed by every DH session. Callers that
   * omit `sessionId` on `notify.dh` reach all active avatars via this key.
   */
  readonly notifyBroadcastSessionKey = "dh-notify:broadcast";

  private qwenClient!: QwenRealtimeClient;
  /** Tool router — only populated in `function_calling` mode. */
  private toolRouter: ToolRouter | null = null;
  /**
   * NotifyBridge — only populated in `function_calling` mode when a
   * `winclawBus` is supplied via {@link HandlerDeps}.
   */
  private notifyBridge: NotifyBridge | null = null;
  private dhManager!: DigitalHumanManager;
  private dhLiveId!: string;
  private identityLoader!: IdentityLoader;
  private readonly audioResampler: AudioResampler = new AudioResampler();

  // DH audio buffering — paced at real-time rate to keep lip sync aligned
  private dhAudioBuffer: Buffer = Buffer.alloc(0);
  private static readonly DH_MIN_FRAME_SIZE = 1_280; // 40ms @ 16kHz/16bit/mono
  private static readonly DH_PACE_INTERVAL_MS = 40;  // Send one frame every 40ms (real-time)
  // Minimum buffer level before starting to drain (prevents underrun jitter)
  private static readonly DH_MIN_BUFFER_BYTES = 6_400; // 200ms @ 16kHz/16bit
  private dhPaceTimer: ReturnType<typeof setInterval> | null = null;
  private dhPaceStarted = false; // whether we've begun draining
  private dhLastDrainTime = 0;   // for elapsed-time-based frame counting

  // Raw PCM accumulator for clean resampling (avoids chunk-boundary artifacts)
  private rawPcm24kBuffer: Buffer = Buffer.alloc(0);

  // Session integration — track which runIds were issued by this DH session
  private pendingRunIds = new Set<string>();

  // TTS queue
  private ttsQueue: string[] = [];
  private ttsInProgress = false;

  // STT aggregation — accumulate VAD fragments into complete sentences
  private sttBuffer = "";
  private sttFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly STT_FLUSH_DELAY_MS = 2_000;

  // Delta TTS — track cumulative text and TTS each new sentence as it appears
  private deltaBuffer = "";
  private lastDeltaLength = 0; // track cumulative length to extract only new chars
  private static readonly SENTENCE_END = /[。！？.!?\n]/;

  // Lifecycle flags
  private initialized = false;
  private cleanedUp = false;

  constructor(deps: HandlerDeps) {
    this.sessionId = deps.sessionId;
    this.ws = deps.ws;
    this.config = deps.config;
    this.workspaceDir = deps.workspaceDir;
    this.gwBridge = deps.gwBridge;
    this.memory = deps.memory;
    this.winclawBus = deps.winclawBus;
    this.webSearchFn = deps.webSearchFn;
    this.dhMode = resolveDhMode(deps.config.dhMode);
    // DH voice session — unified with webchat for full context sharing.
    this.sessionKey = "agent:main:main";
    // Per-session notification channel — see notifyBroadcastSessionKey for
    // the fan-out variant.
    this.notifySessionKey = `dh-notify:${this.sessionId}`;
  }

  /**
   * Expose the underlying Qwen client so Phase 3's NotifyBridge can call
   * `sendSystemEvent` / `createResponse` to inject owner notifications.
   *
   * Returns `null` before {@link initialize} completes and after
   * {@link cleanup} runs. NotifyBridge implementations should register on
   * the handler and re-check this getter before every push.
   */
  getQwenClient(): QwenRealtimeClient | null {
    if (!this.initialized || this.cleanedUp) return null;
    return this.qwenClient ?? null;
  }

  /** Read-only view of the active DH mode for this handler. */
  get mode(): DhMode {
    return this.dhMode;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. Load identity (TTS-only instructions for Qwen)
    this.identityLoader = new IdentityLoader(this.workspaceDir, {
      maxInstructionsChars: this.config.identity?.maxInstructionsChars,
      voiceInstructions: this.config.identity?.voiceInstructions,
    });
    const identity = await this.identityLoader.load();
    console.info(`[Handler:${this.sessionId}] Identity loaded: ${identity.name} (dhMode=${this.dhMode})`);

    // 2. Connect Qwen Realtime. The callback set and instructions differ
    //    between the two dhModes — see the file-level docstring.
    const isFC = this.dhMode === "function_calling";

    const instructions = isFC
      ? buildInstructions({
          avatarName: identity.name,
          nickname: identity.nickname,
          relationship: identity.relationship,
          soulMd: identity.rawSoul,
          identityMd: identity.rawIdentity,
        })
      : identity.instructions;

    this.qwenClient = new QwenRealtimeClient(
      {
        apiKey: this.config.qwen.apiKey,
        model: this.config.qwen.model,
        voice: this.config.qwen.voice,
        voiceModel: this.config.qwen.voiceModel,
        serverVad: this.config.qwen.serverVad,
      },
      {
        onAudioResponse: (pcm, sampleRate) => this.handleQwenAudio(pcm, sampleRate),
        onTextResponse: (text, isDelta) => this.handleQwenText(text, isDelta),
        onUserTranscript: (transcript) => this.handleUserTranscript(transcript),
        onResponseStarted: () => this.handleResponseStarted(),
        onResponseDone: () => this.handleResponseDone(),
        onError: (err) => this.handleError(err),
      },
      instructions,
    );

    if (isFC) {
      // --- function_calling mode: wire ToolRouter + tools catalogue ---
      if (!this.memory) {
        console.warn(
          `[Handler:${this.sessionId}] dhMode=function_calling but no memory plugin supplied — tools that hit memory will fail closed.`,
        );
      }
      // Use a no-op memory if missing so the router never throws; the
      // returned user_message lets Qwen speak a clean failure notice.
      const memory: MemoryCorePlugin =
        this.memory ??
        ({
          search: async () => [],
          get: async () => "",
          markDirty: () => {},
          reindex: async () => {},
        } as MemoryCorePlugin);

      this.toolRouter = new ToolRouter({
        memory,
        gwBridge: this.gwBridge,
        sessionKey: this.sessionKey,
        dhSessionId: this.sessionId,
        webSearchFn: this.webSearchFn,
        earlyTimeoutMs: this.config.dhTool?.earlyTimeoutMs,
        lateTimeoutMs: this.config.dhTool?.lateTimeoutMs,
      });

      this.qwenClient.on("functionCall", (call) => {
        void this.dispatchFunctionCall(call);
      });

      // CRITICAL: register tools BEFORE connect() so the initial session.update
      // Qwen sends on open already includes the tool catalogue. If we set tools
      // after connect, Qwen's first message is "tools=[]" and it commits to a
      // no-tool behavior mode; the subsequent update_session({tools}) arrives
      // too late to change its stance. (Matches Python reference pattern.)
      this.qwenClient.setTools(WINCLAW_DH_TOOLS);
    }

    const connected = await this.qwenClient.connect();
    if (!connected) {
      throw new Error(`[Handler:${this.sessionId}] Failed to connect to Qwen`);
    }

    if (isFC) {
      // In FC mode Qwen itself produces the outbound audio — TTS-only must
      // stay OFF so VAD-triggered responses are actually delivered.

      // Wire NotifyBridge so Winclaw domain events (email/task/calendar/
      // channel) are spoken by the avatar. Graceful degradation — if no
      // winclawBus was supplied the bridge is simply not created.
      if (!this.winclawBus) {
        console.info(
          `[Handler:${this.sessionId}] NotifyBridge disabled (no winclawBus supplied by plugin host)`,
        );
      }
      if (this.winclawBus) {
        try {
          this.notifyBridge = new NotifyBridge({
            qwenClient: this.qwenClient,
            winclawBus: this.winclawBus,
          });
          console.info(
            `[Handler:${this.sessionId}] NotifyBridge active (winclawBus subscribed)`,
          );
        } catch (err) {
          console.error(
            `[Handler:${this.sessionId}] NotifyBridge init failed:`,
            err,
          );
          this.notifyBridge = null;
        }
      }

      // Also forward gateway chat events (with a notification marker) to
      // NotifyBridge. This is the "Winclaw → Agent → chat event → voice"
      // push path described in docs/dh-qwen35-function-calling-proposal.md.
      //
      // We attach to the DH session's gateway sessionKey. Events originating
      // from this session's own tool-call runs are ALSO delivered here, but
      // `pushFromChatEvent` filters by notification marker so regular agent
      // replies are not surfaced as OWNER NOTIFICATIONs.
      const notifyBridge = this.notifyBridge;
      if (notifyBridge) {
        this.gwBridge.onChatEvent(this.sessionKey, (payload) => {
          // Skip events that originate from this session's own tool-call
          // round-trips (chatSendAndWait). Those final messages are already
          // consumed by ToolRouter and returned to Qwen as tool results —
          // surfacing them again as OWNER NOTIFICATIONs would double-handle
          // the same reply.
          if (payload?.runId && this.gwBridge.isPendingRun(payload.runId)) {
            return;
          }
          notifyBridge.pushFromChatEvent(payload);
        });

        // Phase C — subscribe to dedicated notification channels. Winclaw
        // components (agents/skills/hooks/automations) use the `notify.dh`
        // gateway RPC to emit chat events on `dh-notify:<sessionId>` (or
        // `dh-notify:broadcast`). NotifyBridge receives these via the same
        // pushFromChatEvent entry point — priority markers (`[HIGH]`,
        // `[LOW]`, `[NOTIFY]`) steer delivery.
        this.gwBridge.onChatEvent(this.notifySessionKey, (payload) => {
          notifyBridge.pushFromChatEvent(payload);
        });
        this.gwBridge.onChatEvent(this.notifyBroadcastSessionKey, (payload) => {
          notifyBridge.pushFromChatEvent(payload);
        });
        console.info(
          `[Handler:${this.sessionId}] notify.dh subscribed keys=[${this.notifySessionKey}, ${this.notifyBroadcastSessionKey}]`,
        );
      }
    } else {
      // Enable TTS-only mode (legacy pipeline uses Qwen only for STT+TTS)
      this.qwenClient.ttsOnly = true;
    }

    // Memory is fully handled by the Gateway agent via chat.send.
    // No memory injection into Qwen — all reasoning goes through Gateway
    // which has embedding search, memory plugins, and full tool access.

    // 3. Start DH session (ByteDance virtual human)
    this.dhManager = new DigitalHumanManager({
      virtualHumanAppId: this.config.bytedance.appId,
      virtualHumanToken: this.config.bytedance.token,
      virtualHumanRole: this.config.bytedance.role,
      byteRtcAppId: this.config.bytedance.rtcAppId,
      byteRtcAppKey: this.config.bytedance.rtcAppKey,
      defaultRoomId: this.config.bytedance.rtcRoomId,
      defaultPushUid: this.config.bytedance.rtcPushUid,
      defaultViewerUid: this.config.bytedance.rtcViewerUid,
    });

    const streamInfo = await this.dhManager.startSession({ liveId: this.sessionId });
    this.dhLiveId = streamInfo.liveId;

    this.sendToClient({
      type: "dh_stream_info",
      data: {
        liveId: streamInfo.liveId,
        roomId: streamInfo.roomId,
        viewerToken: streamInfo.viewerToken,
        viewerUid: streamInfo.viewerUid,
        rtcAppId: streamInfo.rtcAppId,
        publisherUid: streamInfo.publisherUid,
        status: streamInfo.status,
      },
    });

    // 4. Register Gateway chat event handler. In function_calling mode Qwen
    //    handles reasoning directly so we skip the gateway wire entirely.
    if (!isFC) {
      this.gwBridge.onChatEvent(this.sessionKey, (payload) => {
        this.handleChatEvent(payload);
      });
    }

    this.initialized = true;
    console.info(`[Handler:${this.sessionId}] Initialized (sessionKey=${this.sessionKey})`);

    // A1: Structured startup log — one-line status for session diagnosability
    const toolNames = isFC ? WINCLAW_DH_TOOLS.map(t => t.name).join(",") : "n/a";
    console.info(
      `[DH:${this.sessionId}] 🎯 Session started  mode=${this.dhMode}  ` +
      `tools=${toolNames}  memory=${!!this.memory}  bus=${!!this.winclawBus}  ` +
      `voice=${this.config.qwen.voice}  sessionKey=${this.sessionKey}`
    );
  }

  // -------------------------------------------------------------------------
  // Inbound messages (browser → server)
  // -------------------------------------------------------------------------

  handleAudioMessage(audioBase64: string): void {
    if (!this.ensureReady("handleAudioMessage")) return;
    try {
      const pcm = Buffer.from(audioBase64, "base64");
      this.qwenClient.sendAudio(pcm);
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] handleAudioMessage error:`, err);
    }
  }

  private _videoMessageCount = 0;
  handleVideoMessage(videoBase64: string): void {
    this._videoMessageCount++;
    if (this._videoMessageCount === 1 || this._videoMessageCount % 10 === 0) {
      console.log(
        `[Handler:${this.sessionId}] 📹 video message #${this._videoMessageCount} received from UI (base64 len=${videoBase64.length})`,
      );
    }
    if (!this.ensureReady("handleVideoMessage")) {
      console.warn(
        `[Handler:${this.sessionId}] 📹 video frame dropped — handler not ready`,
      );
      return;
    }
    try {
      const frameData = Buffer.from(videoBase64, "base64");
      const sent = this.qwenClient.sendVideo(frameData);
      if (this._videoMessageCount === 1) {
        console.log(
          `[Handler:${this.sessionId}] 📹 first video frame relayed to Qwen (returned=${sent})`,
        );
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] handleVideoMessage error:`, err);
    }
  }

  /**
   * Handle typed text from chat panel.
   *
   * In function_calling mode the text is sent straight to Qwen (which owns
   * reasoning + tools). In legacy mode it goes through the Gateway agent
   * pipeline exactly like before.
   */
  handleTextMessage(text: string): void {
    if (!this.ensureReady("handleTextMessage")) return;
    if (this.dhMode === "function_calling") {
      try {
        this.qwenClient.sendText(text);
        this.sendToClient({ type: "user_transcript", data: { content: text } });
      } catch (err) {
        console.error(`[Handler:${this.sessionId}] handleTextMessage (FC) error:`, err);
      }
      return;
    }
    try {
      // Send typed text through the Gateway agent pipeline (not Qwen)
      this.gwBridge.chatSend(this.sessionKey, `[voice] ${text}`)
        .then((runId) => {
          if (runId) this.pendingRunIds.add(runId);
          if (!this.ttsInProgress && this.ttsQueue.length === 0) {
            const ack = RealtimeSessionHandler.generateAckMessage(text);
            this.enqueueTts(ack);
          }
        })
        .catch((err) => {
          console.error(`[Handler:${this.sessionId}] chat.send error:`, err);
        });
      // Also show as user transcript in browser
      this.sendToClient({ type: "user_transcript", data: { content: text } });
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] handleTextMessage error:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // Gateway chat event handler (Agent response → Qwen TTS → DH)
  // -------------------------------------------------------------------------

  /**
   * Handle a chat event from the Gateway agent pipeline.
   * Delta events → browser subtitle. Final event → extract <voice> tag → Qwen TTS → DH lip sync.
   * For responses not originating from this DH session, proactively announce to idle DH.
   */
  private async handleChatEvent(payload: ChatEventPayload): Promise<void> {
    const text = payload.message?.content?.[0]?.text;
    if (!text) return;

    const isMyRun = this.pendingRunIds.has(payload.runId);

    if (payload.state === "delta") {
      // Show streaming text in browser subtitle regardless of source
      this.sendToClient({ type: "ai_thinking", data: { thinking: false } });
      this.sendToClient({ type: "ai_text", data: { content: text, is_delta: true } });

      // Track cumulative delta length (for new-char extraction if needed later)
      this.lastDeltaLength = text.length;

    } else if (payload.state === "final") {
      // Reset delta tracking
      this.lastDeltaLength = 0;
      this.deltaBuffer = "";

      // Show full text in browser
      this.sendToClient({ type: "ai_text", data: { content: text, is_delta: false } });

      if (isMyRun) {
        // ── DH's own question → Agent response ──
        // Extract <voice> tag for concise TTS, or fallback
        const voiceSummary = this.extractVoiceSummary(text);
        const ttsText = voiceSummary || this.fallbackSummarize(text);
        console.info(`[Handler:${this.sessionId}] 🔊 Voice summary (${ttsText.length} chars): "${ttsText.substring(0, 50)}..."`);
        this.enqueueTts(ttsText);
        this.pendingRunIds.delete(payload.runId);
      } else {
        // ── Other channel response → proactive announcement ──
        if (text.length >= 10 && !this.ttsInProgress && this.ttsQueue.length === 0) {
          const preview = text
            .replace(/<voice>[\s\S]*?<\/voice>/g, "")
            .replace(/[#*|`\->\[\]()]/g, "")
            .replace(/\n+/g, " ")
            .substring(0, 80)
            .trim();
          if (preview.length >= 5) {
            const announcement = `チャットに新しいメッセージがあります。${preview}`;
            console.info(`[Handler:${this.sessionId}] 📢 Proactive announce: "${announcement.substring(0, 50)}..."`);
            this.enqueueTts(announcement);
          }
        }
      }
    } else if (payload.state === "error") {
      const errMsg = payload.errorMessage ?? "Agent error";
      this.sendToClient({ type: "error", data: { message: errMsg } });
    }
  }

  // -------------------------------------------------------------------------
  // Function-calling dispatch (function_calling mode only)
  // -------------------------------------------------------------------------

  /**
   * Forward a Qwen function call to {@link ToolRouter} and return the result
   * to Qwen via `sendFunctionResult`. Never throws — router errors surface
   * as `{status:"failed", user_message}` payloads.
   */
  private async dispatchFunctionCall(
    call: import("./integrations/qwen-realtime.js").QwenFunctionCall,
  ): Promise<void> {
    if (!this.toolRouter) return;
    // A2: Log function call dispatch (before router)
    console.info(
      `[DH:${this.sessionId}] 🔧 Qwen→tool: ${call.name}  args=${(call.argumentsJson ?? "").slice(0, 300)}`
    );
    // A4: Surface tool call to browser UI (inspectable via devtools WS frames)
    this.sendToClient({
      type: "tool_call",
      data: { name: call.name, args: call.argumentsJson ?? "", callId: call.callId },
    });
    try {
      const result = await this.toolRouter.handle(call);
      // A2: Log tool result returning to Qwen
      const truncated = result.slice(0, 300);
      let sig = "status=?";
      let status: "ok" | "failed" = "ok";
      let summary: string | undefined;
      let errorMsg: string | undefined;
      try {
        const parsed = JSON.parse(result) as {
          status?: string;
          summary?: string;
          user_message?: string;
          error?: string;
        };
        sig = `status=${parsed.status ?? "?"}`;
        status = parsed.status === "failed" ? "failed" : "ok";
        summary = parsed.summary ?? parsed.user_message;
        errorMsg = parsed.error;
      } catch {
        /* non-JSON tool output — rare */
      }
      console.info(
        `[DH:${this.sessionId}] ✅ Tool→Qwen: ${call.name}  ${sig}  result=${truncated}`
      );
      this.sendToClient({
        type: "tool_result",
        data: {
          name: call.name,
          callId: call.callId,
          status,
          summary,
          error: errorMsg,
        },
      });
      await this.qwenClient.sendFunctionResult(call.callId, result);
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] dispatchFunctionCall error:`, err);
      this.sendToClient({
        type: "tool_result",
        data: {
          name: call.name,
          callId: call.callId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      });
      // Last-resort fallback — the router itself is supposed to guarantee a
      // result string, but guard the sendFunctionResult path too.
      const payload = JSON.stringify({
        status: "failed",
        user_message: "申し訳ありません、その操作は現在実行できません。",
      });
      try {
        await this.qwenClient.sendFunctionResult(call.callId, payload);
      } catch (err2) {
        console.error(`[Handler:${this.sessionId}] sendFunctionResult fallback failed:`, err2);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Qwen callback handlers (STT/TTS only)
  // -------------------------------------------------------------------------

  /**
   * Qwen realtime audio output.
   *
   * - **legacy_pipeline**: discarded here; TTS audio comes via the
   *   `qwen-tts.ts` HTTP API in {@link processNextTts}.
   * - **function_calling**: Qwen 3.5 produces the audio directly. Accumulate
   *   chunks, resample 24 kHz → 16 kHz, and feed the DH pacer.
   */
  private handleQwenAudio(pcm: Buffer, sampleRate: number): void {
    if (this.dhMode !== "function_calling") {
      // Legacy mode: realtime audio is VAD-only noise; ignored by design.
      return;
    }
    if (sampleRate !== 16_000) {
      this.rawPcm24kBuffer = Buffer.concat([this.rawPcm24kBuffer, pcm]);
      const evenLen = this.rawPcm24kBuffer.length & ~1;
      if (evenLen >= 480) {
        const chunk = this.rawPcm24kBuffer.subarray(0, evenLen);
        this.rawPcm24kBuffer = this.rawPcm24kBuffer.subarray(evenLen);
        const pcm16k = this.audioResampler.resample(chunk, sampleRate, 16_000);
        this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm16k]);
      }
    } else {
      this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm]);
    }
    this.flushDhAudioBuffer(false);
  }

  /**
   * Qwen assistant text output.
   *
   * - **legacy_pipeline**: ignored — final answers come via Gateway chat events.
   * - **function_calling**: forwarded to the browser as streaming subtitle.
   */
  private handleQwenText(text: string, isDelta: boolean): void {
    if (this.dhMode !== "function_calling") return;
    if (!text) return;
    this.sendToClient({ type: "ai_text", data: { content: text, is_delta: isDelta } });
  }

  /**
   * Qwen STT completed → send transcript to Gateway agent pipeline.
   */
  // NOTE: Currently unused — kept for potential future delta TTS mode
  /** Extract complete sentences from delta buffer and enqueue for TTS immediately. */
  private flushDeltaSentences(force: boolean): void {
    while (true) {
      const match = this.deltaBuffer.match(RealtimeSessionHandler.SENTENCE_END);
      if (!match || match.index === undefined) break;

      const sentenceEnd = match.index + 1;
      const sentence = this.deltaBuffer.substring(0, sentenceEnd).trim();
      this.deltaBuffer = this.deltaBuffer.substring(sentenceEnd);

      if (sentence.length >= 3) {
        console.info(`[Handler:${this.sessionId}] 🔊 Delta TTS: "${sentence.substring(0, 30)}..." (${sentence.length} chars)`);
        this.enqueueTts(sentence);
      }
    }

    // Force flush remaining if requested (on final)
    if (force && this.deltaBuffer.trim().length >= 3) {
      this.enqueueTts(this.deltaBuffer.trim());
      this.deltaBuffer = "";
    }
  }

  /** Extract the <voice> summary tag from Agent response. */
  private extractVoiceSummary(fullText: string): string | null {
    const match = fullText.match(/<voice>([\s\S]*?)<\/voice>/);
    return match ? match[1].trim() : null;
  }

  /** Fallback summarization when Agent doesn't include <voice> tag. */
  private fallbackSummarize(text: string): string {
    const clean = text
      .replace(/<voice>[\s\S]*?<\/voice>/g, "")
      .replace(/[#*|`\->\[\]()_]/g, "")
      .replace(/\n+/g, "。")
      .replace(/。+/g, "。")
      .trim();

    if (!clean) return "処理が完了しました。チャット画面をご確認ください。";

    // Extract first 3 sentences for a concise spoken summary
    const sentences = clean.split(/[。！？.!?\n]/).filter(s => s.trim().length > 2);
    if (sentences.length > 3) {
      const lang = RealtimeSessionHandler.detectLanguage(clean);
      const summary = sentences.slice(0, 3).join("。") + "。";
      const suffix = lang === "ja" ? "詳しくはチャット画面をご確認ください。"
                   : lang === "en" ? " Please check the chat panel for details."
                   : "详细内容请查看聊天画面。";
      return summary + suffix;
    }

    return clean;
  }

  /** Flush accumulated STT fragments to Gateway as one complete message. */
  private flushSttBuffer(): void {
    this.sttFlushTimer = null;
    const message = this.sttBuffer.trim();
    this.sttBuffer = "";
    if (!message || message.length < 2) return;

    console.info(`[Handler:${this.sessionId}] 🎤 STT (aggregated): "${message}" (${message.length} chars)`);

    // Show thinking indicator
    this.sendToClient({ type: "ai_thinking", data: { thinking: true } });

    // All messages go through Gateway agent
    console.info(`[Handler:${this.sessionId}] 📤 Gateway chat.send → ${this.sessionKey}`);
    this.gwBridge.chatSend(this.sessionKey, `[voice] ${message}`)
      .then((runId) => {
        if (runId) this.pendingRunIds.add(runId);
        // Immediate voice ACK — respond before Agent finishes processing
        if (!this.ttsInProgress && this.ttsQueue.length === 0) {
          const ack = RealtimeSessionHandler.generateAckMessage(message);
          this.enqueueTts(ack);
        }
      })
      .catch((err) => {
        console.error(`[Handler:${this.sessionId}] chat.send error:`, err);
      });
  }

  /** Filter out noise/filler words that VAD incorrectly splits as separate utterances. */
  private static readonly FILLER_PATTERN = /^(嗯+|啊+|哦+|哎+|呃+|唔+|就|可能|有|没|好|是|嗯嗯|yeah|ok|hmm|uh|ah|oh|um|mhm|okay|right|yes|no|just)\.?$/i;

  private handleUserTranscript(transcript: string): void {
    const trimmed = transcript.trim().replace(/[。！？.!?]+$/, "");
    if (!trimmed || trimmed.length < 2) return;

    // Filter out filler words
    if (RealtimeSessionHandler.FILLER_PATTERN.test(trimmed)) {
      return;
    }

    // Show each fragment in browser immediately
    this.sendToClient({ type: "user_transcript", data: { content: transcript } });

    // In function_calling mode Qwen drives the conversation directly, so we
    // only surface transcripts for UI — no gateway round-trip needed.
    if (this.dhMode === "function_calling") return;

    // Accumulate STT fragments — wait for pause before sending to agent
    this.sttBuffer += (this.sttBuffer ? "，" : "") + trimmed;

    // Reset the flush timer
    if (this.sttFlushTimer) clearTimeout(this.sttFlushTimer);
    this.sttFlushTimer = setTimeout(() => this.flushSttBuffer(), RealtimeSessionHandler.STT_FLUSH_DELAY_MS);
  }

  private handleResponseStarted(): void {
    // Only notify browser for TTS responses (not VAD auto)
    if (this.ttsInProgress) {
      this.sendToClient({ type: "ai_response_started" });
    }
  }

  private handleResponseDone(): void {
    if (this.dhMode === "function_calling") {
      // Qwen finished emitting audio → finalize the DH pacer.
      this.sendToClient({ type: "ai_response_done" });
      this.flushDhAudioBuffer(true);
      return;
    }
    if (this.ttsInProgress) {
      // This was a real TTS response completing
      this.sendToClient({ type: "ai_response_done" });
      this.flushDhAudioBuffer(true);
      this.ttsInProgress = false;
    }
    // Always try to process next TTS (works for both TTS done and suppressed VAD done)
    this.processNextTts();
  }

  /** Add text to TTS queue and start processing if idle. */
  private enqueueTts(text: string): void {
    this.ttsQueue.push(text);
    if (!this.ttsInProgress) {
      this.processNextTts();
    }
  }

  private ttsRetryTimer: ReturnType<typeof setInterval> | null = null;

  /** Detect language from text content using Unicode character ranges.
   * Requires substantial kana presence (>10%) to classify as Japanese,
   * preventing false positives from CJK text with occasional particles. */
  private static detectLanguage(text: string): "zh" | "ja" | "en" | "ko" {
    const kanaCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    if (kanaCount > 0 && kanaCount / text.length > 0.1) return "ja";
    const hangulCount = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;
    if (hangulCount > 0 && hangulCount / text.length > 0.1) return "ko";
    if (/^[\x00-\x7F\s.,!?'"()\-:;@#$%^&*+={}[\]<>\/\\~`]+$/.test(text.trim())) return "en";
    return "zh";
  }

  /** Language-to-voice mapping for qwen3.5-omni-flash-realtime TTS.
   * All Qwen 3.5 voices natively support multilingual synthesis. */
  private static readonly VOICE_MAP: Record<string, string> = {
    zh: "Serena",      // Chinese: gentle female
    ja: "Serena",      // Japanese: same voice handles JP natively
    en: "Aria",        // English: clear professional female
    ko: "Serena",      // Korean: Serena handles KR natively
  };

  // ACK rotation counters — avoid repeating the same phrase
  private static ackTaskIndex = 0;
  private static ackQueryIndex = 0;

  /** Generate a natural, varied voice acknowledgment in the detected language. */
  private static generateAckMessage(userMessage: string): string {
    const lang = RealtimeSessionHandler.detectLanguage(userMessage);
    const isTask = /分配|处理|安排|执行|发送|通知|确认|检查|催|部署|更新|修改|创建|删除|帮我|查|整理|统计|分析|报告|提醒|割り当て|確認|送信|実行|check|send|deploy|create|update|notify|schedule/.test(userMessage);

    if (lang === "ja") {
      if (isTask) {
        const phrases = [
          "はい、すぐに対応します。完了したらご報告しますね。",
          "承知しました。確認でき次第お伝えします。",
          "了解です、処理を始めます。少々お待ちください。",
          "かしこまりました。結果が出たらすぐにお知らせします。",
          "はい、取り掛かります。しばらくお待ちいただけますか。",
        ];
        return phrases[this.ackTaskIndex++ % phrases.length];
      }
      const phrases = [
        "はい、確認しますね。",
        "少々お待ちください、調べてみます。",
        "はい、ちょっと見てみますね。",
        "確認しますので少しお待ちを。",
      ];
      return phrases[this.ackQueryIndex++ % phrases.length];
    }

    if (lang === "en") {
      if (isTask) {
        const phrases = [
          "Got it, I'll handle that right away. I'll report back when it's done.",
          "Sure, working on it now. I'll let you know the results.",
          "Understood. Let me take care of that for you.",
          "On it. I'll get back to you shortly.",
        ];
        return phrases[this.ackTaskIndex++ % phrases.length];
      }
      const phrases = [
        "Let me check on that for you.",
        "Sure, looking into it now.",
        "One moment, let me find out.",
      ];
      return phrases[this.ackQueryIndex++ % phrases.length];
    }

    // Chinese (default)
    if (isTask) {
      const phrases = [
        "好的，我知道了，确认后给您报告结果。",
        "收到，马上处理，完成后向您汇报。",
        "好的，这就去办，请稍等。",
        "明白了，我先处理一下，有结果立刻通知您。",
        "了解，正在处理中，稍后给您反馈。",
        "好的，交给我吧，处理好了跟您说。",
      ];
      return phrases[this.ackTaskIndex++ % phrases.length];
    }
    const phrases = [
      "好的，我查一下。",
      "稍等，我确认一下。",
      "好的，马上看看。",
      "让我查看一下，稍等。",
    ];
    return phrases[this.ackQueryIndex++ % phrases.length];
  }

  /** Send next queued text to Qwen for TTS, waiting until Qwen is idle. */
  private processNextTts(): void {
    if (this.ttsInProgress || this.ttsQueue.length === 0) {
      this.stopTtsRetry();
      return;
    }

    // Wait for Qwen to finish any in-flight response (including suppressed VAD)
    if (this.qwenClient.isResponding) {
      this.startTtsRetry();
      return;
    }

    this.stopTtsRetry();
    const text = this.ttsQueue.shift()!;

    // Skip very short text (Qwen may not generate audio for 1-2 chars)
    if (text.trim().length < 3) {
      console.info(`[Handler:${this.sessionId}] TTS skip (too short: "${text}")`);
      this.processNextTts();
      return;
    }

    // Clean text for TTS: strip Markdown, emoji, special chars
    const cleanText = text
      .replace(/\*\*/g, "")           // remove **bold**
      .replace(/[#\-|]/g, "")        // remove # - | (markdown table/header)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [link](url) → link
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "") // emoji
      .replace(/\s+/g, " ")          // collapse whitespace
      .trim();

    if (!cleanText || cleanText.length < 2) {
      console.info(`[Handler:${this.sessionId}] TTS skip after clean: "${text}"`);
      this.ttsInProgress = false;
      this.processNextTts();
      return;
    }

    this.ttsInProgress = true;
    console.info(`[Handler:${this.sessionId}] TTS speaking (${cleanText.length} chars) via HTTP API`);

    // Use qwen3-omni-flash HTTP API for TTS (not realtime WebSocket)
    this.sendToClient({ type: "ai_response_started" });

    // Auto-detect language and select appropriate qwen3-omni-flash voice
    const lang = RealtimeSessionHandler.detectLanguage(cleanText);
    const voice = RealtimeSessionHandler.VOICE_MAP[lang] || "Cherry";
    console.info(`[Handler:${this.sessionId}] TTS lang=${lang} voice=${voice}`);

    synthesizeSpeech(cleanText, {
      apiKey: this.config.qwen.apiKey,
      voice,
    }, (pcm, sampleRate) => {
      // Accumulate raw PCM in a continuous buffer before resampling.
      // This prevents chunk-boundary artifacts from independent resampling.
      if (sampleRate !== 16_000) {
        this.rawPcm24kBuffer = Buffer.concat([this.rawPcm24kBuffer, pcm]);
        // Only resample when we have enough data (>= 10ms = 480 bytes @ 24kHz)
        // and ensure even byte count (2 bytes per sample)
        const evenLen = this.rawPcm24kBuffer.length & ~1;
        if (evenLen >= 480) {
          const chunk = this.rawPcm24kBuffer.subarray(0, evenLen);
          this.rawPcm24kBuffer = this.rawPcm24kBuffer.subarray(evenLen);
          const pcm16k = this.audioResampler.resample(chunk, sampleRate, 16_000);
          this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm16k]);
        }
      } else {
        this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm]);
      }
      this.flushDhAudioBuffer(false);
    }).then(() => {
      console.info(`[Handler:${this.sessionId}] TTS complete`);
      // Flush any remaining raw PCM from the accumulator
      if (this.rawPcm24kBuffer.length >= 2) {
        const evenLen = this.rawPcm24kBuffer.length & ~1;
        if (evenLen > 0) {
          const pcm16k = this.audioResampler.resample(
            this.rawPcm24kBuffer.subarray(0, evenLen), 24_000, 16_000
          );
          this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm16k]);
        }
        this.rawPcm24kBuffer = Buffer.alloc(0);
      }
      // Mark buffer as finalizing — the pacer will drain remaining frames
      // at real-time pace, then stop automatically.
      this.flushDhAudioBuffer(true);
      this.sendToClient({ type: "ai_response_done" });
      this.ttsInProgress = false;
      this.processNextTts();
    }).catch((err) => {
      console.error(`[Handler:${this.sessionId}] TTS error:`, err);
      this.sendToClient({ type: "ai_response_done" });
      this.ttsInProgress = false;
      this.processNextTts();
    });
  }

  private startTtsRetry(): void {
    if (!this.ttsRetryTimer) {
      this.ttsRetryTimer = setInterval(() => this.processNextTts(), 200);
    }
  }

  private stopTtsRetry(): void {
    if (this.ttsRetryTimer) {
      clearInterval(this.ttsRetryTimer);
      this.ttsRetryTimer = null;
    }
  }

  private handleError(err: Error): void {
    console.error(`[Handler:${this.sessionId}] Qwen error:`, err);
    this.sendToClient({ type: "error", data: { message: err.message } });
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  async cleanup(): Promise<void> {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    if (this.sttFlushTimer) { clearTimeout(this.sttFlushTimer); this.sttFlushTimer = null; }
    this.stopTtsRetry();
    this.stopDhPacer();
    console.info(`[Handler:${this.sessionId}] Cleaning up…`);

    // Unregister Gateway event handler. In FC mode the handler is the
    // NotifyBridge push-forwarder; in legacy mode it is the DH response
    // receiver. Either way we take it back.
    try {
      this.gwBridge.offChatEvent(this.sessionKey);
      this.gwBridge.offChatEvent(this.notifySessionKey);
      this.gwBridge.offChatEvent(this.notifyBroadcastSessionKey);
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] offChatEvent error:`, err);
    }

    // Dispose NotifyBridge BEFORE closing the qwen client so it can't fire
    // sendSystemEvent into a closing socket.
    try {
      if (this.notifyBridge) {
        this.notifyBridge.dispose();
        this.notifyBridge = null;
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] NotifyBridge dispose error:`, err);
    }

    // Disconnect Qwen
    try {
      if (this.qwenClient) await this.qwenClient.disconnect();
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] Qwen disconnect error:`, err);
    }

    // Stop DH session
    try {
      if (this.dhManager && this.dhLiveId) {
        await this.dhManager.stopSession(this.dhLiveId);
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] DH stop error:`, err);
    }

    // Stop identity watcher
    try {
      if (this.identityLoader) this.identityLoader.unwatch();
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] Identity unwatch error:`, err);
    }

    console.info(`[Handler:${this.sessionId}] Cleanup complete`);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Start the paced DH audio sender.
   *
   * Instead of flushing audio all at once, drain the buffer at real-time pace.
   * Uses elapsed-time-based frame counting to absorb setInterval jitter.
   * Waits until buffer reaches minimum water level before starting to drain
   * (prevents underrun from bursty TTS chunk arrival).
   */
  private startDhPacer(): void {
    if (this.dhPaceTimer) return; // already running
    this.dhPaceTimer = setInterval(() => {
      this.drainDhFrames();
    }, RealtimeSessionHandler.DH_PACE_INTERVAL_MS);
  }

  private stopDhPacer(): void {
    if (this.dhPaceTimer) {
      clearInterval(this.dhPaceTimer);
      this.dhPaceTimer = null;
    }
    this.dhPaceStarted = false;
    this.dhLastDrainTime = 0;
  }

  /**
   * Drain DH audio buffer using elapsed-time-based frame counting.
   * Sends exactly the right number of frames based on how much real time
   * has passed since the last drain — absorbs setInterval jitter.
   */
  private drainDhFrames(): void {
    const dhSession = this.dhManager?.getSession(this.dhLiveId);
    if (!dhSession) return;

    // Guard: if the DH WebSocket has closed (network blip, session expired),
    // don't spray sendAudioData errors into the console. Stop the pacer and
    // drop the remaining buffer. Qwen audio will still play on Qwen side;
    // only the ByteDance avatar lip-sync is temporarily lost until reconnect.
    if (!dhSession.isConnected) {
      console.warn(
        `[Handler:${this.sessionId}] DH session disconnected — stopping pacer, dropping ${this.dhAudioBuffer.length}B of buffered audio`,
      );
      this.dhAudioBuffer = Buffer.alloc(0);
      this.stopDhPacer();
      return;
    }

    const frameSize = RealtimeSessionHandler.DH_MIN_FRAME_SIZE;
    const minBuffer = RealtimeSessionHandler.DH_MIN_BUFFER_BYTES;

    // Wait until buffer reaches minimum level before starting drain
    // (prevents underrun from bursty TTS chunk arrival)
    if (!this.dhPaceStarted) {
      if (this.dhAudioBuffer.length < minBuffer && !this.dhPaceFinalizing) {
        return; // still accumulating
      }
      this.dhPaceStarted = true;
      this.dhLastDrainTime = Date.now();
      return; // start draining on next tick
    }

    const now = Date.now();
    const elapsedMs = now - this.dhLastDrainTime;
    // How many frames worth of time has passed (40ms per frame)
    const framesToSend = Math.floor(elapsedMs / 40);
    if (framesToSend === 0) return;

    // Advance time counter by exact frame multiples (not wall clock)
    // to prevent drift
    this.dhLastDrainTime += framesToSend * 40;

    let sent = 0;
    for (let i = 0; i < framesToSend; i++) {
      if (this.dhAudioBuffer.length >= frameSize) {
        const frame = this.dhAudioBuffer.subarray(0, frameSize);
        this.dhAudioBuffer = this.dhAudioBuffer.subarray(frameSize);
        try {
          dhSession.sendAudioData(frame);
          sent++;
        } catch (err) {
          console.error(`[Handler:${this.sessionId}] DH sendAudioData error:`, err);
          this.stopDhPacer();
          return;
        }
      } else if (this.dhPaceFinalizing && this.dhAudioBuffer.length > 0) {
        // Last partial frame — pad to minimum size
        const padded = Buffer.alloc(frameSize, 0);
        this.dhAudioBuffer.copy(padded);
        this.dhAudioBuffer = Buffer.alloc(0);
        try {
          dhSession.sendAudioData(padded);
          sent++;
        } catch (err) {
          console.error(`[Handler:${this.sessionId}] DH final frame error:`, err);
        }
        this.stopDhPacer();
        this.dhPaceFinalizing = false;
        return;
      } else if (this.dhPaceFinalizing && this.dhAudioBuffer.length === 0) {
        this.stopDhPacer();
        this.dhPaceFinalizing = false;
        return;
      } else {
        // Buffer underrun during streaming — wait for more data
        break;
      }
    }
  }

  private dhPaceFinalizing = false;

  /**
   * Signal that audio data is available or that no more data is coming.
   * @param forceFlush When true, marks the buffer as finalizing.
   */
  private flushDhAudioBuffer(forceFlush: boolean): void {
    if (forceFlush) {
      this.dhPaceFinalizing = true;
      // If pacer hasn't started yet (buffer never reached min level),
      // force-start it now to drain whatever we have
      if (!this.dhPaceStarted && this.dhAudioBuffer.length > 0) {
        this.dhPaceStarted = true;
        this.dhLastDrainTime = Date.now();
      }
    }
    // Ensure pacer is running whenever we have data
    if (this.dhAudioBuffer.length > 0 || this.dhPaceFinalizing) {
      this.startDhPacer();
    }
  }

  sendToClient(msg: ClientMessage): void {
    try {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] sendToClient error:`, err);
    }
  }

  // NOTE: Currently unused — kept for potential future delta TTS mode
  /**
   * Split text into sentence-sized chunks for faster TTS.
   * Each chunk is short enough for quick TTS generation (~2-3s per chunk).
   */
  private splitIntoSentences(text: string): string[] {
    // Split on Chinese/Japanese/English sentence endings + newlines
    const raw = text.split(/(?<=[。！？\n.!?])\s*/);
    const sentences: string[] = [];
    let current = "";

    for (const part of raw) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (current.length + trimmed.length > 80) {
        // Current buffer is long enough, flush it
        if (current.trim()) sentences.push(current.trim());
        current = trimmed;
      } else {
        current += (current ? "" : "") + trimmed;
      }
    }
    if (current.trim()) sentences.push(current.trim());

    // If no splits happened, return original as single chunk
    return sentences.length > 0 ? sentences : [text];
  }

  private ensureReady(caller: string): boolean {
    if (!this.initialized || this.cleanedUp) {
      console.warn(`[Handler:${this.sessionId}] ${caller} — not ready`);
      return false;
    }
    return true;
  }
}
