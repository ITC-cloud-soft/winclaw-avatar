/**
 * @file notify-bridge.test.ts
 * @description Unit tests for {@link NotifyBridge}. Uses a bare EventEmitter as
 * the winclawBus and a hand-rolled stub of QwenRealtimeClient so the tests
 * neither hit the network nor depend on ws.
 */

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotifyBridge, type NotifyBridgeOptions } from "./notify-bridge.js";
import type { QwenRealtimeClient } from "./integrations/qwen-realtime.js";

// ---------------------------------------------------------------------------
// Test stubs
// ---------------------------------------------------------------------------

/**
 * Minimal QwenRealtimeClient-compatible stub. NotifyBridge only uses `.on()`,
 * `.off()` and `.sendSystemEvent()`, so we extend EventEmitter and add the
 * one async method.
 */
class FakeQwen extends EventEmitter {
  sendSystemEvent = vi.fn<(text: string) => Promise<void>>(async () => {
    /* noop */
  });
}

function makeBridge(
  overrides: Partial<NotifyBridgeOptions> = {}
): { bridge: NotifyBridge; qwen: FakeQwen; bus: EventEmitter } {
  const qwen = new FakeQwen();
  const bus = new EventEmitter();
  const bridge = new NotifyBridge({
    qwenClient: qwen as unknown as QwenRealtimeClient,
    winclawBus: bus,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    ...overrides,
  });
  return { bridge, qwen, bus };
}

