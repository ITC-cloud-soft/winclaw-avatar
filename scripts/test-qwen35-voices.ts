#!/usr/bin/env npx tsx
/**
 * Probe which voices are supported on qwen3.5-omni-flash-realtime.
 * Sends a session.update with each candidate voice and records the first
 * error (if any) from Qwen.
 */
import WebSocket from "ws";

const API_KEY = process.env.DASHSCOPE_API_KEY;
if (!API_KEY) {
  console.error("ERROR: DASHSCOPE_API_KEY required");
  process.exit(2);
}

// Full catalog that had been claimed supported on 3.5-realtime
const VOICES = [
  "Cherry", "Serena", "Ethan", "Chelsie", "Aura", "Breeze",
  "Maple", "River", "Amber", "Cove", "Sage", "Willow",
  // English
  "Aria", "Bella", "Claire", "Daniel", "Eric", "Frank",
  "Grace", "Henry", "Ivy", "Jack", "Kate", "Leo",
  // Multilingual
  "Luna",
  // Legacy (3.0) names — probably unsupported on 3.5
  "Tina", "Chelsey",
];

async function testVoice(voice: string): Promise<"ok" | "unsupported" | "error"> {
  return new Promise((resolve) => {
    const ws = new WebSocket(
      `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-flash-realtime`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    let done = false;
    const finish = (r: "ok" | "unsupported" | "error") => {
      if (done) return;
      done = true;
      try { ws.close(); } catch {}
      resolve(r);
    };

    const timer = setTimeout(() => finish("error"), 8000);

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          voice,
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
        },
      }));
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "session.updated") {
        clearTimeout(timer);
        finish("ok");
      } else if (msg.type === "error") {
        const m = msg.error?.message ?? "";
        clearTimeout(timer);
        finish(m.includes("not supported") || m.includes("Voice") ? "unsupported" : "error");
      }
    });

    ws.on("error", () => { clearTimeout(timer); finish("error"); });
    ws.on("close", (code) => {
      if (!done) {
        clearTimeout(timer);
        finish(code === 1000 ? "ok" : "error");
      }
    });
  });
}

(async () => {
  console.log(`Probing ${VOICES.length} voices on qwen3.5-omni-flash-realtime...\n`);
  const results: Record<string, string> = {};
  for (const v of VOICES) {
    process.stdout.write(`  ${v.padEnd(12)} `);
    const r = await testVoice(v);
    results[v] = r;
    console.log(r === "ok" ? "✅" : r === "unsupported" ? "❌ unsupported" : "⚠️ error");
    await new Promise(r => setTimeout(r, 300)); // rate-limit friendly
  }
  console.log("\n=== Summary ===");
  console.log("Supported: " + Object.entries(results).filter(([,r]) => r === "ok").map(([v]) => v).join(", "));
  console.log("Unsupported: " + Object.entries(results).filter(([,r]) => r === "unsupported").map(([v]) => v).join(", "));
  console.log("Errors: " + Object.entries(results).filter(([,r]) => r === "error").map(([v]) => v).join(", "));
})();
