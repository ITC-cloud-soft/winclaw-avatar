/**
 * @fileoverview Digital Human plugin configuration schema.
 *
 * This module defines the Zod runtime schema that mirrors the JSON Schema declared
 * in `winclaw.plugin.json` exactly. The WinClaw plugin system validates the raw
 * config via JSON Schema before it reaches the plugin; Zod provides a second layer
 * of type-safety at the TypeScript boundary and produces inferred types consumed
 * throughout the plugin.
 *
 * All defaults here must match the `default` values in `winclaw.plugin.json`.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Qwen3-omni realtime voice model
// ---------------------------------------------------------------------------

/**
 * Configuration for the Qwen3-omni DashScope realtime API.
 *
 * `apiKey` is the only required field; all others fall back to production
 * defaults. Sensitive values should be injected via `${DASHSCOPE_API_KEY}`
 * environment-variable substitution in `winclaw.json`.
 */
export const QwenConfigSchema = z
  .object({
    /** DashScope API key. Use `${DASHSCOPE_API_KEY}` in winclaw.json. */
    apiKey: z.string().min(1, "qwen.apiKey is required"),
    /** Realtime model identifier. @default "qwen3.5-omni-flash-realtime" */
    model: z.string().min(1).default("qwen3.5-omni-flash-realtime"),
    /** Voice preset for Qwen3.5 Realtime TTS. @default "Serena" */
    voice: z.string().min(1).default("Serena"),
    /** Voice-to-text model used for transcription. @default "gummy-realtime-v1" */
    voiceModel: z.string().min(1).default("gummy-realtime-v1"),
    /** Whether to use server-side voice activity detection. @default true */
    serverVad: z.boolean().default(true),
  })
  .strict();

export type QwenConfig = z.infer<typeof QwenConfigSchema>;

// ---------------------------------------------------------------------------
// ByteDance virtual human API
// ---------------------------------------------------------------------------

/**
 * Configuration for the ByteDance / BytePlus virtual human API and ByteRTC
 * video-streaming layer.
 *
 * All four credential fields (`appId`, `token`, `rtcAppId`, `rtcAppKey`) are
 * required; remaining fields default to the recommended room/uid identifiers.
 */
export const BytedanceConfigSchema = z
  .object({
    /** Virtual Human AppID. Use `${VIRTUAL_HUMAN_APPID}` in winclaw.json. */
    appId: z.string().min(1, "bytedance.appId is required"),
    /** Virtual Human auth token. Use `${VIRTUAL_HUMAN_TOKEN}` in winclaw.json. */
    token: z.string().min(1, "bytedance.token is required"),
    /** Avatar role identifier. @default "250623-zhibo-linyunzhi" */
    role: z.string().min(1).default("250623-zhibo-linyunzhi"),
    /** ByteRTC application ID. Use `${BYTERTC_APP_ID}` in winclaw.json. */
    rtcAppId: z.string().min(1, "bytedance.rtcAppId is required"),
    /** ByteRTC application key. Use `${BYTERTC_APP_KEY}` in winclaw.json. */
    rtcAppKey: z.string().min(1, "bytedance.rtcAppKey is required"),
    /** RTC room identifier shared by publisher and viewer. @default "winclaw_dh_room" */
    rtcRoomId: z.string().min(1).default("winclaw_dh_room"),
    /** RTC publisher UID (the avatar stream source). @default "winclaw_dh_publisher" */
    rtcPushUid: z.string().min(1).default("winclaw_dh_publisher"),
    /** RTC viewer UID (the frontend client). @default "winclaw_dh_viewer" */
    rtcViewerUid: z.string().min(1).default("winclaw_dh_viewer"),
  })
  .strict();

export type BytedanceConfig = z.infer<typeof BytedanceConfigSchema>;

// ---------------------------------------------------------------------------
// Identity loading (SOUL.md / IDENTITY.md)
// ---------------------------------------------------------------------------

