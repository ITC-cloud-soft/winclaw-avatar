/**
 * DHWebSocket – WebSocket connection manager for the Digital Human platform.
 *
 * Responsibilities:
 *   • Connect to the DH backend WebSocket endpoint
 *   • Parse incoming JSON messages and dispatch to typed handler callbacks
 *   • Send typed outgoing messages (audio, text, video)
 *   • Keep the connection alive with a periodic ping
 *   • Reconnect automatically on unexpected close with exponential backoff
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** ICE server entry as sent by the dh-saas / MuseTalk backend. */
export interface DHIceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Stream info for the MuseTalk (dh-saas / OpenAvatarChat / FastRTC) provider.
 * The browser negotiates a WebRTC peer connection directly with the VM.
 */
export interface MuseTalkStreamInfo {
  provider: 'musetalk';
  sessionId: string;
  ownerToken: string;
  /** POST {sdp,type:"offer",webrtc_id} → {sdp} answer. */
  offerUrl: string;
  controlWs: string;
  iceServers: DHIceServer[];
  expiresAt: string;
}

/**
 * Stream info for the legacy BytePlus (ByteRTC) provider.
 * `provider` may be absent on older backends — treat undefined as byteplus.
 */
export interface BytePlusStreamInfo {
  provider?: 'byteplus';
  /** Backend sends camelCase; we normalize both conventions */
  liveId: string;
  roomId: string;
  viewerToken: string;
  viewerUid: string;
  rtcAppId: string;
  publisherUid: string;
  status?: string;
}

/**
 * Discriminated union over `provider`. Branch on `info.provider === "musetalk"`
 * to pick the WebRTC-direct viewer; otherwise use the ByteRTC viewer.
 */
export type DHStreamInfo = MuseTalkStreamInfo | BytePlusStreamInfo;

export type DHMessageHandler = {
  /** WebSocket opened and ready to send. */
  onConnected?: () => void;
  /** The DH backend sent ByteRTC room / token info. */
  onDhStreamInfo?: (info: DHStreamInfo) => void;
  /** The AI returned a text chunk (or full sentence). */
  onAiText?: (content: string, isDelta: boolean) => void;
  /** The AI returned an audio chunk. */
  onAiAudio?: (base64Audio: string, sampleRate: number) => void;
  /** The AI started generating a response. */
  onAiResponseStarted?: () => void;
  /** The AI finished generating a response. */
  onAiResponseDone?: () => void;
  /**
   * The user barged in (server VAD detected speech over the avatar). The
   * backend has already dropped the VM's lip-sync queue; the client should
   * flush any locally-buffered TTS so the old turn stops playing.
   */
  onAiSpeechInterrupted?: () => void;
  /** The AI is thinking (agent processing). */
  onAiThinking?: (thinking: boolean) => void;
  /** The ASR engine produced a transcript of what the user said. */
  onUserTranscript?: (transcript: string) => void;
  /** The backend sent a structured error. */
  onError?: (code: string, message: string) => void;
  /** WebSocket closed (after exhausting reconnect attempts). */
  onClose?: () => void;
  /**
   * The backend proxied a MuseTalk SDP answer (or an error) in response to a
   * `musetalk_offer` we sent. Settable per-offer on the instance.
   */
  onMuseTalkAnswer?: (data: { sdp?: string; error?: string }) => void;
};

// ---------------------------------------------------------------------------
// Internal message shapes (server → client)
// ---------------------------------------------------------------------------

interface IncomingMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Parse a tool-call `args` payload into a plain object.
 *
 * `realtime-handler` forwards Qwen's `argumentsJson` — normally a JSON string,
 * but a defensive `object`/`undefined` path is kept so a backend change that
 * pre-parses can't break UI dispatch. Malformed input yields `{}`.
 */
function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* malformed → empty */
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// DHWebSocket
// ---------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL_MS = 15_000;

export class DHWebSocket {
  private ws: WebSocket | null = null;
  private url = '';
  private handlers: DHMessageHandler;

