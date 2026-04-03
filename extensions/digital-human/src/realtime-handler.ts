/**
 * @fileoverview RealtimeSessionHandler — orchestrates a single digital-human
 * voice session using the WinClaw Gateway agent pipeline.
 *
 * Architecture (Gateway-integrated):
 * ```
 * User audio → Qwen STT → transcript → Gateway chat.send → Agent Pipeline
 *   → Agent answer → chat event (delta/final)
 *   → Qwen TTS (speakText) → audio → ByteDance DH lip sync
 * ```
 *
 * Qwen is used ONLY for STT (speech-to-text) and TTS (text-to-speech).
 * All reasoning, tool use, and memory are handled by the WinClaw Agent
 * through the Gateway — exactly like WhatsApp/Telegram channels.
 */

import WebSocket from "ws";

import { QwenRealtimeClient } from "./integrations/qwen-realtime.js";
import { DigitalHumanManager } from "./integrations/byteplus-rtc.js";
import { AudioResampler } from "./integrations/audio-resampler.js";
import { IdentityLoader } from "./identity-loader.js";
import type { DigitalHumanConfig } from "./config.js";
import type { GatewayBridge, ChatEventPayload } from "./gateway-bridge.js";
import { synthesizeSpeech } from "./integrations/qwen-tts.js";

/**
 * Dependencies for constructing a RealtimeSessionHandler.
 */
export interface HandlerDeps {
  sessionId: string;
  ws: WebSocket;
  config: DigitalHumanConfig;
  workspaceDir: string;
  gwBridge: GatewayBridge;
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

  /** Gateway session key: agent:main:direct:dh-voice:{sessionId} */
  readonly sessionKey: string;

  private qwenClient!: QwenRealtimeClient;
  private dhManager!: DigitalHumanManager;
  private dhLiveId!: string;
  private identityLoader!: IdentityLoader;
  private readonly audioResampler: AudioResampler = new AudioResampler();

  // DH audio buffering
  private dhAudioBuffer: Buffer = Buffer.alloc(0);
  private static readonly DH_MIN_FRAME_SIZE = 1_280;

  // TTS queue
  private ttsQueue: string[] = [];
  private ttsInProgress = false;

  // STT aggregation — accumulate VAD fragments into complete sentences
  private sttBuffer = "";
  private sttFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly STT_FLUSH_DELAY_MS = 3_000;

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
    // DH voice session — same agent (main) = same workspace, tools, identity, memory.
    // Separate from webchat to avoid mixing conversation histories.
    this.sessionKey = "agent:main:dh-voice";
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
    console.info(`[Handler:${this.sessionId}] Identity loaded: ${identity.name}`);

