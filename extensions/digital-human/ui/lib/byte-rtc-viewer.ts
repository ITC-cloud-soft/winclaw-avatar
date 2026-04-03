/**
 * ByteRTCViewer - Displays a remote digital-human video stream via ByteRTC.
 *
 * Wraps the `@byteplus/rtc` SDK to join a ByteRTC room in subscriber-only
 * mode, subscribe to the first remote user's audio+video stream, and render
 * it inside a caller-supplied DOM element.
 *
 * Designed as a standalone ES module with no React or Next.js dependencies.
 * The SDK itself (`@byteplus/rtc`) must be available as a package dependency
 * in the surrounding project.
 *
 * Reference implementation:
 *   DigtalHuman/digitalMan/front/src/rtc/viewer.ts
 *
 * @module byte-rtc-viewer
 */

import VERTC, { MediaType, StreamIndex } from '@byteplus/rtc';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Lifecycle and error callbacks for {@link ByteRTCViewer}.
 * All callbacks are optional; unhandled events are silently ignored.
 */
export type ViewerCallbacks = {
  /**
   * Called when the browser's autoplay policy prevents media from playing.
   * Show a "Click to play" button and call `viewer.play(userId)` in the
   * handler to unblock playback after the user gesture.
   *
   * @param userId - The remote user whose media cannot autoplay.
   * @param kind   - Which media type failed (`'audio'` or `'video'`).
   */
  onAutoplayFailed?: (userId: string, kind: 'audio' | 'video') => void;

  /**
   * Called when an unrecoverable SDK error occurs.
   *
   * @param error - The raw error thrown by the SDK.
   */
  onError?: (error: unknown) => void;

  /**
   * Called when a remote user joins the room.
   *
   * @param userId - The remote user's ID.
   */
  onUserJoined?: (userId: string) => void;

  /**
   * Called when a remote user leaves the room.
   *
   * @param userId - The remote user's ID.
   */
  onUserLeave?: (userId: string) => void;

  /**
   * Called once the first remote video stream has been subscribed and the
   * video player has been attached to the render DOM element. This is the
   * signal that the digital-human video is visible.
   */
  onStreamReady?: () => void;
};

// ---------------------------------------------------------------------------
// ByteRTCViewer class
// ---------------------------------------------------------------------------

/**
 * Subscriber-only ByteRTC viewer for digital-human video streams.
 *
 * @example
 * ```ts
 * const viewer = new ByteRTCViewer('myAppId', 'dh-video-container', {
 *   onStreamReady: () => console.log('DH video is live'),
 *   onAutoplayFailed: (uid, kind) => showPlayButton(uid, kind),
 *   onUserLeave: (uid) => console.log('DH left:', uid),
 * });
 *
 * await viewer.join(token, roomId, viewerUid);
 *
 * // On cleanup:
 * await viewer.leave();
 * viewer.destroy();
 * ```
 */
export class ByteRTCViewer {
  /** The underlying ByteRTC engine instance. */
  private engine: ReturnType<typeof VERTC.createEngine>;

  /**
   * Whether the remote video player has already been attached to the render
   * DOM. Only the first published stream triggers a `setRemoteVideoPlayer`
   * call to avoid overwriting the video element on subsequent publishes.
   */
  private firstRemoteSet = false;

  /** ID of the DOM element (or the element itself) used to render video. */
  private renderDomId: string;

