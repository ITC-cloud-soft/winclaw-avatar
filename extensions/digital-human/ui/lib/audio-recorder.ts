/**
 * AudioRecorder - Captures microphone audio for real-time voice chat.
 *
 * Pipeline: microphone → ScriptProcessorNode → downsample to 16kHz →
 *           Float32 → PCM16 (Int16) → base64 → callback
 *
 * Compatible with APIs that expect PCM_16000HZ_MONO_16BIT audio (e.g. Qwen Omni).
 * No React or Next.js dependencies — pure Web Audio API + MediaStream API.
 *
 * @module audio-recorder
 */

/** Callback invoked for each captured audio chunk (~256 ms of audio at 16 kHz). */
export type AudioDataCallback = (base64Audio: string) => void;

/**
 * AudioRecorder captures mono microphone audio, downsamples it to 16 kHz,
 * converts to PCM16 (little-endian Int16), and delivers base64-encoded chunks
 * via a caller-supplied callback.
 *
 * @example
 * ```ts
 * const recorder = new AudioRecorder();
 * await recorder.start((chunk) => sendToServer(chunk));
 * // ...later...
 * recorder.stop();
 * ```
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _isRecording = false;
  private onAudioData: AudioDataCallback | null = null;

  /** Target output sample rate in Hz. */
  private readonly targetSampleRate = 16000;

  /**
   * ScriptProcessorNode buffer size (samples per channel per callback).
   * At 48 kHz native rate this gives ~85 ms per callback; after downsampling
   * the chunk represents ~256 ms at 16 kHz.
   */
  private readonly bufferSize = 4096;

  /** Whether the recorder is currently capturing audio. */
  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Start recording from the default microphone.
   *
   * Requests microphone access with echo cancellation, noise suppression, and
   * automatic gain control enabled. Throws if permission is denied or if
   * `getUserMedia` is unavailable (non-secure context).
   *
   * @param onAudioData - Invoked with a base64-encoded PCM16 string for each
   *   audio buffer (~256 ms at 16 kHz). Called on the audio processing thread
   *   so keep the handler fast.
   * @throws {Error} When getUserMedia is unavailable, permission is denied, or
   *   no microphone device is found.
   */
  async start(onAudioData: AudioDataCallback): Promise<void> {
    if (this._isRecording) {
      console.warn('[AudioRecorder] Already recording');
      return;
    }

    this.onAudioData = onAudioData;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone requires a secure context (HTTPS or localhost). ' +
          'Please access via https:// or http://localhost.'
        );
      }

      // Request microphone with voice-optimised constraints. The ideal
      // sampleRate hint may be ignored by some browsers, which is fine —
      // we always downsample in software to targetSampleRate.
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: this.targetSampleRate },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Safari still exposes webkitAudioContext on older versions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx() as AudioContext;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessorNode is deprecated but has universal browser support
      // and requires no additional worker files, making it suitable for
      // standalone embedding in a plugin UI without a build server.
      this.processorNode = this.audioContext.createScriptProcessor(
        this.bufferSize,
        1, // inputChannels
        1  // outputChannels
      );

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent): void => {
        // CRITICAL: Zero the output buffer so the mic signal is not routed to
        // the speakers/headphones. The processor must be connected to
        // destination for the onaudioprocess event to fire, but we never
        // want to hear the raw mic feed.
        const outputData = event.outputBuffer.getChannelData(0);
        outputData.fill(0);

        if (!this._isRecording || !this.onAudioData) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Downsample from the browser's native rate to 16 kHz.
        const downsampled = this.downsample(
          inputData,
          this.audioContext!.sampleRate,
          this.targetSampleRate
        );

        if (downsampled.length === 0) return;

        // Float32 → PCM16 → base64 and deliver to caller.
        const pcm16 = this.float32ToPCM16(downsampled);
        const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
        this.onAudioData(base64);
      };

      // mic → processor → destination (destination connection is required for
      // the onaudioprocess event to fire even though we silence the output).
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this._isRecording = true;
      console.log(
        `[AudioRecorder] Started — native=${this.audioContext.sampleRate} Hz → ` +
        `target=${this.targetSampleRate} Hz, bufferSize=${this.bufferSize}`
      );
    } catch (error) {
      console.error('[AudioRecorder] Failed to start:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and release all Web Audio and MediaStream resources.
   * Safe to call when not recording.
   */
  stop(): void {
    if (!this._isRecording) return;
    this._isRecording = false;
    this.cleanup();
    console.log('[AudioRecorder] Stopped');
  }

  /**
   * Mute or unmute the microphone track without tearing down the audio
   * pipeline. When muted the processor continues to fire but the track
   * delivers silence (the OS indicator light may turn off on some platforms).
   *
   * @param muted - `true` to mute, `false` to unmute.
   */
  setMuted(muted: boolean): void {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.onAudioData = null;
  }

  /**
   * Downsample a Float32Array from `fromRate` Hz to `toRate` Hz using
   * averaging-based resampling. Each output sample is the arithmetic mean of
   * the corresponding input samples in the ratio window, which provides simple
   * low-pass filtering and avoids aliasing for the 3:1 ratio typical of
   * 48 kHz → 16 kHz conversion.
   *
   * @param buffer   - Input PCM samples in the range [-1, 1].
   * @param fromRate - Native sample rate (e.g. 48000 or 44100).
   * @param toRate   - Desired output sample rate (16000).
   * @returns Resampled Float32Array at `toRate` Hz.
   */
  private downsample(
    buffer: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return buffer;

    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const start = Math.round(i * ratio);
      const end = Math.round((i + 1) * ratio);
      let sum = 0;
      let count = 0;

      for (let j = start; j < end && j < buffer.length; j++) {
        sum += buffer[j];
        count++;
      }

      result[i] = count > 0 ? sum / count : 0;
    }

    return result;
  }

  /**
   * Convert a Float32Array (range -1.0 to 1.0) to a PCM16 Int16Array
   * (little-endian, range -32768 to 32767). Values are clamped before
   * conversion to guard against minor floating-point overshoot.
   *
   * @param float32 - Input samples.
   * @returns Equivalent PCM16 samples.
   */
  private float32ToPCM16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  /**
   * Encode an ArrayBuffer as a base64 string using the browser's native
   * `btoa` function. Iterates over raw bytes to build the binary string,
   * which avoids TextDecoder/TextEncoder dependency.
   *
   * @param buffer - Raw binary data.
   * @returns Base64-encoded string.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
