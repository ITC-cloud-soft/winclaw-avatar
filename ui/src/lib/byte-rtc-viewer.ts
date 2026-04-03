/**
 * ByteRTC Viewer for Digital Human video stream
 * Wraps @byteplus/rtc SDK to display the DH video in a DOM element.
 * Uses dynamic import because @byteplus/rtc is a browser-only SDK that
 * cannot be required at module evaluation time (no Node.js support).
 */

export type ViewerCallbacks = {
  onAutoplayFailed?: (userId: string, kind: 'audio' | 'video') => void;
  onError?: (e: unknown) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeave?: (userId: string) => void;
  onStreamReady?: () => void;
};

// Minimal type stubs for the ByteRTC SDK surface we actually use.
// The real SDK ships its own typings, but we only need these shapes
// so that TypeScript is happy without importing the full package at
// compile time.
interface VERTCEngine {
  on(event: string, handler: (...args: unknown[]) => void): void;
  joinRoom(
    token: string,
    roomId: string,
    userInfo: { userId: string },
    options: {
      isAutoPublish: boolean;
      isAutoSubscribeAudio: boolean;
      isAutoSubscribeVideo: boolean;
    }
  ): Promise<void>;
  subscribeStream(userId: string, mediaType: number): Promise<void>;
  setRemoteVideoPlayer(
    streamIndex: number,
    options: { userId: string; renderDom: string }
  ): Promise<void>;
  leaveRoom(): Promise<void>;
  play?(userId: string): void;
}

interface VERTCStatic {
  createEngine(appId: string): VERTCEngine;
  getSdkVersion(): string;
  events: Record<string, string>;
}

// MediaType and StreamIndex enum values used by the SDK.
// Kept as plain constants so we do not need to import the real SDK at
// module level (the dynamic import below will give us the real values,
// but these match the SDK's numeric constants and are used as fallbacks
// when binding events before the async import resolves).
const MEDIA_TYPE_AUDIO = 1;
const MEDIA_TYPE_VIDEO = 2;
const MEDIA_TYPE_AUDIO_AND_VIDEO = 3;
const STREAM_INDEX_MAIN = 0;

export class ByteRTCViewer {
  private engine: VERTCEngine | null = null;
  private firstRemoteSet = false;
  private renderDomId: string;
  private appId: string;
  private callbacks: ViewerCallbacks;
  private autoplayFailedUsers: Set<string> = new Set();
  private initialized = false;

  constructor(
    appId: string,
    renderDomId: string,
    callbacks: ViewerCallbacks = {}
  ) {
    this.appId = appId;
    this.renderDomId = renderDomId;
    this.callbacks = callbacks;
  }

