/**
 * MuseTalkWebRTCViewer – WebRTC-direct viewer for dh-saas / MuseTalk
 * (OpenAvatarChat / FastRTC) sessions.
 *
 * This replaces the ByteRTC path when the backend reports
 * `dh_stream_info.provider === "musetalk"`. The browser negotiates a
 * peer connection directly with the MuseTalk VM (no ByteRTC SFU).
 *
 * 道B: the VM is a PURE MuseTalk renderer — winclaw owns the brain (Qwen
 * ASR+LLM+TTS). The microphone is owned by winclaw (mic → DH WS → winclaw
 * Qwen), NOT published to the VM, and winclaw TTS is played locally by the
 * AudioStreamPlayer. So this peer connection is video-only:
 *
 *   1. Create RTCPeerConnection({ iceServers })
 *   2. Create a DataChannel 'control' (its existence unblocks FastRTC
 *      audio_emit — must NOT be omitted)
 *   3. addTransceiver('video', recvonly) — receive the avatar video only;
 *      we do NOT attach the real mic (winclaw owns it)
 *   4. createOffer() → setLocalDescription → wait ICE gathering (2s)
 *   5. exchangeOffer(sdp, webrtc_id) → answer SDP (proxied server-side over
 *      the DH WebSocket; the dh-saas VM sends no CORS header so a direct
 *      browser POST would fail preflight)
 *   6. setRemoteDescription({type:"answer", sdp})
 *   7. ontrack → attach received video MediaStream to <video> element
 *
 * Adapted from the proven webRtcDirectViewer.ts reference implementation.
 */

export type MuseTalkViewerCallbacks = {
  onAutoplayFailed?: (userId: string, kind: 'audio' | 'video') => void;
  onError?: (e: unknown) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeave?: (userId: string) => void;
  onStreamReady?: () => void;
};

export interface MuseTalkViewerConfig {
  /**
   * Exchange the local SDP offer for a remote answer SDP. The offer is sent
   * server-side (e.g. over the DH WebSocket) to avoid the browser CORS
   * failure that occurs when POSTing directly to the dh-saas VM.
   */
  exchangeOffer: (sdp: string, webrtcId: string) => Promise<string>;
  /** Session id from dh_stream_info; reused as the FastRTC webrtc_id. */
  sessionId?: string;
  /** ICE servers from dh_stream_info; defaults to Google STUN if empty. */
  iceServers?: RTCIceServer[];
}

export class MuseTalkWebRTCViewer {
  private pc: RTCPeerConnection | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  /**
   * 道B publishes no local media (winclaw owns the mic), so this stays null.
   * Retained only so leave() can defensively stop any tracks if a future
   * change re-introduces a local publish — the null guard makes it a no-op.
   */
  private localStream: MediaStream | null = null;
  private readonly containerId: string;
  private readonly callbacks: MuseTalkViewerCallbacks;
  private cleaned = false;
  private streamReadyFired = false;
  /**
   * 道B / 方案1: the VM (OAC RtcStream, AsyncAudioVideoStreamHandler) DOES emit
   * an avatar audio track muxed+frame-synced with the lip video over WebRTC.
   * By default we keep it muted and play winclaw TTS locally (legacy path), but
   * `?webrtcAudio=1` unmutes the <video> so the synced VM audio plays directly —
   * autoproject DH_AUDIO_VIA_VM parity, removing the local audioDelay guess.
   * NOTE: when unmuted, autoplay needs a user gesture (the session starts from a
   * click, so this is satisfied in practice).
   */
  private readonly playWebRtcAudio =
    (() => {
      try {
        return new URLSearchParams(location.search).get('webrtcAudio') === '1';
      } catch {
        return false;
      }
    })();

  /**
   * @param containerOrVideoElId DOM element id where the <video> is appended
   *        (same id ByteRTCViewer renders into).
   */
  constructor(containerOrVideoElId: string, callbacks: MuseTalkViewerCallbacks = {}) {
    this.containerId = containerOrVideoElId;
    this.callbacks = callbacks;
  }

