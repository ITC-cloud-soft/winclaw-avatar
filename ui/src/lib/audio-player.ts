/**
 * AudioStreamPlayer – plays back a stream of base64-encoded PCM16 audio chunks.
 *
 * Designed for AI TTS responses (e.g. Qwen Omni) that arrive as a series of
 * small base64 PCM16 packets.  Each call to playChunk() schedules the decoded
 * buffer immediately after the previous one, so the playback queue is gapless
 * even when chunks arrive faster or slower than real-time.
 *
 * Default sample rate is 24 000 Hz (Qwen Omni TTS output).
 */

export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private _isPlaying = false;
  private defaultSampleRate: number;

  constructor(sampleRate = 24000) {
    this.defaultSampleRate = sampleRate;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Decode and schedule a base64-encoded PCM16 (little-endian) audio chunk.
   * Chunks are queued sequentially; the first chunk begins at
   * AudioContext.currentTime (or immediately if already behind).
   *
   * @param base64Audio Base64-encoded raw PCM16 samples (Int16, little-endian).
   * @param sampleRate  Override the sample rate for this chunk only.
   *                    Defaults to the rate passed to the constructor.
   */
  playChunk(base64Audio: string, sampleRate?: number): void {
    try {
      const ctx = this.ensureContext();
      const rate = sampleRate ?? this.defaultSampleRate;

      // --- Decode base64 → Uint8Array ---
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // --- Int16 LE → Float32 (-1…+1) ---
      const sampleCount = Math.floor(bytes.length / 2);
      if (sampleCount === 0) return;

      const samples = new Float32Array(sampleCount);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getInt16(i * 2, /* littleEndian */ true) / 32768.0;
      }

      // --- Create AudioBuffer ---
      const buffer = ctx.createBuffer(1, sampleCount, rate);
      buffer.copyToChannel(samples, 0);

      // --- Schedule playback ---
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (this.nextStartTime < now) {
        // We fell behind (first chunk, or a gap in delivery) – snap to now
        this.nextStartTime = now;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this._isPlaying = true;

      source.onended = () => {
        // If nothing else is queued, mark playback as idle.
        if (ctx.currentTime >= this.nextStartTime - 0.01) {
          this._isPlaying = false;
        }
      };
    } catch (e) {
      console.error('[AudioPlayer] Error playing chunk:', e);
    }
  }

  /**
   * Immediately stop all playback and close the AudioContext.
   * The player can be reused after stop() – ensureContext() will open a
   * new context on the next playChunk() call.
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
   * Reset the scheduling cursor without closing the AudioContext.
   * Use this when a new AI response starts so the first new chunk plays
   * immediately instead of after the tail of the previous response.
   */
  resume(): void {
    this.nextStartTime = 0;
    this._isPlaying = false;
    // If the context was suspended (e.g. browser autoplay policy), wake it.
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /** True while chunks are still scheduled / playing. */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: this.defaultSampleRate });
    }
    if (this.audioContext.state === 'suspended') {
      // Best-effort resume; may be blocked until a user gesture occurs.
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }
}

export default AudioStreamPlayer;