  /**
   * Lazily load @byteplus/rtc and create the engine.
   * Must be called before join(). Safe to call multiple times.
   */
  private async ensureEngine(): Promise<VERTCEngine> {
    if (this.engine) return this.engine;

    if (this.initialized) {
      throw new Error('[ByteRTC] Engine initialization already in progress');
    }
    this.initialized = true;

    try {
      // Load the ByteRTC SDK from the vendor directory (copied at build time).
      // The SDK is browser-only so we use a runtime dynamic import from a static
      // URL path served by the gateway's control-ui static file handler.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const sdkUrl = new URL('./vendor/byteplus-rtc.esm.js', window.location.href).href;
      const mod = await import(/* @vite-ignore */ sdkUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const VERTC: VERTCStatic = (mod.default ?? mod) as VERTCStatic;

      this.engine = VERTC.createEngine(this.appId);
      console.log(`[ByteRTC] Engine created: appId=${this.appId}, SDK v${VERTC.getSdkVersion()}`);

      this.bindEvents(VERTC);
      return this.engine;
    } catch (e) {
      this.initialized = false;
      console.error('[ByteRTC] Failed to load @byteplus/rtc SDK:', e);
      this.callbacks.onError?.(e);
      throw e;
    }
  }

  private bindEvents(VERTC: VERTCStatic): void {
    if (!this.engine) return;

    // When a remote user publishes a stream, subscribe and attach the
    // video player to the configured DOM element id.
    this.engine.on(VERTC.events.onUserPublishStream, async (evt: unknown) => {
      const { userId, mediaType } = evt as { userId: string; mediaType: number };
      console.log(`[ByteRTC] User published stream: userId=${userId}, mediaType=${mediaType}`);

      const hasMedia =
        (mediaType & MEDIA_TYPE_AUDIO_AND_VIDEO) !== 0 ||
        (mediaType & MEDIA_TYPE_VIDEO) !== 0 ||
        (mediaType & MEDIA_TYPE_AUDIO) !== 0;

      if (!hasMedia) return;

      try {
        await this.engine!.subscribeStream(userId, MEDIA_TYPE_AUDIO_AND_VIDEO);
        console.log(`[ByteRTC] Subscribed to stream: userId=${userId}`);

        // Only set the video player once – for the first remote publisher.
        if (!this.firstRemoteSet) {
          // Clear the container so the SDK doesn't warn "renderDom is not empty"
          const container = document.getElementById(this.renderDomId);
          if (container) container.innerHTML = '';

          await this.engine!.setRemoteVideoPlayer(STREAM_INDEX_MAIN, {
            userId,
            renderDom: this.renderDomId,
          });
          this.firstRemoteSet = true;
          this.callbacks.onStreamReady?.();
          console.log(`[ByteRTC] Video player set: userId=${userId}, dom=#${this.renderDomId}`);
        }
      } catch (e) {
        console.error('[ByteRTC] Subscribe error:', e);
        this.callbacks.onError?.(e);
      }
    });

    this.engine.on(VERTC.events.onUserJoined, (evt: unknown) => {
      const uid = (evt as { userInfo?: { userId?: string } })?.userInfo?.userId;
      if (uid) {
        console.log(`[ByteRTC] User joined: ${uid}`);
        this.callbacks.onUserJoined?.(uid);
      }
    });

    this.engine.on(VERTC.events.onUserLeave, (evt: unknown) => {
      const uid = (evt as { userInfo?: { userId?: string } })?.userInfo?.userId;
      if (uid) {
        console.log(`[ByteRTC] User left: ${uid}`);
        this.callbacks.onUserLeave?.(uid);
      }
    });

    // autoplay restrictions: record the user so the caller can retry
    // after a user-gesture event (e.g. button click).
    this.engine.on(VERTC.events.onAutoplayFailed, (evt: unknown) => {
      const { userId, kind } = evt as { userId: string; kind: 'audio' | 'video' };
      console.warn(`[ByteRTC] Autoplay failed: userId=${userId}, kind=${kind}`);
      this.autoplayFailedUsers.add(userId);
      this.callbacks.onAutoplayFailed?.(userId, kind);
    });

    this.engine.on(VERTC.events.onError, (e: unknown) => {
      console.error('[ByteRTC] SDK error:', e);
      this.callbacks.onError?.(e);
    });
  }

  /**
   * Join a ByteRTC room as a viewer (subscribe only, no publishing).
   * Initializes the engine on first call.
   */
  async join(token: string, roomId: string, userId: string): Promise<void> {
    const engine = await this.ensureEngine();
    console.log(`[ByteRTC] Joining room: roomId=${roomId}, userId=${userId}`);
    await engine.joinRoom(
      token,
      roomId,
      { userId },
      {
        isAutoPublish: false,
        isAutoSubscribeAudio: true,
        isAutoSubscribeVideo: true,
      }
    );
  }

  /**
   * Retry media playback for a user after a user gesture.
   * Call this from a click handler when onAutoplayFailed fires.
   */
  play(userId: string): void {
    if (!this.engine) return;
    try {
      this.engine.play?.(userId);
      this.autoplayFailedUsers.delete(userId);
    } catch {
      // play() may not exist on all SDK versions – safe to ignore
    }
  }

  /**
   * Replay all users whose autoplay failed (e.g. on a "tap to unmute" button).
   */
  playAll(): void {
    for (const uid of this.autoplayFailedUsers) {
      this.play(uid);
    }
  }

  /**
   * Leave the current room and reset video player state.
   */
  async leave(): Promise<void> {
    if (!this.engine) return;
    try {
      await this.engine.leaveRoom();
      console.log('[ByteRTC] Left room');
    } catch (e) {
      console.warn('[ByteRTC] Error leaving room:', e);
    }
    this.firstRemoteSet = false;
    this.autoplayFailedUsers.clear();
  }

  /**
   * Leave room and discard the engine instance so ensureEngine() can
   * create a fresh one on next join().
   */
  destroy(): void {
    this.leave().catch(() => {});
    this.engine = null;
    this.initialized = false;
    console.log('[ByteRTC] Viewer destroyed');
  }
}

export default ByteRTCViewer;
