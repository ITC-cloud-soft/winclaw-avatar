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
import {
  createAvatarProvider,
  BytePlusAvatarProvider,
  type AvatarStreamProvider,
  type AvatarStreamInfo,
} from "./integrations/avatar-provider.js";
import { AudioResampler } from "./integrations/audio-resampler.js";
import { MuseTalkAudioSink } from "./integrations/musetalk-audio-sink.js";
import { IdentityLoader } from "./identity-loader.js";
import { resolveDhMode, type DhMode, type DigitalHumanConfig } from "./config.js";
import type { GatewayBridge, ChatEventPayload } from "./gateway-bridge.js";
import { synthesizeSpeech } from "./integrations/qwen-tts.js";
import { WINCLAW_DH_TOOLS } from "./tools/catalog.js";
import { ToolRouter } from "./tool-router.js";
import type { WebSearchResult } from "./tool-router.js";
import { MemoryBridge, type MemoryCorePlugin } from "./memory-bridge.js";
import { buildInstructions } from "./instructions-builder.js";
import { searchMusic, recommendMusic, type MusicTrack } from "./music-search.js";

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

/**
 * Payload of the `dh_stream_info` frame sent to the browser.
 *
 * `provider` selects which sub-fields are populated:
 *
 * - **musetalk** — WebRTC descriptor for the dh-saas avatar. The browser does
 *   the SDP exchange against `offerUrl` directly and uses `iceServers` /
 *   `controlWs`. `sessionId` / `ownerToken` / `expiresAt` identify the lease.
 * - **byteplus** — legacy ByteRTC descriptor (liveId/roomId/viewerToken/…),
 *   carried through the index signature.
 */
export interface DhStreamInfoData {
  provider: "musetalk" | "byteplus";
  sessionId?: string;
  ownerToken?: string;
  offerUrl?: string;
  controlWs?: string;
  iceServers?: Array<{ urls: string[]; username?: string; credential?: string }>;
  expiresAt?: string;
  /** BytePlus passthrough fields (liveId, roomId, viewerToken, …). */
  [key: string]: unknown;
}

