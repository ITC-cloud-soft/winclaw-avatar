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
  /**
   * 読み上げ言語ヒント(zh/ja/en/ko…)。**発音の正本**。qwen3-omni-flash は
   * 共有漢字(大丈夫・本当…)を system prompt の言語文脈に引きずられて読む傾向があり、
   * 既定の中国語 system prompt だと日本語文の漢字を中国語読み(大丈夫→dazhangfu)して
   * しまう。language を渡すとその言語の朗読 system prompt を使い、正しい発音へ寄せる。
   */
  language?: string;
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

/** TTS system prompt(既定=中国語)。原様朗読を指示。 */
const TTS_SYSTEM_PROMPT =
  "你是一个语音朗读助手。请严格原样朗读用户提供的文字，" +
  "不要添加、修改、解释或扩展任何内容。只朗读，不回答。";

/**
 * 言語別の朗読 system prompt。**発音の正本**。qwen3-omni-flash は system prompt の
 * 言語に発音を引きずられるため、読む言語に合わせて切り替える。特に日本語:
 * 中国語 prompt のままだと共有漢字を中国語読み(大丈夫→dazhangfu)する事故が出る。
 */
const TTS_SYSTEM_PROMPT_BY_LANG: Record<string, string> = {
  zh: TTS_SYSTEM_PROMPT,
  ja:
    "あなたは日本語の音声読み上げアシスタントです。" +
    "ユーザーが渡したテキストを、正しい日本語の発音でそのまま読み上げてください。" +
    "漢字は必ず日本語の音読み・訓読みで読み、中国語(ピンイン)の発音は絶対に使わないでください。" +
    "例:「大丈夫」は「だいじょうぶ」、「本当」は「ほんとう」、「大変」は「たいへん」、" +
    "「今日」は「きょう」、「一緒」は「いっしょ」と読みます。" +
    "内容の追加・修正・説明はせず、読み上げるだけにしてください。返答はしないでください。",
  en:
    "You are a text-to-speech assistant. Read the user's text aloud exactly as given, " +
    "in natural English pronunciation. Do not add, modify, explain, or expand. " +
    "Only read; do not answer.",
  ko:
    "당신은 음성 낭독 도우미입니다. 사용자가 준 텍스트를 올바른 한국어 발음으로 " +
    "그대로 읽어 주세요. 내용을 추가·수정·설명하지 말고 읽기만 하세요.",
};

/** language ヒントから朗読 system prompt を選ぶ(未知/未指定は中国語既定)。 */
function ttsSystemPromptFor(language?: string): string {
  const l = (language || "").slice(0, 2).toLowerCase();
  return TTS_SYSTEM_PROMPT_BY_LANG[l] ?? TTS_SYSTEM_PROMPT;
}

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
      { role: "system", content: ttsSystemPromptFor(config.language) },
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
