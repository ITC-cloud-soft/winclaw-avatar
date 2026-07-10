/**
 * DHSessionController – glue layer that wires the four DH library modules
 * (DHWebSocket, ByteRTCViewer, AudioRecorder, AudioStreamPlayer) into a single
 * managed session lifecycle.
 *
 * Usage:
 *   const controller = new DHSessionController({ ...callbacks });
 *   await controller.start(wsPort, gatewayToken);
 *   // … later …
 *   await controller.stop();
 */

import { DHWebSocket } from '../lib/dh-websocket.ts';
import type { DHStreamInfo } from '../lib/dh-websocket.ts';
import { ByteRTCViewer } from '../lib/byte-rtc-viewer.ts';
import { MuseTalkWebRTCViewer } from '../lib/musetalk-webrtc-viewer.ts';
import { AudioRecorder } from '../lib/audio-recorder.ts';
import { AudioStreamPlayer } from '../lib/audio-player.ts';
import { VideoCapture } from '../lib/video-capture.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DHConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type DHSessionCallbacks = {
  /** Fired whenever the overall session status changes. */
  onConnectionStatusChange: (status: DHConnectionStatus) => void;
  /**
   * Fired when the AI produces text.
   * @param text     The text fragment (or full sentence).
   * @param isDelta  True when `text` is an incremental chunk that should be
   *                 appended to the current subtitle; false when it is a full
   *                 replacement.
   */
  onSubtitleUpdate: (text: string, isDelta: boolean) => void;
  /** Fired on backend-reported errors (forwarded from the WebSocket). */
  onErrorMessage: (message: string) => void;
  /** Fired when the ASR engine returns a transcript of the user's speech. */
  onUserTranscript: (transcript: string) => void;
  /** Fired when agent starts/stops thinking. */
  onThinkingChange?: (thinking: boolean) => void;
  /** Fired when the digital-human avatar is shown/hidden (on-demand lifecycle). */
  onAvatarActiveChange?: (active: boolean) => void;
};

// ---------------------------------------------------------------------------
// DHSessionController
// ---------------------------------------------------------------------------

/** Delay (ms) after `ai_response_done` before unmuting the microphone. */
const UNMUTE_DELAY_MS = 800;

/** DOM element id of the `<video>` tag rendered by digital-human.ts. */
const VIDEO_RENDER_DOM_ID = 'dh-video-player';

/** Default local-TTS playback delay (ms) compensating the MuseTalk video pipeline
 *  latency (winclaw → control WS → VM GPU lip-sync → WebRTC) so the avatar's lips
 *  line up with the locally played voice. Tune per session via `?audioDelay=<ms>`
 *  (e.g. ?audioDelay=350); 0 disables the offset (legacy immediate playback). */
const DEFAULT_AUDIO_DELAY_MS = 250;

/** Read the per-session TTS playback delay (seconds) from `?audioDelay=<ms>`,
 *  defaulting to {@link DEFAULT_AUDIO_DELAY_MS}. Clamped to [0, 2000] ms. */
function readAudioDelaySec(): number {
  try {
    const raw = new URLSearchParams(location.search).get('audioDelay');
    const ms = raw == null ? DEFAULT_AUDIO_DELAY_MS : Number(raw);
    if (!Number.isFinite(ms)) return DEFAULT_AUDIO_DELAY_MS / 1000;
    return Math.min(2000, Math.max(0, ms)) / 1000;
  } catch {
    return DEFAULT_AUDIO_DELAY_MS / 1000;
  }
}

/** 方案1 (autoproject DH_AUDIO_VIA_VM parity): when `?webrtcAudio=1`, play the
 *  VM's avatar audio track that arrives muxed+frame-synced over the MuseTalk
 *  WebRTC stream, instead of the locally-played ai_audio (which needs the
 *  open-loop audioDelay guess). Eliminates the 250ms offset and the "audio not
 *  gated on video" desync — server-side A/V sync like autoproject's ByteRTC
 *  path. Default off (legacy local-TTS path) until validated. */
function readWebRtcAudioEnabled(): boolean {
  try {
    return new URLSearchParams(location.search).get('webrtcAudio') === '1';
  } catch {
    return false;
  }
}

/**
 * Common surface both viewers expose so the controller can hold either one
 * and tear it down uniformly regardless of provider.
 */