// Wire-protocol message shapes sent to the browser client
type ClientMessage =
  | { type: "dh_stream_info"; data: DhStreamInfoData }
  | { type: "ai_audio"; data: { audio: string; format: "pcm16"; sample_rate: number } }
  | { type: "ai_text"; data: { content: string; is_delta: boolean } }
  | { type: "ai_thinking"; data: { thinking: boolean } }
  | { type: "user_transcript"; data: { content: string } }
  | { type: "ai_response_started" }
  | { type: "ai_response_done" }
  | { type: "ai_speech_interrupted" }
  | { type: "musetalk_answer"; data: { sdp?: string; error?: string } }
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
  | { type: "error"; data: { message: string; code?: string } };

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
  /**
   * Avatar stream provider (Stage 1b). Selected by `config.dh.provider`.
   * 道B — MuseTalk mode mints a dh-saas WebRTC session for the browser's video
   * AND runs the full Qwen pipeline in winclaw, pushing TTS PCM to the VM over
   * {@link museTalkAudioSink}. BytePlus mode wraps {@link DigitalHumanManager}
   * and preserves the legacy pipeline.
   */
  private avatarProvider!: AvatarStreamProvider;
  /**
   * MuseTalk SDP-offer proxy state. In MuseTalk mode the browser cannot POST
   * its SDP offer directly to the dh-saas VM (no CORS header), so the offer is
   * proxied server-to-server through {@link handleMuseTalkOffer}.
   */
  private museTalkOfferUrl: string | undefined;
  private museTalkOwnerToken: string | undefined;
  /**
   * 道B render path — true when the avatar provider is MuseTalk. In this mode
   * winclaw runs the full Qwen pipeline (identity + memory + tools) and pushes
   * the resulting TTS PCM to the L20 VM (pure renderer) over
   * {@link museTalkAudioSink}; the VM returns avatar video over WebRTC.
   */
  private isMuseTalkMode = false;
  /**
   * winclaw → L20 VM control-WS audio sink (MuseTalk render mode only). Drains
   * Qwen's 24kHz TTS PCM to the VM in 4800-byte frames with NO resample. `null`
   * in BytePlus mode or before {@link initialize} runs.
   */
  private museTalkAudioSink: MuseTalkAudioSink | null = null;
  private identityLoader!: IdentityLoader;
  /**
   * Memory bridge — only populated in `function_calling` mode when a memory
   * plugin is supplied. Records user/assistant turns to `memory/YYYY-MM-DD.md`
   * and preloads recent memory into the Qwen instructions at session start.
   */
  private memoryBridge: MemoryBridge | null = null;
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

    // Stage 1b: select avatar provider.
    //
    // 道B — MuseTalk (default) is now a PURE RENDERER. winclaw still runs the
    // entire Qwen-omni dialogue pipeline (identity + memory + tools); it mints
    // a dh-saas session for the browser's video WebRTC AND opens a control WS
    // ({@link MuseTalkAudioSink}) to push TTS PCM to the VM. BytePlus preserves
    // the legacy ByteDance pipeline as a rollback path.
    this.avatarProvider = createAvatarProvider(this.config);
    this.isMuseTalkMode = this.avatarProvider.kind === "musetalk";
    const isMuseTalk = this.isMuseTalkMode;
    console.info(`[DH:${this.sessionId}] 🎭 avatar provider=${this.avatarProvider.kind}`);

    if (isMuseTalk) {
      // 道B: avatar はオンデマンド。初期 setup では dh-saas セッションを mint しない。
      // Qwen realtime を先に確立し、初回対話 or 手動「数字人 ON」で client が
      // avatar_resume を送った時に mint する({@link handleAvatarResume} →
      // {@link startMuseTalkAvatar})。これにより:
      //   1) avatar mint 失敗(dh-saas 502 "Worker call failed" 等)が Qwen
      //      セッションを絶対に巻き込まない(以前は setup 内の eager mint が throw
      //      → ws.close(1011) → client 全再接続ループで Qwen も切れていた)
      //   2) 対話しないまま TTL 切れする無駄な room mint を避ける(=B GPU節約)
      console.info(
        `[DH:${this.sessionId}] 🎭 MuseTalk on-demand: avatar は初回対話/手動ONで mint(setup では mint しない)`,
      );
    }

    // 2. Connect Qwen Realtime. The callback set and instructions differ
    //    between the two dhModes — see the file-level docstring. MuseTalk mode
    //    always runs the FC-style Qwen pipeline (winclaw is the brain in 道B).
    const isFC = this.dhMode === "function_calling" || isMuseTalk;

    // 道B lite-voice (speed mode): WINCLAW_DH_LITE_VOICE=1 runs qwen as a lean
    // voice assistant — drops the Japanese persona role files (USER/AGENTS/TOOLS/
    // HEARTBEAT/BOOTSTRAP/BOOT) and the memory preload, replacing them with a clean
    // language-neutral prompt (so the avatar follows the user's spoken language
    // instead of defaulting to Japanese). NOTE: the 6 agent tools stay ON — the
    // earlier latency turned out to be the L20→dashscope cross-border link (fixed
    // by the intl endpoint), not the tools, so SNS/email integration is preserved.
    const liteVoice = process.env.WINCLAW_DH_LITE_VOICE === "1";

    // Wire the memory bridge before building instructions so recent memory can
    // be preloaded into the prompt. Only active in FC-style mode with a backend.
    let memoryPreload = "";
    if (isFC && !liteVoice && this.memory && this.config.memory?.recordConversation !== false) {
      try {
        this.memoryBridge = new MemoryBridge(
          this.workspaceDir,
          this.memory,
          "digital-human",
          {
            flushDebounceMs: this.config.memory?.flushDebounceMs,
            preloadDays: this.config.memory?.preloadDays,
          },
        );
        memoryPreload = await this.memoryBridge.preloadRecentMemory();
        if (memoryPreload) {
          console.info(
            `[DH:${this.sessionId}] 🧠 Preloaded recent memory (${memoryPreload.length} chars) into instructions`,
          );
        }
      } catch (err) {
        console.error(`[Handler:${this.sessionId}] MemoryBridge init failed:`, err);
        this.memoryBridge = null;
        memoryPreload = "";
      }
    }

    // lite-voice (clean voice companion): a dedicated, language-NEUTRAL prompt
    // with a STRICT "match the user's spoken language" rule. The full winclaw
    // identity (rawSoul/rawIdentity) is a Japanese persona written in Japanese,
    // which made the avatar reply in Japanese even when asked to speak Chinese —
    // the language-match rule inside buildInstructions was drowned out by the
    // Japanese persona/examples. In lite mode we drop that persona entirely and
    // use this clean prompt, so the avatar follows whatever language the user
    // speaks (Serena is a zh-capable voice; the only blocker was the prompt).
    const liteName = (identity.nickname || identity.name || "").trim();
    const liteVoicePrompt =
      `${liteName ? `你的名字是 ${liteName}。` : ""}你是一个温暖、自然的语音陪伴助手,正在和用户进行实时语音对话。\n\n` +
      `最重要的规则:\n` +
      `1. 语言:必须用「用户当前所说的语言」回复。用户说中文你就说中文,说英文就说英文,说日文就说日文。` +
      `当用户切换语言、或明确要求你换语言时(例如说「说中文」),立刻从此用那种语言回复。` +
      `绝不要用用户没有使用的语言回答。一句话之内只用一种语言的词汇和发音,不要混语言。\n` +
      `2. 简短:这是语音对话,回复要短、口语化,通常 1-2 句话。不要废话、不要复述问题、不要「让我…」之类的开场白。\n` +
      `3. 自然:像朋友一样温暖、直接、切题。\n` +
      `4. 工具:当用户要你做事——发消息到 WhatsApp/Slack/Telegram/LINE/邮件、上网查实时信息、回忆过去的事、执行任务——就调用相应的工具去完成,完成后用一句口语化的话汇报结果。不确定用哪个工具时,用 ask_winclaw 把需求原样转给 winclaw。日常闲聊不要调用工具。\n` +
      `5. 画面控制(ui_action):当用户要你操作这个界面——显示/隐藏「任务管理」面板、藏起或显示底部「控制条」、打开某个「成果物/PDF」预览、开关麦克风、开关摄像头、启动或关闭「数字人形象」——就调用 ui_action 工具。参数 target 取值:` +
      `task_panel(任务管理面板)、controls(控制条)、artifact(成果物预览,name 填文件名如「英伟达投资分析报告.pdf」)、mic(麦克风)、camera(摄像头)、avatar(数字人形象);action 取值:show/hide/toggle/on/off/open/close。` +
      `例:「显示任务管理」→ ui_action(target=task_panel, action=show);「藏起控制条」→ ui_action(target=controls, action=hide);「把英伟达PDF显示出来」→ ui_action(target=artifact, action=show, name="英伟达投资分析报告.pdf");「关掉麦克风」→ ui_action(target=mic, action=off);「关掉数字人」→ ui_action(target=avatar, action=hide)。` +
      `注意区分:界面/画面的显示隐藏用 ui_action;而"生成PDF/做报告/写代码"这类实务任务用 task_run,别混。调用后用一句口语化的话确认(如「好的,打开任务管理」)。`;
    const instructions = liteVoice
      ? liteVoicePrompt
      : isFC
      ? buildInstructions({
          avatarName: identity.name,
          nickname: identity.nickname,
          relationship: identity.relationship,
          soulMd: identity.rawSoul,
          identityMd: identity.rawIdentity,
          // 道B §5.1 — fold all 8 canonical role files into the prompt so the
          // avatar shares winclaw's full identity (SOUL/IDENTITY/USER/AGENTS/
          // TOOLS/HEARTBEAT/BOOTSTRAP/BOOT).
          userMd: identity.rawUser,
          agentsMd: identity.rawAgents,
          toolsMd: identity.rawTools,
          heartbeatMd: identity.rawHeartbeat,
          bootstrapMd: identity.rawBootstrap,
          bootMd: identity.rawBoot,
          // Recent-memory summary (today/yesterday) as additional context.
          additionalContext: memoryPreload || undefined,
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
        // Enables task_run's secretary-inbox double-write (managed tasks).
        workspaceDir: this.workspaceDir,
        webSearchFn: this.webSearchFn,
        earlyTimeoutMs: this.config.dhTool?.earlyTimeoutMs,
        lateTimeoutMs: this.config.dhTool?.lateTimeoutMs,
      });

      this.qwenClient.on("functionCall", (call) => {
        void this.dispatchFunctionCall(call);
      });

      // 道B barge-in — server VAD detected the user speaking over the avatar.
      // Tell the MuseTalk VM to drop its queued lip-sync audio so the new turn
      // starts cleanly. No-op in BytePlus mode (sink is null).
      this.qwenClient.on("speechStarted", () => {
        if (this.museTalkAudioSink) {
          this.museTalkAudioSink.interrupt();
        }
        // Forward barge-in to the browser so it flushes the AudioStreamPlayer.
        // Without this, TTS PCM already buffered/scheduled locally keeps playing
        // after the VM has dropped its lip-sync queue, so the user hears the old
        // turn over their interruption. No-op for BytePlus (audio rides ByteRTC).
        this.sendToClient({ type: "ai_speech_interrupted" });
      });

      // Memory recording (道B §5.2) — persist both sides of the dialogue to
      // memory/YYYY-MM-DD.md via the debounced MemoryBridge. Guarded on the
      // bridge being present (FC mode + memory backend + recordConversation).
      if (this.memoryBridge) {
        const bridge = this.memoryBridge;
        this.qwenClient.on("userTranscript", (transcript: string) => {
          bridge.recordUserSpeech(transcript);
        });
        this.qwenClient.on("textDone", (text: string) => {
          bridge.recordAIResponse(text);
        });
      }

      // CRITICAL: register tools BEFORE connect() so the initial session.update
      // Qwen sends on open already includes the tool catalogue. If we set tools
      // after connect, Qwen's first message is "tools=[]" and it commits to a
      // no-tool behavior mode; the subsequent update_session({tools}) arrives
      // too late to change its stance. (Matches Python reference pattern.)
      // Tools stay ON even in lite-voice mode: the earlier latency was the
      // L20→dashscope cross-border link (fixed via the intl endpoint), NOT the
      // tools. Restore the 6 agent tools (ask_winclaw / task_run / channel_send /
      // memory_search / memory_get / internet_search) so the avatar can drive
      // SNS/email integration (WhatsApp/Slack/Telegram/LINE) again.
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

    // 道B identity hot-reload (§5.1) — when enabled, re-load the 8 role files on
    // change and push the rebuilt instructions into the live Qwen session. Only
    // meaningful in FC-style mode (legacy uses identity.instructions verbatim
    // and never updates mid-session).
    if (isFC && this.config.identity?.hotReload) {
      this.identityLoader.watch((updated) => {
        const rebuilt = buildInstructions({
          avatarName: updated.name,
          nickname: updated.nickname,
          relationship: updated.relationship,
          soulMd: updated.rawSoul,
          identityMd: updated.rawIdentity,
          userMd: updated.rawUser,
          agentsMd: updated.rawAgents,
          toolsMd: updated.rawTools,
          heartbeatMd: updated.rawHeartbeat,
          bootstrapMd: updated.rawBootstrap,
          bootMd: updated.rawBoot,
        });
        const ok = this.qwenClient.updateInstructions(rebuilt);
        console.info(
          `[Handler:${this.sessionId}] 🔄 Identity hot-reload applied (${rebuilt.length} chars, sent=${ok})`,
        );
      });
      console.info(`[Handler:${this.sessionId}] Identity hot-reload watching 8 role files`);
    }

    // 3. In MuseTalk (道B) mode the dh-saas session was already minted above and
    //    audio flows over the control WS — there is no ByteDance manager. Only
    //    BytePlus mode drives DigitalHumanManager + the PCM pacer (drainDhFrames).
    if (!isMuseTalk) {
      // Start DH session (ByteDance virtual human) via the BytePlus provider.
      // The provider wraps DigitalHumanManager; we keep a reference to the
      // underlying manager so the PCM pacer (drainDhFrames) can drive lip-sync
      // exactly as before.
      const byteProvider = this.avatarProvider as BytePlusAvatarProvider;
      this.dhManager = byteProvider.manager;

      const streamInfo = await this.avatarProvider.startSession({ liveId: this.sessionId });
      this.dhLiveId = streamInfo.liveId as string;

      this.sendToClient({
        type: "dh_stream_info",
        data: {
          provider: "byteplus",
          liveId: streamInfo.liveId,
          roomId: streamInfo.roomId,
          viewerToken: streamInfo.viewerToken,
          viewerUid: streamInfo.viewerUid,
          rtcAppId: streamInfo.rtcAppId,
          publisherUid: streamInfo.publisherUid,
          status: streamInfo.status,
        },
      });
    }

    // 4. Register Gateway chat event handler. In function_calling mode Qwen
    //    handles reasoning directly so we skip the gateway wire entirely.
    if (!isFC) {
      this.gwBridge.onChatEvent(this.sessionKey, (payload) => {
        this.handleChatEvent(payload);
      });
    }

    this.initialized = true;
    console.info(`[Handler:${this.sessionId}] Initialized (sessionKey=${this.sessionKey})`);

    // A1: Structured startup log — one-line status for session diagnosability.
    // In 道B MuseTalk mode qwen is the brain (NOT bypassed) and audio flows over
    // the control WS sink; render is the pure VM.
    const toolNames = isFC ? WINCLAW_DH_TOOLS.map(t => t.name).join(",") : "n/a";
    console.info(
      `[DH:${this.sessionId}] 🎯 Session started  mode=${this.dhMode}  ` +
      `provider=${this.avatarProvider.kind}  qwen=brain  ` +
      `audioSink=${this.museTalkAudioSink?.isConnected ?? false}  ` +
      `tools=${toolNames}  memory=${!!this.memory}  memoryBridge=${!!this.memoryBridge}  ` +
      `hotReload=${!!(isFC && this.config.identity?.hotReload)}  bus=${!!this.winclawBus}  ` +
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
  // 数字人形象 オンデマンド・ライフサイクル(docs/10 §4.2 / B案)
  //   idle で avatar を閉じ(browser が WebRTC 切断 → VM room 解放 = GPU/slot 節約)、
  //   再対話で dh-saas セッションを mint し直して再唤醒する。Qwen realtime は常時維持。
  // -------------------------------------------------------------------------

  /**
   * dh-saas MuseTalk セッションを mint し、`dh_stream_info` をクライアントへ送り、
   * winclaw→VM 制御WS(audio sink)を開く。初回確立(setup 内)と再唤醒
   * ({@link handleAvatarResume})の両方で使う。
   */
  private async startMuseTalkAvatar(): Promise<void> {
    const roleId = this.config.dh.musetalk.defaultRoleId;
    // dh-saas は Worker concurrent_limit=1 + room quota 解放遅延(WebRTC 切断後
    // heartbeat_timeout 待ち)があり、close→再open 直後の再 mint は
    // 502 "Worker call failed" になりやすい。指数バックオフで数回リトライして
    // 直前 room の quota 解放窓を越える。全滅時のみ throw(呼び出し側=setup は
    // オンデマンド化で mint しない / resume は catch 済 → Qwen は巻き込まれない)。
    const delaysMs = [0, 1500, 3000, 5000, 8000];
    let streamInfo: AvatarStreamInfo | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      if (delaysMs[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
      }
      try {
        streamInfo = await this.avatarProvider.startSession({
          liveId: this.sessionId,
          roleId,
        });
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(
          `[DH:${this.sessionId}] avatar mint attempt ${attempt + 1}/${delaysMs.length} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (!streamInfo) {
      // 全リトライ失敗。avatar のみ諦め、Qwen 対話は維持。client に通知して
      // ボタンを「数字人 ON」に戻させる(WS は閉じない)。
      this.sendToClient({
        type: "error",
        data: {
          code: "AVATAR_MINT_FAILED",
          message:
            lastErr instanceof Error ? lastErr.message : "avatar mint failed",
        },
      });
      throw lastErr ?? new Error("avatar mint failed");
    }
    this.museTalkOfferUrl = streamInfo.offerUrl;
    this.museTalkOwnerToken = streamInfo.ownerToken;
    this.sendToClient({
      type: "dh_stream_info",
      data: {
        provider: "musetalk",
        sessionId: streamInfo.sessionId,
        ownerToken: streamInfo.ownerToken,
        offerUrl: streamInfo.offerUrl,
        controlWs: streamInfo.controlWs,
        iceServers: streamInfo.iceServers,
        expiresAt: streamInfo.expiresAt,
      },
    });
    if (streamInfo.controlWs) {
      this.museTalkAudioSink = new MuseTalkAudioSink({
        controlWsUrl: streamInfo.controlWs,
        ownerToken: streamInfo.ownerToken,
        logger: {
          info: (msg) => console.info(`[DH:${this.sessionId}] ${msg}`),
          warn: (msg) => console.warn(`[DH:${this.sessionId}] ${msg}`),
          error: (msg, err) => console.error(`[DH:${this.sessionId}] ${msg}`, err ?? ""),
        },
      });
      try {
        await this.museTalkAudioSink.connect();
        console.info(`[DH:${this.sessionId}] 🔊 MuseTalk audio sink connected`);
      } catch (err) {
        console.error(`[DH:${this.sessionId}] MuseTalk audio sink connect failed:`, err);
      }
    }
  }

  /**
   * オンデマンド: idle で avatar を閉じた(browser が WebRTC 切断済 → VM room 解放)。
   * winclaw 側の audio sink を閉じ、失効した offerUrl を破棄する(TTS は dead session へ送らない)。
   */
  handleAvatarPause(): void {
    if (this.museTalkAudioSink) {
      try { this.museTalkAudioSink.close(); } catch { /* idempotent */ }
      this.museTalkAudioSink = null;
    }
    this.museTalkOfferUrl = undefined;
    console.info(`[DH:${this.sessionId}] ⏸ avatar paused (VM room released; Qwen keeps running)`);
  }

  /** 再唤醒: dh-saas セッションを mint し直し、`dh_stream_info` を再送する。 */
  async handleAvatarResume(): Promise<void> {
    if (!this.isMuseTalkMode) return;
    if (this.museTalkAudioSink) return; // 既に有効(重複 resume 抑止)
    console.info(`[DH:${this.sessionId}] ▶ avatar resume — re-minting dh-saas session`);
    try {
      await this.startMuseTalkAvatar();
    } catch (err) {
      console.error(`[DH:${this.sessionId}] avatar resume failed:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // MuseTalk SDP-offer proxy (browser → winclaw → dh-saas VM)
  // -------------------------------------------------------------------------

  /**
   * Forward the browser's WebRTC SDP offer to the dh-saas VM server-side.
   *
   * The browser cannot POST the offer directly to the VM (it returns no
   * `Access-Control-Allow-Origin` header → CORS preflight fails), so the
   * offer arrives over the existing DH WebSocket and we relay it here with
   * the owner token. The resulting answer SDP (or an error) is sent back to
   * the browser as a `musetalk_answer` frame. WebRTC media still flows
   * direct browser↔VM via TURN.
   */
  async handleMuseTalkOffer(sdp: string, webrtcId: string): Promise<void> {
    console.info(
      `[DH:${this.sessionId}] 📡 handleMuseTalkOffer ENTER sdpLen=${sdp?.length} wid=${webrtcId} offerUrl=${this.museTalkOfferUrl}`,
    );
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.museTalkOwnerToken) headers["Authorization"] = `Bearer ${this.museTalkOwnerToken}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      console.info(`[DH:${this.sessionId}] 📡 fetching offer endpoint…`);
      const resp = await fetch(this.museTalkOfferUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify({ sdp, type: "offer", webrtc_id: webrtcId }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      console.info(`[DH:${this.sessionId}] 📡 fetch returned status=${resp.status}`);
      if (!resp.ok) {
        const txt = await resp.text();
        this.sendToClient({
          type: "musetalk_answer",
          data: { error: `offer ${resp.status}: ${txt.slice(0, 200)}` },
        });
        return;
      }
      const ans = (await resp.json()) as { sdp?: string };
      if (!ans?.sdp) {
        this.sendToClient({ type: "musetalk_answer", data: { error: "empty answer sdp" } });
        return;
      }
      console.info(`[DH:${this.sessionId}] 📡 MuseTalk offer proxied → ${resp.status}`);
      this.sendToClient({ type: "musetalk_answer", data: { sdp: ans.sdp } });
    } catch (err) {
      console.error(`[DH:${this.sessionId}] 📡 handleMuseTalkOffer CATCH:`, err);
      this.sendToClient({
        type: "musetalk_answer",
        data: { error: err instanceof Error ? err.message : String(err) },
      });
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
      // O4 会話保活: task_run は長時間非同期になり得る(early-timeout 快返後もバックグラウンドで
      // metacoder が走る)。回執播報後の静默で 300s idle 切断が起きないよう保活を arm する。
      // disarm は次の response.done / ユーザ発話 / cleanup(下記)。
      if (call.name === "task_run") {
        this._armKeepAlive();
      }
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
    // 道B MuseTalk render path — push Qwen's TTS PCM straight to the VM over the
    // control WS in 4800-byte frames with NO resample (Qwen 24kHz verbatim; the
    // VM down-converts internally). Also forward to the browser as `ai_audio`
    // for local playback (the VM returns video only — no audio track).
    if (this.isMuseTalkMode) {
      if (this.museTalkAudioSink) {
        this.museTalkAudioSink.sendAudioData(pcm);
      }
      this.sendToClient({
        type: "ai_audio",
        data: {
          audio: pcm.toString("base64"),
          format: "pcm16",
          sample_rate: sampleRate,
        },
      });
      return;
    }
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
    // O4: ユーザが新しく話し始めた = 会話が進んだので保活を止める(次の task_run で再 arm)。
    this._stopKeepAlive();
    const trimmed = transcript.trim().replace(/[。！？.!?]+$/, "");
    if (!trimmed || trimmed.length < 2) return;

    // 語音点歌(内蔵 music bundle・docs/20)。点歌/停止/兜底提案への肯定応答を
    // 転写ベースで確定的に処理する。**filler 過濾より先**に判定するのは、兜底提案
    // (「放《稻香》好吗?」)への「好」等の肯定応答が FILLER_PATTERN に食われるのを
    // 防ぐため。命中したら以降の STT/agent 送出はしない。
    if (this._tryVoiceMusic(trimmed)) return;

    // Filter out filler words
    if (RealtimeSessionHandler.FILLER_PATTERN.test(trimmed)) {
      return;
    }

    // Show each fragment in browser immediately
    this.sendToClient({ type: "user_transcript", data: { content: transcript } });

    // 語音 UI 制御の確定的兜底: realtime モデル(omni-flash)は ui_action の
    // function-call を確実には出さない(実測: 「カメラを開いて」を理解しても発話で
    // 応答するだけで tool を呼ばない)。転写を直接照合し、UI 操作意図なら Qwen の
    // 判断を待たず client へ ui_action を下達する。詳細は _tryVoiceUiIntent 参照。
    this._tryVoiceUiIntent(trimmed);

    // In function_calling mode Qwen drives the conversation directly, so we
    // only surface transcripts for UI — no gateway round-trip needed.
    if (this.dhMode === "function_calling") return;

    // Accumulate STT fragments — wait for pause before sending to agent
    this.sttBuffer += (this.sttBuffer ? "，" : "") + trimmed;

    // Reset the flush timer
    if (this.sttFlushTimer) clearTimeout(this.sttFlushTimer);
    this.sttFlushTimer = setTimeout(() => this.flushSttBuffer(), RealtimeSessionHandler.STT_FLUSH_DELAY_MS);
  }

  // -------------------------------------------------------------------------
  // 語音 UI 制御の確定的兜底(dh-voice-control-everything-plan の実効化)
  //
  // realtime モデル(qwen omni-flash)は ui_action の function-call を確実には
  // 出さない。そこで転写を直接パターン照合し、UI 操作意図なら Qwen の判断を待たず
  // client へ ui_action を下達する。既存の {type:"tool_call"} 転送路を再利用する
  // ので client 改修は不要(dh-websocket が dh-ui-action を発火 → app-render /
  // main-layout / secretary-panel が実行)。冪等な絶対アクション(on/off/show/
  // hide)のみ出すため、万一 Qwen も ui_action を呼んでも二重発火は無害。
  // -------------------------------------------------------------------------

  /** 明示 on/off を持つ設備・パネル対象の照合表(誤爆を避けるため動作語必須)。 */
  private static readonly _UI_TARGETS: ReadonlyArray<{
    target: string;
    on: string;
    off: string;
    re: RegExp;
  }> = [
    { target: "camera", on: "on", off: "off", re: /摄像头|攝像頭|摄像机|カメラ|镜头|鏡頭|\bcamera\b/i },
    { target: "mic", on: "on", off: "off", re: /麦克风|麥克風|话筒|話筒|マイク|\bmic(rophone)?\b/i },
    { target: "avatar", on: "show", off: "hide", re: /数字人|數字人|数字形象|虚拟形象|虛擬形象|アバター|\bavatar\b/i },
    { target: "task_panel", on: "show", off: "hide", re: /任务管理|任務管理|任务面板|任務面板|任务列表|任務列表|タスク(管理|パネル|一覧)|\btask.?panel\b/i },
    { target: "controls", on: "show", off: "hide", re: /控制条|控制條|控制栏|控制欄|控制按钮|控制按鈕|操作パネル|コントロール|\bcontrols?\b/i },
    { target: "subtitle", on: "show", off: "hide", re: /字幕|caption|subtitle|字幕栏|字幕欄/i },
  ];

  /** 「開く/表示/on」系の語(查看/看 を含む — 「查看成果物」対応)。 */
  private static readonly _UI_ON =
    /打开|打開|开启|開啟|开|開|启动|啟動|显示|顯示|查看|查|看看|看一下|看|瞧|展示|亮出|拿出|调出|調出|叫出|翻出|给我看|給我看|出来|出來|弹出|彈出|オン|表示|開いて|出して|見せて|つけて|\b(show|open|on|turn on|enable|start|view)\b/i;
  /** 「閉じる/隠す/off」系の語。 */
  private static readonly _UI_OFF =
    /关闭|關閉|关掉|關掉|关上|關上|关|關|隐藏|隱藏|藏起|收起|撤下|停掉|关停|關停|オフ|消して|隠して|閉じて|止めて|\b(hide|close|off|turn off|disable|stop)\b/i;
  /** 否定/疑問のときは兜底しない(誤爆防止)。 */
  private static readonly _UI_SKIP =
    /不要|不用|别|別|甭|勿|莫|\bwhy\b|为什么|為什麼|什么是|什麼是|吗[?？]?$|嗎[?？]?$|呢[?？]?$/i;
  /** 成果物プレビュー対象語(open=show / close=hide)。 */
  private static readonly _UI_ARTIFACT =
    /成果物|成果|报告|報告|文档|文檔|文件|预览|預覽|\bpdf\b|レポート|ファイル/i;
  /** 全屏/沉浸モード対象語(「数字人」を含みうるので最優先で判定する)。 */
  private static readonly _UI_FULLSCREEN =
    /全屏|全螢|全萤|全画面|全屏幕|沉浸|フルスクリーン|full ?screen|最大化/i;
  /** 「退出全屏」等の解除語。 */
  private static readonly _UI_FS_EXIT =
    /退出|取消|还原|還原|恢复|恢復|缩小|縮小|退回|正常/i;
  /** 音色切替の文脈語 + 変更動詞 + 任意の話者別名。 */
  private static readonly _UI_VOICE_CTX = /声音|聲音|音色|嗓音|\bvoice\b|说话的?声|說話的?聲/i;
  private static readonly _UI_VOICE_VERB = /换|換|改|切换|切換|变成|變成|用/i;
  private static readonly _UI_VOICE_ALIAS =
    /小春|温柔|溫柔|小夏|活泼|活潑|小芊|知性|小婉|优雅|優雅|小悦|小悅|甜美|小彤|小白|沉稳|沉穩|书生|書生|儒雅|小硕|小碩|清朗|老铁|老鐵|浑厚|渾厚|tomoka|riko|stella|bella|杰力豆|童声|童聲|kyong|日語|日语|日文|日本語|英語|英语|英文|english|韩语|韓語|韩文|한국어/i;

  private _uiIntentSeq = 0;

  // ── 語音点歌(内蔵 music bundle・docs/20)──────────────────────────────
  /** 兜底提案中の曲(「放《稻香》好吗?」)。次の肯定応答で再生する。 */
  private _pendingMusic: { track: MusicTrack; artist: string } | null = null;

  /** 点歌トリガ(播放/点播/放一首… + 曲名 or 《》)。誤爆防止のため下の解析と併用。 */
  private static readonly _MUSIC_TRIGGER =
    /播放|點播|点播|放一首|放首|点一首|點一首|来一首|來一首|来首|來首|听一首|聽一首|点歌|點歌|唱一首|唱首|点播首/;
  /** 弱いトリガ(放/点/来/听/唱)。CTX(歌/音乐/《》)と併用時のみ点歌とみなす。 */
  private static readonly _MUSIC_WEAK_VERB = /[放點点來来聽听唱]/;
  private static readonly _MUSIC_CTX = /歌|音乐|音樂|曲|[《【][^》】]+[》】]/;
  /** 停止/暂停。 */
  private static readonly _MUSIC_STOP =
    /停(止|下)?播放|别放了|別放了|关掉音乐|關掉音樂|关闭音乐|關閉音樂|停止音乐|停止音樂|不(听|聽)了|停下来|停下來|別放歌|别放歌|关掉歌|關掉歌/;
  private static readonly _MUSIC_PAUSE = /暂停|暫停|先停|停一下/;
  /** 兜底提案への肯定/否定(短文照合)。 */
  private static readonly _MUSIC_AFFIRM =
    /^(好|好的|好呀|好啊|好嘞|可以|行|嗯好|要|想(听|聽)|放吧|来吧|來吧|播放|放|听|聽|ok|okay|yes|はい|うん|いいよ|おねがい|お願い)/i;
  private static readonly _MUSIC_DECLINE =
    /不用|不要|算了|别|別|不(听|聽)|不想|换一|換一|no|やめ|结束|結束/;

  /**
   * 転写を UI 操作コマンドとして照合し、命中したら client へ ui_action を下達する。
   * 命中で true。設備/パネル対象は明示 on/off 必須。artifact は「開く + 成果物/PDF
   * /報告…」で show、name はキーワード除去後の残り(openPreviewNodeByName が曖昧
   * 一致 → 無ければ最新を開く)。
   */
  private _tryVoiceUiIntent(transcript: string): boolean {
    const R = RealtimeSessionHandler;
    const t = transcript.trim();
    if (t.length < 2 || t.length > 40) return false; // UI 命令は短文
    if (R._UI_SKIP.test(t)) return false;

    const wantsOff = R._UI_OFF.test(t);
    const wantsOn = R._UI_ON.test(t);

    // 0) 全屏/沉浸(「全屏显示数字人」は 数字人 を含むので avatar より先に判定)
    if (R._UI_FULLSCREEN.test(t)) {
      const exit = wantsOff || R._UI_FS_EXIT.test(t);
      this._dispatchUiAction("fullscreen", exit ? "off" : "on");
      return true;
    }

    // 1) 音色切替(声音文脈+変更動詞、または 変更動詞+話者別名)。name=転写全体を
    //    client(setDhVoice)へ渡し alias 照合。
    if (
      (R._UI_VOICE_CTX.test(t) && R._UI_VOICE_VERB.test(t)) ||
      (R._UI_VOICE_VERB.test(t) && R._UI_VOICE_ALIAS.test(t))
    ) {
      this._dispatchUiAction("voice", "on", t);
      return true;
    }

    // 2) 設備/パネル対象(camera/mic/avatar/task_panel/controls/subtitle)
    for (const e of R._UI_TARGETS) {
      if (!e.re.test(t)) continue;
      if (!wantsOn && !wantsOff) return false; // 動作語なし → 命令ではない
      this._dispatchUiAction(e.target, wantsOff ? e.off : e.on);
      return true;
    }

    // 3) 成果物 / PDF プレビュー(open=show / close=hide)
    if (R._UI_ARTIFACT.test(t)) {
      if (wantsOff) {
        this._dispatchUiAction("artifact", "hide");
        return true;
      }
      if (wantsOn) {
        // 開く: metacoder に語義解析させ、精確なファイル名を得てから開く(跨言語/
        // 主題一致/多候選の消歧に対応)。詳細は _resolveAndOpenArtifact 参照。
        void this._resolveAndOpenArtifact(this._extractArtifactName(t) ?? t);
        return true;
      }
    }
    return false;
  }

  /**
   * 成果物を「metacoder 語義解析」経由で開く(dh-voice-control-everything §file-resolve)。
   * client の正規化文字列一致だけでは「特斯拉投资报告 → Tesla_Stock_Investment_Report.pdf」
   * のような跨言語/主題一致や、似た複数ファイルの消歧ができない。そこで metacoder
   * (workspace の ls + 言語理解)に精確なファイル名を選ばせ、その名で ui_action を下達する。
   *
   * gwBridge.chatSendAndWait を直接使う(handleTaskRun と違い secretary inbox へ書かない
   * = ユーザ任务列表を汚さない)。解析中は ACK を発声し「固まった」感を防ぐ。多候補は
   * DH が口頭で反問(次の発話で再解析され一意化 → 開く)。
   */
  private async _resolveAndOpenArtifact(query: string): Promise<void> {
    const q = (query || "").trim();
    try {
      this.enqueueTts("好的,我找一下。");
      const prompt =
        `[artifact-resolve] 主人想打开一个已生成的成果物文件(PDF/报告/文档等)。` +
        `他说的是:「${q}」。\n` +
        `请用 ls 列出当前工作目录里的成果物文件,从中选出主人最可能指的**那一个**。\n` +
        `要理解跨语言与主题(如 Tesla=特斯拉、Investment=投资、Performance=业绩/性能、` +
        `hotel=酒店),按含义匹配文件名;必要时可读 content.json 里的 title 辅助判断。\n` +
        `**只**输出一行严格 JSON(不要任何解释或代码块):\n` +
        `{"match":"<精确文件名或null>","candidates":["<若多个都很像就都列出>"]}\n` +
        `规则:唯一确定→match 填该文件名、candidates 留空;多个都像→match 填 null、` +
        `candidates 列出这些文件名;都不像→两者都空。`;
      const reply = await this.gwBridge.chatSendAndWait(
        this.sessionKey,
        `[voice] ${prompt}`,
        { timeoutMs: 30_000 },
      );
      const parsed = RealtimeSessionHandler._parseResolveJson(reply);
      const candidates = parsed?.candidates ?? [];
      if (parsed?.match) {
        console.info(`[DH:${this.sessionId}] 📂 artifact-resolve → "${parsed.match}"`);
        this._dispatchUiAction("artifact", "show", parsed.match);
      } else if (candidates.length >= 2) {
        const list = candidates.slice(0, 4).join("、");
        this.enqueueTts(`找到好几个相似的:${list}。你要打开哪一个?`);
      } else {
        this.enqueueTts("没找到你说的那个文件,你可以说得更具体一点。");
      }
    } catch (err) {
      console.error(`[DH:${this.sessionId}] artifact-resolve failed:`, err);
      // フォールバック: 従来の client 曖昧一致へ(query をそのまま渡す)。
      this._dispatchUiAction("artifact", "show", q || undefined);
    }
  }

  /** metacoder の返信から解析 JSON を頑健に抽出({match, candidates})。 */
  private static _parseResolveJson(
    text: string,
  ): { match: string | null; candidates: string[] } | null {
    if (!text) return null;
    const m = text.match(/\{[\s\S]*\}/); // コードフェンス/前後の散文を無視
    if (!m) return null;
    try {
      const o = JSON.parse(m[0]) as { match?: unknown; candidates?: unknown };
      const match = typeof o.match === "string" && o.match.trim() ? o.match.trim() : null;
      const candidates = Array.isArray(o.candidates)
        ? o.candidates.filter((x): x is string => typeof x === "string" && !!x.trim())
        : [];
      return { match, candidates };
    } catch {
      return null;
    }
  }

  /** UI コマンド文から成果物名候補を抽出(動作語・汎用名詞を除去した残り)。 */
  private _extractArtifactName(t: string): string | undefined {
    const stripped = t
      .replace(
        /打开|打開|开启|開啟|开|開|显示|顯示|查看|查|看看|看一下|看|瞧|展示|亮出|拿出|叫出|翻出|给我看|給我看|出来|出來|调出|調出|弹出|彈出|把|请|請|帮我|幫我|一下|那个|那個|这个|這個|中的|裡的|里的|指定的|指定|叫做|叫|名为|名字|文件名|预览|預覽|的|中|里|裡|オン|表示|開いて|出して|見せて|show|open|view|please/gi,
        "",
      )
      .replace(/成果物|成果|文件|レポート|ファイル/gi, "")
      .trim();
    return stripped.length >= 2 ? stripped : undefined;
  }

  /** 既存の tool_call 転送路で client へ ui_action を下達(Qwen 経由と同形)。 */
  private _dispatchUiAction(target: string, action: string, name?: string): void {
    const args = JSON.stringify(name ? { target, action, name } : { target, action });
    const callId = `uiintent-${++this._uiIntentSeq}`;
    console.info(
      `[DH:${this.sessionId}] 🎛️ Voice→UI(兜底): ui_action ${target}/${action}${name ? ` name="${name}"` : ""}`,
    );
    this.sendToClient({ type: "tool_call", data: { name: "ui_action", args, callId } });
  }

  // -------------------------------------------------------------------------
  // 語音点歌(内蔵 music bundle・docs/20 §4.0/§4.3)
  //
  // handleUserTranscript から filler 過濾より先に呼ばれる。優先順:
  //   1) 具体的な点歌(歌手+曲名 or 曲名/《》抽出可)→ 検索して循环再生。pending を上書き。
  //   2) 停止/暂停 → music_play(stop/pause)。
  //   3) 兜底提案中(_pendingMusic)への肯定/否定応答 → 再生 or 取消。
  // 命中で true(以降の agent 送出を止める)。すべて確定的(実時音声モデルの
  // tool-call に頼らない・[[aimeta-dh-voice-ui-control]])。
  // -------------------------------------------------------------------------
  private _tryVoiceMusic(transcript: string): boolean {
    const R = RealtimeSessionHandler;
    const t = transcript.trim();
    if (!t || t.length > 40) return false;

    // 1) 具体的な点歌(曲名を抽出できたら最優先。pending を上書き)。
    const parsed = this._parseMusicIntent(t);
    if (parsed) {
      this._pendingMusic = null;
      this.sendToClient({ type: "user_transcript", data: { content: transcript } });
      void this._doMusicPlay(parsed.artist, parsed.song);
      return true;
    }

    // 2) 停止 / 暂停。
    if (R._MUSIC_STOP.test(t) || R._MUSIC_PAUSE.test(t)) {
      const pause = R._MUSIC_PAUSE.test(t) && !R._MUSIC_STOP.test(t);
      this._pendingMusic = null;
      this._dispatchUiAction("music", pause ? "pause" : "stop");
      this.enqueueTts(pause ? "好的,先暂停。" : "好的,已经停止播放了。");
      return true;
    }

    // 3) 兜底提案中の肯定/否定応答。
    if (this._pendingMusic) {
      if (R._MUSIC_DECLINE.test(t)) {
        this._pendingMusic = null;
        this.enqueueTts("好的,那不放了。");
        return true;
      }
      if (R._MUSIC_AFFIRM.test(t)) {
        const track = this._pendingMusic.track;
        this._pendingMusic = null;
        this._playTrack(track);
        this.enqueueTts(`好的,为你循环播放《${track.title}》。`);
        return true;
      }
      // 肯定でも否定でもない発話 → 提案は失効。以降の通常処理に委ねる。
      this._pendingMusic = null;
      return false;
    }
    return false;
  }

  /**
   * 点歌意図を解析し {artist, song} を返す(不成立は null)。トリガ語必須:
   * 強トリガ(播放/点播/放一首…)or 弱動詞(放/点/来/听/唱)+ CTX(歌/音乐/《》)。
   * 曲名は《》【】優先、無ければ「歌手的曲名」の「的」分割、それも無ければ動詞除去後の残り。
   */
  private _parseMusicIntent(t: string): { artist: string; song: string } | null {
    const R = RealtimeSessionHandler;
    const hasStrong = R._MUSIC_TRIGGER.test(t);
    const hasWeak = R._MUSIC_WEAK_VERB.test(t) && R._MUSIC_CTX.test(t);
    if (!hasStrong && !hasWeak) return null;

    let artist = "";
    let song = "";
    // (a)《曲名》/【曲名】: 括弧内=曲名、括弧前(動詞/的 除去)=歌手。
    const br = t.match(/[《【]([^》】]+)[》】]/);
    if (br) {
      song = br[1].trim();
      artist = this._cleanMusicWord(t.slice(0, br.index ?? 0)).replace(/的$/, "").trim();
    } else {
      // (b) 動詞・フィラーを除去した本体。
      const body = this._cleanMusicWord(t);
      const de = body.lastIndexOf("的");
      if (de > 0 && de < body.length - 1) {
        artist = body.slice(0, de).trim();
        song = body.slice(de + 1).trim();
      } else {
        song = body.trim();
      }
    }
    // 先頭の「这首/那首/一首」だけ剥がす(曲名末尾の「歌」は 生日歌/国歌 等で残す)。
    song = song.replace(/^(这|這|那)?(首|一首)?/, "").trim();
    if (!song || song.length < 1 || song.length > 20) return null;
    if (/^(歌|歌曲|音乐|音樂|一首|首歌)$/.test(song)) return null;
    if (artist.length > 12) artist = "";
    return { artist, song };
  }

  /** 点歌文から動詞・フィラー・CTX語を剥がして核を残す。 */
  private _cleanMusicWord(s: string): string {
    return (s || "")
      .replace(
        /请|請|帮我|幫我|给我|給我|我想|我要|想要|能不能|可以|麻烦|麻煩|播放|點播|点播|放一首|放首|点一首|點一首|来一首|來一首|来首|來首|听一首|聽一首|点歌|點歌|唱一首|唱首|放|點|点|來|来|聽|听|唱|一首|一下|首|歌曲|音乐|音樂|歌|吧|呗|唄|谢谢|謝謝|好吗|好嗎|嘛|呀|啊/g,
        "",
      )
      .trim();
  }

  /** 検索→命中で循环再生、未命中で同歌手の別曲を提案(再生しない)。 */
  private async _doMusicPlay(artist: string, song: string): Promise<void> {
    const label = artist ? `${artist}的《${song}》` : `《${song}》`;
    try {
      this.enqueueTts(`好的,这就为你找${label}。`);
      const track = await searchMusic(artist, song);
      if (track) {
        this._playTrack(track);
        this.enqueueTts(`好的,为你循环播放《${track.title}》。`);
        return;
      }
      // 未命中 → 同歌手の別曲を提案(勝手に再生しない・§8-3)。
      const rec = artist ? await recommendMusic(artist, song) : null;
      if (rec) {
        this._pendingMusic = { track: rec, artist };
        this.enqueueTts(`没有找到《${song}》。要不要放${artist}的《${rec.title}》?`);
      } else {
        this.enqueueTts(`抱歉,没有找到《${song}》。你可以换一首试试。`);
      }
    } catch (err) {
      console.error(`[DH:${this.sessionId}] music search failed:`, err);
      this.enqueueTts("抱歉,音乐搜索出错了,待会儿再试试。");
    }
  }

  /** client へ music_play を下達(封面/歌名/歌手/循环 を name=JSON で渡す)。 */
  private _playTrack(track: MusicTrack): void {
    const payload = JSON.stringify({
      playUrl: track.playUrl,
      title: track.title,
      artist: track.artist,
      cover: track.cover ?? "",
      source: track.source,
      loop: true,
    });
    console.info(
      `[DH:${this.sessionId}] 🎵 music_play [${track.source}] ${track.artist} - ${track.title}`,
    );
    this._dispatchUiAction("music", "play", payload);
  }

  private handleResponseStarted(): void {
    // The browser mutes the mic on ai_response_started to suppress echo into
    // Qwen during AI speech. In 道B (MuseTalk) and function_calling mode Qwen
    // itself produces the audio, so ttsInProgress is never set (that flag only
    // tracks the legacy HTTP-TTS path); gate on the mode instead so mic-mute
    // actually engages. Legacy TTS-only mode still gates on ttsInProgress to
    // avoid notifying for suppressed VAD-auto responses.
    if (this.isMuseTalkMode || this.dhMode === "function_calling" || this.ttsInProgress) {
      this.sendToClient({ type: "ai_response_started" });
    }
  }

  private handleResponseDone(): void {
    if (this.isMuseTalkMode) {
      // 道B — flush the residual partial frame and release the MuseTalk pipeline
      // back to idle (blink/breathe). No DH pacer in this mode.
      this.sendToClient({ type: "ai_response_done" });
      if (this.museTalkAudioSink) {
        this.museTalkAudioSink.audioEnd();
      }
      return;
    }
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

  // -------------------------------------------------------------------------
  // O4 会話保活(長タスク中の 300s idle 切断防止)
  // -------------------------------------------------------------------------
  private _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private _keepAliveTicks = 0;
  /** 保活間隔。DashScope 既定 idle(~300s)より安全に短く。 */
  private static readonly _KEEPALIVE_INTERVAL_MS = 240_000;
  /** 保活の最大 tick 数(暴走防止)。240s×8 ≈ 32 分 ≒ late 配信 25 分 + 余裕。 */
  private static readonly _KEEPALIVE_MAX_TICKS = 8;

  /** 保活を開始(冪等)。task_run 回執後に arm。 */
  private _armKeepAlive(): void {
    this._stopKeepAlive();
    this._keepAliveTicks = 0;
    this._keepAliveTimer = setInterval(() => {
      this._keepAliveTicks += 1;
      if (this._keepAliveTicks > RealtimeSessionHandler._KEEPALIVE_MAX_TICKS) {
        this._stopKeepAlive();
        return;
      }
      try {
        this.qwenClient?.sendKeepAlive();
      } catch (err) {
        console.warn(`[DH:${this.sessionId}] keepalive failed:`, err);
      }
    }, RealtimeSessionHandler._KEEPALIVE_INTERVAL_MS);
  }

  /** 保活を停止(冪等)。ユーザ発話 / cleanup で disarm。 */
  private _stopKeepAlive(): void {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
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
    this._stopKeepAlive(); // O4: 保活タイマー解放。
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

    // Close the 道B MuseTalk control-WS audio sink (idempotent, never throws).
    try {
      if (this.museTalkAudioSink) {
        this.museTalkAudioSink.close();
        this.museTalkAudioSink = null;
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] MuseTalk audio sink close error:`, err);
    }

    // Finalize memory — flush pending turns, write the session-end marker, and
    // trigger a reindex so this dialogue is searchable next session.
    try {
      if (this.memoryBridge) {
        await this.memoryBridge.onSessionEnd("数字人语音会话结束");
        this.memoryBridge = null;
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] MemoryBridge onSessionEnd error:`, err);
    }

    // Disconnect Qwen
    try {
      if (this.qwenClient) await this.qwenClient.disconnect();
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] Qwen disconnect error:`, err);
    }

    // Stop avatar provider (MuseTalk best-effort no-op; BytePlus stops the
    // underlying DH session).
    try {
      if (this.avatarProvider) {
        await this.avatarProvider.stop();
      }
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] avatar provider stop error:`, err);
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
