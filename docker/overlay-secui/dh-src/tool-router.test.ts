/**
 * @file tool-router.test.ts
 * @description Unit tests for {@link ToolRouter}.
 *
 * Every test asserts the JSON contract: the handler ALWAYS returns a string
 * parsable as `{status: "ok" | "failed", ...}`. Handlers never throw — any
 * thrown error from a dependency must be wrapped in a `status:"failed"`
 * payload with a user-facing Japanese `user_message`.
 *
 * `task_run` and `channel_send` route through `GatewayBridge.chatSendAndWait`
 * so they invoke the same agent pipeline that WhatsApp / text-chat use. The
 * tests mock the bridge and verify the natural-language message shape.
 */

import { describe, it, expect, vi } from "vitest";
import { ToolRouter, type ToolRouterDeps } from "./tool-router.js";
import type { QwenFunctionCall } from "./integrations/qwen-realtime.js";
import type { MemoryCorePlugin, MemorySearchResult } from "./memory-bridge.js";
import type { GatewayBridge } from "./gateway-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCall(
  name: string,
  args: unknown,
  callId = "call-1",
): QwenFunctionCall {
  return {
    callId,
    name,
    argumentsJson: args === undefined ? "" : JSON.stringify(args),
  };
}

function makeMemory(overrides: Partial<MemoryCorePlugin> = {}): MemoryCorePlugin {
  return {
    search: vi.fn(async () => [] as MemorySearchResult[]),
    get: vi.fn(async () => ""),
    markDirty: vi.fn(),
    reindex: vi.fn(async () => {}),
    ...overrides,
  };
}

interface MockGw {
  chatSendAndWait: ReturnType<typeof vi.fn>;
  chatSendAsync: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
}

function makeGw(impl?: (sessionKey: string, message: string) => Promise<string>): {
  gw: GatewayBridge;
  mock: MockGw;
} {
  const chatSendAndWait = vi.fn(
    impl ?? (async () => "ok"),
  );
  // Default async variant: fulfils immediately using the same impl.
  const chatSendAsync = vi.fn(
    async (sessionKey: string, message: string) => {
      const text = await (impl ?? (async () => "ok"))(sessionKey, message);
      return { done: true as const, text };
    },
  );
  const request = vi.fn(async (_method: string, _params: unknown) => ({} as unknown));
  const gw = { chatSendAndWait, chatSendAsync, request } as unknown as GatewayBridge;
  return { gw, mock: { chatSendAndWait, chatSendAsync, request } };
}

function makeRouter(
  overrides: Partial<ToolRouterDeps> = {},
): { router: ToolRouter; deps: ToolRouterDeps } {
  const { gw } = makeGw();
  const deps: ToolRouterDeps = {
    memory: makeMemory(),
    gwBridge: gw,
    sessionKey: "agent:main:main",
    dhSessionId: "test-session",
    ...overrides,
  };
  return { router: new ToolRouter(deps), deps };
}

// ---------------------------------------------------------------------------
// Generic error handling
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — error handling", () => {
  it("rejects malformed JSON arguments", async () => {
    const { router } = makeRouter();
    const call: QwenFunctionCall = {
      callId: "c1",
      name: "memory_search",
      argumentsJson: "{not json",
    };
    const parsed = JSON.parse(await router.handle(call));
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/形式/);
  });

  it("returns failed for unknown tool names", async () => {
    const { router } = makeRouter();
    const parsed = JSON.parse(
      await router.handle(makeCall("nope", { x: 1 })),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/nope/);
  });

  it("wraps dependency errors into failed payloads (never throws)", async () => {
    const memory = makeMemory({
      search: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const { router } = makeRouter({ memory });
    const parsed = JSON.parse(
      await router.handle(makeCall("memory_search", { query: "x" })),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toBeTruthy();
    expect(parsed.error).toContain("boom");
  });
});

// ---------------------------------------------------------------------------
// memory_search
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — memory_search", () => {
  it("maps results to {path, snippet, score}", async () => {
    const memory = makeMemory({
      search: vi.fn(async (): Promise<MemorySearchResult[]> => [
        { content: "hello", source: "memory/2026-04-19.md", score: 0.9, startLine: 1, endLine: 3 },
      ]),
    });
    const { router } = makeRouter({ memory });
    const parsed = JSON.parse(
      await router.handle(makeCall("memory_search", { query: "hi", top_k: 3 })),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.results[0]).toMatchObject({
      path: "memory/2026-04-19.md",
      snippet: "hello",
      score: 0.9,
    });
    expect(memory.search).toHaveBeenCalledWith({ query: "hi", topK: 3 });
  });

  it("defaults top_k to 5 and validates empty query", async () => {
    const memory = makeMemory();
    const { router } = makeRouter({ memory });

    const empty = JSON.parse(
      await router.handle(makeCall("memory_search", { query: "  " })),
    );
    expect(empty.status).toBe("failed");

    await router.handle(makeCall("memory_search", { query: "x" }));
    expect(memory.search).toHaveBeenCalledWith({ query: "x", topK: 5 });
  });
});