type DHViewer = {
  leave(): Promise<void>;
  destroy(): void;
  play(userId?: string): void | Promise<void>;
};

export class DHSessionController {
  private ws: DHWebSocket | null = null;
  rtcViewer: DHViewer | null = null;
  recorder: AudioRecorder | null = null;
  /**
   * True once a MuseTalk (WebRTC-direct) stream is negotiated. In 道B the VM
   * is a pure renderer: winclaw runs Qwen (ASR+LLM+TTS) itself, so the STT
   * recorder MUST keep running (mic → ws.sendAudio → winclaw Qwen) and the
   * winclaw TTS MUST be played locally via the AudioStreamPlayer (the VM
   * returns video only over WebRTC, no audio track).
   */
  private museTalkMode = false;

  // ── 数字人形象 オンデマンド・ライフサイクル(docs/10 §4.2) ────────────────────
  // Qwen realtime(WS+マイク)は常時 ON。avatar(MuseTalk)は対話中だけ表示し、
  // 無対話が続くと自動で閉じ、次の対話で再唤醒する。手動トグルも維持。
  /** サーバから受けた stream_info(再唤醒時の再 negotiate に再利用)。 */
  private streamInfo: DHStreamInfo | null = null;
  /** 対話中/手動 ON = avatar を出したい状態。ロード直後は false(待機)。 */
  private avatarWanted = false;
  /** 無対話アイドルタイマー(発火で avatar を閉じる)。 */
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** 無対話で avatar を閉じるまでの時間(ms)。 */
  private static readonly AVATAR_IDLE_MS = 60_000;
  private player: AudioStreamPlayer | null = null;
  private callbacks: DHSessionCallbacks;
  private unmuteTimer: ReturnType<typeof setTimeout> | null = null;
  /** タブ隠れ(親の meta:visibility_hidden)直前に avatar が active だったか。復帰時の再 mint 判定用。 */
  private _wasAvatarActiveOnHide = false;

