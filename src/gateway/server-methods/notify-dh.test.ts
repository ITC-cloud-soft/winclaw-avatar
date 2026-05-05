/**
 * Unit tests for the `notify.dh` gateway RPC handler.
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildNotifyDhChatPayload,
  DH_NOTIFY_BROADCAST_SESSION_KEY,
  dhNotifySessionKey,
  notifyDhHandlers,
} from "./notify-dh.js";
import type { GatewayRequestContext } from "./types.js";

type AnyFn = (...args: unknown[]) => unknown;

function makeContextStub(): {
  context: GatewayRequestContext;
  broadcast: ReturnType<typeof vi.fn>;
  nodeSendToSession: ReturnType<typeof vi.fn>;
  logs: { info: string[]; warn: string[] };
} {
  const broadcast = vi.fn();
  const nodeSendToSession = vi.fn();
  const logs = { info: [] as string[], warn: [] as string[] };
  const logger = {
    info: (m: string) => logs.info.push(m),
    warn: (m: string) => logs.warn.push(m),
    debug: () => {},
    error: () => {},
  };
  const context = {
    broadcast,
    nodeSendToSession,
    logGateway: logger,
  } as unknown as GatewayRequestContext;
  return { context, broadcast, nodeSendToSession, logs };
}

function invoke(params: unknown, ctx: ReturnType<typeof makeContextStub>) {
  const respond = vi.fn();
  const handler = notifyDhHandlers["notify.dh"] as AnyFn;
  handler({
    params: params as Record<string, unknown>,
    respond,
    context: ctx.context,
    client: null,
    isWebchatConnect: () => false,
    req: { id: "r1", method: "notify.dh", params: params as any },
  });
  return { respond };
}

describe("notify.dh handler", () => {
  describe("param validation", () => {
    it("rejects missing priority", () => {
      const ctx = makeContextStub();
      const { respond } = invoke({ text: "hi" }, ctx);
      expect(respond).toHaveBeenCalledTimes(1);
      const [ok, , error] = respond.mock.calls[0]!;
      expect(ok).toBe(false);
      expect(error?.message).toMatch(/priority/);
    });

    it("rejects empty text", () => {
      const ctx = makeContextStub();
      const { respond } = invoke({ priority: "high", text: "" }, ctx);
      const [ok, , error] = respond.mock.calls[0]!;
      expect(ok).toBe(false);
      expect(error?.message).toMatch(/text/i);
    });

    it("rejects invalid priority value", () => {
      const ctx = makeContextStub();
      const { respond } = invoke({ priority: "urgent", text: "x" }, ctx);
      const [ok, , error] = respond.mock.calls[0]!;
      expect(ok).toBe(false);
      expect(error?.message).toMatch(/priority/);
    });
  });

  describe("targeted delivery (sessionId given)", () => {
    it("emits on the per-session notification key with [HIGH] marker", () => {
      const ctx = makeContextStub();
      const { respond } = invoke(
        {
          sessionId: "s-42",
          priority: "high",
          text: "新着メール: 山田さんから会議の件",
          source: "email",
          hintLanguage: "ja",
          dedupKey: "email:yamada",
        },
        ctx,
      );

      expect(respond).toHaveBeenCalledTimes(1);
      const [ok, payload] = respond.mock.calls[0]!;
      expect(ok).toBe(true);
      expect(payload).toEqual(
        expect.objectContaining({
          ok: true,
          deliveredTo: 1,
          sessionKeys: [dhNotifySessionKey("s-42")],
        }),
      );

      expect(ctx.broadcast).toHaveBeenCalledTimes(1);
      const [event, body] = ctx.broadcast.mock.calls[0]!;
      expect(event).toBe("chat");
      expect(body.sessionKey).toBe("dh-notify:s-42");
      expect(body.state).toBe("final");
      expect(body.message.role).toBe("system");
      expect(body.message.content[0].text).toMatch(
        /^\[HIGH\] 新着メール: 山田さんから会議の件$/,
      );

      expect(ctx.nodeSendToSession).toHaveBeenCalledWith(
        "dh-notify:s-42",
        "chat",
        expect.objectContaining({ sessionKey: "dh-notify:s-42" }),
      );
    });

    it("uses [LOW] marker for low priority", () => {
      const ctx = makeContextStub();
      invoke({ sessionId: "a", priority: "low", text: "bg update" }, ctx);
      const body = ctx.broadcast.mock.calls[0]![1] as {
        message: { content: Array<{ text: string }> };
      };
      expect(body.message.content[0].text).toMatch(/^\[LOW\] bg update$/);
    });

    it("uses [NOTIFY] marker for normal priority", () => {
      const ctx = makeContextStub();
      invoke({ sessionId: "a", priority: "normal", text: "info" }, ctx);
      const body = ctx.broadcast.mock.calls[0]![1] as {
        message: { content: Array<{ text: string }> };
      };
      expect(body.message.content[0].text).toMatch(/^\[NOTIFY\] info$/);
    });
  });

  describe("broadcast delivery (sessionId omitted)", () => {
    it("emits on the well-known broadcast key", () => {
      const ctx = makeContextStub();
      const { respond } = invoke(
        { priority: "high", text: "server alarm" },
        ctx,
      );
      const [ok, payload] = respond.mock.calls[0]!;
      expect(ok).toBe(true);
      expect(payload.sessionKeys).toEqual([DH_NOTIFY_BROADCAST_SESSION_KEY]);
      const body = ctx.broadcast.mock.calls[0]![1];
      expect(body.sessionKey).toBe("dh-notify:broadcast");
      expect(body.message.content[0].text).toMatch(/^\[HIGH\] server alarm$/);
    });
  });
});

describe("buildNotifyDhChatPayload", () => {
  it("attaches notifyMeta when extra hints provided", () => {
    const payload = buildNotifyDhChatPayload({
      sessionKey: "dh-notify:x",
      runId: "run-1",
      now: 100,
      params: {
        priority: "normal",
        text: "hello",
        source: "email",
        hintLanguage: "ja",
        dedupKey: "k",
      },
    });
    expect(payload).toMatchObject({
      runId: "run-1",
      sessionKey: "dh-notify:x",
      state: "final",
      message: {
        role: "system",
        timestamp: 100,
        content: [{ type: "text", text: "[NOTIFY] hello" }],
      },
    });
    const withMeta = payload as unknown as {
      notifyMeta: Record<string, string>;
    };
    expect(withMeta.notifyMeta).toEqual({
      source: "email",
      hintLanguage: "ja",
      dedupKey: "k",
    });
  });

  it("omits notifyMeta when no hints present", () => {
    const payload = buildNotifyDhChatPayload({
      sessionKey: "dh-notify:x",
      runId: "r",
      params: { priority: "high", text: "t" },
    });
    expect((payload as Record<string, unknown>).notifyMeta).toBeUndefined();
  });
});
