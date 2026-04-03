/**
 * @fileoverview TTS via DashScope CosyVoice WebSocket streaming API.
 *
 * Uses cosyvoice-v1 for pure TTS. First-chunk latency <1s, 16kHz PCM16.
 * Protocol matches DashScope Python SDK exactly.
 */

import WebSocket from "ws";
import { randomUUID } from "crypto";

const DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/speech-synthesizer";

export interface TtsConfig {
  apiKey: string;
  voice?: string;
  model?: string;
}

export type TtsAudioCallback = (pcm: Buffer, sampleRate: number) => void;

export const TTS_VOICES: Array<{ id: string; label: string }> = [
  { id: "longxiaochun", label: "小春·温柔" },
  { id: "longxiaoxia", label: "小夏·活泼" },
  { id: "longxiaoqian", label: "小芊·知性" },
  { id: "longwan", label: "小婉·优雅" },
  { id: "longyue", label: "小悦·甜美" },
  { id: "longtong", label: "小彤·自然" },
  { id: "longxiaobai", label: "小白·沉稳" },
  { id: "longshu", label: "书生·儒雅" },
  { id: "longshuo", label: "小硕·清朗" },
  { id: "longlaotie", label: "老铁·浑厚" },
  { id: "longjielidou", label: "杰力豆·童声" },
  { id: "loongstella", label: "Stella·EN♀" },
  { id: "loongbella", label: "Bella·EN♀" },
];

export async function synthesizeSpeech(
  text: string,
  config: TtsConfig,
  onAudio: TtsAudioCallback,
): Promise<void> {
  const model = config.model ?? "cosyvoice-v1";
  const voice = config.voice ?? "longxiaochun";
  const sampleRate = 16_000;
  const taskId = randomUUID().replace(/-/g, "");

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(DASHSCOPE_WS_URL, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    let totalBytes = 0;
    let settled = false;
    let startedOk = false;
    const startTime = Date.now();

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      if (err) {
        console.error(`[TTS] Error: ${err.message}`);
        reject(err);
      } else {
        const elapsed = Date.now() - startTime;
        console.log(`[TTS] Done: ${totalBytes} bytes (${(totalBytes / 2 / sampleRate).toFixed(1)}s audio, ${elapsed}ms wall)`);
        resolve();
      }
    };

    const timer = setTimeout(() => finish(new Error("TTS timeout 30s")), 30_000);

    ws.on("open", () => {
      console.log(`[TTS] WS open, sending run-task + text: "${text.substring(0, 30)}..." voice=${voice}`);

      // run-task
      ws.send(JSON.stringify({
        header: { action: "run-task", task_id: taskId, streaming: "duplex" },
        payload: {
          model, task_group: "audio", task: "tts", function: "SpeechSynthesizer",
          input: {},
          parameters: { voice, volume: 50, text_type: "PlainText", sample_rate: sampleRate, rate: 1.0, format: "pcm", pitch: 1.0 },
        },
      }));

      // Send text immediately (don't wait for task-started)
      ws.send(JSON.stringify({
        header: { action: "continue-task", task_id: taskId, streaming: "duplex" },
        payload: { model, task_group: "audio", task: "tts", function: "SpeechSynthesizer", input: { text } },
      }));

      // Finish
      ws.send(JSON.stringify({
        header: { action: "finish-task", task_id: taskId, streaming: "duplex" },
        payload: { input: {} },
      }));
    });

    ws.on("message", (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      // All messages come as binary frames. Check if it's JSON (starts with '{')
      if (buf[0] === 0x7B) { // '{' character
        try {
          const msg = JSON.parse(buf.toString("utf-8")) as Record<string, unknown>;
          const header = msg.header as Record<string, unknown> | undefined;
          const event = header?.event as string | undefined;

          if (event === "task-started") {
            startedOk = true;
            console.log("[TTS] task-started");
          } else if (event === "task-finished") {
            clearTimeout(timer);
            finish();
          } else if (event === "task-failed") {
            clearTimeout(timer);
            const errMsg = (header?.error_message as string) ?? "TTS task failed";
            finish(new Error(errMsg));
          }
          // result-generated events are metadata, skip
        } catch {}
        return;
      }

      // Raw PCM audio
      totalBytes += buf.length;
      onAudio(buf, sampleRate);
    });

    ws.on("error", (err) => { clearTimeout(timer); finish(err); });
    ws.on("close", () => { clearTimeout(timer); if (!settled) finish(); });
  });
}