// ---------------------------------------------------------------------------
// memory_get
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — memory_get", () => {
  it("passes path/startLine/endLine through", async () => {
    const memory = makeMemory({
      get: vi.fn(async () => "line1\nline2"),
    });
    const { router } = makeRouter({ memory });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("memory_get", {
          path: "memory/2026-04-19.md",
          startLine: 10,
          endLine: 20,
        }),
      ),
    );
    expect(parsed).toEqual({ status: "ok", text: "line1\nline2" });
    expect(memory.get).toHaveBeenCalledWith({
      filePath: "memory/2026-04-19.md",
      startLine: 10,
      endLine: 20,
    });
  });

  it("requires path", async () => {
    const { router } = makeRouter();
    const parsed = JSON.parse(
      await router.handle(makeCall("memory_get", {})),
    );
    expect(parsed.status).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// task_run — routes through gateway chat.send
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — task_run (via gateway)", () => {
  it("builds a Japanese natural-language request and returns the agent reply", async () => {
    const { gw, mock } = makeGw(async () => "メールを5件まとめました。");
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("task_run", { taskName: "email.summarize", args: { count: 5 } }),
      ),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.user_message).toBe("メールを5件まとめました。");

    // Verify dispatch: sessionKey + constructed message
    expect(mock.chatSendAsync).toHaveBeenCalledTimes(1);
    const [key, msg] = mock.chatSendAsync.mock.calls[0]!;
    expect(key).toBe("agent:main:main");
    expect(msg).toContain("email.summarize");
    expect(msg).toContain("タスク実行");
    expect(msg).toContain("count");
  });

  it("requires taskName", async () => {
    const { router } = makeRouter();
    const parsed = JSON.parse(
      await router.handle(makeCall("task_run", {})),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/タスク名/);
  });

  it("returns timeout user_message when the gateway times out", async () => {
    const { gw } = makeGw(async () => {
      throw new Error("chatSendAndWait: timeout");
    });
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("task_run", { taskName: "slow.task" }),
      ),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/タイムアウト/);
  });

  it("surfaces generic agent errors as a failed payload", async () => {
    const { gw } = makeGw(async () => {
      throw new Error("agent exploded");
    });
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("task_run", { taskName: "boom" }),
      ),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toBe("タスクを実行できませんでした。");
    expect(parsed.error).toContain("agent exploded");
  });

  it("extracts <voice> summary tag from agent reply", async () => {
    const { gw } = makeGw(
      async () => "長いレポート本文...\n<voice>要点だけ口頭で</voice>\n続き",
    );
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(makeCall("task_run", { taskName: "report" })),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.user_message).toBe("要点だけ口頭で");
  });
});

// ---------------------------------------------------------------------------
// channel_send — routes through gateway chat.send
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — channel_send (via gateway)", () => {
  it("builds a natural-language send request with the agent", async () => {
    const { gw, mock } = makeGw(async () => "送信しました。");
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("channel_send", {
          channel: "line",
          recipient: "山田さん",
          body: "会議は明日",
        }),
      ),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.user_message).toBe("送信しました。");

    const [, msg] = mock.chatSendAsync.mock.calls[0]!;
    expect(msg).toContain("LINE");
    expect(msg).toContain("山田さん");
    expect(msg).toContain("会議は明日");
  });

  it("validates required fields", async () => {
    const { router } = makeRouter();
    const parsed = JSON.parse(
      await router.handle(
        makeCall("channel_send", { channel: "email" /* no recipient/body */ }),
      ),
    );
    expect(parsed.status).toBe("failed");
  });

  it("rejects channels outside the allowed enum without calling the gateway", async () => {
    const { gw, mock } = makeGw();
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("channel_send", {
          channel: "sms",
          recipient: "+15551234567",
          body: "hi",
        }),
      ),
    );
    expect(parsed.status).toBe("failed");
    expect(mock.chatSendAsync).not.toHaveBeenCalled();
  });

  it("returns timeout user_message when agent does not reply", async () => {
    const { gw } = makeGw(async () => {
      throw new Error("chatSendAndWait: timeout");
    });
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("channel_send", {
          channel: "slack",
          recipient: "#general",
          body: "hi",
        }),
      ),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/タイムアウト/);
  });
});

