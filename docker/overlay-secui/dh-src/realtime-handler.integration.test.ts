/**
 * @file realtime-handler.integration.test.ts
 * @description Integration test for the NotifyBridge <-> QwenRealtimeClient
 * wiring introduced in Phase 3.
 *
 * We do NOT boot the full RealtimeSessionHandler (that requires a live ws,
 * ByteDance RTC, and Gateway). Instead we verify the contract the handler
 * relies on: given a mock QwenRealtimeClient (EventEmitter + sendSystemEvent)
 * and an EventEmitter winclawBus, emitting `email.received` must cause
 * `sendSystemEvent` to be called on the qwen client once the session reports
 * `responseDone`.
 */

import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";

import { NotifyBridge } from "./notify-bridge.js";
import type { QwenRealtimeClient } from "./integrations/qwen-realtime.js";

class FakeQwen extends EventEmitter {
  sendSystemEvent = vi.fn<(text: string) => Promise<void>>(async () => {});
}

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

describe("RealtimeSessionHandler ↔ NotifyBridge wiring", () => {
  it("email.received on the bus reaches qwenClient.sendSystemEvent when idle", async () => {
    const qwen = new FakeQwen();
    const bus = new EventEmitter();
    const bridge = new NotifyBridge({
      qwenClient: qwen as unknown as QwenRealtimeClient,
      winclawBus: bus,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    bus.emit("email.received", { from: "alice", subject: "hello" });
    await tick();

    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("OWNER NOTIFICATION");
    expect(text).toContain("alice");
    expect(text).toContain("hello");

    bridge.dispose();
  });

  it("email.received is deferred while Qwen is responding, delivered on responseDone", async () => {
    const qwen = new FakeQwen();
    const bus = new EventEmitter();
    const bridge = new NotifyBridge({
      qwenClient: qwen as unknown as QwenRealtimeClient,
      winclawBus: bus,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    // Simulate an in-flight response.
    qwen.emit("responseStarted");
    bus.emit("email.received", { from: "bob", subject: "meeting" });
    await tick();
    expect(qwen.sendSystemEvent).not.toHaveBeenCalled();

    // Response finishes → bridge flushes the buffered email.
    qwen.emit("responseDone");
    await tick();
    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    expect(qwen.sendSystemEvent.mock.calls[0]![0]).toContain("bob");

    bridge.dispose();
  });

  it("pushFromChatEvent forwards NOTIFY-tagged final chat events to Qwen", async () => {
    const qwen = new FakeQwen();
    const bus = new EventEmitter();
    const bridge = new NotifyBridge({
      qwenClient: qwen as unknown as QwenRealtimeClient,
      winclawBus: bus,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    // Simulate the gateway-bridge → NotifyBridge wire (same as
    // realtime-handler wires in FC mode).
    bridge.pushFromChatEvent({
      runId: "notif-1",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "[HIGH] カレンダーが5分後です" }],
        timestamp: Date.now(),
      },
    });
    await tick();

    expect(qwen.sendSystemEvent).toHaveBeenCalledTimes(1);
    const text = qwen.sendSystemEvent.mock.calls[0]![0];
    expect(text).toContain("OWNER NOTIFICATION");
    expect(text).toContain("priority=high");
    expect(text).toContain("カレンダーが5分後です");

    bridge.dispose();
  });

  it("dispose unsubscribes from the winclaw bus — subsequent events are no-ops", async () => {
    const qwen = new FakeQwen();
    const bus = new EventEmitter();
    const bridge = new NotifyBridge({
      qwenClient: qwen as unknown as QwenRealtimeClient,
      winclawBus: bus,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    bridge.dispose();
    bus.emit("email.received", { from: "c", subject: "d" });
    qwen.emit("responseDone");
    await tick();
    expect(qwen.sendSystemEvent).not.toHaveBeenCalled();

    // And bus listeners are really removed (no memory leak).
    expect(bus.listenerCount("email.received")).toBe(0);
    expect(bus.listenerCount("task.completed")).toBe(0);
    expect(bus.listenerCount("calendar.reminder")).toBe(0);
    expect(bus.listenerCount("channel.message")).toBe(0);
  });
});
