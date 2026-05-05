/**
 * VideoCapture - Captures camera frames for real-time video streaming.
 *
 * Pipeline: camera MediaStream → hidden <video> element → offscreen <canvas> →
 *           JPEG encode → strip data-URL prefix → base64 string → callback
 *
 * Frames are captured at 2 fps (every 500 ms) at 640×480 with JPEG quality
 * 0.7, matching the reference autoproject implementation. The underlying
 * MediaStream is also exposed so the caller can attach it to a visible
 * <video> element for a live preview.
 *
 * No React or Next.js dependencies — pure MediaStream API + Canvas 2D API.
 *
 * @module video-capture
 */

/** Callback invoked for each captured JPEG frame. */
export type FrameCallback = (base64JpegFrame: string) => void;

/**
 * Captures camera video frames periodically and delivers them as
 * base64-encoded JPEG strings to a caller-supplied callback.
 *
 * @example
 * ```ts
 * const capture = new VideoCapture();
 * const stream = await capture.start((frame) => sendToServer(frame), previewVideoEl);
 *
 * // To pause frame delivery without stopping the camera:
 * capture.setEnabled(false);
 *
 * // Full teardown:
 * capture.stop();
 * ```
 */
export class VideoCapture {
  /** Hidden <video> element used as the source for canvas drawImage. */
  private videoElement: HTMLVideoElement | null = null;

  /** Offscreen canvas onto which each frame is drawn before JPEG encoding. */
  private canvas: HTMLCanvasElement | null = null;

  /** 2D rendering context for the offscreen canvas. */
  private canvasCtx: CanvasRenderingContext2D | null = null;

  /** The live camera MediaStream. */
  private mediaStream: MediaStream | null = null;

  /** Handle returned by setInterval for the periodic capture loop. */
  private captureInterval: ReturnType<typeof setInterval> | null = null;

  private _isCapturing = false;
  private onFrame: FrameCallback | null = null;

  // ---------------------------------------------------------------------------
  // Configuration constants (match the autoproject reference implementation)
  // ---------------------------------------------------------------------------

  /** Capture width in pixels. */
  private readonly width = 640;

  /** Capture height in pixels. */
  private readonly height = 480;

  /**
   * Target capture rate in frames per second.
   * 2 fps → one frame every 500 ms.
   */
  private readonly fps = 2;

  /**
   * JPEG compression quality in the range [0, 1].
   * 0.7 balances image fidelity and payload size for real-time transmission.
   */
  private readonly jpegQuality = 0.7;

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  /** Whether a capture session is currently active. */
  get isCapturing(): boolean {
    return this._isCapturing;
  }

  /**
   * The underlying camera {@link MediaStream}.
   * Useful for attaching to a visible `<video>` element as an alternative to
   * passing `previewElement` to {@link start}.
   * Returns `null` when not capturing.
   */
  get stream(): MediaStream | null {
    return this.mediaStream;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Open the camera and begin periodic frame capture.
   *
   * Requests the front-facing camera with ideal dimensions of 640×480.
   * The returned Promise resolves with the raw {@link MediaStream} so the
   * caller can optionally display a preview outside of this class.
   *
   * @param onFrame        - Invoked every ~500 ms with a base64 JPEG string
   *   (no `data:image/jpeg;base64,` prefix). Only called when the underlying
   *   video has `readyState >= HAVE_CURRENT_DATA`.
   * @param previewElement - Optional `<video>` element to display the live
   *   camera feed. It is set to muted + playsInline and played automatically.
   * @returns The camera {@link MediaStream}.
   * @throws {Error} When `getUserMedia` is unavailable (non-secure context),
   *   the user denies camera permission, or no camera device is found.
   */
  async start(
    onFrame: FrameCallback,
    previewElement?: HTMLVideoElement | null
  ): Promise<MediaStream> {
    if (this._isCapturing) {
      console.warn('[VideoCapture] Already capturing');
      return this.mediaStream!;
    }

    this.onFrame = onFrame;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera requires a secure context (HTTPS or localhost). ' +
          'Please access via https:// or http://localhost.'
        );
      }

