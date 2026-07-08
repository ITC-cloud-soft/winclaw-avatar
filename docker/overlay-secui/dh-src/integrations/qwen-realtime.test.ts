/**
 * @file qwen-realtime.test.ts
 * @description Unit tests for Qwen 3.5 realtime function-calling additions.
 *
 * These tests mock the underlying WebSocket via `QwenRealtimeClient`'s
 * internal state so we can exercise the public function-calling surface
 * without opening a real DashScope connection.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  QwenRealtimeClient,
  type QwenFunctionCall,
  type QwenToolDefinition,
} from "./qwen-realtime.js";
import {
  DEFAULT_VOICE,
  QWEN_VOICES,
  QWEN_VOICE_CATALOG,
  findVoice,
} from "./qwen-voices.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a `QwenRealtimeClient` with a mocked WebSocket. All `send()` calls
 * are captured on `sent` for assertion.
 */
function makeClient(opts: { callbacks?: ConstructorParameters<typeof QwenRealtimeClient>[1] } = {}) {
  const client = new QwenRealtimeClient(
    { apiKey: "test-key" },
    opts.callbacks,
    "system-prompt"
  );

  const sent: unknown[] = [];
  // Fake WebSocket with readyState=OPEN (1). See `_sendMessage` guard.
  const fakeWs = {
    readyState: 1,
    send: (data: string) => {
      sent.push(JSON.parse(data));
    },
    close: () => {},
  };

  // Poke private state — required because we cannot establish a real socket.
  // Tests are explicit and this is the cleanest route that avoids a network.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._ws = fakeWs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._isConnected = true;

  return { client, sent };
}

const SAMPLE_TOOL: QwenToolDefinition = {
  type: "function",
  name: "memory_search",
  description: "Search memory",
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
};

// ---------------------------------------------------------------------------
// Voice catalog
// ---------------------------------------------------------------------------

describe("qwen-voices catalog", () => {
  it("defaults to Serena", () => {
    expect(DEFAULT_VOICE).toBe("Serena");
  });

  it("includes all documented zh voices", () => {
    const zhIds = QWEN_VOICE_CATALOG.zh.map((v) => v.id);
    for (const id of [
      "Cherry", "Serena", "Ethan", "Chelsie", "Aura", "Breeze",
      "Maple", "River", "Amber", "Cove", "Sage", "Willow",
    ]) {
      expect(zhIds).toContain(id);
    }
  });

  it("includes all documented en voices", () => {
    const enIds = QWEN_VOICE_CATALOG.en.map((v) => v.id);
    for (const id of [
      "Aria", "Bella", "Claire", "Daniel", "Eric", "Frank",
      "Grace", "Henry", "Ivy", "Jack", "Kate", "Leo",
    ]) {
      expect(enIds).toContain(id);
    }
  });

  it("includes Luna as a multilingual voice", () => {
    const multiIds = QWEN_VOICE_CATALOG.multi.map((v) => v.id);
    expect(multiIds).toContain("Luna");
  });

  it("findVoice returns Serena descriptor", () => {
    const v = findVoice("Serena");
    expect(v).toBeDefined();
    expect(v?.language).toBe("zh");
  });

  it("no duplicate voice ids across the catalog", () => {
    const ids = QWEN_VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// setTools()
// ---------------------------------------------------------------------------

describe("QwenRealtimeClient.setTools()", () => {
  it("stores tools even when disconnected", () => {
    const client = new QwenRealtimeClient({ apiKey: "k" });
    client.setTools([SAMPLE_TOOL]);
    expect(client.tools).toHaveLength(1);
    expect(client.tools[0]).toEqual(SAMPLE_TOOL);
  });

  it("sends session.update with tools when connected", () => {
    const { client, sent } = makeClient();
    client.setTools([SAMPLE_TOOL]);
    expect(sent).toHaveLength(1);
    const msg = sent[0] as { type: string; session: { tools: unknown[] } };
    expect(msg.type).toBe("session.update");
    expect(msg.session.tools).toEqual([SAMPLE_TOOL]);
  });
});

// ---------------------------------------------------------------------------
// sendFunctionResult()
// ---------------------------------------------------------------------------

describe("QwenRealtimeClient.sendFunctionResult()", () => {
  it("emits conversation.item.create + response.create with correct payload", async () => {
    const { client, sent } = makeClient();
    await client.sendFunctionResult("call-123", '{"status":"ok","value":42}');

    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "call-123",
        output: '{"status":"ok","value":42}',
      },
    });
    expect(sent[1]).toEqual({ type: "response.create" });
  });
});

// ---------------------------------------------------------------------------
// sendSystemEvent()
// ---------------------------------------------------------------------------

describe("QwenRealtimeClient.sendSystemEvent()", () => {
  it("inserts a system message and triggers a response", async () => {
    const { client, sent } = makeClient();
    await client.sendSystemEvent("[OWNER NOTIFICATION] test");

    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: "[OWNER NOTIFICATION] test" }],
      },
    });
    expect(sent[1]).toEqual({ type: "response.create" });
  });
});

