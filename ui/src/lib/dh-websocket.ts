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

export interface DHStreamInfo {
  /** Backend sends camelCase; we normalize both conventions */
  liveId: string;
  roomId: string;
  viewerToken: string;
  viewerUid: string;
  rtcAppId: string;
  publisherUid: string;
}

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
  /** The AI is thinking (agent processing). */
  onAiThinking?: (thinking: boolean) => void;
  /** The ASR engine produced a transcript of what the user said. */
  onUserTranscript?: (transcript: string) => void;
  /** The backend sent a structured error. */
  onError?: (code: string, message: string) => void;
  /** WebSocket closed (after exhausting reconnect attempts). */
  onClose?: () => void;
};

// ---------------------------------------------------------------------------
// Internal message shapes (server → client)
// ---------------------------------------------------------------------------

interface IncomingMessage {
  type: string;
  [key: string]: unknown;
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

  constructor(handlers: DHMessageHandler) {
    this.handlers = handlers;
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

    this.openConnection();
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
      // User speech transcript (ASR)
      // ------------------------------------------------------------------
      case 'user_transcript': {
        const transcript = ((data.content ?? data.transcript ?? msg.content ?? '') as string);
        this.handlers.onUserTranscript?.(transcript);
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

      default:
        console.debug('[DHWebSocket] Unhandled message type:', msg.type, msg);
        break;
    }
  }
}

export default DHWebSocket;