  constructor(callbacks: DHSessionCallbacks) {
    this.callbacks = callbacks;
    // ★親(ai-meta)からの可視性通知(docs/23 一期 B・決策③):
    //   タブ隠れ → avatar room を釈放(hideAvatar: WebRTC 切断で VM room 解放・dh-saas 配額還す)、
    //   タブ復帰 → 隠す前に active だった時のみ再 mint(showAvatar)。Qwen WS/対話文脈は維持
    //   (hide/showAvatar は WebRTC のみ切替=聊天は不断)。embed 元 origin は myaiportal.net/localhost に限定。
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { type?: string } | null;
      if (!d || typeof d !== "object") return;
      if (d.type !== "meta:visibility_hidden" && d.type !== "meta:visibility_visible") return;
      let host = "";
      try { host = new URL(e.origin).hostname; } catch { return; }
      const trusted =
        host === "localhost" || host === "127.0.0.1" ||
        host === "myaiportal.net" || host.endsWith(".myaiportal.net");
      if (!trusted) return;
      if (d.type === "meta:visibility_hidden") {
        this._wasAvatarActiveOnHide = this.isAvatarActive();
        if (this._wasAvatarActiveOnHide) this.hideAvatar();
      } else if (this._wasAvatarActiveOnHide && !this.isAvatarActive()) {
        this._wasAvatarActiveOnHide = false;
        this.showAvatar();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start a new DH session.
   *
   * @param wsPort        Port number of the standalone DH WebSocket server
   *                      (obtained from `GET /api/dh/health`).
   * @param gatewayToken  The gateway auth token used as the connection key.
   */
  async start(wsPort: number, gatewayToken: string): Promise<void> {
    // Teardown any lingering session first.
    await this.stop();

    this.callbacks.onConnectionStatusChange('connecting');

    // Build WebSocket URL.
    // - HTTP (localhost / direct-port / dev): connect directly to the standalone
    //   DH WebSocket server at `ws://host:wsPort` (legacy behavior; mic is allowed
    //   because http://localhost is a secure context, and ws:// is fine on an http page).
    // - HTTPS (behind a TLS reverse proxy, e.g. caddy on a public VM): the page is a
    //   secure context (mic works) but a plain `ws://` would be blocked as mixed content.
    //   Connect **same-origin** over `wss://${location.host}/api/dh/connect/...` and let the
    //   reverse proxy route `/api/dh/connect` → the internal DH WS server (18790). This
    //   avoids a second TLS port and the mixed-content block. (winclaw-avatar 道B / ai-meta)
    const isHttps = location.protocol === 'https:';
    const wsUrl = isHttps
      ? `wss://${location.host}/api/dh/connect/${gatewayToken}`
      : `ws://${location.hostname}:${wsPort}/api/dh/connect/${gatewayToken}`;

    this.ws = new DHWebSocket(this.buildMessageHandlers());
    this.ws.connect(wsUrl);

    // Create the audio player immediately; it will only actually decode/play
    // once the first audio chunk arrives. The playback delay compensates the
    // MuseTalk video pipeline latency so the lips line up with the voice.
    this.player = new AudioStreamPlayer(24000, readAudioDelaySec());

    // Start the microphone recorder.  Audio chunks are forwarded to the
    // WebSocket as soon as the connection opens.
    this.recorder = new AudioRecorder((base64Audio: string) => {
      this.ws?.sendAudio(base64Audio);
    });

    try {
      await this.recorder.start();
      // Default: mic ON (unmuted)
    } catch (err) {
      console.error('[DHSessionController] Microphone access denied:', err);
      this.callbacks.onErrorMessage(
        err instanceof Error ? err.message : 'Microphone access denied'
      );
      // Continue anyway – user may still receive DH video/audio.
    }
  }

  /**
   * Gracefully tear down the current session and reset all sub-components.
   */
  async stop(): Promise<void> {
    // Cancel any pending unmute timer.
    if (this.unmuteTimer !== null) {
      clearTimeout(this.unmuteTimer);
      this.unmuteTimer = null;
    }

    // Reset provider mode + avatar lifecycle state for the next session.
    this.museTalkMode = false;
    if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    this.streamInfo = null;
    this.avatarWanted = false;

    // 1. Stop the microphone recorder and camera.
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    this.stopCamera();

    // 2. Leave the ByteRTC room.
    if (this.rtcViewer) {
      await this.rtcViewer.leave().catch(() => {});
      this.rtcViewer = null;
    }

    // 3. Stop the audio player.
    if (this.player) {
      this.player.stop();
      this.player = null;
    }

    // 4. Disconnect the WebSocket (suppresses auto-reconnect).
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }

    this.callbacks.onConnectionStatusChange('disconnected');
  }

  /**
   * Toggle the microphone mute state.
   * @returns The new `micEnabled` value (true = active/unmuted).
   */
  toggleMic(): boolean {
    if (!this.recorder) return false;
    const nextMuted = !this.recorder.isMuted;
    this.recorder.setMuted(nextMuted);
    // Return whether the mic is now *enabled* (i.e. not muted).
    return !nextMuted;
  }

  /**
   * Tier 2 実時声音切替: 新しい Qwen 音色をサーバ(節点 dh 插件)へ通知する。
   * サーバ側で Qwen realtime を新 voice で張り直し、次の一句から新しい声になる
   * (avatar / audio sink は不変、コンテナ再起動不要)。WS 未接続なら no-op。
   * @param voice 新しい Qwen 音色 id(例: "Ethan" / "Cherry" / "Serena")。
   * @returns 指令を送れたら true。
   */
  setVoice(voice: string): boolean {
    if (!this.ws) {
      console.warn('[DHSessionController] setVoice — no active session');
      return false;
    }
    this.ws.sendVoiceChange(voice);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 数字人形象 オンデマンド・ライフサイクル
  // ---------------------------------------------------------------------------
  /** avatar を表示(対話 or 手動)。stream_info があれば negotiate。idle タイマー reset。 */
  showAvatar(): void {
    this.avatarWanted = true;
    this.resetIdleTimer();
    if (this.rtcViewer) return; // 既に表示中
    if (this.streamInfo) {
      // 有効な stream_info があれば即 negotiate。
      this.initRtcViewer(this.streamInfo);
      this.callbacks.onAvatarActiveChange?.(true);
    } else {
      // B案: pause 後は stream_info を破棄済。winclaw に再 mint を要求し、
      // 新しい dh_stream_info 到着時(onDhStreamInfo)に negotiate される(再唤醒)。
      this.ws?.sendAvatarResume();
    }
  }
  /** avatar を閉じる(WebRTC 切断 → VM room 解放。Qwen WS/マイクは維持=対話は継続可能)。 */
  hideAvatar(): void {
    this.avatarWanted = false;
    if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.rtcViewer) {
      this.rtcViewer.destroy(); // WebRTC 切断 → dh-saas セッション(VM room)が閉じ GPU/slot 解放
      this.rtcViewer = null;
    }
    this.museTalkMode = false;
    // B案: winclaw 側の後片付け(audio sink 閉じ等)+ 次回は再 mint させるため stream_info 破棄。
    this.ws?.sendAvatarPause();
    this.streamInfo = null;
    this.callbacks.onAvatarActiveChange?.(false);
  }
  /** 手動トグル。表示中なら閉じ、非表示なら表示。新しい表示状態を返す。 */
  toggleAvatar(): boolean {
    if (this.rtcViewer) { this.hideAvatar(); return false; }
    this.showAvatar();
    return true;
  }
  isAvatarActive(): boolean { return this.rtcViewer !== null; }
  /** 無対話アイドルタイマーを張り直す(対話イベントごとに reset)。 */
  private resetIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.rtcViewer) this.hideAvatar(); // 1分無対話 → avatar 自動クローズ
    }, DHSessionController.AVATAR_IDLE_MS);
  }

  private cameraStream: MediaStream | null = null;
  private cameraEnabled = false;
  private videoCapture: VideoCapture | null = null;

  /**
   * Toggle the camera PiP preview and video frame capture.
   * Returns the new enabled state.
   */
  toggleCamera(): boolean {
    this.cameraEnabled = !this.cameraEnabled;
    if (this.cameraEnabled) {
      this.startCamera();
    } else {
      this.stopCamera();
    }
    return this.cameraEnabled;
  }

  private async startCamera(): Promise<void> {
    try {
      // Poll for the preview DOM element (Lit may need a few frames to render it)
      let preview: HTMLVideoElement | null = null;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 50));
        preview = document.getElementById('camera-preview') as HTMLVideoElement | null;
        if (preview) break;
      }
      if (!preview) {
        console.warn('[DHSessionController] #camera-preview not found after 1s');
      }

      this.videoCapture = new VideoCapture();
      let frameCount = 0;
      this.cameraStream = await this.videoCapture.start(
        (base64Jpeg: string) => {
          frameCount++;
          // Log every 10th frame to confirm capture + send, avoid console spam
          if (frameCount === 1 || frameCount % 10 === 0) {
            console.log(
              `[DHSessionController] 📹 captured frame #${frameCount} (base64 len=${base64Jpeg.length}); ws.connected=${this.ws?.isConnected}`,
            );
          }
          try {
            this.ws?.sendVideo(base64Jpeg);
          } catch (err) {
            console.warn('[DHSessionController] sendVideo failed:', err);
          }
        },
        preview
      );
      console.log('[DHSessionController] Camera started — VideoCapture is now emitting frames');
    } catch (err) {
      console.error('[DHSessionController] Camera access denied or capture failed:', err);
      this.cameraEnabled = false;
      this.cameraStream = null;
      if (this.videoCapture) {
        try { this.videoCapture.stop(); } catch {}
        this.videoCapture = null;
      }
    }
  }

  private stopCamera(): void {
    const hadCamera = !!this.videoCapture || !!this.cameraStream;
    if (this.videoCapture) {
      try { this.videoCapture.stop(); } catch {}
      this.videoCapture = null;
    }
    // VideoCapture.stop() already stops the MediaStream tracks; null out our ref.
    this.cameraStream = null;
    const preview = document.getElementById('camera-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.srcObject = null;
    }
    if (hadCamera) {
      console.log('[DHSessionController] Camera stopped');
    }
  }

  // ---------------------------------------------------------------------------
  // DHMessageHandler builder
  // ---------------------------------------------------------------------------

  private buildMessageHandlers() {
    return {
      onConnected: () => {
        console.log('[DHSessionController] WebSocket connected');
        this.callbacks.onConnectionStatusChange('connected');
      },

      onDhStreamInfo: (info: DHStreamInfo) => {
        console.log('[DHSessionController] DH stream info received:', info);
        // オンデマンド: stream_info は保存し、avatar はロード時には出さない(待機)。
        // 対話中/手動 ON 済(avatarWanted)なら即 negotiate。
        this.streamInfo = info;
        if (this.avatarWanted && !this.rtcViewer) {
          this.initRtcViewer(info);
          this.callbacks.onAvatarActiveChange?.(true);
        }
      },

      onAiText: (content: string, isDelta: boolean) => {
        this.callbacks.onSubtitleUpdate(content, isDelta);
      },

      onAiAudio: (base64Audio: string, sampleRate: number) => {
        // Playback policy depends on the provider:
        //   • byteplus: audio comes through the ByteRTC stream, so playing it
        //     again here would cause double/overlapping audio — skip while a
        //     viewer is present.
        //   • musetalk (道B): winclaw owns the TTS. By default the VM is treated
        //     as a video-only renderer, so we play winclaw TTS locally.
        //     EXCEPT when `?webrtcAudio=1` (方案1): the VM's avatar audio comes
        //     muxed+synced over the MuseTalk WebRTC stream, so playing it again
        //     here would double the audio — skip the local player.
        const skipLocalForWebRtcAudio = this.museTalkMode && readWebRtcAudioEnabled();
        if ((this.museTalkMode || !this.rtcViewer) && !skipLocalForWebRtcAudio) {
          this.player?.playChunk(base64Audio, sampleRate);
        }
      },

      onAiResponseStarted: () => {
        // 対話イベント: avatar を表示(未表示なら再唤醒)+ idle タイマー reset。
        this.showAvatar();
        // Mute the microphone immediately to suppress echo during AI speech.
        if (this.recorder) {
          this.recorder.setMuted(true);
        }
        // Reset the audio player cursor so the first incoming chunk starts
        // immediately rather than after the tail of the previous response.
        this.player?.resume();
      },

      onAiSpeechInterrupted: () => {
        // Barge-in: the backend interrupted the VM's lip-sync queue because the
        // user spoke over the avatar. Drop the locally-buffered/scheduled TTS so
        // the old turn stops immediately instead of playing over the new turn.
        this.player?.flush();
        // Cancel a pending unmute — the mic is already (or about to be) live for
        // the user's interruption; onAiResponseStarted will re-mute for the
        // avatar's next turn.
        if (this.unmuteTimer !== null) {
          clearTimeout(this.unmuteTimer);
          this.unmuteTimer = null;
        }
      },

      onAiResponseDone: () => {
        // Delay unmuting so the mic does not pick up the tail of the TTS.
        if (this.unmuteTimer !== null) {
          clearTimeout(this.unmuteTimer);
        }
        this.unmuteTimer = setTimeout(() => {
          this.unmuteTimer = null;
          if (this.recorder) {
            this.recorder.setMuted(false);
          }
        }, UNMUTE_DELAY_MS);
      },

      onUserTranscript: (transcript: string) => {
        // 対話イベント(ユーザー発話): avatar を表示(再唤醒)+ idle タイマー reset。
        this.showAvatar();
        this.callbacks.onUserTranscript(transcript);
      },

      onAiThinking: (thinking: boolean) => {
        this.callbacks.onThinkingChange?.(thinking);
      },

      onError: (code: string, message: string) => {
        console.error(`[DHSessionController] Backend error [${code}]: ${message}`);
        if (code === 'AVATAR_MINT_FAILED') {
          // avatar(数字人形象)の mint のみ失敗。Qwen 音声対話は継続しているので
          // セッションを 'error' にはせず、avatar 状態だけリセットして
          // ボタンを「数字人 ON」に戻す(ユーザは再度 ON で mint を試せる)。
          this.avatarWanted = false;
          if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; }
          this.callbacks.onAvatarActiveChange?.(false);
          return;
        }
        this.callbacks.onErrorMessage(message);
        this.callbacks.onConnectionStatusChange('error');
      },

      onClose: () => {
        console.log('[DHSessionController] WebSocket closed');
        this.callbacks.onConnectionStatusChange('disconnected');
      },
    };
  }

  // ---------------------------------------------------------------------------
  // ByteRTC initialisation
  // ---------------------------------------------------------------------------

  private initRtcViewer(info: DHStreamInfo): void {
    // If a viewer already exists (e.g. reconnect), destroy the old one first.
    if (this.rtcViewer) {
      this.rtcViewer.destroy();
      this.rtcViewer = null;
    }

    if (info.provider === 'musetalk') {
      this.initMuseTalkViewer(info);
    } else {
      this.initByteRtcViewer(info);
    }
  }

  /**
   * MuseTalk (dh-saas / WebRTC-direct) viewer. In 道B the VM is a pure
   * MuseTalk renderer: winclaw owns the brain (Qwen ASR+LLM+TTS). The winclaw
   * STT recorder started in start() MUST keep running (mic → ws.sendAudio →
   * winclaw Qwen), and winclaw TTS is played locally by the AudioStreamPlayer
   * (onAiAudio plays in MuseTalk mode); the VM returns video only.
   */
  private initMuseTalkViewer(
    info: Extract<DHStreamInfo, { provider: 'musetalk' }>,
  ): void {
    this.museTalkMode = true;

    // Do NOT stop the winclaw STT recorder here. In 道B the mic must flow
    // browser → ws.sendAudio → winclaw Qwen (NOT into the VM peer connection),
    // so the AudioRecorder started in start() stays alive. Echo is suppressed
    // by onAiResponseStarted/Done muting the mic during AI speech.

    const viewer = new MuseTalkWebRTCViewer(VIDEO_RENDER_DOM_ID, {
      onStreamReady: () => {
        console.log('[DHSessionController] MuseTalk WebRTC stream ready');
      },
      onAutoplayFailed: (userId, kind) => {
        console.warn(
          `[DHSessionController] MuseTalk autoplay failed for userId=${userId}, kind=${kind}`,
        );
      },
      onError: (err) => {
        console.error('[DHSessionController] MuseTalk error:', err);
        this.callbacks.onErrorMessage(
          err instanceof Error ? err.message : 'MuseTalk error',
        );
      },
    });
    this.rtcViewer = viewer;

    // Proxy the SDP offer through the existing DH WebSocket (server-to-server,
    // no CORS) instead of POSTing directly to the dh-saas VM, which sends no
    // Access-Control-Allow-Origin header and so fails the browser preflight.
    const exchangeOffer = (sdp: string, webrtcId: string) =>
      new Promise<string>((resolve, reject) => {
        const ws = this.ws;
        if (!ws) {
          reject(new Error('DH WebSocket not available for offer exchange'));
          return;
        }
        const timer = setTimeout(
          () => reject(new Error('musetalk offer proxy timeout')),
          20000,
        );
        ws.onMuseTalkAnswer = (ans) => {
          clearTimeout(timer);
          if (ans.error) reject(new Error(ans.error));
          else if (ans.sdp) resolve(ans.sdp);
          else reject(new Error('empty answer'));
        };
        ws.sendMuseTalkOffer(sdp, webrtcId);
      });

    viewer
      .join({
        exchangeOffer,
        sessionId: info.sessionId,
        iceServers: info.iceServers,
      })
      .catch((err: unknown) => {
        console.error('[DHSessionController] MuseTalk join failed:', err);
        this.callbacks.onErrorMessage(
          err instanceof Error ? err.message : 'MuseTalk join failed',
        );
      });
  }

  /** Legacy BytePlus (ByteRTC) viewer — unchanged rollback path. */
  private initByteRtcViewer(
    info: Extract<DHStreamInfo, { provider?: 'byteplus' }>,
  ): void {
    const viewer = new ByteRTCViewer(info.rtcAppId, VIDEO_RENDER_DOM_ID, {
      onStreamReady: () => {
        console.log('[DHSessionController] ByteRTC stream ready');
      },
      onAutoplayFailed: (userId, kind) => {
        console.warn(
          `[DHSessionController] Autoplay failed for userId=${userId}, kind=${kind}`
        );
      },
      onError: (err) => {
        console.error('[DHSessionController] ByteRTC error:', err);
        this.callbacks.onErrorMessage(
          err instanceof Error ? err.message : 'ByteRTC error'
        );
      },
    });
    this.rtcViewer = viewer;

    // Join as viewer-only (no publish).
    viewer
      .join(info.viewerToken, info.roomId, info.viewerUid)
      .catch((err: unknown) => {
        console.error('[DHSessionController] ByteRTC join failed:', err);
        this.callbacks.onErrorMessage(
          err instanceof Error ? err.message : 'ByteRTC join failed'
        );
      });
  }
}

export default DHSessionController;
