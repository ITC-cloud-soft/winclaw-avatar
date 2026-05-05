#!/usr/bin/env npx tsx
/**
 * Standalone test: Qwen 3.5-omni-flash-realtime Function Calling
 *
 * Purpose: Verify that Qwen actually fires function_call events when given
 * tools — bypassing the entire winclaw-avatar DH pipeline.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=sk-xxx  npx tsx scripts/test-qwen35-fc.ts
 *
 * What it does:
 *   1. Connect to Qwen 3.5-omni-flash-realtime via WebSocket
 *   2. Send session.update with a single tool `get_weather(city)`
 *   3. Send text message "今天东京天气怎么样？"
 *   4. Log EVERY event received from Qwen (raw JSON)
 *   5. Assert: expect `response.function_call_arguments.done` with name=get_weather
 *
 * Exit codes:
 *   0 — function_call fired successfully
 *   1 — tool was NOT called (Qwen answered from own knowledge instead)
 *   2 — connection / protocol error
 */

import WebSocket from "ws";

const API_KEY = process.env.DASHSCOPE_API_KEY;
if (!API_KEY) {
  console.error("ERROR: DASHSCOPE_API_KEY env var required");
  process.exit(2);
}

const MODEL = "qwen3.5-omni-flash-realtime";
const URL = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${MODEL}`;

const WEATHER_TOOL = {
  type: "function",
  name: "get_weather",
  description:
    "Get current weather for a specific city. MUST be called whenever the " +
    "user asks about the weather. Do NOT answer from memory or knowledge — " +
    "this tool is the only source of weather data.",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "City name in the user's language (e.g. 东京, Tokyo, 東京)",
      },
    },
    required: ["city"],
  },
};

const INSTRUCTIONS = [
  "You are a voice assistant. Keep responses under 2 sentences.",
  "",
  "[TOOLS]",
  "  get_weather(city) — Get current weather. MUST be used for ANY weather question.",
  "",
  "[DECISION]",
  "When the user asks about weather (天気/天气/weather), you MUST call get_weather.",
  "Do NOT answer from your own knowledge. Do NOT say '分かりません' without trying the tool first.",
].join("\n");

const TEST_PROMPT = "今天东京天气怎么样？";

let functionCalled = false;
let responseComplete = false;
const events: string[] = [];

const ws = new WebSocket(URL, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});

const timeout = setTimeout(() => {
  console.error("\n⏰ TIMEOUT — no response within 30s");
  printSummary();
  process.exit(2);
}, 30_000);

ws.on("open", () => {
  console.log(`✅ Connected to ${URL}\n`);

  // Send session.update with tool + instructions in ONE message (like Python ref)
  const sessionUpdate = {
    type: "session.update",
    session: {
      modalities: ["text"], // text-only for this test — no audio decoding needed
      instructions: INSTRUCTIONS,
      tools: [WEATHER_TOOL],
      input_audio_transcription: null,
      turn_detection: null, // manual mode — we control when to create responses
    },
  };
  console.log("📤 session.update with tools:");
  console.log(JSON.stringify(sessionUpdate, null, 2).slice(0, 600));
  console.log();
  ws.send(JSON.stringify(sessionUpdate));

  // Wait a moment for the update to be applied, then send user message
  setTimeout(() => {
    const userMsg = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: TEST_PROMPT }],
      },
    };
    console.log(`📤 User message: "${TEST_PROMPT}"`);
    ws.send(JSON.stringify(userMsg));

    ws.send(JSON.stringify({ type: "response.create" }));
    console.log("📤 response.create\n");
  }, 500);
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  const type = msg.type ?? "?";
  events.push(type);

  // Concise event log
  let detail = "";
  if (type === "response.audio_transcript.delta" || type === "response.text.delta") {
    detail = ` delta="${(msg.delta ?? "").slice(0, 60)}"`;
  } else if (type === "response.audio_transcript.done" || type === "response.text.done") {
    detail = ` text="${(msg.transcript ?? msg.text ?? "").slice(0, 120)}"`;
  } else if (type === "response.function_call_arguments.done") {
    functionCalled = true;
    detail = ` 🎯 name=${msg.name} call_id=${msg.call_id} args=${msg.arguments}`;
  } else if (type === "response.function_call_arguments.delta") {
    detail = ` delta=${msg.delta}`;
  } else if (type === "error") {
    detail = ` ⚠️ ${JSON.stringify(msg.error)}`;
  } else if (type === "session.created" || type === "session.updated") {
    const s = msg.session ?? {};
    detail = ` tools=${(s.tools ?? []).map((t: any) => t.name).join(",") || "(none)"}`;
  } else if (type === "response.done") {
    responseComplete = true;
  }

  console.log(`📥 ${type}${detail}`);

  if (responseComplete) {
    setTimeout(finish, 500);
  }
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
  clearTimeout(timeout);
  process.exit(2);
});

ws.on("close", (code, reason) => {
  console.log(`\n🔌 Connection closed: code=${code} reason=${reason.toString()}`);
  clearTimeout(timeout);
  if (!responseComplete) {
    printSummary();
    process.exit(2);
  }
});

function finish() {
  clearTimeout(timeout);
  printSummary();
  ws.close();
  process.exit(functionCalled ? 0 : 1);
}

function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Prompt: "${TEST_PROMPT}"`);
  console.log(`Tool registered: get_weather`);
  console.log(`Events received: ${events.length}`);
  console.log(`Event types: ${[...new Set(events)].join(", ")}`);
  console.log();
  if (functionCalled) {
    console.log("✅ PASS: Qwen called get_weather tool");
    console.log("   → Qwen 3.5 function calling WORKS");
    console.log("   → Problem is in winclaw-avatar integration layer (instructions, timing, or schema)");
  } else {
    console.log("❌ FAIL: Qwen did NOT call get_weather tool");
    console.log("   → Either Qwen 3.5 doesn't support function calling in this account/model");
    console.log("   → Or the tool schema is being rejected");
    console.log("   → Or the model is too weak to follow instructions");
  }
  console.log("=".repeat(60));
}
