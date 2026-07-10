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
import { findVoice } from "./integrations/qwen-voices.js";
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
import { initJaReading, jaKanjiToKana } from "./ja-reading.js";

// 起動時に kuromoji 辞書を非同期ロード(TTS の日本語漢字→仮名読み用)。冪等。
initJaReading();

// Option B(日本語発音トライアル)は不採用: text→TTS 経路で MuseTalk 音声が
//   ブラウザに届かず無音になる問題を解決しきれなかった。既定 OFF = realtime 直出音声
//   (発音はモデル任せ)に戻す。env WINCLAW_DH_TTS_PIPELINE=1 で再有効化可能(実験用)。
const TTS_PIPELINE_MODE =
  (process.env.WINCLAW_DH_TTS_PIPELINE ?? "0") === "1";

// 音画同期補償(MuseTalk モード限定)。VM は口型映像を WebRTC でレンダリングして返すが
// (レンダリング+伝送で遅延あり)、ブラウザは ai_audio を受信次第 即再生するため **音声が
// 口型より先行**する。この値(ms)だけ ai_audio の **ブラウザ送出のみ**を遅らせ、口型映像に
// 合わせる。VM への PCM 送出(sendAudioData)は遅らせない(口型生成は即時のまま)。
// 既定 0 = 無効(従来挙動・1バイトも変えない)。env WINCLAW_DH_AUDIO_DELAY_MS で調整。
// 上限 15000ms(暴走ガード)。barge-in / cleanup で遅延中の送出は全キャンセルする。
const AUDIO_DELAY_MS = (() => {
  const n = Number(process.env.WINCLAW_DH_AUDIO_DELAY_MS ?? "0");
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 15_000) : 0;
})();
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
  // ★Option B: TTS 世代カウンタ。barge-in で ++。in-flight 合成の残りチャンクを破棄する。
  private _ttsGen = 0;

  // 音画同期補償(AUDIO_DELAY_MS>0)で遅延送出中の ai_audio タイマー群。
  // barge-in / cleanup で全 clearTimeout し、打断後に古い音声が鳴り続けるのを防ぐ。
  private _pendingAudioTimers = new Set<ReturnType<typeof setTimeout>>();

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
    // be preloaded into the prompt. Active in FC-style mode with a backend.
    // ★2026-07-10 修正(ユーザ要件「聊过的内容/执行过的任务都要进 winclaw 记忆」):
    //   従来は `!liteVoice` を条件に入れ **lite-voice(現行既定)で記憶橋を丸ごと切って**
    //   いた。だが lite-voice が切りたかったのは**日本語ペルソナ prompt**であって、
    //   会話/任务の**記憶記録(memory/YYYY-MM-DD.md 追記 → gemini-embedding 索引)**では
    //   ない。記録は prompt 言語に影響しない。よって lite-voice でも記憶橋を有効化し、
    //   user 転写 + AI 回复 + 任务结果 + 播放音乐 を memory へ落として memory_search で
    //   召回できる様にする。preload(直近の自分の会話)も中文なので lite の言語中立を壊さない。
    let memoryPreload = "";
    if (isFC && this.memory && this.config.memory?.recordConversation !== false) {
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
    // ★人設反映(lite mode): 后端が IDENTITY.md 冒頭に注入した name/relationship/
    //   owner nickname を IdentityLoader が解析済み。伴侣名=identity.name(自称・
    //   nickname は「对用户的称呼」なので混同しない)、关系=relationship、对用户的称呼
    //   =nickname。冗長な日文人設は使わず(lite の「跟随用户语言」を壊さない)、簡潔な一行で
    //   人設だけ乗せる。name 未解析時は "WinClaw" 回落なので出さない。
    const selfName =
      identity.name && identity.name.trim() && identity.name.trim() !== "WinClaw"
        ? identity.name.trim()
        : "";
    const ownerNick = (identity.nickname || "").trim();
    const rel = (identity.relationship || "").trim();
    // brief = 后端が description から注入した一句話人設(分居状態/秘书役割 等の"当前設定"を含む)。
    //   有れば relationship 単文より brief を優先(状況付きで濃い)。無ければ relationship へ回落。
    const brief = (identity.brief || "").trim();
    const personaLine =
      (selfName ? `你的名字叫「${selfName}」。` : "") +
      (brief ? `${brief} ` : rel ? `你是用户的${rel}。` : "") +
      (ownerNick ? `请始终亲昵地称呼TA为「${ownerNick}」。` : "");
    const liteVoicePrompt =
      `${personaLine}你是一个温暖、自然的语音陪伴助手,正在和用户进行实时语音对话。\n\n` +
      `最重要的规则:\n` +
      `1. 语言:必须用「用户当前所说的语言」回复。用户说中文你就说中文,说英文就说英文,说日文就说日文。` +
      `当用户切换语言、或明确要求你换语言时(例如说「说中文」),立刻从此用那种语言回复。` +
      `绝不要用用户没有使用的语言回答。一句话之内只用一种语言的词汇和发音,不要混语言。\n` +
      `2. 简短:这是语音对话,回复要短、口语化,通常 1-2 句话。不要废话、不要复述问题、不要「让我…」之类的开场白。\n` +
      `3. 自然:像朋友一样温暖、直接、切题。\n` +
      `4. 工具:当用户要你做事——发消息到 WhatsApp/Slack/Telegram/LINE/邮件、上网查实时信息、回忆过去的事、执行任务——就调用相应的工具去完成,完成后用一句口语化的话汇报结果。不确定用哪个工具时,用 ask_winclaw 把需求原样转给 winclaw。日常闲聊不要调用工具。\n` +
      `5. 画面控制(ui_action):当用户要你操作这个界面——显示/隐藏「任务管理」面板、藏起或显示底部「控制条」、打开某个「成果物/PDF」预览、开关麦克风、开关摄像头、启动或关闭「数字人形象」、开关「字幕」、进入/退出「全屏沉浸」、切换「音色」——就调用 ui_action 工具。参数 target 取值:` +
      `task_panel(任务管理面板)、controls(控制条)、artifact(成果物预览,name 填文件名)、mic(麦克风)、camera(摄像头)、avatar(数字人形象)、subtitle(字幕)、fullscreen(全屏)、voice(音色,name 填如「活泼」「日語」)、task_continue(给指定编号的任务追加继续指令,name 填 JSON {"seq":任务号,"text":"指令"})、task_artifact(打开指定编号任务的成果物,name 填 JSON {"seq":任务号,"query":"pdf或文件名"});action 取值:show/hide/toggle/on/off/open/close/play/pause/stop/resume/send。` +
      `例:「显示任务管理」→ ui_action(task_panel, show);「把英伟达PDF显示出来」→ ui_action(artifact, show, name="英伟达投资分析报告.pdf");「打开124号任务的成果」→ ui_action(task_artifact, open, name="{\\"seq\\":124}");「让1号任务继续,补充xxx」→ ui_action(task_continue, send, name="{\\"seq\\":1,\\"text\\":\\"补充xxx\\"}");「关掉麦克风」→ ui_action(mic, off)。\n` +
      `6. 播放音乐:当用户要你放歌/点歌/播放某首歌(如「放首晴天」「播放周杰伦的歌」),音乐会**自动播放**,你只需说一句「好的,这就为你放」。**播放/暂停/停止音乐绝对不要调用 task_run 或任何工具**——音乐由系统自动处理,用 task_run 会错误地创建任务。这是你会的能力,别拒绝。\n` +
      `7. 你的能力自知:当用户问「你能做什么/有什么功能」,主动且简短地介绍你真实会的:陪伴聊天、执行任务(做报告/查资料/发消息)、播放音乐、打开与继续历史任务、显示成果物、控制这个界面(面板/麦克风/摄像头/形象/字幕/全屏/音色)。**绝不要说「我只是个聊天助手/我不能做这些」这类否定自己能力的话**——上面这些你都会。\n` +
      `8. ★执行任务时绝不编造(最重要):当用户要你执行任务(分析/研究/查资料/做报告/发消息/整理/统计等),后台会自动通过 winclaw 执行,你**只需简短回应「好的,我来帮你处理,稍等」并等待**。**绝对不要编造分析内容、数据、结论,也不要假装任务已经完成或"再试一次肯定行"**。真实结果处理好后系统会明确告诉你成功还是失败,你再据此如实转告用户;失败就如实说失败,绝不谎报成功。没拿到真实结果前,不要给出任何具体结论。` +
      `★当任务生成了报告/文档/PDF 等成果物时,告诉用户「已经做好了,稍等一下就会自动显示在下面的成果物栏里」——**成果物会自动更新出现,不用让用户手动刷新**;别说"已经显示了/你看下面"这种,因为可能还要几秒才同步过来。\n` +
      `9. ★不要为「动作确认/状态询问」建任务(最重要):只有当用户提出**有明确主题的实务需求**(如「查特斯拉的财务状况」「做份英伟达投资分析」)才用 task_run。` +
      `以下情况**绝不调用 task_run**,直接口头回应即可:①问任务/系统状态(「这个任务在执行吗」「好了吗」「进度怎样」)——直接口头告知或说「我看一下」;②光杆动作没有主题(「帮我打开」「显示」「处理一下」)——这是界面操作,用 ui_action 或反问「你要打开什么」;③状态类短语(「正在处理中」)。这些都不该出现在任务列表里。\n` +
      `11. ★创建任务前先确认(重要):当你要为用户创建一个任务(调查/分析/做报告/生成文档等),` +
      `**先用一句话复述你理解的任务内容并问「对吗?」**,等用户说「对/是/开始」再真正创建并执行;` +
      `用户说「不对/取消」就放弃;用户补充内容就并进去再确认一次。**在用户确认前,绝不要说任务已创建/已开始/已完成**。\n` +
      `10. ★记忆与延续(重要):你和主人聊过的内容、做过的任务、放过的歌都会**存进长期记忆**。` +
      `当用户提到过去(「我上次说的」「你还记得吗」「之前那个」),先凭记忆回答;记不清就调 memory_search 查再答,**不要说「我不记得/我记不住」**。` +
      `每次对话开始,如果有历史记忆就自然延续话题,别每次都从「今天过得怎么样」这种通用开场重新开始。\n` +
      `注意区分:界面/画面的显示隐藏用 ui_action;而"生成PDF/做报告/写代码"这类实务任务用 task_run,别混。调用后用一句口语化的话确认(如「好的,打开任务管理」)。`;
    const _baseInstructions = liteVoice
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

    // ★2026-07-10(ユーザ要件「聊过的内容要记得住、别每次都从『今天过得怎么样』开始」):
    //   非 lite の buildInstructions は additionalContext に memoryPreload を折込むが、
    //   **lite-voice(現行既定)は liteVoicePrompt を使い memoryPreload を無視していた** →
    //   記録はされても開口時に過去文脈を持たず、毎回リセットされた挨拶になる。ここで
    //   lite-voice でも直近記憶を prompt 末尾へ明示付加し、「憶えていて話を継ぐ」を実現する。
    const instructions =
      liteVoice && memoryPreload
        ? _baseInstructions +
          "\n\n【最近的对话记忆(这是你和主人**之前聊过/做过**的事,你要记得)】\n" +
          memoryPreload +
          "\n\n★根据上面的记忆:开口打招呼时**自然延续之前的话题或提到上次聊/做过的事**" +
          "(例如「上次你说的那个…后来怎么样了」「昨天点的那首歌不错吧」)," +
          "**绝对不要每次都用『今天过得怎么样』『有什么可以帮你』这种从零开始的通用开场**。" +
          "用户提到过去的事时,先用记忆回答,记不清再用 memory_search 查。"
        : _baseInstructions;

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
        // 音画同期補償で遅延送出待ちの ai_audio を破棄(打断後に旧ターン音声が鳴り続けない)。
        this.clearPendingAudio();
        // ★Option B: 割り込み時は TTS キュー + 蓄積 delta をクリアし、進行中 TTS の
        //   残りチャンクは _ttsGen 世代不一致で破棄させる(古いターンを喋り続けない)。
        if (TTS_PIPELINE_MODE) {
          this._ttsGen++;
          this.ttsQueue = [];
          this.deltaBuffer = "";
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
  // 実時声音切替(Tier 2 — 内嵌 UI からの音色切替)
  //   UI がドロップダウンで新しい Qwen 音色を選ぶ → {type:"voice_change",voice}
  //   を WS で送る → 此処で検証 → qwenClient を新 voice で realtime 再接続する。
  //   DashScope は session.created で voice を固定するため、session.update では
  //   変わらない → WS を張り直すのが唯一確実(reconnectWithVoice を復用)。
  //   Qwen セッションだけ張り直す。avatar(MuseTalk video)/audio sink は不変。
  // -------------------------------------------------------------------------

  /**
   * Change the realtime TTS voice for this live session.
   *
   * Validates `voice` against the Qwen voice catalog, then reconnects the Qwen
   * realtime session with the new voice (see
   * {@link QwenRealtimeClient.reconnectWithVoice}). The MuseTalk avatar video +
   * control-WS audio sink are untouched — only the Qwen brain WS is re-established
   * — so the avatar keeps rendering and the very next spoken turn uses the new
   * voice, without a container restart.
   *
   * Never throws: unknown voices and reconnect failures are logged and surfaced
   * to the browser as a non-fatal `error` (`VOICE_CHANGE_FAILED`) so the session
   * (and current voice) keep working.
   *
   * @param voice - New Qwen voice id (e.g. "Ethan", "Cherry", "Serena").
   */
  async handleVoiceChange(voice: string): Promise<void> {
    if (!this.ensureReady("handleVoiceChange")) return;

    const requested = (voice ?? "").trim();
    const known = findVoice(requested);
    if (!known) {
      console.warn(
        `[DH:${this.sessionId}] voice_change rejected — unknown voice "${requested}"`,
      );
      this.sendToClient({
        type: "error",
        data: { code: "VOICE_CHANGE_FAILED", message: `Unknown voice: ${requested}` },
      });
      return;
    }

    if (requested === this.qwenClient.voice) {
      console.info(`[DH:${this.sessionId}] voice_change no-op — already "${requested}"`);
      return;
    }

    console.info(
      `[DH:${this.sessionId}] 🎙 voice_change "${this.qwenClient.voice}" → "${requested}" — reconnecting Qwen`,
    );
    // Keep config in sync so any later diagnostics / session.created reflect it.
    this.config.qwen.voice = requested;
    try {
      const ok = await this.qwenClient.reconnectWithVoice(requested);
      if (!ok) {
        this.sendToClient({
          type: "error",
          data: { code: "VOICE_CHANGE_FAILED", message: "Voice reconnect failed" },
        });
        return;
      }
      // Re-register tools after the reconnect: setTools sends session.update only
      // when connected, so if reconnectWithVoice resolves before session.created
      // the pre-seeded tools from _buildFullSessionPayload already cover it; this
      // call is a safe no-op reinforcement (idempotent) once connected.
      if (this.toolRouter) {
        this.qwenClient.setTools(WINCLAW_DH_TOOLS);
      }
      console.info(`[DH:${this.sessionId}] ✅ voice_change applied — voice="${requested}"`);
    } catch (err) {
      console.error(`[DH:${this.sessionId}] voice_change error:`, err);
      this.sendToClient({
        type: "error",
        data: {
          code: "VOICE_CHANGE_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
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
    // モデルが FC した=転写兜底は不要(真フォールバック判定用)。
    this._lastFunctionCallAt = Date.now();
    // ★音楽はクライアント側 _tryVoiceMusic が再生済。モデルが task_run("music.*") を
    //   呼んでも winclaw タスクを作らず良性結果を返す(スプリアスな music.play タスク濫造 +
    //   二重処理を防ぐ)。音楽の再生/停止は task_run ではない。
    if (call.name === "task_run") {
      let taskName = "";
      try {
        taskName = String(
          (JSON.parse(call.argumentsJson ?? "{}") as { taskName?: string }).taskName ?? "",
        );
      } catch {
        /* ignore */
      }
      if (/^music([._]|$)|music[._](play|pause|stop|resume|next)/i.test(taskName)) {
        console.info(
          `[DH:${this.sessionId}] ⏭ task_run("${taskName}") = 音楽 → winclaw 派発せず(客户端兜底処理済)`,
        );
        const benign = JSON.stringify({
          status: "ok",
          summary: "音乐已经在播放了。",
          user_message: "音乐已经在播放了。",
        });
        this.sendToClient({
          type: "tool_result",
          data: { name: call.name, callId: call.callId, status: "ok", summary: "音乐(客户端处理)" },
        });
        try {
          await this.qwenClient.sendFunctionResult(call.callId, benign);
        } catch {
          /* ignore */
        }
        return;
      }
      // ★動作確認/状態質問/光杆動詞の task_run はタスク化しない(モデルが誤って
      //   task_run を呼んでも受管タスクを作らず会話で応じる)。ユーザ要件 2026-07-10。
      if (RealtimeSessionHandler._isJunkTaskRequest(taskName)) {
        console.info(
          `[DH:${this.sessionId}] ⏭ task_run("${taskName}") = 非タスク発話(状態質問/動作確認)→ 派発せず`,
        );
        const benign = JSON.stringify({
          status: "ok",
          summary: "这是个操作/状态类的请求,不需要建任务,我直接口头回应就好。",
          user_message: "好的。",
        });
        this.sendToClient({
          type: "tool_result",
          data: { name: call.name, callId: call.callId, status: "ok", summary: "非任务发话(不建任务)" },
        });
        try {
          await this.qwenClient.sendFunctionResult(call.callId, benign);
        } catch {
          /* ignore */
        }
        return;
      }
    }
    // ★重複抑制: 3.5 モデルは同一 task_run/ask_winclaw を数秒で何度もループ発火し
    //   タスクが 4 個も起きる。同一 intent(name+args)を 60s 内は**再実行せず**、
    //   Qwen へ「処理中・重複提出するな」を返してループを止める。
    if (call.name === "task_run" || call.name === "ask_winclaw") {
      const now = Date.now();
      const key = `${call.name}:${(call.argumentsJson ?? "").replace(/\s+/g, "").slice(0, 200)}`;
      for (const [k, ts] of this._recentTaskKeys) {
        if (now - ts > RealtimeSessionHandler._TASK_DEDUP_MS) this._recentTaskKeys.delete(k);
      }
      const last = this._recentTaskKeys.get(key);
      if (last !== undefined && now - last < RealtimeSessionHandler._TASK_DEDUP_MS) {
        console.info(
          `[DH:${this.sessionId}] ⏭ dedup ${call.name}(${Math.round((now - last) / 1000)}s前に派発済)— 重复派发を阻止`,
        );
        const dup = JSON.stringify({
          status: "ok",
          summary: "这个任务我已经在处理了,请不要重复提交,稍等结果就好。",
          user_message: "这个任务我已经在处理了,请稍等结果。",
        });
        this.sendToClient({
          type: "tool_result",
          data: { name: call.name, callId: call.callId, status: "ok", summary: "已在处理中(去重)" },
        });
        try {
          await this.qwenClient.sendFunctionResult(call.callId, dup);
        } catch {
          /* ignore */
        }
        return;
      }
      this._recentTaskKeys.set(key, now);
    }
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
  /**
   * ブラウザへ `ai_audio`(ユーザが実際に聞く音声)を送る。{@link AUDIO_DELAY_MS} が
   * >0 のとき、VM の口型映像(WebRTC レンダリング遅延あり)に合わせて **ブラウザ送出のみ**
   * を setTimeout で遅延させる(順序は同一遅延で保たれる)。0 のときは即時送出=従来挙動。
   * 遅延中のタイマーは {@link _pendingAudioTimers} で追跡し、barge-in / cleanup で全 clear。
   */
  private sendAiAudioToClient(pcm: Buffer, sampleRate: number): void {
    const audio = pcm.toString("base64");
    const send = () =>
      this.sendToClient({
        type: "ai_audio",
        data: { audio, format: "pcm16", sample_rate: sampleRate },
      });
    if (AUDIO_DELAY_MS <= 0) {
      send();
      return;
    }
    const timer = setTimeout(() => {
      this._pendingAudioTimers.delete(timer);
      send();
    }, AUDIO_DELAY_MS);
    this._pendingAudioTimers.add(timer);
  }

  /** 遅延送出中の ai_audio を全キャンセルする(barge-in / cleanup)。冪等。 */
  private clearPendingAudio(): void {
    for (const t of this._pendingAudioTimers) clearTimeout(t);
    this._pendingAudioTimers.clear();
  }

  private handleQwenAudio(pcm: Buffer, sampleRate: number): void {
    // 道B MuseTalk render path — push Qwen's TTS PCM straight to the VM over the
    // control WS in 4800-byte frames with NO resample (Qwen 24kHz verbatim; the
    // VM down-converts internally). Also forward to the browser as `ai_audio`
    // for local playback (the VM returns video only — no audio track).
    if (this.isMuseTalkMode) {
      // ★Option B: realtime 音声は破棄(TTS 経路が MuseTalk を駆動する=発音矯正のため)。
      if (TTS_PIPELINE_MODE) return;
      if (this.museTalkAudioSink) {
        this.museTalkAudioSink.sendAudioData(pcm);
      }
      // ブラウザへ ai_audio。AUDIO_DELAY_MS>0 なら口型映像に合わせ遅延送出(送 VM は即時)。
      this.sendAiAudioToClient(pcm, sampleRate);
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
    // ★Option B: 応答テキスト(delta)を貯めて文単位で TTS へ流す(realtime 音声の代替)。
    //   完全転写(isDelta=false)は重複するので貯めない。残りは handleResponseDone で flush。
    if (TTS_PIPELINE_MODE && this.isMuseTalkMode && isDelta) {
      this.deltaBuffer += text;
      this.flushDeltaSentences(false);
    }
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

    // ★タスク作成前の復唱確認への応答(2026-07-10)。確認待ち中は「对/不对/补充」を最優先で
    //   捌く(music の「好」等に横取りされない為に **最前**で判定)。命中で以降処理を止める。
    if (this._pendingTaskConfirm) {
      this.sendToClient({ type: "user_transcript", data: { content: transcript } });
      if (this._handleTaskConfirmReply(trimmed)) return;
    }

    // 語音点歌(内蔵 music bundle・docs/20)。点歌/停止/兜底提案への肯定応答を
    // 転写ベースで確定的に処理する。**filler 過濾より先**に判定するのは、兜底提案
    // (「放《稻香》好吗?」)への「好」等の肯定応答が FILLER_PATTERN に食われるのを
    // 防ぐため。命中したら以降の STT/agent 送出はしない。
    if (this._tryVoiceMusic(trimmed)) {
      this.qwenClient?.suppressNextResponse(); // 兜底が喋る為モデルは抑制(二重発声防止)
      return;
    }

    // Filter out filler words
    if (RealtimeSessionHandler.FILLER_PATTERN.test(trimmed)) {
      return;
    }

    // Show each fragment in browser immediately
    this.sendToClient({ type: "user_transcript", data: { content: transcript } });

    // 診断: 転写内容と task-seq 判定結果をログ(語音 UI 制御のデバッグ用)。
    const _seq = RealtimeSessionHandler._matchTaskSeq(trimmed);
    console.info(
      `[Handler:${this.sessionId}] transcript="${trimmed}" taskSeq=${_seq ? _seq.seq : "none"}`,
    );

    // 「N号任务の成果物を開く」(例:「打开120号任务的PDF」)。継続指示より先に判定
    // (開く動詞+成果物名詞があれば継続でなく成果物オープン)。
    if (this._tryVoiceTaskArtifact(trimmed)) {
      this.qwenClient?.suppressNextResponse();
      return;
    }

    // 「特定タスク番号への継続指示」(例:「3号任务把标题改成…」)。UI 命令より先に
    // 判定(長文可・40字上限を掛けない)。命中したら client へ task_continue を下達し
    // agent へは流さない(secretary-panel が該当タスクへ POST /tasks/{id}/messages)。
    if (this._tryVoiceTaskContinue(trimmed)) {
      this.qwenClient?.suppressNextResponse();
      return;
    }

    // 語音 UI 制御の確定的兜底: realtime モデル(omni-flash)は ui_action の
    // function-call を確実には出さない(実測: 「カメラを開いて」を理解しても発話で
    // 応答するだけで tool を呼ばない)。転写を直接照合し、UI 操作意図なら Qwen の
    // 判断を待たず client へ ui_action を下達する。詳細は _tryVoiceUiIntent 参照。
    if (this._tryVoiceUiIntent(trimmed)) {
      this.qwenClient?.suppressNextResponse();
      return;
    }

    // ★全「実行系要求」の winclaw 兜底(ユーザ要件: 全 tool-call に winclaw 兜底必須)。
    //   実時モデルは task_run 等の function-call を実際には出さない(実測 0/72=纯聊天)。
    //   UI/音楽/成果物/継続 以外の**実行を要する要求**(分析/調査/作成/送信/整理/提醒…)を
    //   検出したら、**winclaw agent(ask_winclaw)へ確定的に委ね**、返ってきた**真の成否**を
    //   数字人へ播報+コンテキスト注入する(成功/失败を捏造しない=胡说八道防止)。
    if (this._tryVoiceAskWinclaw(trimmed)) return;

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
    { target: "task_panel", on: "show", off: "hide", re: /任务管理|任務管理|任务面板|任務面板|任务列表|任務列表|任务栏|任務欄|任务窗|任務窗|任务框|任務框|任务侧栏|任務側欄|タスク(管理|パネル|一覧|バー|欄|ウィンドウ)|\btask.?(panel|bar|list|window)\b/i },
    { target: "controls", on: "show", off: "hide", re: /控制条|控制條|控制栏|控制欄|控制按钮|控制按鈕|控制面板|操作パネル|操作欄|操作バー|コントロール|\bcontrol.?(s|bar|panel)?\b/i },
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
  /** 成果物プレビュー対象語(open=show / close=hide)。★成果物の"中身"を指す語も含める
   *  (「打开投资建议/分析/方案」等 = 直前タスクの成果物を開く意図。task_run 化を防ぐ)。
   *  artifact 分岐は wantsOn(打开/查看)必須なので、動詞無しの「分析特斯拉」等は task のまま。 */
  private static readonly _UI_ARTIFACT =
    /成果物|成果|报告|報告|报告书|報告書|文档|文檔|文件|预览|預覽|\bpdf\b|レポート|ファイル|投资建议|投資建議|投资报告|投資報告|建议书|建議書|分析|方案|计划书|計劃書|财报|財報|结果|結果/i;
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

  // ★点歌の片段合并(2026-07-10・ユーザ要件「保证搜索到对应音乐」)。「放…」「青花瓷」「好不好」の
  //   様に断続化した語音を 1 曲へまとめて検索する為の収集バッファ + 収集窗フラグ。
  private _musicCoalesceBuffer = "";
  private _musicCoalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private _musicListening = false;
  /** 点歌収集の無音待ち窓(ms)。この間の続き片段(バレ曲名含む)を同一点歌へ吸収。 */
  private static readonly _MUSIC_COALESCE_MS = 1400;

  // ★タスク派発の重複抑制 + 兜底の真フォールバック化(2026-07-09)。
  //   3.5 モデルが prompt 誘導で FC する様になったが**同一 task_run をループ発火**する
  //   (実測: 1 要求で task_run×4=タスク 4 個)。加えて転写兜底が叠加し二重派発/二重発声。
  /** 直近 function-call 発生時刻(ms)。転写兜底が「モデルが FC 済ならスキップ」に使う。 */
  private _lastFunctionCallAt = 0;
  /** intentKey → 最終派発 ms。同一タスクの短時間再派発を抑止。 */
  private readonly _recentTaskKeys = new Map<string, number>();
  /** 同一 intent の再派発を無視する窓(ms)。 */
  private static readonly _TASK_DEDUP_MS = 60_000;
  /** 兜底が待機中の最新の実行系要求(遅延 fallback 判定用)。 */
  private _pendingAskWinclaw: string | null = null;
  // ★連続語音の合并(2026-07-10・ユーザ要件「同じ任务は1個の编号だけ」)。断続的に話す
  //   task-worthy 発話を **1 タスクへ合并**する。片段が来る度にバッファへ追記し、~5s の
  //   無音(次の片段が来ない=一区切り)で **1 回だけ** task_run を dispatch する。
  private _taskCoalesceBuffer = "";
  private _taskCoalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private _taskCoalesceFcBase = 0;
  /** 合并の無音待ち窓(ms)。この間に続く片段は同一タスクへ吸収。 */
  private static readonly _TASK_COALESCE_MS = 5000;
  // ★タスク作成前の**復唱確認**(2026-07-10・ユーザ要件): 合并した要求を dispatch する前に
  //   数字人が「你是要我X吗?」と復唱し、**肯定応答を得てから**作成+実行する(誤タスク防止)。
  private _pendingTaskConfirm: string | null = null;
  private _pendingTaskConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  /** 確認待ちの自動失効(ms)。無応答ならタスクを作らず破棄。 */
  private static readonly _TASK_CONFIRM_TTL_MS = 30_000;
  /** 確認への肯定(先頭一致)。 */
  private static readonly _TASK_CONFIRM_YES =
    /^(对|對|是|是的|对的|對的|没错|沒錯|好|好的|好呀|好嘞|可以|行|嗯|嗯嗯|嗯呐|确认|確認|确定|確定|就这样|就這樣|就是|开始|開始|开始吧|開始吧|去吧|执行|執行|做吧|拜托|拜託|ok|okay|yes|yep|sure|はい|うん|いいよ)/i;
  /** 確認への否定/取消(先頭一致)。 */
  private static readonly _TASK_CONFIRM_NO =
    /^(不|不对|不對|不是|不用|不要|别|別|算了|取消|等等|先别|先別|停|不做|重来|重來|再说|再說|no|nope|やめ|ちがう)/i;

  // ── 語音点歌(内蔵 music bundle・docs/20)──────────────────────────────
  /** 兜底提案中の曲(「放《稻香》好吗?」)。次の肯定応答で再生する。 */
  private _pendingMusic: { track: MusicTrack; artist: string } | null = null;
  /** 現在音乐が再生中(dispatch play 済・stop まで true)。停止/换一首/暂停 等の
   *  制御意図はこの間だけ判定する(未再生時の誤爆を防ぎつつ停止語を広く採れる)。 */
  private _musicActive = false;
  /** 「换一首/下一首」用に直近の歌手・曲名を保持(同歌手の別曲を推す)。 */
  private _lastMusicArtist = "";
  private _lastMusicTitle = "";
  /** ★音乐記憶(2026-07-10・ユーザ要件): 再生した曲を履歴保持。DH が「刚才放的什么歌」に
   *  答え、「再放一遍/刚才那首」で **URL 再解決なし**に即再生できる様にする(mp3 path 記憶)。
   *  セッション内メモリ(container 稼働中は保持)。最新が末尾・上限 30 件。 */
  private _musicHistory: Array<{
    title: string;
    artist: string;
    playUrl: string;
    source: string;
    at: number;
  }> = [];
  /** 直近再生トラック(「再放一遍」の即時再生用・playUrl キャッシュ)。 */
  private _lastMusicTrack: MusicTrack | null = null;

  /** 点歌トリガ(播放/点播/放一首… + 曲名 or 《》)。誤爆防止のため下の解析と併用。
   *  ★D: 灵敏化。「我想听/我要听/放首歌/放点音乐/听首歌」等の明確な点歌表現を追加
   *  (曲名抽出は _parseMusicIntent が担うので誤爆は残りが空/generic なら弾かれる)。 */
  private static readonly _MUSIC_TRIGGER =
    /播放|點播|点播|放一首|放首|点一首|點一首|来一首|來一首|来首|來首|听一首|聽一首|点歌|點歌|唱一首|唱首|点播首|我想听|我想聽|我要听|我要聽|放首歌|放個歌|放个歌|唱首歌|放点音乐|放點音樂|来点音乐|來點音樂|放音乐|放音樂|听首歌|聽首歌|听点|聽點/;
  /** 弱いトリガ(放/点/来/听/唱)。CTX(歌/音乐/曲/旋律/《》)と併用時のみ点歌とみなす。 */
  private static readonly _MUSIC_WEAK_VERB = /[放點点來来聽听唱]/;
  private static readonly _MUSIC_CTX = /歌|音乐|音樂|曲|旋律|单曲|單曲|[《【][^》】]+[》】]/;
  /** 停止(★music-active 時のみ判定するので広く採る:停/停止/别放/关掉/不听 等)。 */
  private static readonly _MUSIC_STOP =
    /停(止|下|掉)?$|停止|停下|停掉|别放|別放|别听|別聽|别唱|別唱|关掉|關掉|关了|關了|关闭|關閉|关一下|關一下|不(听|聽)了|不想(听|聽|放)|不要(听|聽|放|了)|够了|夠了|安静|安靜|静音|靜音|闭嘴|閉嘴|结束|結束/;
  /** 暂停(停 を含むので _MUSIC_STOP より先に判定)。 */
  private static readonly _MUSIC_PAUSE = /暂停|暫停|先停|停一下|先暂停|先暫停/;
  /** 恢复/继续。 */
  private static readonly _MUSIC_RESUME =
    /继续(播放|放|听|聽)?|繼續(播放|放|听|聽)?|接着(放|听|聽)|接著(放|听|聽)|恢复播放|恢復播放|继续吧|繼續吧/;
  /** 换一首/下一首(同歌手の別曲を推す)。 */
  private static readonly _MUSIC_NEXT =
    /换一?首|換一?首|换个|換個|换歌|換歌|下一首|下一曲|下一个|下一個|再来一?首|再來一?首|再放一?首|来首别的|來首別的|别的歌|別的歌|换首歌|換首歌|不(听|聽)这(首)?|不(听|聽)這(首)?|换换|換換/;
  /** ★灵敏化: 「再放一遍/刚才那首」= 直近再生トラックを URL 再解決なしに即再生。 */
  private static readonly _MUSIC_REPLAY =
    /再放一遍|再放一次|再听一遍|再聽一遍|重新放|重放|重播|刚才那首|剛才那首|刚才的歌|剛才的歌|刚才那歌|剛才那歌|同一首|再来一遍|再來一遍|那首再放|刚刚那首|剛剛那首/;
  /** 兜底提案への肯定/否定(短文照合)。 */
  private static readonly _MUSIC_AFFIRM =
    /^(好|好的|好呀|好啊|好嘞|可以|行|嗯好|要|想(听|聽)|放吧|来吧|來吧|播放|放|听|聽|ok|okay|yes|はい|うん|いいよ|おねがい|お願い)/i;
  private static readonly _MUSIC_DECLINE =
    /不用|不要|算了|别|別|不(听|聽)|不想|no|やめ|结束|結束/;

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

  /** 中文/日文数字(一百二十…)またはアラビア数字を整数へ。不正なら null。 */
  private static _cnNumToInt(s: string): number | null {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const digit: Record<string, number> = {
      "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "兩": 2, "三": 3, "四": 4,
      "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
      "壹": 1, "贰": 2, "參": 3, "叁": 3, "肆": 4, "伍": 5, "陆": 6, "柒": 7, "捌": 8, "玖": 9,
    };
    const unit: Record<string, number> = { "十": 10, "拾": 10, "百": 100, "佰": 100, "千": 1000, "仟": 1000 };
    let section = 0;
    let num = 0;
    for (const ch of s) {
      if (ch in digit) {
        num = digit[ch];
      } else if (ch in unit) {
        const u = unit[ch];
        section += (num === 0 ? 1 : num) * u; // 「十二」の先頭十=10
        num = 0;
      } else {
        return null; // 想定外文字
      }
    }
    const total = section + num;
    return total > 0 ? total : null;
  }

  /**
   * 転写からタスク番号参照(任务N / 第N个任务 / N号任务 / タスクN / task N)を抽出。
   * N はアラビア数字 **または中文/日文数字**(一百二十…)。ASR は口語番号を漢数字で
   * 書き起こすため、両対応しないと「120号任务」が拾えない(実測の主因)。
   */
  private static _matchTaskSeq(t: string): { seq: number; raw: string } | null {
    const NUM = "(\\d+|[零〇一二两兩三四五六七八九十百千拾佰仟壹贰參叁肆伍陆柒捌玖]+)";
    const re = new RegExp(
      `第\\s*${NUM}\\s*(?:个|個|号|號|項)?\\s*(?:任务|任務)` +
        `|(?:任务|任務|タスク|task)\\s*(?:号|號|#|＃|no\\.?|番)?\\s*${NUM}` +
        `|${NUM}\\s*(?:号|號|番)\\s*(?:任务|任務|タスク)`,
      "i",
    );
    const m = t.match(re);
    if (!m) return null;
    const numStr = m[1] || m[2] || m[3] || "";
    const seq = RealtimeSessionHandler._cnNumToInt(numStr);
    if (seq == null || seq <= 0) return null;
    return { seq, raw: m[0] };
  }

  /** 成果物名詞/ファイル種別(pdf/excel/報告/文件…)を含むか。 */
  private static readonly _UI_ARTIFACT_NOUN =
    /成果物|成果|报告|報告|文档|文檔|文件|预览|預覽|レポート|ファイル|\bpdf\b|excel|xlsx?|csv|表格|word|docx?|ppt|图片|圖片|图像|圖像|截图|截圖|\bimage\b|\bphoto\b/i;

  /**
   * 「N号任务の成果物/PDF を開く」を検出し、命中したら client へ
   * ui_action(target=task_artifact, name=JSON{seq,query}) を下達する。
   * 例:「打开120号任务的PDF」「把3号任务的报告打开」「任务5的12号表面文件给我看」。
   * 条件 = タスク番号 + 開く動詞(_UI_ON)+ 成果物名詞(_UI_ARTIFACT_NOUN)。
   * 「关闭/隐藏」なら preview を閉じる。query = 種別/ファイル名ヒント(残り)。
   */
  private _tryVoiceTaskArtifact(t: string): boolean {
    const info = RealtimeSessionHandler._matchTaskSeq(t);
    if (!info) return false;
    if (!RealtimeSessionHandler._UI_ARTIFACT_NOUN.test(t)) return false;
    // 閉じる意図が明示なら preview を hide(番号は問わない)。
    if (RealtimeSessionHandler._UI_OFF.test(t)) {
      this._dispatchUiAction("artifact", "hide");
      return true;
    }
    if (!RealtimeSessionHandler._UI_ON.test(t)) return false; // 開く動詞なし
    // query = タスク参照句 + 開く動詞 + 汎用名詞を除いた残り(pdf/報告/ファイル名ヒント)。
    const query = t
      .replace(info.raw, " ")
      .replace(/[，,。．.、：:；;]+/g, " ")
      .replace(
        /(打开|打開|开启|開啟|显示|顯示|查看|看看|看一下|看|瞧|展示|亮出|拿出|调出|調出|叫出|翻出|给我看|給我看|出来|出來|弹出|彈出|请|請|帮我|幫我|一下|那个|那個|这个|這個|中的|裡的|里的|的|中|里|裡|成果物|成果|文件|レポート|ファイル|表示|開いて|出して|見せて|show|open|view|please|把)/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    this._dispatchUiAction("task_artifact", "show", JSON.stringify({ seq: info.seq, query }));
    this.enqueueTts(`好的,我打开第${info.seq}号任务的成果物。`);
    this._noteDhContext(`已为用户打开第${info.seq}号任务的成果物预览${query ? `(${query})` : ""}。`);
    return true;
  }

  /**
   * 「特定タスク番号への継続指示」を転写から検出し、命中したら client へ
   * ui_action(target=task_continue, name=JSON{seq,text}) を下達する。
   * 例:「3号任务把日期改成2025」「第2个任务补充一句摘要」「タスク5に注记を追加」。
   * 番号(user_seq)+ 残りの指示文を抽出。純粋な開閉(打开/关闭のみ)は task_panel
   * 側に譲るため false。指示文が実体(>=2字)である時のみ true。
   */
  private _tryVoiceTaskContinue(t: string): boolean {
    const info = RealtimeSessionHandler._matchTaskSeq(t);
    if (!info) return false;
    const seq = info.seq;
    // 指示文 = 転写からタスク参照句を除去し、先頭の接続語を刈る。
    const instruction = t
      .replace(info.raw, " ")
      .replace(/[，,。．.、：:；;]+/g, " ")
      .replace(/^\s*(?:继续|繼續|接着|接著|然后|然後|再|请|請|帮我|幫我|给它|給它|让它|讓它|叫它|告诉它|告訴它|に|へ|の|for|to)\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (instruction.length < 2) return false;
    // 「打开/关闭…」だけ(実体指示なし)は task_panel の管轄。
    if (/^(打开|打開|显示|顯示|关闭|關閉|隐藏|隱藏|open|show|close|hide)$/i.test(instruction)) {
      return false;
    }
    this._dispatchUiAction("task_continue", "send", JSON.stringify({ seq, text: instruction }));
    this.enqueueTts(`好的,我把这条指令补到第${seq}号任务。`);
    this._noteDhContext(`已给第${seq}号任务追加继续指令:「${instruction}」。`);
    return true;
  }

  // -------------------------------------------------------------------------
  // ★全「実行系要求」の winclaw 兜底(ask_winclaw)—— realtime FC 不発の確定救済。
  //   ユーザ要件: (1) 全 tool-call は winclaw 兜底必須、(2) 数字人は真の成否を知る事。
  // -------------------------------------------------------------------------
  /** 実行を要する要求か(明確な実行動詞を含む)。単なる疑問/挨拶/能力質問は含まない。 */
  private static readonly _ACTIONABLE_INTENT =
    /(帮我|帮忙|替我|分析|研究|调研|调查|查(一下|下|询|阅|查)|搜(一下|索|查)|检索|做(个|一个|一份|一下)|生成|写(个|一个|一封|一份|一篇|篇)|制作|整理|统计|汇总|归纳|总结|摘要|报告|方案|计划|发送|发个|发一(封|条)|发邮件|发消息|发短信|通知|安排|预约|提醒|排期|日程|执行|处理|办理|搞定|部署|创建|更新|删除|修改|拉取|下载|翻译|计算|预测|评估|投资建议|analyze|research|investigate|search for|look up|find out|make me|write me|generate|summari[sz]e|report|send (a|an|me)|schedule|remind|deploy|translate|calculate|分析して|調べて|調査して|作って|書いて|送って|まとめて|報告して|やって|手伝って)/i;
  /** 兜底に流さない纯粹な挨拶/感谢/告别(全文一致のみ。task を含む文はブロックしない)。 */
  private static readonly _ACTIONABLE_SKIP =
    /^(你好|您好|早上好|中午好|下午好|晚上好|嗨|哈喽|哈啰|在吗|在不在|你是谁|你叫什么|你好吗|谢谢|谢谢你|多谢|再见|拜拜|晚安|hi|hello|hey|thanks|thank you|bye|good night)[!。！.~\s]*$/i;

  // ★タスク化すべきでない発話の判定(2026-07-10・ユーザ要件: 動作確認/状態質問の
  //   碎语音でタスクを作らない。#133/#134 の様な実務要求のみ作る)。
  /** タスク状態/進捗を問うだけの発話(建てるべきタスクでなく会話で答えるべき)。 */
  private static readonly _TASK_STATUS_QUERY =
    /(在执行|在執行|在处理|在處理|执行吗|執行嗎|执行了(没|吗|嘛)|執行了(沒|嗎)|执行情况|執行情況|执行的?怎么样|完成了(吗|没|嘛|沒)|完成了嗎|好了(吗|没|嘛|沒)|好了嗎|怎么样了|怎麼樣了|咋样了|咋樣了|做完了(吗|没|嘛)|做好了(吗|没|嘛)|搞定了(吗|没)|弄好了(吗|没)|进度(如何|怎样|怎么样)?|進度|状态如何|狀態如何|正在处理|正在處理|正在执行|正在執行|正在生成|正在加载|正在載入|处理中|處理中)/;
  /** 光杆 UI/動作動詞(宾语なし)。単体はタスクでなく UI 操作の取りこぼし/状態語。 */
  private static readonly _TASK_BARE_VERB =
    /^(?:请|請|帮我|幫我|麻烦|麻煩|给我|給我|帮忙|幫忙|替我|你|来|來)*\s*(?:打开|打開|开启|開啟|关闭|關閉|显示|顯示|隐藏|隱藏|开|開|关|關|看一下|看看|看|停|暂停|暫停|继续|繼續|开始|開始|结束|結束|退出|返回|确定|確定|取消|处理|處理|执行|執行|操作|运行|運行)\s*(?:一下|吧|呢|啊|哦|嘛|嘛|中|一下下)?\s*(?:正在)?(?:处理|處理|执行|執行|加载|載入)?\s*(?:中)?[。.!！?？~、\s]*$/;

  /**
   * タスク化すべきでない発話か(true=作らない)。ユーザ要件(2026-07-10):
   *   ①状態/進捗を問うだけ(「这个任务在执行吗」)②光杆動詞(「帮我打开」)
   *   ③状態語(「显示正在处理中」)④トリガ語を除くと主題が残らない(実体なし)
   * これらは会話で応じるべきで、受管タスクを濫造しない。#133/#134 の様に明確な
   * 主題(特斯拉财务/发展计划)があるものは false(=タスク化する)。
   */
  static _isJunkTaskRequest(text: string): boolean {
    const t = (text || "").trim();
    if (!t) return true;
    if (RealtimeSessionHandler._TASK_STATUS_QUERY.test(t)) return true;
    if (RealtimeSessionHandler._TASK_BARE_VERB.test(t)) return true;
    // トリガ動詞/礼儀語/填詞を除いて主題が 2 字未満なら実体なし=作らない。
    const core = t
      .replace(
        /(请|請|帮我|幫我|麻烦|麻煩|给我|給我|帮忙|幫忙|替我|马上|馬上|现在|現在|一下|那个|那個|这个|這個|就是|嗯|呃|然后|然後|正在|中)/g,
        "",
      )
      .replace(
        /(打开|打開|开启|開啟|显示|顯示|查询|查詢|查阅|查閱|查一下|查|搜索|搜寻|搜尋|搜|检索|檢索|做|生成|写|寫|制作|製作|整理|处理|處理|执行|執行|操作|运行|運行|安排|通知)/g,
        "",
      )
      .replace(/[，,。．.、：:；;!！?？~\s]/g, "");
    if (core.length < 2) return true;
    return false;
  }

  /**
   * 実行を要する要求を検出したら winclaw agent(ask_winclaw)へ確定的に委ねる兜底。
   * 実時モデルが function-call を出さない為の救済(実測 0/72)。命中で true。
   */
  private _tryVoiceAskWinclaw(transcript: string): boolean {
    const t = transcript.trim();
    if (t.length < 3 || t.length > 200) return false;
    if (RealtimeSessionHandler._ACTIONABLE_SKIP.test(t)) return false;
    if (!RealtimeSessionHandler._ACTIONABLE_INTENT.test(t)) return false;
    // ★動作確認/状態質問/光杆動詞はタスク化しない(会話で応じる)。ユーザ要件 2026-07-10。
    if (RealtimeSessionHandler._isJunkTaskRequest(t)) {
      console.info(`[DH:${this.sessionId}] ⏭ 非タスク発話(状態質問/動作確認)→ タスク化せず: "${t.slice(0, 40)}"`);
      return false;
    }
    // ★連続語音を1タスクへ合并(2026-07-10)。断続的に話す片段(「调查A股内存」「结果做成
    //   PDF」…)を都度タスク化すると #146〜#150 の様に**同一要求が複数编号**になる。よって
    //   即派発せず、バッファへ追記して ~5s の無音待ち後に **1 回だけ** dispatch する。
    //   ・バッファ開始時のみ ack を1回喋る(「好的,我来处理」)。
    //   ・待機中に片段が来る度にタイマ再セット(=最後の片段から 5s 静かになったら确定)。
    //   ・待機中にモデルが FC したら兜底は撤回(二重回避)。
    if (this._taskCoalesceBuffer && !this._taskCoalesceBuffer.includes(t)) {
      this._taskCoalesceBuffer += "。" + t; // 続きの片段を追記
    } else if (!this._taskCoalesceBuffer) {
      this._taskCoalesceBuffer = t; // 新規バッファ開始
      this._taskCoalesceFcBase = this._lastFunctionCallAt;
      this.enqueueTts("好的,我来帮你处理,请稍等。"); // ack は開始時に1回だけ
      this._armKeepAlive();
    }
    if (this._taskCoalesceTimer) clearTimeout(this._taskCoalesceTimer);
    this._taskCoalesceTimer = setTimeout(() => {
      const full = this._taskCoalesceBuffer.trim();
      const fcBase = this._taskCoalesceFcBase;
      this._taskCoalesceBuffer = "";
      this._taskCoalesceTimer = null;
      if (!full) return;
      // 待機中にモデルが FC(自ら task_run)した=処理済→兜底しない(二重回避)。
      if (this._lastFunctionCallAt !== fcBase) return;
      // ★即派発せず、まず**復唱確認**する(ユーザ要件)。肯定応答で初めて作成+実行。
      this._askTaskConfirm(full);
    }, RealtimeSessionHandler._TASK_COALESCE_MS);
    return true; // 消費(通常フロー送出は止める。Qwen 自身の応答は別途走る)
  }

  /**
   * 合并したタスク要求を **dispatch 前に復唱確認** する(ユーザ要件 2026-07-10)。
   * 「你是要我X吗?说『对』我就去做」と喋り、`_pendingTaskConfirm` に控える。以後の肯定で
   * `_executeCoalescedTask` が走る。TTL 内に応答が無ければ破棄(タスクを作らない)。
   */
  private _askTaskConfirm(full: string): void {
    this._pendingTaskConfirm = full;
    if (this._pendingTaskConfirmTimer) clearTimeout(this._pendingTaskConfirmTimer);
    this._pendingTaskConfirmTimer = setTimeout(() => {
      if (this._pendingTaskConfirm) {
        console.info(`[DH:${this.sessionId}] ⏭ タスク確認 無応答で失効: "${this._pendingTaskConfirm.slice(0, 40)}"`);
      }
      this._pendingTaskConfirm = null;
      this._pendingTaskConfirmTimer = null;
    }, RealtimeSessionHandler._TASK_CONFIRM_TTL_MS);
    // 復唱(長すぎる時は要約風に頭を読む)。Qwen の当ターン応答は抑制し、この確認だけ喋る。
    const recap = full.length > 60 ? full.slice(0, 60) + "…" : full;
    this.enqueueTts(`好的,我理解的任务是:${recap}。确认的话说一声「对」,我就开始;要改就直接说。`);
    this._noteDhContext(
      `你正在向用户**确认**一个任务:「${recap}」。等用户说「对/是/开始」再执行;说「不对/取消」就放弃;` +
        `说别的(补充/修改)就把它并进这个任务重新确认。**在用户确认前不要说任务已开始/已完成**。`,
    );
    this.qwenClient?.suppressNextResponse();
  }

  /** 確認 OK 後に実際にタスクを作成+実行する(合并タイマの元 dispatch を分離)。 */
  private _executeCoalescedTask(full: string): void {
    const now = Date.now();
    const key = `ask_winclaw:${full.replace(/\s+/g, "").slice(0, 120)}`;
    const last = this._recentTaskKeys.get(key);
    if (last !== undefined && now - last < RealtimeSessionHandler._TASK_DEDUP_MS) return;
    this._recentTaskKeys.set(key, now);
    const callId = `voiceask-${++this._uiIntentSeq}`;
    console.info(`[DH:${this.sessionId}] 🧠 Voice→winclaw(确认后·合并): task_run "${full.slice(0, 80)}"`);
    this.sendToClient({
      type: "tool_call",
      data: { name: "task_run", args: JSON.stringify({ taskName: full }), callId },
    });
    this.enqueueTts("好的,这就去做,请稍等。");
    this._armKeepAlive();
    void this._dispatchAskWinclaw(full, callId);
  }

  /**
   * 確認待ち中(`_pendingTaskConfirm`)の応答処理。肯定→実行、否定→破棄、それ以外→
   * 追加/修正としてタスクへ并入し再確認。命中で true(以降の処理を止める)。
   */
  private _handleTaskConfirmReply(t: string): boolean {
    if (!this._pendingTaskConfirm) return false;
    const R = RealtimeSessionHandler;
    const clear = () => {
      if (this._pendingTaskConfirmTimer) clearTimeout(this._pendingTaskConfirmTimer);
      this._pendingTaskConfirmTimer = null;
    };
    // 肯定 → 実行。
    if (R._TASK_CONFIRM_YES.test(t)) {
      const full = this._pendingTaskConfirm;
      this._pendingTaskConfirm = null;
      clear();
      this._executeCoalescedTask(full);
      this.qwenClient?.suppressNextResponse();
      return true;
    }
    // 否定/取消 → 破棄。
    if (R._TASK_CONFIRM_NO.test(t)) {
      this._pendingTaskConfirm = null;
      clear();
      this.enqueueTts("好的,那这个先不做了。");
      this._noteDhContext("用户取消了刚才要确认的任务,已放弃,不要执行。");
      this.qwenClient?.suppressNextResponse();
      return true;
    }
    // それ以外で **明確に実行系(actionable)** の発話 = 補足/修正 → 并入し再確認。
    //   ★music/UI 等の別意図はここで捕まえず false を返し、通常処理へ委ねる(誤并入回避)。
    if (
      t.length >= 2 &&
      R._ACTIONABLE_INTENT.test(t) &&
      !RealtimeSessionHandler._isJunkTaskRequest(t)
    ) {
      const merged = this._pendingTaskConfirm + "。" + t;
      this._pendingTaskConfirm = null; // _askTaskConfirm で再セット
      clear();
      this._askTaskConfirm(merged);
      return true;
    }
    // 肯定/否定/補足のいずれでもない(相槌・別意図)→ 確認待ちは維持し、通常処理へ委ねる。
    return false;
  }

  /**
   * ask_winclaw を tool-router 経由で実行し、**真の成否**を数字人へ返す(捏造しない)。
   * winclaw 返り値(status/summary/user_message/error)を解析し、成功=要約、失敗=理由を
   * 播報+コンテキスト注入。「成功と嘘をつく(胡说八道)」を防ぐ。
   */
  private async _dispatchAskWinclaw(request: string, callId: string): Promise<void> {
    const short = request.slice(0, 30);
    if (!this.toolRouter) {
      this.enqueueTts("抱歉,现在没法执行这个任务。");
      this._noteDhContext(`任务「${short}」**执行失败**:winclaw 未就绪。如实告诉用户失败。`);
      return;
    }
    try {
      // ★task_run で発火する事が肝心: handleTaskRun は writeSecretaryInbox(source:"voice")で
      //   **受管任务を作成** → ai-meta poller が claim → winclaw metacoder が実行 → 成果物。
      //   ask_winclaw は転送のみで**任务を作らない**(=「任务没有创建」の原因だった)。
      //   taskName に自然語要求をそのまま入れ、metacoder に解釈・実行させる。
      // ★A案(成果物リンク): metacoder は自由に作業目录を選ぶ為、成果物が
      //   sessions/<自由名>/ 等へ散り任务の output_rel に紐付かない(面板で見えない)。
      //   保存先を工作区 `outputs/` 直下へ寄せるよう明示指示する(後端 B 兜底が
      //   outputs/ と sessions/ を時間窓で拾う二段構え)。
      const taskNameWithOut =
        request +
        "\n\n★成果物の保存先(重要): レポート/PDF/文档/表格などの最終成果物は、必ず" +
        "工作区の `outputs/` 目录**直下**に保存してください(勝手なサブ目录を作らない)。" +
        "ファイル名は内容が分かる名前にしてください。";
      const result = await this.toolRouter.handle({
        name: "task_run",
        argumentsJson: JSON.stringify({ taskName: taskNameWithOut, args: {} }),
        callId,
      } as import("./integrations/qwen-realtime.js").QwenFunctionCall);
      let status: "ok" | "failed" = "ok";
      let summary = "";
      let errorMsg = "";
      try {
        const p = JSON.parse(result) as {
          status?: string;
          summary?: string;
          user_message?: string;
          error?: string;
        };
        status = p.status === "failed" ? "failed" : "ok";
        summary = (p.summary || p.user_message || "").trim();
        errorMsg = (p.error || "").trim();
      } catch {
        summary = (result || "").slice(0, 200);
      }
      this.sendToClient({
        type: "tool_result",
        data: { name: "task_run", callId, status, summary, error: errorMsg },
      });
      if (status === "failed") {
        this.enqueueTts(`抱歉,这个任务没能完成${errorMsg ? `,${errorMsg.slice(0, 40)}` : ""}。`);
        this._noteDhContext(`任务「${short}」**执行失败**${errorMsg ? `(${errorMsg.slice(0, 60)})` : ""}。**如实告诉用户失败,绝不能说成功**。`);
      } else {
        // ★重要修正(2026-07-10・胡说八道の根治): task_run の return は
        //   「已提交/(場合により)后台結果」であり、**成果物ファイル(PDF/报告)が
        //   出来た保証にはならない**。metacoder は多くの場合「調べますね」等と答えるだけで
        //   ファイルを書かない事がある。従来は無条件に「执行成功」と注入していた為、DH が
        //   「已生成PDF」と嘘をついた。よって成功と断定せず、**返ってきた実結果をそのまま
        //   渡し、結果に明示が無い限り「ファイル/PDF 生成」を口にするなと強く釘を刺す**。
        //   TTS は追加で喋らない(_tryVoiceAskWinclaw で ack 済=二重発声回避)。
        const resultText = (summary || "").slice(0, 200);
        this._noteDhContext(
          `任务「${short}」的后台返回:「${resultText || "(已提交,处理中)"}」。` +
            `★如实转述这个返回内容即可。**除非上面的返回里明确写了"已生成/已保存 某文件/PDF/报告",否则绝对不要说你生成了PDF、报告或任何文件**。` +
            `也不要编造数据或结论;还没结果就说「还在处理中,稍等」。`,
        );
      }
      // ★winclaw 記憶へ記録(ユーザ要件「执行过的任务都要进记忆」)。提交した任务と
      //   後台返回を memory/YYYY-MM-DD.md へ落とし、次回以降 memory_search で召回可能に。
      try {
        this.memoryBridge?.recordTaskResult(
          `语音任务: ${short}`,
          (summary || "").slice(0, 200) || "已提交后台处理",
          status !== "failed",
        );
      } catch {
        /* best-effort */
      }
    } catch (err) {
      console.error(`[DH:${this.sessionId}] voice ask_winclaw failed:`, err);
      this.enqueueTts("抱歉,这个任务执行时出错了,待会儿再试试。");
      this._noteDhContext(`任务「${short}」**执行出错**(${err instanceof Error ? err.message.slice(0, 60) : "unknown"})。如实告知用户,别谎报成功。`);
    }
  }

  /** 既存の tool_call 転送路で client へ ui_action を下達(Qwen 経由と同形)。 */
  private _dispatchUiAction(target: string, action: string, name?: string): void {
    const args = JSON.stringify(name ? { target, action, name } : { target, action });
    const callId = `uiintent-${++this._uiIntentSeq}`;
    console.info(
      `[DH:${this.sessionId}] 🎛️ Voice→UI(兜底): ui_action ${target}/${action}${name ? ` name="${name}"` : ""}`,
    );
    this.sendToClient({ type: "tool_call", data: { name: "ui_action", args, callId } });
    // 基础界面操作(面板/麦/摄/形象/字幕/全屏/音色/成果物)を Qwen 上下文へ集中回灌し
    // 数字人が「自分が界面を操作した」事を自知できるようにする(問題②)。
    // music / task_artifact / task_continue は各兜底で**具体的に**回灌済のためスキップ(二重回灌回避)。
    if (!["music", "task_artifact", "task_continue"].includes(target)) {
      this._noteDhContext(`已为用户执行界面操作:${target} ${action}${name ? `(${name})` : ""}。`);
    }
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

    // 0) ★「再放一遍/刚才那首」= キャッシュした直近トラックを **URL 再解決なし** に即再生。
    //    灵敏化 + 音乐記憶の実用化(検索抽風を避け、mp3 path を憶えている強み)。
    if (R._MUSIC_REPLAY.test(t) && this._lastMusicTrack) {
      this.sendToClient({ type: "user_transcript", data: { content: transcript } });
      this._pendingMusic = null;
      this._playTrack(this._lastMusicTrack);
      this.enqueueTts(`好的,再放一遍《${this._lastMusicTrack.title}》。`);
      return true;
    }

    // ★1) 点歌の片段合并: 「放…」「青花瓷」「好不好」の様な断続語音を 1 曲へまとめて検索する。
    //   強トリガ/曲名 parse 成立/収集窗中 の発話をバッファへ追記し ~1.4s 無音で parse+play。
    //   バレ曲名(トリガ無しの「青花瓷」)も収集窗中なら吸収する = 命中率が上がる。
    //   ★制御語(停/换/暂停/继续)は再生中なら収集せず素通し(下の control で即処理)。
    const isCtl =
      R._MUSIC_STOP.test(t) || R._MUSIC_NEXT.test(t) || R._MUSIC_PAUSE.test(t) || R._MUSIC_RESUME.test(t);
    const hasSongSignal =
      !!this._parseMusicIntent(t) ||
      R._MUSIC_TRIGGER.test(t) ||
      (R._MUSIC_WEAK_VERB.test(t) && R._MUSIC_CTX.test(t));
    if ((this._musicListening || hasSongSignal) && !(this._musicActive && isCtl)) {
      this._musicListening = true;
      this._pendingMusic = null;
      this._musicCoalesceBuffer = this._musicCoalesceBuffer
        ? this._musicCoalesceBuffer + t
        : t;
      this.sendToClient({ type: "user_transcript", data: { content: transcript } });
      if (this._musicCoalesceTimer) clearTimeout(this._musicCoalesceTimer);
      this._musicCoalesceTimer = setTimeout(() => {
        const full = this._musicCoalesceBuffer;
        this._musicCoalesceBuffer = "";
        this._musicListening = false;
        this._musicCoalesceTimer = null;
        const p = this._parseMusicIntent(full);
        if (p) {
          console.info(`[DH:${this.sessionId}] 🎵 点歌合并 → 搜索「${p.artist ? p.artist + "的" : ""}${p.song}」(原文:${full.slice(0, 40)})`);
          void this._doMusicPlay(p.artist, p.song);
          this._noteDhContext(
            `正在为用户搜索并播放${p.artist ? p.artist + "的" : ""}《${p.song}》音乐(音乐播放能力已触发)。`,
          );
        } else {
          console.info(`[DH:${this.sessionId}] 🎵 点歌合并 → 曲名抽出できず(原文:${full.slice(0, 40)})`);
        }
      }, RealtimeSessionHandler._MUSIC_COALESCE_MS);
      return true;
    }

    // 2) 音乐制御は「再生中 or 提案中」のみ判定する(未再生時の誤爆防止・停止語を広く採るため)。
    const musicOn = this._musicActive || !!this._pendingMusic;
    if (musicOn) {
      // 2a) 暂停(停 を含むため停止より先)。
      if (R._MUSIC_PAUSE.test(t)) {
        this._dispatchUiAction("music", "pause");
        this.enqueueTts("好的,先暂停。");
        this._noteDhContext("已暂停音乐播放。");
        return true;
      }
      // 2b) 恢复/继续。
      if (R._MUSIC_RESUME.test(t) && this._musicActive) {
        this._dispatchUiAction("music", "resume");
        this.enqueueTts("好的,继续播放。");
        this._noteDhContext("已继续播放音乐。");
        return true;
      }
      // 2c) 换一首/下一首 → 同歌手の別曲へ差替。
      if (R._MUSIC_NEXT.test(t)) {
        this.sendToClient({ type: "user_transcript", data: { content: transcript } });
        void this._doMusicNext();
        return true;
      }
      // 2d) 停止。
      if (R._MUSIC_STOP.test(t)) {
        this._musicActive = false;
        this._pendingMusic = null;
        this._dispatchUiAction("music", "stop");
        this.enqueueTts("好的,已经停下了。");
        this._noteDhContext("已停止音乐播放。");
        return true;
      }
    }

    // 3) 兜底提案中の肯定/否定応答。
    if (this._pendingMusic) {
      if (R._MUSIC_DECLINE.test(t)) {
        this._pendingMusic = null;
        this.enqueueTts("好的,那不放了。");
        return true;
      }
      if (R._MUSIC_AFFIRM.test(t)) {
        const p = this._pendingMusic;
        this._pendingMusic = null;
        this._lastMusicArtist = p.artist || this._lastMusicArtist;
        this._playTrack(p.track);
        this.enqueueTts(`好的,为你循环播放《${p.track.title}》。`);
        this._noteDhContext(`已开始循环播放《${p.track.title}》。`);
        return true;
      }
      // 肯定でも否定でもない発話 → 提案は失効。以降の通常処理に委ねる。
      this._pendingMusic = null;
      return false;
    }
    return false;
  }

  /** 「换一首/下一首」: 直近歌手の別曲を推して差替再生(歌手不明なら問い返す)。 */
  private async _doMusicNext(): Promise<void> {
    const artist = this._lastMusicArtist;
    if (!artist) {
      this.enqueueTts("好的,你想听谁的歌?");
      return;
    }
    try {
      this.enqueueTts("好的,给你换一首。");
      const rec = await recommendMusic(artist, this._lastMusicTitle);
      if (rec) {
        this._playTrack(rec);
        this.enqueueTts(`为你播放${artist}的《${rec.title}》。`);
      } else {
        this.enqueueTts(`暂时没找到${artist}的其他歌了,你可以换个歌手试试。`);
      }
    } catch (err) {
      console.error(`[DH:${this.sessionId}] music next failed:`, err);
      this.enqueueTts("抱歉,换歌出错了,待会儿再试试。");
    }
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
    // ★2026-07-10: 曲名末尾の口語/疑問(「青花瓷好不好」→「青花瓷」)を剥がす。ASR で語尾に
    //   混じる「好不好/行吗/可以吗/谢谢…」が検索を汚し命中率を下げる。**剥いても 2 字以上残る
    //   時だけ**適用(「好不好」単体=康小白の曲は保持)。
    const _stripTail = song
      .replace(
        /(好不好|好不好呀|好吗|好嗎|好嘛|行不行|行吗|行嗎|可以吗|可以嗎|可不可以|怎么样|怎麼樣|如何|谢谢你?|謝謝你?|多谢|拜托你?|拜託|麻烦你?|呗|唄|嘛|哈|呀|哦|噢|喔|嘞|啦)+[?？!！。.,，\s]*$/g,
        "",
      )
      .trim();
    if (_stripTail.length >= 2) song = _stripTail;
    if (!song || song.length < 1 || song.length > 20) return null;
    // ★D: 誤爆防止。曲名になり得ない generic/代名詞(「我想听你唱歌」→ song="你" 等)を弾く。
    if (
      /^(歌|歌曲|音乐|音樂|一首|首歌|你|我|他|她|它|您|你们|你們|我们|我們|咱|大家|这|那|這|什么|什麼|啥|点|點|一下|一点|一點|别的|別的|什么歌|什麼歌|首|个|個)$/.test(
        song,
      )
    )
      return null;
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
        // 「换一首」用に歌手を記憶(未指定なら曲の主歌手を採る)。
        this._lastMusicArtist = artist || (track.artist.split("/")[0] || "").trim();
        this._playTrack(track);
        this.enqueueTts(`好的,为你循环播放《${track.title}》。`);
        return;
      }
      // ★B: 未命中は **まず即座に**「没找到」を出す(recommend を待たせない=無音防止)。
      this.enqueueTts(`没有找到《${song}》。`);
      // 歌手が判れば同歌手の別曲を提案(勝手に再生しない・§8-3)。無ければ換歌を促す。
      if (artist) {
        const rec = await recommendMusic(artist, song);
        if (rec) {
          this._pendingMusic = { track: rec, artist };
          this.enqueueTts(`要不要放${artist}的《${rec.title}》?`);
          return;
        }
      }
      this.enqueueTts("你可以换一首,或者说得更具体点试试。");
    } catch (err) {
      console.error(`[DH:${this.sessionId}] music search failed:`, err);
      this.enqueueTts("抱歉,音乐搜索出错了,待会儿再试试。");
    }
  }

  /** client へ music_play を下達(封面/歌名/歌手/循环 を name=JSON で渡す)。 */
  /** ai-meta 後端の公開 music-proxy(host 白名单)を指す base。ブラウザ <audio> が同源 https で
   *  再生できるよう、音楽 CDN 直リンクをここ経由へ書換える。この deploy の後端は固定。 */
  private static readonly _AIMETA_BASE = (
    process.env.AIMETA_API_BASE ||
    process.env.WINCLAW_GRC_URL ||
    "https://api.myaiportal.net"
  ).replace(/\/+$/, "");

  /** 音楽 CDN 直リンクを後端 proxy 経由(同源)へ書換える。http(s) 以外/空/二重は素通し。 */
  private static _proxyMusicUrl(url: string): string {
    if (!url || !/^https?:\/\//i.test(url)) return url;
    if (url.includes("/api/v1/music-proxy")) return url; // 二重 proxy 防止
    return `${RealtimeSessionHandler._AIMETA_BASE}/api/v1/music-proxy?url=${encodeURIComponent(url)}`;
  }

  private _playTrack(track: MusicTrack): void {
    const payload = JSON.stringify({
      // ★2026-07-10: netease 等の直リンクはブラウザ直再生が hotlink/跨域で失敗する為、
      //   ai-meta 後端の公開 proxy(host 白名单)経由 = **同源 https** へ書換えて渡す。
      //   後端が Referer を付けて CDN から取得しストリームするので CSP media-src 'self' で再生可。
      playUrl: RealtimeSessionHandler._proxyMusicUrl(track.playUrl),
      title: track.title,
      artist: track.artist,
      cover: track.cover ?? "",
      source: track.source,
      loop: true,
    });
    console.info(
      `[DH:${this.sessionId}] 🎵 music_play [${track.source}] ${track.artist} - ${track.title}`,
    );
    // 再生中フラグ + 直近曲名(换一首の除外用)を更新。
    this._musicActive = true;
    this._lastMusicTitle = track.title;
    // ★音乐記憶: 直近トラック(mp3 path 込み)+ 履歴を更新。DH に「今この曲を再生した」を
    //   回灌し、「刚才放的什么歌」に答え・「再放一遍」で即再生できる様にする。
    this._lastMusicTrack = track;
    if (track.playUrl) {
      this._musicHistory.push({
        title: track.title,
        artist: track.artist,
        playUrl: track.playUrl,
        source: track.source,
        at: Date.now(),
      });
      if (this._musicHistory.length > 30) this._musicHistory.shift();
    }
    const recent = this._musicHistory
      .slice(-5)
      .map((m) => `《${m.title}》`)
      .join("、");
    this._noteDhContext(
      `你刚为用户播放了《${track.title}》(${track.artist})。**记住这首是当前正在放的歌**。` +
        `用户问"刚才放的什么歌/这是什么歌"就答《${track.title}》;说"再放一遍/刚才那首"就是要重播它。` +
        (recent ? `本次会话已放过:${recent}。` : ""),
    );
    // ★winclaw 記憶へも記録(gemini-embedding 索引 → 次回以降 memory_search で召回可能)。
    try {
      this.memoryBridge?.recordTaskResult(
        "播放音乐",
        `《${track.title}》 - ${track.artist}(来源 ${track.source})`,
        true,
      );
    } catch {
      /* best-effort */
    }
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
      // ★Option B: 残りテキストを TTS へ enqueue。audioEnd は TTS キュー drain 後
      //   (processNextTts 完了時)に呼ぶ(まだ合成中に閉じない)。
      if (TTS_PIPELINE_MODE) {
        this.flushDeltaSentences(true);
        // キューも進行中 TTS も無ければ即終了通知(空応答対策)。
        if (this.ttsQueue.length === 0 && !this.ttsInProgress) {
          this.sendToClient({ type: "ai_response_done" });
          if (this.museTalkAudioSink) this.museTalkAudioSink.audioEnd();
        }
        return;
      }
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

  /**
   * 转写兜底(_tryVoiceMusic / _tryVoiceUiIntent / _tryVoiceTaskArtifact /
   * _tryVoiceTaskContinue)で実行した**動作+結果**を Qwen 会話コンテキストへ
   * **静かに**注入する(injectContext=`conversation.item.create` のみ・
   * `response.create` なし=追加発声しない)。
   *
   * enqueueTts の確認語は別系統の HTTP TTS で喋る為 Qwen は関知しない。この注入で
   * 数字人が「自分が今何をして、どうなったか(状態)」を次ターンで把握でき、
   * 「さっきの曲かかった?」等の追問にも正しく答えられる(能力調用状態の自知・問題②)。
   */
  private _noteDhContext(note: string): void {
    try {
      this.qwenClient?.injectContext(`[系统事件·你刚为用户执行了操作] ${note}`);
    } catch {
      /* best-effort: 認識用のみ。失敗しても本筋に影響させない */
    }
  }

  private ttsRetryTimer: ReturnType<typeof setInterval> | null = null;

  /** Detect language from text content using Unicode character ranges.
   * Requires substantial kana presence (>10%) to classify as Japanese,
   * preventing false positives from CJK text with occasional particles. */
  private static detectLanguage(text: string): "zh" | "ja" | "en" | "ko" {
    const kanaCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    // \u4EEE\u540D\u306F\u4E2D\u56FD\u8A9E\u306B\u306F\u307B\u307C\u51FA\u306A\u3044 \u2192 \u4EEE\u540D\u304C\u6709\u308C\u3070\u65E5\u672C\u8A9E\u5BC4\u308A\u306B\u5224\u5B9A(\u95BE\u5024\u3092\u4E0B\u3052\u3001\u6F22\u5B57\u591A\u3081
    // \u306E\u65E5\u672C\u8A9E\u6587\u3082 ja \u306B\u3057\u3066 TTS \u306E\u8A00\u8A9E\u5225 prompt \u3092\u52B9\u304B\u305B\u308B=\u4E2D\u56FD\u8A9E\u8AAD\u307F\u4E8B\u6545\u3092\u9632\u3050)\u3002
    if (kanaCount >= 2 || (kanaCount > 0 && kanaCount / text.length > 0.05)) return "ja";
    const hangulCount = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;
    if (hangulCount > 0 && hangulCount / text.length > 0.1) return "ko";
    if (/^[\x00-\x7F\s.,!?'"()\-:;@#$%^&*+={}[\]<>\/\\~`]+$/.test(text.trim())) return "en";
    return "zh";
  }

  /** Language-to-voice mapping for legacy TTS（qwen3-omni-flash-realtime 受理音色のみ・docs/22）。 */
  private static readonly VOICE_MAP: Record<string, string> = {
    zh: "Serena",      // Chinese: gentle female
    ja: "Ono Anna",    // ★Japanese: 専用日语音色（docs/22 决策③）。发音が自然
    en: "Chelsie",     // English: bright female（旧模型受理。旧 "Aria" は不受理のため差替）
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
    // ★Option B: 文単位で ai_response_started を撒くと client 側 player.resume() が
    //   毎文でリセットされ音が途切れる/出ない。開始通知は handleResponseStarted で
    //   応答毎に1回だけ出す(realtime 経路と同じ)。ここでは Option B のとき撒かない。
    if (!(TTS_PIPELINE_MODE && this.isMuseTalkMode)) {
      this.sendToClient({ type: "ai_response_started" });
    }

    // Auto-detect language and select appropriate qwen3-omni-flash voice
    const lang = RealtimeSessionHandler.detectLanguage(cleanText);
    const voice = RealtimeSessionHandler.VOICE_MAP[lang] || "Cherry";
    // ★日本語は kuromoji で漢字→仮名読み(カタカナ)へ変換してから TTS へ。
    //   qwen3-omni-flash は共有漢字を中国語読みする(新橋→xinqiao)ため、読みを渡して確定。
    //   辞書未準備/漢字なしは原文素通し(TTS を止めない)。
    const ttsText = lang === "ja" ? jaKanjiToKana(cleanText) : cleanText;
    if (ttsText !== cleanText) {
      console.info(`[Handler:${this.sessionId}] TTS ja-reading: "${cleanText.slice(0, 24)}" → "${ttsText.slice(0, 24)}"`);
    }
    console.info(`[Handler:${this.sessionId}] TTS lang=${lang} voice=${voice}`);

    const ttsGen = this._ttsGen; // barge-in で ++ されたら古い合成として破棄。
    synthesizeSpeech(ttsText, {
      apiKey: this.config.qwen.apiKey,
      voice,
      language: lang, // ★言語別 system prompt(補助)。読み変換と併用。
    }, (pcm, sampleRate) => {
      // ★Option B: MuseTalk モードは TTS PCM を realtime 音声と同じ経路へ:
      //   (1) museTalkAudioSink へ verbatim 送出(VM の口パク用。VM は映像のみ返す)、
      //   (2) ブラウザへ ai_audio を送る(**ユーザが実際に聞くのはこちら**。VM に音声track無し)。
      //   pacer は使わない。割り込み後(世代不一致)は破棄。
      if (TTS_PIPELINE_MODE && this.isMuseTalkMode) {
        if (ttsGen === this._ttsGen) {
          if (this.museTalkAudioSink) this.museTalkAudioSink.sendAudioData(pcm);
          // ブラウザへ ai_audio。AUDIO_DELAY_MS>0 なら口型映像に合わせ遅延送出(送 VM は即時)。
          this.sendAiAudioToClient(pcm, sampleRate);
        }
        return;
      }
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
      // ★Option B(MuseTalk): pacer を使わず、キューが空になったら avatar へ発話終了通知。
      if (TTS_PIPELINE_MODE && this.isMuseTalkMode) {
        this.ttsInProgress = false;
        if (this.ttsQueue.length === 0) {
          this.sendToClient({ type: "ai_response_done" });
          if (this.museTalkAudioSink) this.museTalkAudioSink.audioEnd();
        }
        this.processNextTts();
        return;
      }
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
    this.clearPendingAudio(); // 音画同期補償の遅延送出タイマーを解放。
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
