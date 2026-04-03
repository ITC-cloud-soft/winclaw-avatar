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
    /** Realtime model identifier. @default "qwen3-omni-flash-realtime" */
    model: z.string().min(1).default("qwen3-omni-flash-realtime"),
    /** Voice preset for TTS synthesis. @default "Cherry" */
    voice: z.enum(["Cherry", "Serena", "Ethan", "Chelsie"]).default("Cherry"),
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
export const digitalHumanConfigSchema = z
  .object({
    qwen: QwenConfigSchema,
    bytedance: BytedanceConfigSchema,
    identity: IdentityConfigSchema,
    memory: MemoryConfigSchema,
    taskBridge: TaskBridgeConfigSchema,
    session: SessionConfigSchema,
  })
  .strict();

/** Fully-resolved, type-safe configuration for the digital-human plugin. */
export type DigitalHumanConfig = z.infer<typeof digitalHumanConfigSchema>;