/**
 * Controls how the plugin assembles Qwen session instructions from the
 * WinClaw workspace identity files.
 */
export const IdentityConfigSchema = z
  .object({
    /**
     * Optional extra instructions appended after the content of `SOUL.md` for
     * the voice scene. Useful for adding voice-specific behavioral guidance
     * without modifying the canonical identity file. @default ""
     */
    voiceInstructions: z.string().default(""),
    /**
     * Hard character limit applied to the assembled instructions string before
     * it is sent to Qwen `session.update`. Prevents exceeding model context
     * limits. Must be between 500 and 10000. @default 4000
     */
    maxInstructionsChars: z.number().int().min(500).max(10000).default(4000),
    /**
     * When `true`, the identity loader watches `SOUL.md` / `IDENTITY.md` for
     * file-system changes and pushes updated instructions to an active Qwen
     * session without requiring a restart. @default true
     */
    hotReload: z.boolean().default(true),
  })
  .strict()
  .default({});

export type IdentityConfig = z.infer<typeof IdentityConfigSchema>;

// ---------------------------------------------------------------------------
// Memory integration (memory-core)
// ---------------------------------------------------------------------------

/**
 * Configuration for the memory-bridge that persists voice-conversation
 * transcripts to the WinClaw `memory-core` store.
 */
export const MemoryConfigSchema = z
  .object({
    /**
     * When `true`, each conversation turn (user transcript + assistant reply)
     * is appended to `memory/YYYY-MM-DD.md` in the workspace. @default true
     */
    recordConversation: z.boolean().default(true),
    /**
     * Debounce window in milliseconds applied before flushing accumulated
     * transcript lines to disk. Coalesces rapid turns into a single write.
     * Minimum 500 ms. @default 3000
     */
    flushDebounceMs: z.number().int().min(500).default(3000),
    /**
     * Number of past days' memory logs to pre-load into the Qwen session
     * context at session start. Must be between 0 and 7. @default 2
     */
    preloadDays: z.number().int().min(0).max(7).default(2),
    /**
     * Determines how memory recall is triggered during a session:
     * - `"qwen_recall"`: Qwen autonomously emits a `[RECALL:…]` marker.
     * - `"keyword"`:     The backend detects configured trigger keywords.
     * - `"both"`:        Either mechanism can trigger recall.
     * @default "qwen_recall"
     */
    recallTrigger: z.enum(["qwen_recall", "keyword", "both"]).default("qwen_recall"),
    /**
     * Maximum number of memory search results returned per recall query.
     * Must be between 1 and 20. @default 5
     */
    recallTopK: z.number().int().min(1).max(20).default(5),
  })
  .strict()
  .default({});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// ---------------------------------------------------------------------------
// Task bridge (WinClaw Agent)
// ---------------------------------------------------------------------------

/**
 * Settings that govern how the digital-human plugin dispatches tasks to the
 * WinClaw Agent for execution and then summarises the result for the avatar.
 */
export const TaskBridgeConfigSchema = z
  .object({
    /**
     * Model used for task execution dispatched via the task bridge. An empty
     * string means "use the workspace default agent model". @default ""
     */
    model: z.string().default(""),
    /**
     * Maximum wall-clock seconds to wait for a task to complete before
     * returning a timeout result to the avatar. Range: 10–300. @default 60
     */
    maxWaitSeconds: z.number().int().min(10).max(300).default(60),
    /**
     * Token budget for the single-sentence task-result summary injected into
     * the Qwen session as a system message. Minimum 50. @default 200
     */
    summaryMaxTokens: z.number().int().min(50).default(200),
  })
  .strict()
  .default({});

export type TaskBridgeConfig = z.infer<typeof TaskBridgeConfigSchema>;

// ---------------------------------------------------------------------------
// DH tool dispatch (async receipt pattern — Phase C)
// ---------------------------------------------------------------------------