// ---------------------------------------------------------------------------
// createResponse()
// ---------------------------------------------------------------------------

describe("QwenRealtimeClient.createResponse()", () => {
  it("sends a lone response.create", async () => {
    const { client, sent } = makeClient();
    await client.createResponse();
    expect(sent).toEqual([{ type: "response.create" }]);
  });
});

// ---------------------------------------------------------------------------
// response.function_call_arguments.done dispatch
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Manual keep-alive ping loop
// ---------------------------------------------------------------------------

describe("QwenRealtimeClient ping loop", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a ping interval on _onOpen and clears it on _onClose", () => {
    vi.useFakeTimers();
    const client = new QwenRealtimeClient({ apiKey: "k" }, undefined, "sys");

    const ping = vi.fn();
    // readyState OPEN === 1
    const fakeWs = {
      readyState: 1,
      send: () => {},
      close: () => {},
      ping,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._ws = fakeWs;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._onOpen(fakeWs);

    // Ping loop is armed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any)._pingTimer).not.toBeNull();

    // After 20s we should see one ping, after 40s two pings.
    vi.advanceTimersByTime(20_000);
    expect(ping).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20_000);
    expect(ping).toHaveBeenCalledTimes(2);

    // Close clears the timer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._onClose(1000, "bye");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any)._pingTimer).toBeNull();

    // No further pings after close.
    vi.advanceTimersByTime(60_000);
    expect(ping).toHaveBeenCalledTimes(2);
  });
});

describe("function_call event dispatch", () => {
  it("fires onFunctionCall callback with parsed QwenFunctionCall", () => {
    const onFunctionCall = vi.fn();
    const { client } = makeClient({ callbacks: { onFunctionCall } });

    // Inject a server event through the private handler.
    const raw = JSON.stringify({
      type: "response.function_call_arguments.done",
      call_id: "call-xyz",
      name: "memory_search",
      arguments: '{"query":"hello"}',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._onMessage(Buffer.from(raw));

    expect(onFunctionCall).toHaveBeenCalledTimes(1);
    const call: QwenFunctionCall = onFunctionCall.mock.calls[0][0];
    expect(call.callId).toBe("call-xyz");
    expect(call.name).toBe("memory_search");
    expect(call.argumentsJson).toBe('{"query":"hello"}');
  });

  it("also emits the `functionCall` EventEmitter event", () => {
    const { client } = makeClient();
    const listener = vi.fn();
    client.on("functionCall", listener);

    const raw = JSON.stringify({
      type: "response.function_call_arguments.done",
      call_id: "c1",
      name: "task_run",
      arguments: "{}",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._onMessage(Buffer.from(raw));

    expect(listener).toHaveBeenCalledWith({
      callId: "c1",
      name: "task_run",
      argumentsJson: "{}",
    });
  });
});
