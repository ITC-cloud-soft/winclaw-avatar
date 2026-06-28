/**
 * @file avatar-provider.test.ts
 * @description Unit tests for the Stage 1b avatar-provider abstraction.
 *
 * Verifies that:
 *  - MuseTalkAvatarProvider.startSession() POSTs the correct dh-saas request
 *    and maps the response into an AvatarStreamInfo precisely.
 *  - Non-2xx responses throw with the body text.
 *  - createAvatarProvider() returns the right implementation per config.
 *
 * Global `fetch` is mocked — no real network is touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAvatarProvider,
  MuseTalkAvatarProvider,
  BytePlusAvatarProvider,
} from "./avatar-provider.js";
import type { DigitalHumanConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<DigitalHumanConfig> = {}): DigitalHumanConfig {
  return {
    qwen: {
      apiKey: "test-key",
      model: "qwen3.5-omni-flash-realtime",
      voice: "Serena",
      voiceModel: "gummy-realtime-v1",
      serverVad: true,
    },
    bytedance: {
      appId: "app",
      token: "tok",
      role: "role",
      rtcAppId: "rtc-app",
      rtcAppKey: "rtc-key",
      rtcRoomId: "room",
      rtcPushUid: "pub",
      rtcViewerUid: "view",
    },
    identity: { voiceInstructions: "", maxInstructionsChars: 4000, hotReload: true },
    memory: {
      recordConversation: true,
      flushDebounceMs: 3000,
      preloadDays: 2,
      recallTrigger: "qwen_recall",
      recallTopK: 5,
    },
    taskBridge: { model: "", maxWaitSeconds: 60, summaryMaxTokens: 200 },
    session: { timeoutMinutes: 30, maxConcurrent: 1 },
    dhTool: { earlyTimeoutMs: 15000, lateTimeoutMs: 600000 },
    dh: {
      provider: "musetalk",
      musetalk: {
        dhsaasUrl: "https://dh.example.com",
        tenantToken: "tenant-abc",
        defaultRoleId: "role_default_system",
        systemPrompt: "",
      },
    },
    ...overrides,
  } as DigitalHumanConfig;
}

const DHSAAS_RESPONSE = {
  session_id: "sess_123",
  owner_token: "owner_xyz",
  stream: {
    control_ws: "wss://dh.example.com/ws/sess_123",
    offer_url: "https://dh.example.com/offer/sess_123",
    ice_servers: [
      { urls: ["stun:stun.example.com:3478"] },
      { urls: ["turn:turn.example.com:3478"], username: "u", credential: "c" },
    ],
  },
  expires_at: "2026-06-19T12:00:00Z",
  worker: { id: "w1", region: "ap" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MuseTalkAvatarProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs the correct dh-saas request and maps the response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DHSAAS_RESPONSE,
    });

    const provider = new MuseTalkAvatarProvider(makeConfig().dh.musetalk);
    const info = await provider.startSession({ liveId: "live-1", roleId: "role_custom" });

    // --- request shape ---
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://dh.example.com/api/v1/sessions");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tenant-abc");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      role_id: "role_custom",
      ttl_seconds: 900,
      input_mode: "passthrough",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    // --- response mapping ---
    expect(info).toEqual({
      provider: "musetalk",
      sessionId: "sess_123",
      ownerToken: "owner_xyz",
      offerUrl: "https://dh.example.com/offer/sess_123",
      controlWs: "wss://dh.example.com/ws/sess_123",
      iceServers: DHSAAS_RESPONSE.stream.ice_servers,
      expiresAt: "2026-06-19T12:00:00Z",
    });
  });

  it("falls back to defaultRoleId when roleId omitted", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DHSAAS_RESPONSE,
    });

    const provider = new MuseTalkAvatarProvider(makeConfig().dh.musetalk);
    await provider.startSession({ liveId: "live-1" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.role_id).toBe("role_default_system");
  });

  it("never sends system_prompt — winclaw owns the prompt (道B)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DHSAAS_RESPONSE,
    });

    // Even when a systemPrompt is configured, the pure-renderer VM must not
    // receive it: winclaw drives the Qwen-omni dialogue itself.
    const cfg = makeConfig();
    cfg.dh.musetalk.systemPrompt = "Always respond in English.";
    const provider = new MuseTalkAvatarProvider(cfg.dh.musetalk);
    await provider.startSession({ liveId: "live-1" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("system_prompt");
    expect(body.input_mode).toBe("passthrough");
  });

  it("strips trailing slash from dhsaasUrl", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DHSAAS_RESPONSE,
    });

    const cfg = makeConfig();
    cfg.dh.musetalk.dhsaasUrl = "https://dh.example.com/";
    const provider = new MuseTalkAvatarProvider(cfg.dh.musetalk);
    await provider.startSession({ liveId: "live-1" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://dh.example.com/api/v1/sessions");
  });

  it("throws with body text on non-2xx", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid tenant token",
    });

    const provider = new MuseTalkAvatarProvider(makeConfig().dh.musetalk);
    await expect(provider.startSession({ liveId: "live-1" })).rejects.toThrow(
      /401 Unauthorized: invalid tenant token/,
    );
  });

  it("stop() is a best-effort no-op that does not throw", async () => {
    const provider = new MuseTalkAvatarProvider(makeConfig().dh.musetalk);
    await expect(provider.stop()).resolves.toBeUndefined();
  });
});

describe("createAvatarProvider", () => {
  it("returns MuseTalkAvatarProvider when provider=musetalk", () => {
    const provider = createAvatarProvider(makeConfig());
    expect(provider).toBeInstanceOf(MuseTalkAvatarProvider);
    expect(provider.kind).toBe("musetalk");
  });

  it("returns BytePlusAvatarProvider when provider=byteplus", () => {
    const cfg = makeConfig();
    cfg.dh.provider = "byteplus";
    const provider = createAvatarProvider(cfg);
    expect(provider).toBeInstanceOf(BytePlusAvatarProvider);
    expect(provider.kind).toBe("byteplus");
  });

  it("defaults to musetalk when dh.provider unset", () => {
    const cfg = makeConfig();
    // simulate a config where provider somehow absent
    (cfg.dh as { provider?: string }).provider = undefined;
    const provider = createAvatarProvider(cfg);
    expect(provider).toBeInstanceOf(MuseTalkAvatarProvider);
  });
});