/**
 * Timeouts controlling the async-receipt pattern used by {@link ToolRouter}.
 *
 * When an agent tool (ask_winclaw / task_run / channel_send) takes longer than
 * `earlyTimeoutMs` to reply, the router returns a fast receipt to Qwen
 * ("承知しました、確認中です…") and keeps listening for the agent reply up to
 * `lateTimeoutMs`. When it finally arrives, the result is pushed back through
 * the `notify.dh` RPC so NotifyBridge speaks it as an owner notification.
 */
export const DhToolConfigSchema = z
  .object({
    /**
     * Early ceiling before the router returns a "承知しました、確認中です" receipt.
     * Range: 1s–120s. @default 15000
     */
    earlyTimeoutMs: z.number().int().min(1_000).max(120_000).default(15_000),
    /**
     * Late ceiling — how long after the early deadline we keep waiting for the
     * actual agent reply before giving up. Range: 30s–1800s. @default 1500000
     * (25 min — task_run のリサーチ+PDF生成等は 10分超も普通)
     */
    lateTimeoutMs: z.number().int().min(30_000).max(1_800_000).default(1_500_000),
  })
  .strict()
  .default({});

export type DhToolConfig = z.infer<typeof DhToolConfigSchema>;

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Controls session creation limits and automatic expiration behaviour.
 */
export const SessionConfigSchema = z
  .object({
    /**
     * Inactivity timeout in minutes. A session with no audio activity for
     * this duration is automatically terminated. Minimum 5. @default 30
     */
    timeoutMinutes: z.number().int().min(5).default(30),
    /**
     * Maximum number of simultaneous digital-human sessions permitted per
     * gateway instance. Range: 1–5. @default 1
     */
    maxConcurrent: z.number().int().min(1).max(5).default(1),
  })
  .strict()
  .default({});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// ---------------------------------------------------------------------------
// Avatar provider (Stage 1b — MuseTalk vs BytePlus)
// ---------------------------------------------------------------------------

/**
 * MuseTalk (dh-saas) connection settings.
 *
 * When `dh.provider === "musetalk"` the avatar video is produced by the
 * dh-saas MuseTalk worker reached via WebRTC. The server mints a session
 * (`POST {dhsaasUrl}/api/v1/sessions`) with `input_mode: "passthrough"` and
 * forwards the resulting stream descriptor to the browser, which performs the
 * SDP/ICE exchange directly for the avatar *video*.
 *
 * In the "道B" (brain-on-winclaw) architecture the L20 VM is a **pure MuseTalk
 * renderer**: winclaw runs Qwen3.5-omni-flash-realtime itself (ASR + LLM + TTS,
 * with identity + memory + tools) and pushes the resulting TTS PCM to the VM
 * over the control WebSocket. The VM no longer owns the dialogue brain, so the
 * dialogue prompt is owned by winclaw — see {@link MuseTalkConfigSchema.shape.systemPrompt}.
 * The `dhMode` (function_calling / legacy) selector is now honoured in musetalk
 * mode too (it used to apply to BytePlus only).
 */
export const MuseTalkConfigSchema = z
  .object({
    /** Base URL of the dh-saas session API. @default "https://localhost:8443" */
    dhsaasUrl: z.string().default("https://localhost:8443"),
    /** Tenant bearer token used as `Authorization: Bearer {tenantToken}`. @default "" */
    tenantToken: z.string().default(""),
    /** Fallback role_id when a session does not specify one. @default "role_default_system" */
    defaultRoleId: z.string().default("role_default_system"),
    /**
     * @deprecated In the "道B" (brain-on-winclaw) architecture this field is
     * obsolete: winclaw owns the dialogue prompt (the Qwen instructions are
     * assembled from the identity markdown + memory and applied via
     * `session.update`), and the L20 VM is a pure MuseTalk renderer with no LLM.
     * The musetalk branch therefore no longer forwards `system_prompt` to
     * dh-saas.
     *
     * Retained for backward-compatibility only — removing it would break
     * validation of existing `winclaw.json` files that still set it. The value
     * is simply ignored in 道B; set the persona/language via the workspace
     * identity files (SOUL/IDENTITY/USER/AGENTS/…) instead.
     *
     * Historical behaviour (pre-道B / when the VM still ran Qwen-omni): when set,
     * the dh-saas Worker used it as the Qwen-omni instructions instead of the VM
     * YAML default, letting the avatar speak in any language / persona. @default ""
     */
    systemPrompt: z.string().default(""),
  })
  .prefault({});