      // Request the front-facing camera at the desired resolution. The
      // browser may deliver a different resolution if the device does not
      // support 640×480; the canvas always draws at the configured size.
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.width },
          height: { ideal: this.height },
          facingMode: 'user',
        },
      });

      // Optionally show a live preview on a caller-supplied video element.
      if (previewElement) {
        previewElement.srcObject = this.mediaStream;
        previewElement.muted = true;
        previewElement.playsInline = true;
        await previewElement.play().catch(() => {
          console.warn(
            '[VideoCapture] Preview autoplay blocked — user interaction required'
          );
        });
      }

      // Create a hidden video element that feeds the canvas. This element is
      // never added to the DOM; it exists solely as a drawImage source.
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;

      // Wait for the hidden video to start playing before we begin capturing.
      await this.videoElement.play();

      // Offscreen canvas used for JPEG encoding. Using a fixed canvas size
      // ensures consistent frame dimensions regardless of camera resolution.
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvasCtx = this.canvas.getContext('2d');

      if (!this.canvasCtx) {
        throw new Error('[VideoCapture] Failed to obtain 2D canvas context');
      }

      // Start the periodic capture loop at the configured fps.
      this.captureInterval = setInterval(
        () => this.captureFrame(),
        1000 / this.fps
      );

      this._isCapturing = true;
      console.log(
        `[VideoCapture] Started — ${this.width}x${this.height} @ ${this.fps} fps, ` +
        `JPEG quality=${this.jpegQuality}`
      );

      return this.mediaStream;
    } catch (error) {
      console.error('[VideoCapture] Failed to start:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop capturing and release all camera, canvas, and video resources.
   * Safe to call when not capturing.
   */
  stop(): void {
    if (!this._isCapturing) return;
    this._isCapturing = false;
    this.cleanup();
    console.log('[VideoCapture] Stopped');
  }

  /**
   * Enable or disable the camera track without stopping the capture pipeline.
   *
   * When disabled the OS camera indicator light turns off on most platforms
   * and the canvas receives blank/black frames. The interval loop continues
   * running so that frames resume immediately when re-enabled.
   *
   * @param enabled - `true` to resume camera, `false` to pause it.
   */
  setEnabled(enabled: boolean): void {
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw the current video frame onto the offscreen canvas, encode it as JPEG,
   * strip the data-URL prefix, and deliver the raw base64 string to `onFrame`.
   *
   * Skipped when the hidden video element has insufficient data buffered
   * (`readyState < HAVE_CURRENT_DATA`), which prevents blank frames at startup.
   */
  private captureFrame(): void {
    if (
      !this._isCapturing ||
      !this.videoElement ||
      !this.canvasCtx ||
      !this.canvas ||
      !this.onFrame
    ) {
      return;
    }

    // HTMLMediaElement.HAVE_CURRENT_DATA === 2. The frame is only captured
    // once the video has enough data to display the current playback position.
    if (this.videoElement.readyState < this.videoElement.HAVE_CURRENT_DATA) {
      return;
    }

    // Draw the video frame scaled/cropped to the canvas dimensions.
    this.canvasCtx.drawImage(
      this.videoElement,
      0,
      0,
      this.width,
      this.height
    );

    // Encode as JPEG and strip the "data:image/jpeg;base64," prefix so
    // callers receive a raw base64 string compatible with most APIs.
    const dataUrl = this.canvas.toDataURL('image/jpeg', this.jpegQuality);
    const base64 = dataUrl.split(',')[1];

    if (base64) {
      this.onFrame(base64);
    }
  }

  /**
   * Release all held resources: interval, video element, media tracks, canvas.
   */
  private cleanup(): void {
    if (this.captureInterval !== null) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.canvas = null;
    this.canvasCtx = null;
    this.onFrame = null;
  }
}
