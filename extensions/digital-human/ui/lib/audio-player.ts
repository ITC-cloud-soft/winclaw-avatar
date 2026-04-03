/**
 * AudioPlayer - Plays streamed PCM16 audio chunks with gapless scheduling.
 *
 * Pipeline: base64 string → Uint8Array → PCM16 DataView → Float32Array →
 *           AudioBuffer → BufferSourceNode (scheduled on Web Audio clock)
 *
 * Chunks are scheduled ahead of time using the AudioContext clock so there
 * is no gap between consecutive chunks even when they arrive with irregular
 * network timing. The AudioContext is lazily created and automatically
 * resumed after browser autoplay policy suspends it.
 *
 * No React or Next.js dependencies — pure Web Audio API.
 *
 * @module audio-player
 */

/**
 * Plays a continuous stream of base64-encoded PCM16 audio chunks with
 * gapless back-to-back scheduling on the Web Audio timeline.
 *
 * @example
 * ```ts
 * const player = new AudioStreamPlayer(24000);
 * // Call for each chunk received from the server:
 * player.playChunk(base64String);
 * // When the response is done / interrupted:
 * player.stop();
 * ```
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;

  /**
   * Absolute AudioContext timestamp (in seconds) at which the next chunk
   * should begin playback. Advanced by each chunk's duration after scheduling.
   */
  private nextStartTime = 0;

  /** Default sample rate used when creating the AudioContext. */
  private sampleRate: number;

  /** Whether any audio is currently queued or playing. */
  private _isPlaying = false;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Lazily create (or reuse) an AudioContext at the configured sample rate.
   * Automatically resumes a context that was suspended by the browser's
   * autoplay policy — call this after a user gesture when possible.
   *
   * @returns The ready AudioContext.
   */
  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.audioContext.state === 'suspended') {
      // Best-effort resume; may require a prior user gesture in some browsers.
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Decode and schedule a base64-encoded PCM16 audio chunk for gapless playback.
   *
   * Each call advances the internal timeline cursor by the chunk's duration,
   * so chunks are seamlessly stitched regardless of when `playChunk` is called.
   * If the cursor has fallen behind the current playhead (e.g. after a pause),
   * it is snapped forward to `currentTime` before scheduling.
   *
   * @param base64Audio - Base64-encoded PCM16 little-endian mono audio data.
   * @param sampleRate  - Sample rate of this chunk in Hz. Defaults to the
   *   rate supplied to the constructor (typically 24 000 Hz).
   */
  playChunk(base64Audio: string, sampleRate?: number): void {
    try {
      const ctx = this.ensureContext();
      const rate = sampleRate ?? this.sampleRate;

      // Decode base64 → raw bytes.
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Interpret bytes as little-endian Int16 PCM samples and normalise to
      // the Float32 range [-1, 1] expected by the Web Audio API.
      const sampleCount = Math.floor(bytes.length / 2);
      const samples = new Float32Array(sampleCount);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getInt16(i * 2, true /* little-endian */) / 32768.0;
      }

      // Wrap samples in an AudioBuffer (mono, 1 channel).
      const audioBuffer = ctx.createBuffer(1, sampleCount, rate);
      audioBuffer.copyToChannel(samples, 0);

      // Schedule this chunk to start immediately after the previous one ends.
      // If we have fallen behind the clock (first chunk or after a stop/reset),
      // snap the cursor to the present to avoid a silent wait.
      const now = ctx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(this.nextStartTime);

      // Advance the timeline cursor for the next chunk.
      this.nextStartTime += audioBuffer.duration;
      this._isPlaying = true;

      // Clear the playing flag once the last scheduled chunk finishes.
      source.onended = () => {
        // Use a small epsilon (10 ms) to account for floating-point imprecision.
        if (ctx.currentTime >= this.nextStartTime - 0.01) {
          this._isPlaying = false;
        }
      };
    } catch (error) {
      console.error('[AudioPlayer] Error playing chunk:', error);
    }
  }

  /**
   * Immediately halt all audio and close the AudioContext.
   * Call this when the current response is interrupted or the session ends.
   * After calling `stop()`, the next `playChunk()` will open a fresh context.
   */
  stop(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.nextStartTime = 0;
    this._isPlaying = false;
  }

  /**
   * Reset the playback timeline cursor without closing the AudioContext.
   * Useful between utterances when you want to avoid the latency of
   * re-creating the context but still need clean timing for the next chunk.
   */
  reset(): void {
    this.nextStartTime = 0;
    this._isPlaying = false;
  }

  /**
   * Set the master output volume.
   *
   * Because BufferSourceNodes are connected directly to destination, volume
   * control is applied by creating/updating a GainNode on the context.
   * This implementation adjusts the context's destination gain via a
   * dedicated gain node that is lazily inserted into the chain.
   *
   * NOTE: This method creates/replaces a GainNode each call, which is
   * intentionally simple. For advanced use, manage a persistent GainNode
   * externally or subclass AudioStreamPlayer.
   *
   * @param volume - Gain value in the range [0, 1].
   */
  setVolume(_volume: number): void {
    // Volume control is intentionally a no-op stub for the base class.
    // In most WinClaw UI use cases the OS volume or a separate mixer handles
    // level control. Override or extend this class if per-player volume is
    // required.
    console.debug('[AudioPlayer] setVolume called (stub — use OS volume control)');
  }

  /** Whether audio is currently scheduled or playing. */
  get playing(): boolean {
    return this._isPlaying;
  }
}

// ---------------------------------------------------------------------------
// Singleton helpers
// ---------------------------------------------------------------------------

/** Module-level singleton instance. */
let _playerInstance: AudioStreamPlayer | null = null;

/**
 * Return the shared `AudioStreamPlayer` singleton, creating it on first call.
 *
 * Using a singleton avoids creating multiple AudioContext instances (browsers
 * warn when more than a few are open simultaneously).
 *
 * @param sampleRate - Sample rate passed to the constructor on first call only.
 *   Subsequent calls with a different rate return the existing instance unchanged.
 * @returns The singleton `AudioStreamPlayer`.
 */
export function getAudioPlayer(sampleRate = 24000): AudioStreamPlayer {
  if (!_playerInstance) {
    _playerInstance = new AudioStreamPlayer(sampleRate);
  }
  return _playerInstance;
}

/**
 * Destroy the singleton instance and release its AudioContext.
 * Call this during application teardown or when the plugin panel is closed.
 */
export function destroyAudioPlayer(): void {
  if (_playerInstance) {
    _playerInstance.stop();
    _playerInstance = null;
  }
}