    // 2. Connect Qwen Realtime (STT + TTS only)
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
      identity.instructions,
    );

    const connected = await this.qwenClient.connect();
    if (!connected) {
      throw new Error(`[Handler:${this.sessionId}] Failed to connect to Qwen`);
    }

    // Enable TTS-only mode
    this.qwenClient.ttsOnly = true;

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

    // 4. Register Gateway chat event handler for this session
    this.gwBridge.onChatEvent(this.sessionKey, (payload) => {
      this.handleChatEvent(payload);
    });

    this.initialized = true;
    console.info(`[Handler:${this.sessionId}] Initialized (sessionKey=${this.sessionKey})`);
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

  handleVideoMessage(videoBase64: string): void {
    if (!this.ensureReady("handleVideoMessage")) return;
    try {
      const frameData = Buffer.from(videoBase64, "base64");
      this.qwenClient.sendVideo(frameData);
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] handleVideoMessage error:`, err);
    }
  }

  /**
   * Handle typed text from chat panel — route through Gateway agent.
   */
  handleTextMessage(text: string): void {
    if (!this.ensureReady("handleTextMessage")) return;
    try {
      // Send typed text through the Gateway agent pipeline (not Qwen)
      this.gwBridge.chatSend(this.sessionKey, text).catch((err) => {
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
   * Delta events → browser subtitle. Final event → Qwen TTS → DH lip sync.
   */
  private async handleChatEvent(payload: ChatEventPayload): Promise<void> {
    const text = payload.message?.content?.[0]?.text;
    if (!text) return;

    if (payload.state === "delta") {
      // Clear thinking indicator on first delta
      this.sendToClient({ type: "ai_thinking", data: { thinking: false } });
      // Show streaming text in browser
      this.sendToClient({ type: "ai_text", data: { content: text, is_delta: true } });

      // Gateway delta text is CUMULATIVE (full text so far), extract only new chars
      const newChars = text.length > this.lastDeltaLength ? text.substring(this.lastDeltaLength) : "";
      this.lastDeltaLength = text.length;

      if (newChars) {
        this.deltaBuffer += newChars;
        this.flushDeltaSentences(false);
      }

    } else if (payload.state === "final") {
      // Reset delta tracking for next response
      this.lastDeltaLength = 0;

      // Send full text to browser
      this.sendToClient({ type: "ai_text", data: { content: text, is_delta: false } });

      // Flush any remaining delta buffer as final TTS
      if (this.deltaBuffer.trim()) {
        console.info(`[Handler:${this.sessionId}] 📥 Final flush: "${this.deltaBuffer.substring(0, 30)}..." (${this.deltaBuffer.length} chars)`);
        this.enqueueTts(this.deltaBuffer.trim());
        this.deltaBuffer = "";
      }
    } else if (payload.state === "error") {
      const errMsg = payload.errorMessage ?? "Agent error";
      this.sendToClient({ type: "error", data: { message: errMsg } });
    }
  }

  // -------------------------------------------------------------------------
  // Qwen callback handlers (STT/TTS only)
  // -------------------------------------------------------------------------

  /**
   * Qwen TTS audio output → resample → ByteDance DH lip sync + browser.
   */
  private handleQwenAudio(_pcm: Buffer, _sampleRate: number): void {
    // Discard all Qwen realtime audio (VAD auto-responses).
    // TTS audio comes via qwen-tts.ts HTTP API separately.
  }

  private _unusedOriginalHandleQwenAudio(_pcm: Buffer, _sampleRate: number): void {
    try {
      const pcm16k = this.audioResampler.resample(pcm, sampleRate, 16_000);
      this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm16k]);
      this.flushDhAudioBuffer(false);

      const audioBase64 = pcm.toString("base64");
      this.sendToClient({
        type: "ai_audio",
        data: { audio: audioBase64, format: "pcm16", sample_rate: sampleRate },
      });
    } catch (err) {
      console.error(`[Handler:${this.sessionId}] handleQwenAudio error:`, err);
    }
  }

  /**
   * Qwen TTS text echo — just log, don't process further.
   * The actual content was already sent via handleChatEvent.
   */
  private handleQwenText(_text: string, _isDelta: boolean): void {
    // Ignore all Qwen text — agent answers come via Gateway chat events,
    // and TTS echo text is not needed.
  }

  /**
   * Qwen STT completed → send transcript to Gateway agent pipeline.
   */
  /** Keywords that indicate a complex task (needs acknowledgment before processing). */
  private static readonly TASK_KEYWORDS = /帮我|催|查|检查|发送|通知|汇报|调查|整理|统计|分析|报告|创建|更新|删除|修改|安排|提醒|check|send|notify|report|create|update|schedule/;

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
    this.gwBridge.chatSend(this.sessionKey, message).catch((err) => {
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

    synthesizeSpeech(cleanText, {
      apiKey: this.config.qwen.apiKey,
      // CosyVoice uses its own voice names, not qwen3-omni-flash ones
      voice: "longxiaochun",
    }, (pcm, _sampleRate) => {
      // Send ONLY to DH for lip sync. Browser gets audio via ByteRTC stream.
      // Sending to both causes desync (DH lip moves first, browser audio lags behind).
      this.dhAudioBuffer = Buffer.concat([this.dhAudioBuffer, pcm]);
      this.flushDhAudioBuffer(false);
    }).then(() => {
      console.info(`[Handler:${this.sessionId}] TTS complete`);
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
    console.info(`[Handler:${this.sessionId}] Cleaning up…`);

    // Unregister Gateway event handler
    this.gwBridge.offChatEvent(this.sessionKey);

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

  private flushDhAudioBuffer(forceFlush: boolean): void {
    const dhSession = this.dhManager?.getSession(this.dhLiveId);
    if (!dhSession) {
      if (this.dhAudioBuffer.length > 0) {
        console.warn(`[Handler:${this.sessionId}] flushDhAudioBuffer: no DH session (liveId=${this.dhLiveId}, buffer=${this.dhAudioBuffer.length})`);
      }
      return;
    }

    const frameSize = RealtimeSessionHandler.DH_MIN_FRAME_SIZE;

    while (this.dhAudioBuffer.length >= frameSize) {
      const frame = this.dhAudioBuffer.subarray(0, frameSize);
      this.dhAudioBuffer = this.dhAudioBuffer.subarray(frameSize);
      try {
        dhSession.sendAudioData(frame);
      } catch (err) {
        console.error(`[Handler:${this.sessionId}] DH sendAudioData error:`, err);
        break;
      }
    }

    if (forceFlush && this.dhAudioBuffer.length > 0) {
      const padded = Buffer.alloc(frameSize, 0);
      this.dhAudioBuffer.copy(padded);
      this.dhAudioBuffer = Buffer.alloc(0);
      try {
        dhSession.sendAudioData(padded);
      } catch (err) {
        console.error(`[Handler:${this.sessionId}] DH final frame error:`, err);
      }
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