export type MuseTalkConfig = z.infer<typeof MuseTalkConfigSchema>;

/**
 * Avatar provider selection block.
 *
 * - `"musetalk"` (default): dh-saas WebRTC avatar. In 道B winclaw runs the Qwen
 *   brain and pushes TTS PCM to the VM; the VM only renders the lip-sync video.
 * - `"byteplus"`: existing ByteDance virtual-human pipeline (rollback path).
 *
 * Added additively in Stage 1b — does not affect `qwen` / `bytedance`. The
 * `dhMode` selector now applies to both providers (musetalk honours it too).
 */
export const DhConfigSchema = z
  .object({
    provider: z.enum(["musetalk", "byteplus"]).default("musetalk"),
    musetalk: MuseTalkConfigSchema,
  })
  .prefault({});

export type DhConfig = z.infer<typeof DhConfigSchema>;

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

/**
 * Full validated configuration for the `digital-human` plugin.
 *
 * This schema is the single source of truth for runtime type safety. It is
 * one-to-one with the JSON Schema declared in `winclaw.plugin.json`. WinClaw
 * applies the JSON Schema at load time; `digitalHumanConfigSchema.parse()` is
 * called inside the plugin entry point as a second safety check and to produce
 * the inferred TypeScript type used throughout the codebase.
 *
 * @example
 * ```ts
 * const config = digitalHumanConfigSchema.parse(
 *   api.runtime.config.loadConfig().plugins?.entries?.['digital-human']?.config
 * );
 * ```
 */
/**
 * Runtime mode for the digital-human voice pipeline.
 *
 * - `"function_calling"` (default): Qwen 3.5 Realtime handles speech, reasoning
 *   and TTS in a single WS, calling winclaw tools via function calls.
 * - `"legacy_pipeline"`: the original STT → Gateway chat → TTS three-stage
 *   pipeline. Kept as a safety fallback during rollout.
 *
 * Applies to both avatar providers: in 道B the musetalk branch also honours
 * `dhMode` (it previously short-circuited before this was read).
 *
 * Overridable per-process via the `DH_MODE` environment variable.
 */
export const DhModeSchema = z
  .enum(["function_calling", "legacy_pipeline"])
  .default("function_calling");

export type DhMode = z.infer<typeof DhModeSchema>;

/** Resolve the DH mode from an env override, falling back to the config value. */
export function resolveDhMode(configured: DhMode | undefined): DhMode {
  const envVal = process.env.DH_MODE;
  if (envVal === "function_calling" || envVal === "legacy_pipeline") {
    return envVal;
  }
  return configured ?? "function_calling";
}

export const digitalHumanConfigSchema = z
  .object({
    qwen: QwenConfigSchema,
    bytedance: BytedanceConfigSchema,
    identity: IdentityConfigSchema,
    memory: MemoryConfigSchema,
    taskBridge: TaskBridgeConfigSchema,
    session: SessionConfigSchema,
    /** See {@link DhToolConfigSchema}. */
    dhTool: DhToolConfigSchema,
    /** See {@link DhModeSchema}. */
    dhMode: DhModeSchema.optional(),
    /** See {@link DhConfigSchema} — Stage 1b avatar provider selection. */
    dh: DhConfigSchema,
  })
  .strict();

/** Fully-resolved, type-safe configuration for the digital-human plugin. */
export type DigitalHumanConfig = z.infer<typeof digitalHumanConfigSchema>;
