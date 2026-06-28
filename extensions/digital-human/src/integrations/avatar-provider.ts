/**
 * @fileoverview Avatar stream provider abstraction (Stage 1b).
 *
 * Decouples the realtime session handler from a concrete avatar backend. Two
 * implementations are supported, selected by `config.dh.provider`:
 *
 * - **MuseTalk** ({@link MuseTalkAvatarProvider}) — the default. Mints a
 *   session against the dh-saas API (`POST {dhsaasUrl}/api/v1/sessions`) in
 *   `input_mode:"passthrough"` (pure renderer) and returns a WebRTC stream
 *   descriptor (offer URL, control WS, ICE servers). The browser performs the
 *   SDP/ICE exchange for the video; winclaw runs the Qwen-omni dialogue and
 *   pushes TTS PCM to the VM over `controlWs` (see {@link MuseTalkAudioSink}).
 *   winclaw owns the system prompt, so it is NOT sent to the VM.
 *
 * - **BytePlus** ({@link BytePlusAvatarProvider}) — wraps the existing
 *   {@link DigitalHumanManager} (ByteDance virtual human). Preserves the
 *   original pipeline exactly as a rollback path. This module does NOT modify
 *   `byteplus-rtc.ts`.
 *
 * @module avatar-provider
 */

import { DigitalHumanManager } from "./byteplus-rtc.js";
import type { DigitalHumanConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic stream descriptor returned by
 * {@link AvatarStreamProvider.startSession}.
 *
 * MuseTalk populates the WebRTC fields (`offerUrl`, `controlWs`,
 * `iceServers`, `sessionId`, `ownerToken`, `expiresAt`). BytePlus spreads its
 * existing `StreamInfo` (`liveId`, `roomId`, `viewerToken`, …) through the
 * index signature.
 */
export interface AvatarStreamInfo {
  provider: "musetalk" | "byteplus";
  sessionId?: string;
  ownerToken?: string;
  offerUrl?: string;
  controlWs?: string;
  iceServers?: Array<{ urls: string[]; username?: string; credential?: string }>;
  expiresAt?: string;
  /** BytePlus passthrough (liveId/roomId/viewerToken/…) and future fields. */
  [key: string]: unknown;
}

/**
 * Abstraction over a concrete avatar streaming backend.
 */
export interface AvatarStreamProvider {
  readonly kind: "musetalk" | "byteplus";
  startSession(opts: { liveId: string; roleId?: string }): Promise<AvatarStreamInfo>;
  stop(): Promise<void>;
}

// ---------------------------------------------------------------------------
// dh-saas session API wire shapes
// ---------------------------------------------------------------------------

/** Shape of the JSON body returned by `POST /api/v1/sessions`. */
interface DhSaasSessionResponse {
  session_id: string;
  owner_token: string;
  stream: {
    control_ws: string;
    offer_url: string;
    ice_servers: Array<{ urls: string[]; username?: string; credential?: string }>;
  };
  expires_at: string;
  worker?: { id: string; region?: string };
}

/** Timeout for the dh-saas session-mint request. */
const DHSAAS_REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// MuseTalk provider (dh-saas)
// ---------------------------------------------------------------------------

/**
 * MuseTalk avatar provider backed by the dh-saas session API.
 *
 * Stateless apart from logging — no audio relay, no Qwen. `stop()` is a
 * best-effort no-op because the dh-saas session is owned by the browser via
 * its WebRTC connection and expires on its own TTL.
 */
export class MuseTalkAvatarProvider implements AvatarStreamProvider {
  readonly kind = "musetalk" as const;

  private readonly dhsaasUrl: string;
  private readonly tenantToken: string;
  private readonly defaultRoleId: string;
  private lastSessionId: string | null = null;

  constructor(musetalk: DigitalHumanConfig["dh"]["musetalk"]) {
    // Strip any trailing slash so URL joining is deterministic.
    this.dhsaasUrl = musetalk.dhsaasUrl.replace(/\/+$/, "");
    this.tenantToken = musetalk.tenantToken;
    this.defaultRoleId = musetalk.defaultRoleId;
  }

  async startSession(opts: { liveId: string; roleId?: string }): Promise<AvatarStreamInfo> {
    const roleId = opts.roleId ?? this.defaultRoleId;
    const url = `${this.dhsaasUrl}/api/v1/sessions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DHSAAS_REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.tenantToken}`,
        },
        body: JSON.stringify({
          role_id: roleId,
          ttl_seconds: 900,
          // Pure-renderer mode: the VM lip-syncs PCM that winclaw pushes over
          // controlWs. No system_prompt is sent — winclaw owns the prompt and
          // drives the Qwen-omni dialogue itself (道B).
          input_mode: "passthrough",
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `[MuseTalk] dh-saas session request timed out after ${DHSAAS_REQUEST_TIMEOUT_MS} ms (${url})`,
        );
      }
      throw new Error(
        `[MuseTalk] dh-saas session request failed (${url}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        /* ignore body read failure */
      }
      throw new Error(
        `[MuseTalk] dh-saas session request returned ${res.status} ${res.statusText}: ${bodyText}`,
      );
    }

    const data = (await res.json()) as DhSaasSessionResponse;
    this.lastSessionId = data.session_id;

    return {
      provider: "musetalk",
      sessionId: data.session_id,
      ownerToken: data.owner_token,
      offerUrl: data.stream.offer_url,
      controlWs: data.stream.control_ws,
      iceServers: data.stream.ice_servers,
      expiresAt: data.expires_at,
    };
  }

  async stop(): Promise<void> {
    // Best-effort no-op: the dh-saas session is owned by the browser's WebRTC
    // connection and expires on its TTL. Nothing for the server to tear down.
    console.info(
      `[MuseTalk] stop() — no-op (session=${this.lastSessionId ?? "none"} owned by browser, expires on TTL)`,
    );
  }
}

// ---------------------------------------------------------------------------
// BytePlus provider (wraps existing DigitalHumanManager)
// ---------------------------------------------------------------------------

/**
 * BytePlus avatar provider — a thin wrapper around the existing
 * {@link DigitalHumanManager}. Preserves the exact BytePlus behaviour as a
 * rollback path. Does NOT touch `byteplus-rtc.ts` internals.
 */
export class BytePlusAvatarProvider implements AvatarStreamProvider {
  readonly kind = "byteplus" as const;

  private readonly dhManager: DigitalHumanManager;
  private readonly role: string;
  private liveId: string | null = null;

  constructor(config: DigitalHumanConfig) {
    this.role = config.bytedance.role;
    this.dhManager = new DigitalHumanManager({
      virtualHumanAppId: config.bytedance.appId,
      virtualHumanToken: config.bytedance.token,
      virtualHumanRole: config.bytedance.role,
      byteRtcAppId: config.bytedance.rtcAppId,
      byteRtcAppKey: config.bytedance.rtcAppKey,
      defaultRoomId: config.bytedance.rtcRoomId,
      defaultPushUid: config.bytedance.rtcPushUid,
      defaultViewerUid: config.bytedance.rtcViewerUid,
    });
  }

  /**
   * Expose the underlying manager so the realtime handler can drive the
   * BytePlus PCM pacer (sendAudioData) exactly as before.
   */
  get manager(): DigitalHumanManager {
    return this.dhManager;
  }

  async startSession(opts: { liveId: string; roleId?: string }): Promise<AvatarStreamInfo> {
    const streamInfo = await this.dhManager.startSession({
      liveId: opts.liveId,
      roleId: opts.roleId ?? this.role,
    });
    this.liveId = streamInfo.liveId;
    return {
      provider: "byteplus",
      ...streamInfo,
    };
  }

  async stop(): Promise<void> {
    if (this.liveId) {
      await this.dhManager.stopSession(this.liveId);
      this.liveId = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Construct the avatar provider selected by `config.dh.provider`
 * (defaults to `"musetalk"`).
 */
export function createAvatarProvider(config: DigitalHumanConfig): AvatarStreamProvider {
  const provider = config.dh?.provider ?? "musetalk";
  if (provider === "byteplus") {
    return new BytePlusAvatarProvider(config);
  }
  return new MuseTalkAvatarProvider(config.dh.musetalk);
}
