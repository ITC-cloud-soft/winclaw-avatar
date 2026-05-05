#!/usr/bin/env npx tsx
/**
 * Probe: does Qwen 3.5-omni-flash-realtime accept video input frames?
 * Tries multiple known/candidate message types and reports what works.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=sk-xxx  npx tsx scripts/test-qwen35-video.ts
 */

import WebSocket from "ws";
import fs from "node:fs";

const API_KEY = process.env.DASHSCOPE_API_KEY;
if (!API_KEY) {
  console.error("DASHSCOPE_API_KEY required");
  process.exit(2);
}

const URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-flash-realtime";

// Create a tiny 2×2 red JPEG (ffmpeg-style minimal)
// Pre-encoded: base64 of a 16×16 solid-red JPEG ~ 800 bytes
// Using a simple red square via a known small JPEG for testing.
const RED_SQUARE_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJ" +
  "CAoICAcKDQoKCwwMDAwHCQ4PDQwOCwwMDP/bAEMBAgICAwMDBgMDBgwIBwgMDAwMDAwMDAwMDAwMDAwMDAwM" +
  "DAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP/AABEIABAAEAMBIgACEQEDEQH/xAAfAAABBQEBAQEB" +
  "AQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGR" +
  "oQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2" +
  "d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm" +
  "5+jp6vHy8/T19vf4+fr/2gAMAwEAAhEDEQA/AP3/AKKKKAP/2Q==";

async function tryFormat(label: string, buildVideoMsg: (frameB64: string) => object): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const events: string[] = [];
    let result = "?";
    let sessionReady = false;

    const finish = (r: string) => {
      result = r;
      try { ws.close(); } catch {}
      resolve(r);
    };

    const timer = setTimeout(() => finish(`timeout (last=${events.slice(-5).join(",")})`), 10000);

    ws.on("open", () => {
      // 1. session.update with modalities + transcription
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          voice: "Serena",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: { model: "gummy-realtime-v1" },
        },
      }));
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      const type = msg.type ?? "?";
      events.push(type);

      if (type === "session.updated" && !sessionReady) {
        sessionReady = true;
        // Send a short silence of PCM16 to satisfy "audio before video"
        // 1600 samples = 0.1s at 16kHz mono.
        const silence = Buffer.alloc(3200); // 1600 samples * 2 bytes
        ws.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: silence.toString("base64"),
        }));
        // Now send the video frame in the format under test
        setTimeout(() => {
          ws.send(JSON.stringify(buildVideoMsg(RED_SQUARE_JPEG_BASE64)));
          // Wait a bit for any error event, then finish
          setTimeout(() => {
            clearTimeout(timer);
            const errorEvt = events.includes("error");
            finish(errorEvt ? `❌ rejected (events=${events.slice(-5).join(",")})` : `✅ accepted (no error, events=${events.slice(-5).join(",")})`);
          }, 3000);
        }, 300);
      }

      if (type === "error") {
        const m = msg.error?.message ?? JSON.stringify(msg.error ?? {});
        events.push(`err:${m.slice(0, 100)}`);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      finish(`connection error: ${err.message}`);
    });

    ws.on("close", () => {
      if (result === "?") finish(`closed (events=${events.slice(-5).join(",")})`);
    });
  });
}

const FORMATS: Array<[string, (b64: string) => object]> = [
  ["input_audio_buffer.append_video", (b64) => ({
    type: "input_audio_buffer.append_video",
    video: b64,
  })],
  ["input_video_buffer.append", (b64) => ({
    type: "input_video_buffer.append",
    video: b64,
  })],
  ["input_image_buffer.append", (b64) => ({
    type: "input_image_buffer.append",
    image: b64,
  })],
  ["conversation.item.create (image role=user)", (b64) => ({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_image", image: b64 }],
    },
  })],
  ["conversation.item.create (image_url)", (b64) => ({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "image", image_url: `data:image/jpeg;base64,${b64}` }],
    },
  })],
];

(async () => {
  console.log(`Testing Qwen 3.5 video input formats...\n`);
  for (const [label, fn] of FORMATS) {
    process.stdout.write(`  ${label.padEnd(45)} `);
    const r = await tryFormat(label, fn);
    console.log(r);
    await new Promise(r => setTimeout(r, 500));
  }
})();