  async join(config: MuseTalkViewerConfig): Promise<void> {
    const { exchangeOffer } = config;
    const webrtcId = config.sessionId || MuseTalkWebRTCViewer.uuid();
    const iceServers =
      config.iceServers && config.iceServers.length > 0
        ? config.iceServers
        : [{ urls: 'stun:stun.l.google.com:19302' }];

    console.log(
      '[MuseTalkViewer] join (offer proxied via DH WS)',
      'webrtc_id=',
      webrtcId,
      'iceServers=',
      iceServers.length,
    );

    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    this.mediaStream = new MediaStream();

    // CRITICAL: FastRTC's AudioCallback.recv() blocks until the VM's
    // pc.on("datachannel") handler fires. Without a DataChannel from us the
    // VM never calls our emit() function and avatar audio stays muted forever.
    // We don't message over it — its mere presence in the offer SDP unblocks
    // the VM-side audio_emit loop.
    const dc = pc.createDataChannel('control', { ordered: true });
    dc.onopen = () => console.log('[MuseTalkViewer] DataChannel open (unblocks VM audio_emit)');
    dc.onclose = () => console.log('[MuseTalkViewer] DataChannel closed');
    dc.onerror = (e) => console.warn('[MuseTalkViewer] DataChannel error:', e);

    // 道B: do NOT attach the real microphone. winclaw owns the mic (browser
    // → DH WS → winclaw Qwen); publishing it to the VM here would double-route
    // the user's speech and is unnecessary now that the VM is a pure renderer.
    //
    // HOWEVER the VM's FastRTC emit() loop only starts streaming avatar video
    // once it RECEIVES an inbound audio frame from us. A recvonly transceiver
    // sends nothing, so emit() never wakes and no video track is ever produced
    // (ontrack never fires → black screen). We therefore publish a SILENT
    // sendrecv audio track purely as the wake-up signal: it carries no speech
    // (so nothing is double-routed), but it keeps OPUS frames flowing so the VM
    // begins lip-syncing the PCM that winclaw pushes over controlWs. Fall back
    // to a track-less recvonly transceiver only if AudioContext is unavailable.
    const silentTrack = MuseTalkWebRTCViewer.createSilentAudioTrack();
    if (silentTrack) {
      this.localStream = new MediaStream([silentTrack]);
      pc.addTransceiver(silentTrack, { direction: 'sendrecv', streams: [this.localStream] });
      console.log('[MuseTalkViewer] Attached silent wake-up audio track (sendrecv)');
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      console.warn('[MuseTalkViewer] No AudioContext — silent wake-up track unavailable; emit() may not start');
    }

    // CRITICAL (per autoproject webRtcDirectViewer.ts): FastRTC / OpenAvatarChat
    // MIRRORS our transceiver direction. With `recvonly` the VM answers
    // `a=inactive` and NEVER streams the avatar video (ontrack:video never
    // fires → black screen). It must be `sendrecv` for the VM to send video
    // back, even though we never publish a video track ourselves.
    pc.addTransceiver('video', { direction: 'sendrecv' });

    pc.ontrack = (ev) => {
      console.log('[MuseTalkViewer] ontrack:', ev.track.kind, 'muted=', ev.track.muted);
      if (this.mediaStream && !this.mediaStream.getTracks().includes(ev.track)) {
        this.mediaStream.addTrack(ev.track);
      }
      this.attachToVideoElement();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[MuseTalkViewer] connectionState:', state);
      if (state === 'connected') {
        this.callbacks.onUserJoined?.(webrtcId);
        if (!this.streamReadyFired) {
          this.streamReadyFired = true;
          this.callbacks.onStreamReady?.();
        }
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (!this.cleaned) {
          this.callbacks.onUserLeave?.(webrtcId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[MuseTalkViewer] iceConnectionState:', pc.iceConnectionState);
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering so the SDP is fully populated (2s timeout).
      await this.waitForIceGathering(pc, 2000);

      const localSdp = pc.localDescription?.sdp || '';

      // Exchange the offer server-side (over the DH WebSocket) to dodge the
      // dh-saas VM's missing CORS header. WebRTC media still flows direct
      // browser↔VM via TURN.
      const answerSdp = await exchangeOffer(localSdp, webrtcId);
      if (!answerSdp || typeof answerSdp !== 'string') {
        throw new Error('offer exchange returned empty answer SDP');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      console.log('[MuseTalkViewer] Remote description set, waiting for media...');
    } catch (e) {
      console.error('[MuseTalkViewer] join failed:', e);
      this.callbacks.onError?.(e);
      throw e;
    }
  }

  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const t = setTimeout(() => resolve(), timeoutMs);
      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(t);
          pc.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', handler);
    });
  }

  private attachToVideoElement(): void {
    if (!this.mediaStream) return;
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn('[MuseTalkViewer] container not found:', this.containerId);
      return;
    }

    let video = this.videoEl;
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      // SAFETY (方案1): always start MUTED so the muted-video autoplay policy
      // lets the avatar render immediately (an unmuted video that can't autoplay
      // never paints its first frame → its 100%-height element collapses → the
      // whole avatar area looks "gone"). When ?webrtcAudio=1 we keep the synced
      // VM audio track but un-mute it on the user's FIRST gesture (see below),
      // which is the standard tap-to-enable-audio pattern and cannot break the
      // video rendering.
      video.muted = true;
      video.controls = false;
      video.style.backgroundColor = '#000';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.setAttribute('data-source', 'musetalk-webrtc');
      container.appendChild(video);
      this.videoEl = video;
      if (this.playWebRtcAudio) {
        this.armWebRtcAudioUnmute();
      }
    }
    video.srcObject = this.mediaStream;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          console.log('[MuseTalkViewer] Video playing');
          this.callbacks.onStreamReady?.();
        })
        .catch((err) => {
          console.warn('[MuseTalkViewer] Autoplay blocked:', err?.message ?? err);
          this.callbacks.onAutoplayFailed?.('avatar', 'video');
          // Still signal ready; the user's tap (play()) will unblock playback.
          this.callbacks.onStreamReady?.();
        });
    }
  }

  /** ByteRTCViewer-compat alias: retry playback after a user gesture. */
  async play(_userId?: string): Promise<void> {
    if (this.videoEl) {
      try {
        await this.videoEl.play();
      } catch (e) {
        console.warn('[MuseTalkViewer] play() still failed:', e);
      }
    }
  }

  /**
   * 方案1: un-mute the avatar's WebRTC audio track on the user's first gesture.
   * The <video> autoplays MUTED (so it always renders); browsers only allow
   * audible playback after a user interaction, so we flip muted=false on the
   * first pointerdown/keydown and then detach the listeners. Idempotent and
   * harmless if no audio track is present.
   */
  private armWebRtcAudioUnmute(): void {
    const unmute = () => {
      const v = this.videoEl;
      if (v) {
        v.muted = false;
        v.play().catch(() => {
          /* gesture should satisfy autoplay; ignore transient errors */
        });
        console.log('[MuseTalkViewer] WebRTC audio un-muted on user gesture');
      }
      document.removeEventListener('pointerdown', unmute);
      document.removeEventListener('keydown', unmute);
    };
    document.addEventListener('pointerdown', unmute, { once: true });
    document.addEventListener('keydown', unmute, { once: true });
  }

  async leave(): Promise<void> {
    this.cleaned = true;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        /* ignore */
      }
      this.pc = null;
    }
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
      this.localStream = null;
    }
    if (this.videoEl?.parentNode) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
      this.videoEl.parentNode.removeChild(this.videoEl);
      this.videoEl = null;
    }
    this.mediaStream = null;
  }

  /** ByteRTCViewer-compat alias so the controller can swap viewers freely. */
  destroy(): void {
    this.leave().catch(() => {});
  }

  /**
   * Build a silent (tiny-amplitude) MediaStreamTrack used to wake the VM's
   * FastRTC emit() loop without sending any real speech. The tiny non-zero gain
   * keeps OPUS DTX from dropping frames so the VM's receive() fires and starts
   * streaming avatar video. Returns null if AudioContext is unavailable (caller
   * falls back to a track-less recvonly transceiver).
   */
  private static createSilentAudioTrack(): MediaStreamTrack | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      oscillator.frequency.value = 440;
      oscillator.connect(gain);
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      oscillator.start();
      return dest.stream.getAudioTracks()[0] || null;
    } catch (e) {
      console.warn('[MuseTalkViewer] createSilentAudioTrack failed:', e);
      return null;
    }
  }

  private static uuid(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export default MuseTalkWebRTCViewer;
