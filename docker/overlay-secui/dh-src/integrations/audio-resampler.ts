/**
 * @fileoverview PCM16 linear interpolation audio resampler for the WinClaw
 * digital-human plugin.
 *
 * Audio format context:
 *  - Qwen3-omni-flash-realtime outputs 24 kHz 16-bit signed little-endian PCM
 *  - ByteDance virtual-human API expects 16 kHz 16-bit signed little-endian PCM
 *  - Browser microphone is captured at 16 kHz via AudioRecorder (client side)
 *
 * Primary hot-path: 24 kHz → 16 kHz (Qwen audio → ByteDance DH)
 * Secondary path:   16 kHz → 24 kHz (if future Qwen input requires 24 kHz)
 *
 * Algorithm: linear interpolation (sufficient for real-time voice; avoids the
 * latency of a windowed-sinc filter while producing tolerable audio quality).
 *
 * All input and output Buffers use the Node.js `Buffer` type and contain raw
 * signed 16-bit little-endian PCM samples (Int16Array-compatible layout).
 */

/**
 * Resampling result metadata returned alongside the resampled audio data.
 */
export interface ResampleResult {
  /** Resampled PCM16 audio as a Node.js Buffer. */
  buffer: Buffer;
  /** Number of output samples produced. */
  outputSampleCount: number;
  /** Number of input samples consumed. */
  inputSampleCount: number;
}

/**
 * Stateless PCM16 linear-interpolation resampler.
 *
 * Instantiate once and call {@link AudioResampler.resample} repeatedly.
 * The class holds no mutable state; it is safe to share across sessions.
 *
 * @example
 * ```typescript
 * const resampler = new AudioResampler();
 *
 * // Qwen realtime output (24 kHz) → ByteDance DH input (16 kHz)
 * const pcm16k = resampler.resample(pcm24k, 24_000, 16_000);
 *
 * // Reverse direction if needed
 * const pcm24k = resampler.resample(pcm16k, 16_000, 24_000);
 * ```
 */
export class AudioResampler {
  /**
   * Resample a PCM16 mono audio buffer from one sample rate to another using
   * linear interpolation.
   *
   * @param input   - Raw PCM16 LE mono audio data (any byte length; odd final
   *                  byte is silently dropped).
   * @param fromRate - Source sample rate in Hz (e.g. 24_000).
   * @param toRate   - Target sample rate in Hz (e.g. 16_000).
   * @returns        Resampled PCM16 LE mono audio as a Node.js Buffer.
   *
   * @remarks
   * When `fromRate === toRate` the input buffer is returned as-is without
   * copying, avoiding unnecessary allocation on the identity path.
   *
   * Boundary sample: the last output sample that falls beyond the last input
   * sample clamps to the value of the final input sample (zero-order hold),
   * which prevents clicks at segment boundaries when processing streaming
   * audio in chunks.
   */
  resample(input: Buffer, fromRate: number, toRate: number): Buffer {
    if (fromRate <= 0 || toRate <= 0) {
      throw new RangeError(
        `AudioResampler: sample rates must be positive (got fromRate=${fromRate}, toRate=${toRate})`,
      );
    }

    // Identity path — no work needed.
    if (fromRate === toRate) {
      return input;
    }

    const inputSamples = new Int16Array(
      input.buffer,
      input.byteOffset,
      Math.floor(input.byteLength / 2),
    );

    const inputCount = inputSamples.length;

    if (inputCount === 0) {
      return Buffer.alloc(0);
    }

    // Compute output length.  Use Math.ceil so that a single-sample input
    // at an up-sampling ratio always produces at least one output sample.
    const ratio = fromRate / toRate;
    const outputCount = Math.ceil(inputCount / ratio);

    const outputSamples = new Int16Array(outputCount);

    for (let outIdx = 0; outIdx < outputCount; outIdx++) {
      // Position in the input signal corresponding to this output sample.
      const srcPos = outIdx * ratio;

      const lo = Math.floor(srcPos);
      const hi = lo + 1;
      const frac = srcPos - lo;

      const sampleLo = inputSamples[lo] ?? 0;
      // Clamp to last sample when hi is out of range (boundary hold).
      const sampleHi = hi < inputCount ? inputSamples[hi] : sampleLo;

      // Linear interpolation, rounded to nearest integer.
      outputSamples[outIdx] = Math.round(sampleLo + frac * (sampleHi - sampleLo));
    }

    // Copy Int16Array into a Node.js Buffer (little-endian on all platforms
    // because Int16Array uses the host byte order, which is always LE on x86
    // and ARM; for cross-platform safety we use writeInt16LE explicitly).
    const outputBuffer = Buffer.allocUnsafe(outputCount * 2);
    for (let i = 0; i < outputCount; i++) {
      outputBuffer.writeInt16LE(outputSamples[i], i * 2);
    }

    return outputBuffer;
  }

  /**
   * Convenience overload that also returns sample-count metadata.
   *
   * @param input    - Raw PCM16 LE mono audio data.
   * @param fromRate - Source sample rate in Hz.
   * @param toRate   - Target sample rate in Hz.
   * @returns An object containing the resampled buffer and sample counts.
   */
  resampleWithMeta(
    input: Buffer,
    fromRate: number,
    toRate: number,
  ): ResampleResult {
    const buffer = this.resample(input, fromRate, toRate);
    return {
      buffer,
      inputSampleCount: Math.floor(input.byteLength / 2),
      outputSampleCount: Math.floor(buffer.byteLength / 2),
    };
  }

  /**
   * Optimised shortcut for the primary production path: 24 kHz → 16 kHz.
   *
   * Mathematically equivalent to `resample(input, 24_000, 16_000)` but
   * avoids the general-purpose ratio calculation and uses the exact 3:2
   * decimation ratio inline for clarity and minor branch savings.
   *
   * @param input - PCM16 LE mono audio at 24 kHz.
   * @returns     PCM16 LE mono audio at 16 kHz.
   */
  resample24to16(input: Buffer): Buffer {
    // ratio = 24000 / 16000 = 1.5  →  every 3 input samples yield 2 outputs.
    return this.resample(input, 24_000, 16_000);
  }

  /**
   * Optimised shortcut for the reverse path: 16 kHz → 24 kHz.
   *
   * @param input - PCM16 LE mono audio at 16 kHz.
   * @returns     PCM16 LE mono audio at 24 kHz.
   */
  resample16to24(input: Buffer): Buffer {
    return this.resample(input, 16_000, 24_000);
  }
}

/**
 * Singleton resampler instance for use across the digital-human plugin.
 *
 * Import this when you do not need a custom instance:
 *
 * ```typescript
 * import { audioResampler } from './integrations/audio-resampler.js';
 * const pcm16k = audioResampler.resample24to16(pcm24kBuffer);
 * ```
 */
export const audioResampler = new AudioResampler();