  /**
   * @param appId       - ByteRTC application ID from the BytePlus console.
   * @param renderDomId - ID of the DOM element in which to render the remote
   *   video. The element must exist in the document when {@link join} is called.
   * @param callbacks   - Optional event handler callbacks.
   */
  constructor(
    appId: string,
    renderDomId: string,
    private callbacks: ViewerCallbacks = {}
  ) {
    this.renderDomId = renderDomId;
    this.engine = VERTC.createEngine(appId);
    this.bindEvents();
    console.log(
      `[ByteRTC] Engine created — appId=${appId}, SDK v${VERTC.getSdkVersion()}`
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Join a ByteRTC room in subscriber-only mode.
   *
   * Auto-publish is disabled so this client never sends its own audio/video.
   * Auto-subscribe is enabled for both audio and video so incoming streams
   * are picked up by the `onUserPublishStream` event handler.
   *
   * @param token   - Room access token issued by your ByteRTC token server.
   * @param roomId  - The ByteRTC room ID to join.
   * @param userId  - The local viewer's user ID (must be unique in the room).
   * @returns The Promise returned by `engine.joinRoom`.
   */
  async join(token: string, roomId: string, userId: string): Promise<unknown> {
    console.log(`[ByteRTC] Joining room — roomId=${roomId}, userId=${userId}`);
    return this.engine.joinRoom(
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
   * Trigger media playback on a specific user's stream.
   *
   * Required in browsers that block autoplay until a user gesture. Call this
   * inside a click handler when {@link ViewerCallbacks.onAutoplayFailed} fires.
   *
   * @param userId - The remote user whose stream should be played.
   */
  play(userId: string): void {
    try {
      // The `play` method is present in some SDK versions but not all, so
      // we cast defensively rather than rely on SDK typings.
      (
        this.engine as Record<string, unknown> & {
          play?: (id: string) => void;
        }
      ).play?.(userId);
    } catch {
      // Silently ignore — may not exist in the installed SDK version.
    }
  }

  /**
   * Leave the ByteRTC room and reset internal state.
   *
   * Safe to call multiple times. After `leave()` the viewer can re-join by
   * calling {@link join} again.
   */
  async leave(): Promise<void> {
    try {
      await this.engine?.leaveRoom();
      console.log('[ByteRTC] Left room');
    } catch (error) {
      console.warn('[ByteRTC] Error leaving room:', error);
    }
    this.firstRemoteSet = false;
  }

  /**
   * Leave the room and mark the viewer as destroyed.
   *
   * Call this when the plugin panel is unmounted or the session ends.
   * The viewer instance should not be used after `destroy()`.
   */
  destroy(): void {
    // Leave is intentionally not awaited here; destruction is best-effort.
    this.leave().catch(() => {});
    console.log('[ByteRTC] Viewer destroyed');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Attach all ByteRTC event listeners to the engine.
   * Called once in the constructor.
   */
  private bindEvents(): void {
    // Remote user publishes a stream — subscribe and (on first stream) render.
    this.engine.on(
      VERTC.events.onUserPublishStream,
      async (evt: { userId: string; mediaType: number }) => {
        const { userId, mediaType } = evt;
        console.log(
          `[ByteRTC] User published stream — userId=${userId}, mediaType=${mediaType}`
        );

        // Subscribe whenever the publish contains any media type.
        const hasMedia =
          mediaType & MediaType.AUDIO_AND_VIDEO ||
          mediaType & MediaType.VIDEO ||
          mediaType & MediaType.AUDIO;

        if (hasMedia) {
          try {
            await this.engine.subscribeStream(userId, MediaType.AUDIO_AND_VIDEO);
            console.log(`[ByteRTC] Subscribed to stream — userId=${userId}`);

            // Only bind the video player once (for the first remote publisher).
            if (!this.firstRemoteSet) {
              await this.engine.setRemoteVideoPlayer(
                StreamIndex.STREAM_INDEX_MAIN,
                {
                  userId,
                  renderDom: this.renderDomId,
                }
              );
              this.firstRemoteSet = true;
              this.callbacks.onStreamReady?.();
              console.log(
                `[ByteRTC] Video player set — userId=${userId}, dom=#${this.renderDomId}`
              );
            }
          } catch (error) {
            console.error('[ByteRTC] Subscribe error:', error);
            this.callbacks.onError?.(error);
          }
        }
      }
    );

    // Remote user joined the room.
    this.engine.on(
      VERTC.events.onUserJoined,
      (evt: { userInfo?: { userId?: string } }) => {
        const uid = evt?.userInfo?.userId;
        if (uid) {
          console.log(`[ByteRTC] User joined — ${uid}`);
          this.callbacks.onUserJoined?.(uid);
        }
      }
    );

    // Remote user left the room.
    this.engine.on(
      VERTC.events.onUserLeave,
      (evt: { userInfo?: { userId?: string } }) => {
        const uid = evt?.userInfo?.userId;
        if (uid) {
          console.log(`[ByteRTC] User left — ${uid}`);
          this.callbacks.onUserLeave?.(uid);
        }
      }
    );

    // Browser autoplay policy blocked media.
    this.engine.on(
      VERTC.events.onAutoplayFailed,
      (evt: { userId: string; kind: 'audio' | 'video' }) => {
        console.warn(
          `[ByteRTC] Autoplay failed — userId=${evt.userId}, kind=${evt.kind}`
        );
        this.callbacks.onAutoplayFailed?.(evt.userId, evt.kind);
      }
    );

    // SDK-level error.
    this.engine.on(VERTC.events.onError, (error: unknown) => {
      console.error('[ByteRTC] SDK error:', error);
      this.callbacks.onError?.(error);
    });
  }
}

export default ByteRTCViewer;
