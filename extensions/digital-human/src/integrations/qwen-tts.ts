/**
 * @fileoverview TTS via qwen3-omni-flash HTTP streaming API.
 *
 * Uses the OpenAI-compatible endpoint with `modalities: ["text", "audio"]`
 * and `stream: true`. Outputs 24kHz WAV audio chunks which are decoded to
 * raw PCM16 before passing to the callback.
 *
 * Replaces the previous CosyVoice WebSocket implementation to gain:
 *   - 55 voice presets (Cherry, Tina, Serena, Ethan, etc.)
 *   - Native multilingual TTS (Chinese, Japanese, English, Korean, …)
 *   - ~1s first-chunk latency with streaming
 */

import https from "https";

const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export interface TtsConfig {
  apiKey: string;
  voice?: string;
  model?: string;
}

export type TtsAudioCallback = (pcm: Buffer, sampleRate: number) => void;

/** Qwen3-omni-flash supported voices (subset — 55 total). */
export const TTS_VOICES: Array<{ id: string; label: string }> = [
  // Chinese Female
  { id: "Cherry", label: "Cherry·甜美♀" },
  { id: "Tina", label: "Tina·温柔♀" },
  { id: "Cindy", label: "Cindy·活泼♀" },
  { id: "Serena", label: "Serena·知性♀" },
  // Chinese Male
  { id: "Ethan", label: "Ethan·沉稳♂" },
  { id: "Chelsie", label: "Chelsie·清朗♂" },
  // English
  { id: "Stella", label: "Stella·EN♀" },
  { id: "Bella", label: "Bella·EN♀" },
];

/** TTS system prompt — instructs the model to read text verbatim. */
const TTS_SYSTEM_PROMPT =
  "你是一个语音朗读助手。请严格原样朗读用户提供的文字，" +
  "不要添加、修改、解释或扩展任何内容。只朗读，不回答。";

/**
 * Synthesize speech from text using qwen3-omni-flash streaming API.
 *
 * Audio arrives as base64-encoded WAV chunks in SSE delta events.
 * Each chunk is decoded and the raw PCM16 payload (skipping WAV headers)
 * is forwarded to `onAudio` at 24 kHz sample rate.
 *
 * @param text     Text to synthesize.
 * @param config   API key, voice, and optional model override.
 * @param onAudio  Callback receiving PCM16 buffers at 24 kHz.
 */
export async function synthesizeSpeech(
  text: string,
  config: TtsConfig,
  onAudio: TtsAudioCallback,
): Promise<void> {
  const model = config.model ?? "qwen3-omni-flash";
  const voice = config.voice ?? "Serena";
  const OUTPUT_SAMPLE_RATE = 24_000;

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: TTS_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    stream: true,
    stream_options: { include_usage: true },
    modalities: ["text", "audio"],
    audio: { voice, format: "wav" },
    enable_thinking: false,
  });

  const startTime = Date.now();
  let totalAudioBytes = 0;
  let audioChunks = 0;
  let firstChunkMs = 0;

  return new Promise<void>((resolve, reject) => {
    const url = new URL(DASHSCOPE_URL);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
      (res) => {
        let sseBuffer = "";

        res.on("data", (chunk: Buffer) => {
          sseBuffer += chunk.toString();

          // Process complete SSE lines
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || ""; // keep incomplete last line

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;

            try {
              const obj = JSON.parse(json);
              const delta = obj.choices?.[0]?.delta;

              // Audio data chunk
              if (delta?.audio?.data) {
                const b64 = delta.audio.data as string;
                const wavBuf = Buffer.from(b64, "base64");

                // Extract raw PCM from WAV: skip header on ANY chunk that starts
                // with "RIFF" (the API may embed headers in multiple chunks).
                let pcm: Buffer;
                if (wavBuf.length > 44 && wavBuf.toString("ascii", 0, 4) === "RIFF") {
                  pcm = wavBuf.subarray(44);
                } else {
                  pcm = wavBuf;
                }
                if (audioChunks === 0) firstChunkMs = Date.now() - startTime;

                if (pcm.length > 0) {
                  audioChunks++;
                  totalAudioBytes += pcm.length;
                  onAudio(pcm, OUTPUT_SAMPLE_RATE);
                }
              }

              // Check for errors
              if (obj.error) {
                reject(new Error(`TTS API error: ${obj.error.message || JSON.stringify(obj.error)}`));
                return;
              }
            } catch {
              // Ignore parse errors for malformed SSE lines
            }
          }
        });

        res.on("end", () => {
          const elapsed = Date.now() - startTime;
          const durationSec = totalAudioBytes / (OUTPUT_SAMPLE_RATE * 2); // 16-bit = 2 bytes/sample
          console.log(
            `[TTS] Done: ${totalAudioBytes} bytes (${durationSec.toFixed(1)}s audio, ` +
            `${audioChunks} chunks, first@${firstChunkMs}ms, wall=${elapsed}ms) voice=${voice}`
          );
          resolve();
        });

        res.on("error", (err) => {
          reject(new Error(`TTS stream error: ${err.message}`));
        });
      }
    );

    req.on("error", (err) => {
      reject(new Error(`TTS request error: ${err.message}`));
    });

    req.setTimeout(30_000, () => {
      req.destroy();
      reject(new Error("TTS timeout 30s"));
    });

    console.log(`[TTS] Sending qwen3-omni-flash TTS: "${text.substring(0, 40)}..." voice=${voice}`);
    req.write(body);
    req.end();
  });
}