// ---------------------------------------------------------------------------
// ask_winclaw — generic pass-through to the gateway agent
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — ask_winclaw (via gateway)", () => {
  it("forwards the owner request verbatim and surfaces the agent reply", async () => {
    const { gw, mock } = makeGw(async () => "未読メール3件を確認しました。");
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("ask_winclaw", { request: "今日届いたメールを確認して" }),
      ),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.user_message).toBe("未読メール3件を確認しました。");

    expect(mock.chatSendAsync).toHaveBeenCalledTimes(1);
    const [key, msg] = mock.chatSendAsync.mock.calls[0]!;
    expect(key).toBe("agent:main:main");
    // verbatim — no prefix / wrapping
    expect(msg).toBe("今日届いたメールを確認して");
  });

  it("rejects empty request without calling the gateway", async () => {
    const { gw, mock } = makeGw();
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(makeCall("ask_winclaw", { request: "   " })),
    );
    expect(parsed.status).toBe("failed");
    expect(mock.chatSendAsync).not.toHaveBeenCalled();
  });

  it("returns timeout user_message when the agent does not reply", async () => {
    const { gw } = makeGw(async () => {
      throw new Error("chatSendAndWait: timeout");
    });
    const { router } = makeRouter({ gwBridge: gw });
    const parsed = JSON.parse(
      await router.handle(
        makeCall("ask_winclaw", { request: "昨日の天気教えて" }),
      ),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/タイムアウト/);
  });
});

// ---------------------------------------------------------------------------
// Phase C — async receipt + late delivery via notify.dh
// ---------------------------------------------------------------------------

describe("ToolRouter — async receipt (Phase C)", () => {
  it("returns a receipt and user_message on early timeout, then calls notify.dh on late delivery", async () => {
    // Build a chatSendAsync that resolves done:false with a continuation
    // we control.
    let resolveLate!: (text: string) => void;
    const continuation = new Promise<string>((r) => { resolveLate = r; });
    const chatSendAsync = vi.fn(async () => ({
      done: false as const,
      runId: "run-async-1",
      continuation,
    }));
    const request = vi.fn(async (_method: string, _params: unknown) => ({} as unknown));
    const gw = {
      chatSendAndWait: vi.fn(),
      chatSendAsync,
      request,
    } as unknown as GatewayBridge;
    const { router } = makeRouter({ gwBridge: gw });

    const parsed = JSON.parse(
      await router.handle(
        makeCall("ask_winclaw", { request: "メール全部まとめて" }),
      ),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.receipt).toBe("run-async-1");
    expect(parsed.user_message).toMatch(/確認中/);

    // Fire the late delivery — notify.dh should be invoked with the
    // DH sessionId and formatted text.
    resolveLate("<voice>メール5件確認しました</voice>");
    // Let microtasks flush
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(request).toHaveBeenCalledTimes(1);
    const [method, params] = request.mock.calls[0]!;
    expect(method).toBe("notify.dh");
    expect((params as Record<string, unknown>).sessionId).toBe("test-session");
    expect((params as Record<string, unknown>).text).toMatch(/メール5件/);
    expect((params as Record<string, unknown>).dedupKey).toBe("late-run-async-1");
    expect((params as Record<string, unknown>).source).toBe("async-tool-result");
  });

  it("emits an error notify.dh when the continuation rejects (late timeout)", async () => {
    let rejectLate!: (err: Error) => void;
    const continuation = new Promise<string>((_res, rej) => { rejectLate = rej; });
    const chatSendAsync = vi.fn(async () => ({
      done: false as const,
      runId: "run-async-err",
      continuation,
    }));
    const request = vi.fn(async (_method: string, _params: unknown) => ({} as unknown));
    const gw = {
      chatSendAndWait: vi.fn(),
      chatSendAsync,
      request,
    } as unknown as GatewayBridge;
    const { router } = makeRouter({ gwBridge: gw });

    const parsed = JSON.parse(
      await router.handle(
        makeCall("task_run", { taskName: "long.task" }),
      ),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.receipt).toBe("run-async-err");

    rejectLate(new Error("late timeout"));
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(request).toHaveBeenCalledTimes(1);
    const [method, params] = request.mock.calls[0]!;
    expect(method).toBe("notify.dh");
    expect((params as Record<string, unknown>).text).toMatch(/完了できませんでした/);
    expect((params as Record<string, unknown>).source).toBe("async-tool-error");
  });
});

// ---------------------------------------------------------------------------
// internet_search
// ---------------------------------------------------------------------------

describe("ToolRouter.handle — internet_search", () => {
  it("returns 'under construction' when webSearchFn is absent", async () => {
    const { router } = makeRouter();
    const parsed = JSON.parse(
      await router.handle(makeCall("internet_search", { query: "weather" })),
    );
    expect(parsed.status).toBe("failed");
    expect(parsed.user_message).toMatch(/準備中/);
  });

  it("delegates to webSearchFn when provided and trims sources to 3", async () => {
    const webSearchFn = vi.fn(async () => ({
      answer: "sunny",
      sources: ["a", "b", "c", "d"],
    }));
    const { router } = makeRouter({ webSearchFn });
    const parsed = JSON.parse(
      await router.handle(makeCall("internet_search", { query: "weather" })),
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.answer).toBe("sunny");
    expect(parsed.sources).toEqual(["a", "b", "c"]);
    expect(webSearchFn).toHaveBeenCalledWith("weather");
  });
});
