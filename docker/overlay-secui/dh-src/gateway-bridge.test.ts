/**
 * @file gateway-bridge.test.ts
 * @description Unit tests for {@link GatewayBridge.chatSendAsync}.
 *
 * These tests exercise the async-receipt state machine without spinning up
 * a real WebSocket. We stub `chatSend` to return a fixed runId, then drive
 * the internal `dispatchToPendingRun` directly to simulate gateway events.
 *
 * Flow trace for the async case:
 *   chatSendAsync
 *     ├─ fast  → final event within earlyTimeoutMs → { done:true, text }
 *     └─ late  → earlyTimeoutMs elapses → { done:false, runId, continuation }
 *                  continuation resolves when final arrives (up to lateTimeoutMs)
 *                  or rejects on late timeout / error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayBridge, type ChatEventPayload } from "./gateway-bridge.js";

// Helper: build a fresh GatewayBridge with chatSend stubbed to a fixed runId.
function makeBridge(fixedRunId = "run-1") {
  const gw = new GatewayBridge(9999, "token");
  // Bypass real WebSocket send; chatSendAsync only needs runId.
  (gw as unknown as { chatSend: (k: string, m: string) => Promise<string> })
    .chatSend = vi.fn(async () => fixedRunId);
  return gw;
}

/** Simulate a final chat event on the bridge for a given runId. */
function sendFinal(gw: GatewayBridge, runId: string, text: string): void {
  const payload: ChatEventPayload = {
    runId,
    sessionKey: "agent:main:main",
    seq: 1,
    state: "final",
    message: { role: "assistant", content: [{ type: "text", text }], timestamp: Date.now() },
  };
  (gw as unknown as { dispatchToPendingRun: (p: ChatEventPayload) => void })
    .dispatchToPendingRun(payload);
}

function sendError(gw: GatewayBridge, runId: string, msg: string): void {
  const payload: ChatEventPayload = {
    runId,
    sessionKey: "agent:main:main",
    seq: 1,
    state: "error",
    errorMessage: msg,
  };
  (gw as unknown as { dispatchToPendingRun: (p: ChatEventPayload) => void })
    .dispatchToPendingRun(payload);
}

describe("GatewayBridge.chatSendAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves {done:true, text} when final arrives within earlyTimeoutMs", async () => {
    const gw = makeBridge("run-fast");
    const p = gw.chatSendAsync("agent:main:main", "hi", {
      earlyTimeoutMs: 1_000,
      lateTimeoutMs: 10_000,
    });
    // Let the chatSend microtask flush before firing the final.
    await Promise.resolve();
    sendFinal(gw, "run-fast", "hello back");
    const r = await p;
    expect(r.done).toBe(true);
    if (r.done) expect(r.text).toBe("hello back");
  });

  it("fast-path propagates errors", async () => {
    const gw = makeBridge("run-err");
    const p = gw.chatSendAsync("agent:main:main", "hi", {
      earlyTimeoutMs: 1_000,
      lateTimeoutMs: 10_000,
    });
    await Promise.resolve();
    sendError(gw, "run-err", "boom");
    await expect(p).rejects.toThrow(/boom/);
  });

  it("returns {done:false} after earlyTimeoutMs; continuation resolves when final arrives", async () => {
    const gw = makeBridge("run-late");
    const p = gw.chatSendAsync("agent:main:main", "slow request", {
      earlyTimeoutMs: 100,
      lateTimeoutMs: 10_000,
    });
    await Promise.resolve();
    // Advance past earlyTimeoutMs
    await vi.advanceTimersByTimeAsync(150);
    const r = await p;
    expect(r.done).toBe(false);
    if (!r.done) {
      expect(r.runId).toBe("run-late");
      // Fire the actual final
      sendFinal(gw, "run-late", "done at last");
      const text = await r.continuation;
      expect(text).toBe("done at last");
    }
  });

  it("continuation rejects on lateTimeoutMs", async () => {
    const gw = makeBridge("run-ltl");
    const p = gw.chatSendAsync("agent:main:main", "huge req", {
      earlyTimeoutMs: 50,
      lateTimeoutMs: 500,
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    const r = await p;
    expect(r.done).toBe(false);
    if (!r.done) {
      // Advance past lateTimeoutMs
      const latePromise = r.continuation;
      // attach catch *before* we advance timers so the rejection is observed
      const assertion = expect(latePromise).rejects.toThrow(/late timeout/);
      await vi.advanceTimersByTimeAsync(600);
      await assertion;
    }
  });

  it("continuation rejects when a late error arrives", async () => {
    const gw = makeBridge("run-lerr");
    const p = gw.chatSendAsync("agent:main:main", "req", {
      earlyTimeoutMs: 50,
      lateTimeoutMs: 10_000,
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    const r = await p;
    expect(r.done).toBe(false);
    if (!r.done) {
      const assertion = expect(r.continuation).rejects.toThrow(/kaboom/);
      sendError(gw, "run-lerr", "kaboom");
      await assertion;
    }
  });
});
