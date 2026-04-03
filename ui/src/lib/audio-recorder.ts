/**
 * AudioRecorder – captures microphone audio for real-time voice chat.
 *
 * Pipeline:
 *   getUserMedia → ScriptProcessorNode → downsample to 16 kHz
 *   → Float32 to PCM16 (Int16) → Base64 → callback
 *
 * Compatible with Qwen Omni API (PCM_16000HZ_MONO_16BIT).
 */

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _isRecording = false;
  private _isMuted = false;

  private readonly targetSampleRate = 16000;
  private readonly bufferSize = 4096;

  private readonly onAudioData: (base64Audio: string) => void;

  /**
   * @param onAudioData Callback receiving base64-encoded PCM16 audio chunks.
   *   Each chunk is approximately (bufferSize / nativeSampleRate * 1000) ms
   *   of audio at 16 kHz mono 16-bit little-endian.
   */
  constructor(onAudioData: (base64Audio: string) => void) {
    this.onAudioData = onAudioData;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  /**
   * Request microphone access and start the recording pipeline.
   * Throws if getUserMedia is unavailable or permission is denied.
   */
  async start(): Promise<void> {
    if (this._isRecording) {
      console.warn('[AudioRecorder] Already recording');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        '[AudioRecorder] Microphone requires a secure context (HTTPS or localhost).'
      );
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: this.targetSampleRate },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // webkitAudioContext fallback for older Safari
      const AudioCtx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.audioContext = new AudioCtx();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessorNode is deprecated but still the most broadly
      // supported way to get raw PCM samples in all browsers.
      // AudioWorklet is the modern alternative, but requires a separate
      // worklet file (not convenient for a self-contained module).
      this.processorNode = this.audioContext.createScriptProcessor(
        this.bufferSize,
        1, // input channels
        1  // output channels
      );

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        // CRITICAL: Zero the output buffer so the captured mic audio is
        // not fed back to the speakers / destination, which would cause
        // an audible echo. The node must be connected to destination for
        // onaudioprocess to fire, but we never want to hear the raw mic.
        event.outputBuffer.getChannelData(0).fill(0);

        if (!this._isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const nativeRate = this.audioContext!.sampleRate;

        const downsampled = this.downsample(inputData, nativeRate, this.targetSampleRate);
        if (downsampled.length === 0) return;

        const pcm16 = this.float32ToPCM16(downsampled);
        const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);

        this.onAudioData(base64);
      };

      // Connect: mic → processor → destination
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this._isRecording = true;
      console.log(
        `[AudioRecorder] Started: native=${this.audioContext.sampleRate} Hz → target=${this.targetSampleRate} Hz, buffer=${this.bufferSize}`
      );
    } catch (error) {
      console.error('[AudioRecorder] Failed to start:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and release all browser resources (mic track, AudioContext).
   */
  stop(): void {
    if (!this._isRecording) return;
    this._isRecording = false;
    this.cleanup();
    console.log('[AudioRecorder] Stopped');
  }

  /**
   * Mute or unmute the microphone track without tearing down the pipeline.
   * When muted the mic track is disabled (sends silence), so the processor
   * callback still fires but produces flat zero samples.
   */
  setMuted(muted: boolean): void {
    this._isMuted = muted;
    if (this.mediaStream) {
      for (const track of this.mediaStream.getAudioTracks()) {
        track.enabled = !muted;
      }
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
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
  }

  /**
   * Downsample a Float32Array from `fromRate` Hz to `toRate` Hz using
   * simple averaging (box filter). Produces correct results even when
   * `fromRate` is not an integer multiple of `toRate`.
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
   * Convert Float32Array (range -1.0 … +1.0) to Int16Array (PCM16 LE).
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
   * Encode an ArrayBuffer to a base64 string using btoa().
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

export default AudioRecorder;