// Small helper to wait out the microtask queue (NotifyBridge flushes via
// `void this._flush()` — a macrotask tick settles all pending awaits).
const flushMicrotasks = (): Promise<void> =>
  new Promise((r) => setImmediate(r));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotifyBridge", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("high-priority items are injected immediately", async () => {
    const { bridge, qwen } = makeBridge();
    bridge.push({ priority: "high", summary: "URGENT: test" });
    await flushMicrotasks();

    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("OWNER NOTIFICATION");
    expect(text).toContain("URGENT: test");
    expect(text).toContain("priority=high");
  });

  it("normal-priority items wait for responseDone when session is busy", async () => {
    const { bridge, qwen } = makeBridge();
    // Simulate an ongoing AI response.
    qwen.emit("responseStarted");

    bridge.push({ priority: "normal", summary: "new mail" });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).not.toHaveBeenCalled();

    // Session becomes idle — flush should fire.
    qwen.emit("responseDone");
    await flushMicrotasks();

    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("new mail");
  });

  it("normal-priority item flushes immediately when session is idle", async () => {
    const { bridge, qwen } = makeBridge();
    bridge.push({ priority: "normal", summary: "idle mail" });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
  });

  it("deduplicates items with same dedupKey inside the window", async () => {
    const { bridge, qwen } = makeBridge({ dedupWindowMs: 60_000 });
    bridge.push({ priority: "high", summary: "one", dedupKey: "k" });
    await flushMicrotasks();
    bridge.push({ priority: "high", summary: "two", dedupKey: "k" });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("one");
  });

  it("queue overflow drops low-priority first, keeps high-priority", async () => {
    // Keep session busy so queue actually accumulates.
    const { bridge, qwen } = makeBridge({ maxQueueSize: 3 });
    qwen.emit("responseStarted");

    // Fill with 3 low, then push 2 more normals — lows should be dropped.
    bridge.push({ priority: "low", summary: "low-1" });
    bridge.push({ priority: "low", summary: "low-2" });
    bridge.push({ priority: "low", summary: "low-3" });
    bridge.push({ priority: "normal", summary: "norm-1" });
    bridge.push({ priority: "normal", summary: "norm-2" });
    // Push one high — must be kept regardless of capacity.
    bridge.push({ priority: "high", summary: "high-1" });

    // high-1 is delivered immediately even while busy (per design).
    await flushMicrotasks();
    const highCalls = qwen.sendSystemEvent.mock.calls.filter((c) =>
      c[0].includes("high-1")
    );
    expect(highCalls.length).toBe(1);

    // Now drain: session goes idle repeatedly.
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      qwen.emit("responseDone");
      await flushMicrotasks();
    }
    for (const call of qwen.sendSystemEvent.mock.calls) {
      seen.push(call[0]);
    }

    // We expect the two normals to have survived, and at most one low.
    const normSeen = seen.filter((s) => s.includes("norm-")).length;
    const lowSeen = seen.filter((s) => s.includes("low-")).length;
    expect(normSeen).toBe(2);
    // At least one low must have been dropped (we submitted 3, capacity 3, plus
    // 2 normals which push lows out first).
    expect(lowSeen).toBeLessThanOrEqual(1);
  });

  it("dispose removes all listeners — later events do nothing", async () => {
    const { bridge, qwen, bus } = makeBridge();
    bridge.dispose();

    bus.emit("email.received", { from: "a@b", subject: "hi" });
    qwen.emit("responseDone");
    await flushMicrotasks();

    expect(qwen.sendSystemEvent).not.toHaveBeenCalled();
  });

  it("subscribes to email.received and sets source=email, priority=normal", async () => {
    const { qwen, bus } = makeBridge();
    bus.emit("email.received", { from: "alice", subject: "meeting" });
    await flushMicrotasks();

    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("source=email");
    expect(text).toContain("priority=normal");
    expect(text).toContain("alice");
    expect(text).toContain("meeting");
  });

  it("task.completed respects urgent flag → priority=high", async () => {
    const { qwen, bus } = makeBridge();
    // Keep session busy — only a high-priority item should still leak through.
    qwen.emit("responseStarted");

    bus.emit("task.completed", { name: "build", urgent: true });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("priority=high");
  });

  it("calendar.reminder <=5 min → high, otherwise normal", async () => {
    const { qwen, bus } = makeBridge();
    qwen.emit("responseStarted"); // busy

    bus.emit("calendar.reminder", { title: "standup", minutesUntil: 3 });
    bus.emit("calendar.reminder", { title: "lunch", minutesUntil: 30 });
    await flushMicrotasks();

    // Only the high one bypasses the busy gate.
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("standup");
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("priority=high");
  });

  it("channel.message with mention=true → priority=high", async () => {
    const { qwen, bus } = makeBridge();
    qwen.emit("responseStarted"); // busy
    bus.emit("channel.message", {
      channel: "general",
      sender: "bob",
      preview: "ping",
      mention: true,
    });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("priority=high");
  });

  it("pushFromChatEvent delivers a final chat event tagged as a notification", async () => {
    const { bridge, qwen } = makeBridge();
    bridge.pushFromChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "[NOTIFY] メールを受信しました" }],
        timestamp: Date.now(),
      },
    });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("メールを受信しました");
    // NOTIFY is a marker, not a priority → defaults to normal.
    expect(text).toContain("priority=normal");
    // The marker prefix itself must be stripped before reaching Qwen.
    expect(text).not.toMatch(/\[NOTIFY\]/);
  });

  it("pushFromChatEvent ignores delta events and untagged replies", async () => {
    const { bridge, qwen } = makeBridge();
    // Delta — ignored regardless of content.
    bridge.pushFromChatEvent({
      runId: "r2",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "[NOTIFY] x" }], timestamp: 1 },
    });
    // Final but no notification marker — ignored (regular agent reply).
    bridge.pushFromChatEvent({
      runId: "r3",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "普通の返事です" }], timestamp: 1 },
    });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).not.toHaveBeenCalled();
  });

  it("pushFromChatEvent parses [URGENT] / [HIGH] / [LOW] priority markers", async () => {
    const { bridge, qwen } = makeBridge();
    bridge.pushFromChatEvent({
      runId: "u1",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "[URGENT] サーバーが落ちました" }], timestamp: 1 },
    });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const urgentText = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(urgentText).toContain("priority=high");
    expect(urgentText).toContain("サーバーが落ちました");
    expect(urgentText).not.toMatch(/\[URGENT\]/);

    // LOW marker
    bridge.pushFromChatEvent({
      runId: "l1",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "[LOW] 低優先通知" }], timestamp: 1 },
    });
    // Low gets queued but session is idle, so it flushes.
    // Emit responseDone to drain normal+low slot.
    qwen.emit("responseDone");
    await flushMicrotasks();
    const lowCall = qwen.sendSystemEvent.mock.calls.find((c) =>
      c[0].includes("低優先通知"),
    );
    expect(lowCall).toBeTruthy();
    expect(lowCall![0]).toContain("priority=low");
  });

  it("pushFromChatEvent handles notify.dh-emitted events on a dh-notify:* sessionKey", async () => {
    const { bridge, qwen } = makeBridge();
    // Shape matches what src/gateway/server-methods/notify-dh.ts emits:
    // role=system + [HIGH]/[LOW]/[NOTIFY] marker + dedicated sessionKey.
    bridge.pushFromChatEvent({
      runId: "notify-1",
      sessionKey: "dh-notify:session-abc",
      seq: 0,
      state: "final",
      message: {
        role: "system",
        content: [{ type: "text", text: "[HIGH] 新着メール: 山田さんから会議" }],
        timestamp: Date.now(),
      },
    });
    await flushMicrotasks();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("priority=high");
    expect(text).toContain("新着メール: 山田さんから会議");
    expect(text).not.toMatch(/\[HIGH\]/);
  });

  it("pushFromChatEvent broadcast notify.dh event delivers to all subscribed bridges", async () => {
    // Two independent DH sessions; both receive the same broadcast payload.
    const a = makeBridge();
    const b = makeBridge();
    const broadcastPayload = {
      runId: "notify-bcast",
      sessionKey: "dh-notify:broadcast",
      seq: 0,
      state: "final" as const,
      message: {
        role: "system",
        content: [{ type: "text", text: "[NOTIFY] ビルド完了" }],
        timestamp: Date.now(),
      },
    };
    a.bridge.pushFromChatEvent(broadcastPayload);
    b.bridge.pushFromChatEvent(broadcastPayload);
    await flushMicrotasks();
    expect(a.qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(b.qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(a.qwen.sendSystemEvent.mock.calls[0]![0]).toContain("ビルド完了");
    expect(b.qwen.sendSystemEvent.mock.calls[0]![0]).toContain("ビルド完了");
  });

  it("sendSystemEvent text includes OWNER NOTIFICATION marker and summary", async () => {
    const { bridge, qwen } = makeBridge();
    bridge.push({
      priority: "high",
      summary: "hello world",
      source: "test",
      hintLanguage: "ja",
    });
    await flushMicrotasks();
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toMatch(/OWNER NOTIFICATION/);
    expect(text).toContain("hello world");
    expect(text).toContain("source=test");
    expect(text).toContain("lang=ja");
  });
});