  private reconnectAttempts = 0;
  private isManualClose = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Per-offer MuseTalk answer callback. The DH session controller assigns this
   * just before sending an offer; the dispatcher invokes it when the proxied
   * `musetalk_answer` frame arrives. Mutable so each offer gets a fresh
   * resolve/reject pair.
   */
  onMuseTalkAnswer?: (data: { sdp?: string; error?: string }) => void;

  constructor(handlers: DHMessageHandler) {
    this.handlers = handlers;
    this.onMuseTalkAnswer = handlers.onMuseTalkAnswer;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Open a WebSocket connection to `url`.
   * If called while already connected, the existing connection is closed first.
   */
  connect(url: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[DHWebSocket] Already connected, closing previous connection');
      this.closeInternal();
    }

    this.url = url;
    this.isManualClose = false;
    this.reconnectAttempts = 0;

    this.bindExitHandler();
    this.openConnection();
  }

  /**
   * ページ遷移(返回ボタン/リンク/タブ閉じ)時に、サーバへ確実に切断を伝えて数字人
   * room を即解放させる。返回/リンクで離脱すると WS の close が遅延/欠落し、dh-saas の
   * concurrent_room_quota が漏れて数回で 429(数字人が出せない)になるため。
   * `pagehide` は bfcache 遷移でも発火し unload より確実(WS を持つページは基本
   * bfcache 対象外なので persisted 復帰は考慮不要)。tab 切替(visibilitychange)では
   * 切らない — 一時離席で session を殺さないため。サーバ側の dead-connection 検知と
   * 二重の保険。
   */
  private exitHandlerBound = false;
  private bindExitHandler(): void {
    if (this.exitHandlerBound || typeof window === 'undefined') return;
    this.exitHandlerBound = true;
    window.addEventListener('pagehide', () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.isManualClose = true;
        try {
          this.ws.send(JSON.stringify({ type: 'stop' }));
        } catch {
          /* noop */
        }
        try {
          this.ws.close(1000, 'page hidden');
        } catch {
          /* noop */
        }
      }
    });
  }

  /**
   * Send a base64-encoded PCM16 audio chunk to the backend.
   */
  sendAudio(base64: string): void {
    this.send({ type: 'audio', data: base64 });
  }

  /**
   * Send a text message to the AI (text-chat mode).
   */
  sendText(content: string): void {
    this.send({ type: 'text', text: content });
  }

  /**
   * Send a base64-encoded video frame to the backend.
   */
  sendVideo(base64: string): void {
    this.send({ type: 'video', data: base64 });
  }

  /**
   * Send a MuseTalk WebRTC SDP offer to the backend for server-side proxying
   * to the dh-saas VM. The answer arrives via {@link onMuseTalkAnswer}.
   */
  sendMuseTalkOffer(sdp: string, webrtcId: string): void {
    this.send({ type: 'musetalk_offer', data: { sdp, webrtcId } });
  }

  /**
   * 数字人形象 オンデマンド(docs/10 §4.2 / B案)。avatar を一時停止/再開する制御。
   * pause: サーバ(winclaw)が dh-saas セッション(VM room)側の後片付け(audio sink 閉じ等)を行う。
   *        VM room 自体は browser の WebRTC 切断で閉じ、GPU/room slot が解放される。
   * resume: サーバが dh-saas セッションを mint し直し、新しい dh_stream_info を再送する
   *        → クライアントが再 negotiate して avatar を再表示(再唤醒)。
   */
  sendAvatarPause(): void {
    this.send({ type: 'avatar_pause' });
  }
  sendAvatarResume(): void {
    this.send({ type: 'avatar_resume' });
  }

  /**
   * Tier 2 実時声音切替: 内嵌 UI が新しい Qwen 音色を選んだら、この指令をサーバ
   * (節点 dh 插件)へ送る。サーバは Qwen realtime セッションを新 voice で張り直し、
   * 次の一句から新しい声になる(コンテナ再起動不要 / avatar・audio sink は不変)。
   * @param voice 新しい Qwen 音色 id(例: "Ethan" / "Cherry" / "Serena")。
   */
  sendVoiceChange(voice: string): void {
    this.send({ type: 'voice_change', voice });
  }

  /**
   * Gracefully close the WebSocket and suppress auto-reconnect.
   */
  disconnect(): void {
    this.isManualClose = true;
    this.closeInternal();
    console.log('[DHWebSocket] Disconnected');
  }

  /** True when the WebSocket is in the OPEN state. */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ---------------------------------------------------------------------------
  // Internal connection management
  // ---------------------------------------------------------------------------

  private openConnection(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.error('[DHWebSocket] Failed to create WebSocket:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[DHWebSocket] Connected:', this.url);
      this.reconnectAttempts = 0;
      this.startPing();
      this.handlers.onConnected?.();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onerror = (event: Event) => {
      console.error('[DHWebSocket] WebSocket error:', event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[DHWebSocket] Connection closed: code=${event.code}, reason=${event.reason}`);
      this.stopPing();

      if (!this.isManualClose) {
        this.scheduleReconnect();
      } else {
        this.handlers.onClose?.();
      }
    };
  }

  private closeInternal(): void {
    this.stopPing();
    if (this.ws) {
      // Remove event listeners before closing to prevent the onclose handler
      // from triggering a reconnect during an intentional teardown.
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[DHWebSocket] Giving up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`
      );
      this.handlers.onClose?.();
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1 s, 2 s, 4 s, 8 s, 16 s
    const delayMs = 1000 * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[DHWebSocket] Reconnecting in ${delayMs} ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    setTimeout(() => {
      if (!this.isManualClose) {
        this.openConnection();
      }
    }, delayMs);
  }

  // ---------------------------------------------------------------------------
  // Ping keepalive
  // ---------------------------------------------------------------------------

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Outgoing messages
  // ---------------------------------------------------------------------------

  private send(data: unknown): void {
    if (!this.isConnected) {
      console.warn('[DHWebSocket] Cannot send: not connected');
      return;
    }
    try {
      this.ws!.send(JSON.stringify(data));
    } catch (e) {
      console.error('[DHWebSocket] Send failed:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Incoming message dispatch
  // ---------------------------------------------------------------------------

  private handleMessage(raw: string): void {
    let msg: IncomingMessage;

    try {
      msg = JSON.parse(raw) as IncomingMessage;
    } catch (e) {
      console.error('[DHWebSocket] Failed to parse message:', e, raw);
      return;
    }

    try {
      this.dispatch(msg);
    } catch (e) {
      console.error('[DHWebSocket] Handler threw an error:', e);
    }
  }

  private dispatch(msg: IncomingMessage): void {
    // Backend wraps most payloads as { type, data: { ... } }.
    // Some messages from index.ts use flat top-level fields.
    const data = (msg.data ?? {}) as Record<string, unknown>;

    switch (msg.type) {
      // ------------------------------------------------------------------
      // ByteRTC stream info (room credentials for the viewer)
      // ------------------------------------------------------------------
      case 'dh_stream_info':
      case 'stream_info': {
        const info = data as unknown as DHStreamInfo;
        this.handlers.onDhStreamInfo?.(info);
        break;
      }

      // ------------------------------------------------------------------
      // AI text response (delta or full)
      // ------------------------------------------------------------------
      case 'ai_text': {
        const content = ((data.content ?? data.text ?? msg.content ?? '') as string);
        const isDelta = Boolean(data.is_delta ?? data.isDelta ?? msg.is_delta ?? false);
        this.handlers.onAiText?.(content, isDelta);
        break;
      }

      // ------------------------------------------------------------------
      // AI audio response chunk
      // ------------------------------------------------------------------
      case 'ai_audio': {
        const audio = ((data.audio ?? msg.audio ?? '') as string);
        const sampleRate = ((data.sample_rate ?? data.sampleRate ?? msg.sample_rate ?? 24000) as number);
        if (audio) {
          this.handlers.onAiAudio?.(audio, sampleRate);
        }
        break;
      }

      // ------------------------------------------------------------------
      // Response lifecycle
      // ------------------------------------------------------------------
      case 'ai_thinking': {
        const thinking = Boolean(data.thinking ?? msg.thinking ?? false);
        this.handlers.onAiThinking?.(thinking);
        break;
      }

      case 'response_started':
      case 'ai_response_started':
        this.handlers.onAiResponseStarted?.();
        break;

      case 'response_done':
      case 'ai_response_done':
        this.handlers.onAiResponseDone?.();
        break;

      // ------------------------------------------------------------------
      // Barge-in: user spoke over the avatar (道B). Flush local TTS.
      // ------------------------------------------------------------------
      case 'speech_started':
      case 'ai_speech_interrupted':
        this.handlers.onAiSpeechInterrupted?.();
        break;

      // ------------------------------------------------------------------
      // User speech transcript (ASR)
      // ------------------------------------------------------------------
      case 'user_transcript': {
        const transcript = ((data.content ?? data.transcript ?? msg.content ?? '') as string);
        this.handlers.onUserTranscript?.(transcript);
        break;
      }

      // ------------------------------------------------------------------
      // MuseTalk SDP answer (proxied server-side from the dh-saas VM)
      // ------------------------------------------------------------------
      case 'musetalk_answer': {
        const sdp = data.sdp as string | undefined;
        const error = data.error as string | undefined;
        this.onMuseTalkAnswer?.({ sdp, error });
        break;
      }

      // ------------------------------------------------------------------
      // Backend errors (flat from index.ts OR nested from handler)
      // ------------------------------------------------------------------
      case 'error': {
        const code = ((msg.code ?? data.code ?? 'UNKNOWN') as string);
        const message = ((msg.message ?? data.message ?? 'Unknown error') as string);
        console.error(`[DHWebSocket] Backend error: [${code}] ${message}`);
        this.handlers.onError?.(code, message);
        break;
      }

      // ------------------------------------------------------------------
      // Session created acknowledgment
      // ------------------------------------------------------------------
      case 'session.created':
        console.log('[DHWebSocket] Session created:', msg.sessionId);
        break;

      // ------------------------------------------------------------------
      // Pong / heartbeat (no action needed)
      // ------------------------------------------------------------------
      case 'pong':
        break;

      // ------------------------------------------------------------------
      // Tool call surfaced from the DH agent (realtime-handler が全 tool 呼出を
      // {type:"tool_call", data:{name,args,callId}} で送る)。音声委託タスク
      // (task_run)を秘书パネルへ橋渡しする — window CustomEvent で疎結合に流し、
      // パネルが ai-meta /tasks/ingest へ記録する(A案・docs/10 §14.5)。
      // ------------------------------------------------------------------
      case 'tool_call': {
        const toolName = (data.name as string) ?? '';
        if (toolName === 'task_run') {
          try {
            window.dispatchEvent(
              new CustomEvent('secretary-voice-task', {
                detail: {
                  callId: (data.callId as string) ?? '',
                  args: (data.args as string) ?? '',
                },
              }),
            );
          } catch {
            /* 非ブラウザ/dispatch 失敗は非致命 */
          }
        } else if (toolName === 'ui_action') {
          // 音声 UI 制御(Sprint D)。realtime-handler が {target,action,name} を
          // args に載せて送る。app-render.ts が 'dh-ui-action' を購読し、target
          // ごとに既存ハンドラへ分派する(パネル開閉/マイク/カメラ/avatar 切替)。
          // ここでは疎結合に DOM イベントを撒くだけ — 実行判断は app-render 側。
          try {
            const uiArgs = parseToolArgs(data.args);
            window.dispatchEvent(
              new CustomEvent('dh-ui-action', {
                detail: {
                  target: (uiArgs.target as string) ?? '',
                  action: (uiArgs.action as string) ?? '',
                  name: (uiArgs.name as string) ?? undefined,
                },
              }),
            );
          } catch {
            /* 非ブラウザ/dispatch 失敗は非致命 */
          }
        }
        break;
      }

      default:
        console.debug('[DHWebSocket] Unhandled message type:', msg.type, msg);
        break;
    }
  }
}

export default DHWebSocket;
