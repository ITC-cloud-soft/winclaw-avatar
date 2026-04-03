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
import { AudioRecorder } from '../lib/audio-recorder.ts';
import { AudioStreamPlayer } from '../lib/audio-player.ts';

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
};

// ---------------------------------------------------------------------------
// DHSessionController
// ---------------------------------------------------------------------------

/** Delay (ms) after `ai_response_done` before unmuting the microphone. */
const UNMUTE_DELAY_MS = 800;

/** DOM element id of the `<video>` tag rendered by digital-human.ts. */
const VIDEO_RENDER_DOM_ID = 'dh-video-player';

export class DHSessionController {
  private ws: DHWebSocket | null = null;
  rtcViewer: ByteRTCViewer | null = null;
  recorder: AudioRecorder | null = null;
  private player: AudioStreamPlayer | null = null;
  private callbacks: DHSessionCallbacks;
  private unmuteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: DHSessionCallbacks) {
    this.callbacks = callbacks;
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

    // Build WebSocket URL.  `location.hostname` is correct for both localhost
    // and remote-desktop scenarios because the gateway and DH server run on
    // the same host as the browser's URL.
    const wsUrl = `ws://${location.hostname}:${wsPort}/api/dh/connect/${gatewayToken}`;

    this.ws = new DHWebSocket(this.buildMessageHandlers());
    this.ws.connect(wsUrl);

    // Create the audio player immediately; it will only actually decode/play
    // once the first audio chunk arrives.
    this.player = new AudioStreamPlayer();

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

  private cameraStream: MediaStream | null = null;
  private cameraEnabled = false;

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
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      // Poll for the DOM element (Lit may need a few frames to render it)
      let preview: HTMLVideoElement | null = null;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 50));
        preview = document.getElementById('camera-preview') as HTMLVideoElement | null;
        if (preview) break;
      }
      if (preview) {
        preview.srcObject = this.cameraStream;
        console.log('[DHSessionController] Camera started');
      } else {
        console.warn('[DHSessionController] #camera-preview not found after 1s');
      }
    } catch (err) {
      console.error('[DHSessionController] Camera access denied:', err);
      this.cameraEnabled = false;
      this.cameraStream = null;
    }
  }

  private stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
    const preview = document.getElementById('camera-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.srcObject = null;
    }
    console.log('[DHSessionController] Camera stopped');
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
        this.initRtcViewer(info);
      },

      onAiText: (content: string, isDelta: boolean) => {
        this.callbacks.onSubtitleUpdate(content, isDelta);
      },

      onAiAudio: (base64Audio: string, sampleRate: number) => {
        // Only play via AudioStreamPlayer when ByteRTC is NOT connected.
        // When the RTC viewer is active, audio comes through the RTC stream
        // and playing it again here would cause double/overlapping audio.
        if (!this.rtcViewer) {
          this.player?.playChunk(base64Audio, sampleRate);
        }
      },

      onAiResponseStarted: () => {
        // Mute the microphone immediately to suppress echo during AI speech.
        if (this.recorder) {
          this.recorder.setMuted(true);
        }
        // Reset the audio player cursor so the first incoming chunk starts
        // immediately rather than after the tail of the previous response.
        this.player?.resume();
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
        this.callbacks.onUserTranscript(transcript);
      },

      onAiThinking: (thinking: boolean) => {
        this.callbacks.onThinkingChange?.(thinking);
      },

      onError: (code: string, message: string) => {
        console.error(`[DHSessionController] Backend error [${code}]: ${message}`);
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

    this.rtcViewer = new ByteRTCViewer(info.rtcAppId, VIDEO_RENDER_DOM_ID, {
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

    // Join as viewer-only (no publish).
    this.rtcViewer
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
