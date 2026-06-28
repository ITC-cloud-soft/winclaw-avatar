/**
 * @fileoverview Digital Human plugin entry point.
 *
 * Registers the `@winclaw/digital-human` plugin with the WinClaw plugin
 * system using the standard WinClawPluginApi.
 *
 * On activation this module:
 *
 * 1. Loads and Zod-validates the plugin configuration from `winclaw.json`
 *    via `api.pluginConfig`.
 * 2. Registers a background service (`registerService`) that starts a
 *    standalone WebSocket server on port 18790 (configurable via wsPort).
 * 3. Registers HTTP admin routes (`registerHttpRoute`) for session management.
 * 4. Gracefully shuts down active sessions on service stop.
 *
 * Session orchestration (Qwen realtime, BytePlus RTC, memory-bridge,
 * identity-loader) lives in the sibling modules wired together by
 * `SessionManager` / `RealtimeSessionHandler`.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { ZodError } from "zod";
import { WebSocketServer, WebSocket, type RawData as WsRawData } from "ws";

import { EventEmitter } from "node:events";

import { digitalHumanConfigSchema, type DigitalHumanConfig } from "./config.js";
import { SessionManager } from "./session-manager.js";
import type { SessionManagerConfig } from "./session-manager.js";
import { GatewayBridge } from "./gateway-bridge.js";
import type { WebSearchResult } from "./tool-router.js";
import type {
  MemoryCorePlugin,
  MemoryGetParams,
  MemorySearchParams,
  MemorySearchResult,
} from "./memory-bridge.js";
import { parseInboundMessage } from "./ws-routes.js";

// ---------------------------------------------------------------------------
// WinClaw Plugin API type (minimal subset)
// ---------------------------------------------------------------------------

type PluginLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type WinClawPluginApiMinimal = {
  pluginConfig?: Record<string, unknown>;
  config: {
    agents?: { defaults?: { workspace?: string } };
    gateway?: { port?: number };
  };
  logger: PluginLogger;
  registerHttpRoute: (params: {
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void;
    auth: "gateway" | "plugin";
    match?: "exact" | "prefix";
  }) => void;
  registerService: (service: {
    id: string;
    start: (ctx: { workspaceDir?: string; stateDir: string }) => Promise<void> | void;
    stop?: () => Promise<void> | void;
  }) => void;
  resolvePath?: (input: string) => string;
};

// ---------------------------------------------------------------------------
// Workspace-file-backed memory-core adapter (道B §5.2)
// ---------------------------------------------------------------------------

/**
 * Lightweight {@link MemoryCorePlugin} backed directly by the workspace memory
 * files (`MEMORY.md` + `memory/YYYY-MM-DD.md`).
 *
 * winclaw does not currently expose its embedding-backed memory-core plugin to
 * extensions through the minimal plugin API, so this adapter gives the
 * digital-human session a real backend without a new dependency:
 *
 * - **search** — a keyword scan over the memory files (BM25-ish term overlap),
 *   returning the best-matching lines. This is the same corpus the MemoryBridge
 *   writes voice turns into, so recall and recording are symmetric.
 * - **get** — reads a 1-based line range from a memory file.
 * - **markDirty / reindex** — no-ops (the scan is always live; nothing to index).
 *
 * Used as the `memory` backend for both the FC ToolRouter (`memory_search` /
 * `memory_get`) and the MemoryBridge preload.
 */
class WorkspaceMemoryCore implements MemoryCorePlugin {
  constructor(private readonly workspaceDir: string) {}

  async search(params: MemorySearchParams): Promise<MemorySearchResult[]> {
    const topK = params.topK ?? 5;
    const terms = params.query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (terms.length === 0) return [];

    const files = await this.collectMemoryFiles();
    const hits: MemorySearchResult[] = [];

    for (const rel of files) {
      let content: string;
      try {
        content = await readFile(join(this.workspaceDir, rel), "utf-8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const lower = line.toLowerCase();
        let matched = 0;
        for (const term of terms) {
          if (lower.includes(term)) matched++;
        }
        if (matched > 0) {
          hits.push({
            content: line.trim(),
            source: rel,
            score: matched / terms.length,
            startLine: i + 1,
            endLine: i + 1,
          });
        }
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  async get(params: MemoryGetParams): Promise<string> {
    const abs = isAbsolute(params.filePath)
      ? params.filePath
      : join(this.workspaceDir, params.filePath);
    let content: string;
    try {
      content = await readFile(abs, "utf-8");
    } catch {
      return "";
    }
    const lines = content.split(/\r?\n/);
    const start = Math.max(1, params.startLine ?? 1);
    const end = Math.min(lines.length, params.endLine ?? lines.length);
    if (start > end) return "";
    return lines.slice(start - 1, end).join("\n");
  }

  markDirty(): void {
    /* no-op — the keyword scan is always live. */
  }

  async reindex(): Promise<void> {
    /* no-op — nothing to index. */
  }

  /**
   * Enumerate the workspace-relative memory files to scan: `MEMORY.md` plus
   * every `memory/*.md` daily log (newest first). Missing entries are skipped.
   */
  private async collectMemoryFiles(): Promise<string[]> {
    const out: string[] = ["MEMORY.md"];
    try {
      const entries = await readdir(join(this.workspaceDir, "memory"));
      const daily = entries
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .map((f) => `memory/${f}`);
      out.push(...daily);
    } catch {
      /* no memory/ dir yet — MEMORY.md only. */
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadDigitalHumanConfig(rawConfig: unknown): DigitalHumanConfig {
  try {
    return digitalHumanConfigSchema.parse(rawConfig);
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors
        .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(`[digital-human] Config validation failed:\n${messages}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HTTP response helper
// ---------------------------------------------------------------------------

function jsonResponse(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Generate session ID
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Safe send helper
// ---------------------------------------------------------------------------

/**
 * Safely send a JSON message over a WebSocket, swallowing errors.
 */
function safeSend(ws: WebSocket, msg: unknown): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  } catch (err) {
    console.error("[digital-human] safeSend error:", err);
  }
}

// ---------------------------------------------------------------------------
// Standalone WebSocket server state
// ---------------------------------------------------------------------------

let dhWss: WebSocketServer | null = null;
let dhSessionManager: SessionManager | null = null;

let dhGwBridge: GatewayBridge | null = null;

async function startDhWsServer(
  config: DigitalHumanConfig,
  workspaceDir: string,
  wsPort: number,
  gatewayPort: number,
  gatewayToken: string,
  log: PluginLogger,
): Promise<void> {
  // Connect to the WinClaw Gateway as a WS client (same as WhatsApp/Telegram)
  dhGwBridge = new GatewayBridge(gatewayPort, gatewayToken);
  try {
    await dhGwBridge.connect();
    log.info("[digital-human] GatewayBridge connected to gateway");
  } catch (err) {
    log.warn(`[digital-human] GatewayBridge connect failed (agent features unavailable): ${err}`);
    // Continue anyway — DH can still work for basic voice without agent
  }

  // ── No direct task/channel adapters ──────────────────────────────────────
  // `task_run` and `channel_send` are routed through the Gateway agent
  // pipeline (same path as WhatsApp / text-chat). The tool-router builds a
  // natural-language request, sends it via `chat.send`, and waits for the
  // agent's reply. No direct `cron.run` / `send` RPC wiring needed.
  //
  // Winclaw does not currently expose a programmatic internet-search adapter
  // to plugins (the agent `web-search` tool is tied to the CLI). Leave the
  // hook undefined so `internet_search` falls back to the "under construction"
  // stub. To enable: plug a concrete `(query) => Promise<WebSearchResult>`
  // implementation here — e.g. one that calls a configured search channel.
  //
  // TODO(plugin-host): resolve Winclaw-native web search and inject.
  const webSearchFn: ((q: string) => Promise<WebSearchResult>) | undefined =
    undefined;

  // NotifyBridge is now primarily driven by gateway chat events emitted by
  // Winclaw components (see realtime-handler FC wiring: gwBridge.onChatEvent
  // → NotifyBridge.pushFromChatEvent). We keep a local EventEmitter bus for
  // test harnesses and legacy callers that still emit `email.received` /
  // `task.completed` etc. directly.
  //
  // TODO(plugin-host): once Winclaw components are reliably pushing
  // notifications as chat events via the gateway, the winclawBus parameter
  // can be removed from SessionManagerConfig entirely.
  const winclawBus: EventEmitter = new EventEmitter();

  // Memory backend for FC-mode tools (`memory_search` / `memory_get`) and the
  // MemoryBridge preload/record path (道B §5.2). Backed by the workspace memory
  // files so recall and recording share one corpus. If winclaw later exposes
  // its embedding-backed memory-core to extensions, swap this for that instance.
  const memory: MemoryCorePlugin = new WorkspaceMemoryCore(workspaceDir);
  log.info(`[digital-human] Memory backend: WorkspaceMemoryCore (${workspaceDir})`);

  const managerConfig: SessionManagerConfig = {
    config,
    workspaceDir,
    gwBridge: dhGwBridge,
    memory,
    winclawBus,
    webSearchFn,
  };
  dhSessionManager = new SessionManager(managerConfig);
  dhSessionManager.startTimeoutChecker();

  await new Promise<void>((resolve, reject) => {
    const wss = new WebSocketServer({ port: wsPort });
    wss.once("listening", () => {
      dhWss = wss;
      resolve();
    });
    wss.once("error", reject);
  });

  dhWss!.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", `http://localhost:${wsPort}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const sessionToken = parts[parts.length - 1] ?? "";

    // ── Authentication ────────────────────────────────────────────────────
    if (!sessionToken || sessionToken.length < 8) {
      safeSend(ws, {
        type: "error",
        code: "UNAUTHORIZED",
        message: "Invalid or expired session token",
      });
      ws.close(4001, "Unauthorized");
      return;
    }

    // ── Concurrent session cap check ──────────────────────────────────────
    if (dhSessionManager!.activeCount >= config.session.maxConcurrent) {
      log.warn(
        `[digital-human] Rejected connection: concurrent limit ${config.session.maxConcurrent} reached`,
      );
      safeSend(ws, {
        type: "error",
        code: "CONCURRENT_LIMIT",
        message: `Maximum concurrent sessions (${config.session.maxConcurrent}) reached`,
      });
      ws.close(1008, "Concurrent session limit reached");
      return;
    }

    // ── Create session ────────────────────────────────────────────────────
    const sessionId = generateSessionId();

    log.info(
      `[digital-human] New connection: sessionId=${sessionId} token=${sessionToken.slice(0, 8)}…`,
    );

    // Send session.created immediately so the client knows its session ID
    // while we initialize Qwen / ByteDance DH in the background.
    safeSend(ws, {
      type: "session.created",
      sessionId,
      config: {
        voice: config.qwen.voice,
        model: config.qwen.model,
        role: config.bytedance.role,
        timeoutMinutes: config.session.timeoutMinutes,
        maxConcurrent: config.session.maxConcurrent,
      },
    });

    // ── Message routing loop ──────────────────────────────────────────
    // ★ Registered BEFORE the (~5s) async session init below, so the browser's
    //   MuseTalk WebRTC offer — sent immediately after it receives dh_stream_info
    //   (emitted mid-init) — is handled instead of silently dropped. Previously
    //   these listeners were attached only AFTER `await startSession()` completed,
    //   so an offer arriving during init (reliably so with a slower brain model)
    //   hit no listener → "musetalk offer proxy timeout" + blank avatar. The
    //   handler is registered synchronously in startSession (sessions.set) before
    //   its async init, and museTalkOfferUrl is set before dh_stream_info is
    //   emitted, so getSession + handleMuseTalkOffer are both valid on arrival.
      ws.on("message", (raw: WsRawData) => {
        // Register activity for the inactivity timeout.
        dhSessionManager!.touchActivity(sessionId);

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          safeSend(ws, {
            type: "error",
            code: "INVALID_JSON",
            message: "Message payload is not valid JSON",
            sessionId,
          });
          return;
        }

        const msg = parseInboundMessage(parsed);
        if (!msg) {
          safeSend(ws, {
            type: "error",
            code: "UNKNOWN_MESSAGE_TYPE",
            message: `Unrecognised message type: ${(parsed as Record<string, unknown>)?.["type"] ?? "unknown"}`,
            sessionId,
          });
          return;
        }

        const currentHandler = dhSessionManager!.getSession(sessionId);
        if (!currentHandler) return; // Session already cleaned up.

        switch (msg.type) {
          case "audio":
            currentHandler.handleAudioMessage(msg.data);
            break;

          case "video":
            currentHandler.handleVideoMessage(msg.data);
            break;

          case "text":
            currentHandler.handleTextMessage(msg.text);
            break;

          case "musetalk_offer":
            // MuseTalk WebRTC SDP offer — proxy server-side to dh-saas (the VM
            // sends no CORS header so the browser can't POST it directly).
            void currentHandler.handleMuseTalkOffer(msg.data.sdp, msg.data.webrtcId);
            break;

          case "ping":
            safeSend(ws, { type: "pong", sessionId });
            break;

          case "stop":
            // Client-initiated graceful disconnect.
            ws.close(1000, "Client requested session stop");
            break;
        }
      });

      // ── Graceful disconnect ───────────────────────────────────────────
      ws.on("close", (code: number, reason: Buffer) => {
        const reasonStr = reason.toString();
        log.info(
          `[digital-human] Session ${sessionId} closed: code=${code} reason="${reasonStr}"`,
        );
        // stopSession is idempotent — safe even if already removed by timeout.
        dhSessionManager?.stopSession(sessionId).catch((err) => {
          log.error(
            `[digital-human] Error stopping session ${sessionId} on close: ${String(err)}`,
          );
        });
      });

      // ── Error handling ────────────────────────────────────────────────
      ws.on("error", (err: Error) => {
        log.error(
          `[digital-human] WebSocket error on session ${sessionId}: ${err.message}`,
        );
        safeSend(ws, {
          type: "error",
          code: "WEBSOCKET_ERROR",
          message: err.message,
          sessionId,
        });
        dhSessionManager?.stopSession(sessionId).catch((stopErr) => {
          log.error(
            `[digital-human] Error stopping session ${sessionId} after WS error: ${String(stopErr)}`,
          );
        });
      });

    // ── Initialize the session (async) ────────────────────────────────────
    // Connects to Qwen + dh-saas and emits dh_stream_info to the client during
    // initialize(). The listeners above are already attached, so the WebRTC
    // offer the browser sends right after dh_stream_info is handled (not dropped).
    void (async () => {
      try {
        await dhSessionManager!.startSession(sessionId, ws);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Session initialization failed";
        log.error(`[digital-human] Failed to start session ${sessionId}: ${message}`);
        safeSend(ws, {
          type: "error",
          code: "SESSION_INIT_FAILED",
          message,
          sessionId,
        });
        ws.close(1011, "Session initialization failed");
      }
    })();
  });

  dhWss!.on("error", (err: Error) => {
    log.error(`[digital-human] WS server error: ${err.message}`);
  });

  log.info(`[digital-human] WebSocket server listening on ws://localhost:${wsPort}/api/dh/connect/:token`);
}

async function stopDhWsServer(): Promise<void> {
  if (dhSessionManager) {
    await dhSessionManager.shutdownAll().catch(() => {});
    dhSessionManager.stopTimeoutChecker();
    dhSessionManager = null;
  }
  if (dhGwBridge) {
    dhGwBridge.disconnect();
    dhGwBridge = null;
  }
  if (dhWss) {
    await new Promise<void>((resolve) => dhWss!.close(() => resolve()));
    dhWss = null;
  }
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/**
 * WinClaw plugin registration function.
 * Called once by the WinClaw plugin loader when the `digital-human` plugin
 * entry is enabled in `winclaw.json`.
 */
export default function digitalHumanPlugin(api: WinClawPluginApiMinimal): void {
  if (process.env.AVATAR_EXT_MEMORY_WIKI === "1") { void import("@winclaw-avatar/ext-memory-wiki/register").then((m) => (m as { register?: (a: unknown) => unknown }).register?.(api)).catch(() => {}); }
  if (process.env.AVATAR_EXT_COMPACTION_REGISTRY === "1") { void import("@winclaw-avatar/ext-compaction/register").then((m) => (m as { register?: (a: unknown) => unknown }).register?.(api)).catch(() => {}); }
  if (process.env.AVATAR_EXT_AGENT_CONTROLS === "1") { void import("@winclaw-avatar/avatar-agent-controls/register").then((m) => (m as { register?: (a: unknown) => unknown }).register?.(api)).catch(() => {}); }
  if (process.env.AVATAR_EXT_MEDIA_INTENT === "1") { void import("@winclaw-avatar/ext-media-intent/register").then((m) => (m as { register?: (a: unknown) => unknown }).register?.(api)).catch(() => {}); }
  if (process.env.AVATAR_EXT_CHANNEL_FASTPATH === "1") { void import("@winclaw-avatar/ext-channel-fastpath/register").then((m) => (m as { register?: (a: unknown) => unknown }).register?.(api)).catch(() => {}); }
  // 1. Load and validate plugin config
  const config = loadDigitalHumanConfig(api.pluginConfig ?? {});

  // 2. Resolve workspace directory and WS port
  const workspaceDir =
    api.config?.agents?.defaults?.workspace ??
    (api.resolvePath ? api.resolvePath("workspace") : process.cwd());

  // WS port: prefer config extension wsPort, fall back to gateway port + 1 or 18790
  const gatewayPort = api.config?.gateway?.port ?? 18789;
  const wsPort = (api.pluginConfig?.wsPort as number | undefined) ?? gatewayPort + 1;
  const gatewayToken = (api.config?.gateway as Record<string, unknown>)?.auth
    ? ((api.config.gateway as Record<string, unknown>).auth as Record<string, string>)?.token ?? ""
    : "";

  // 3. Register background service — starts the standalone WS server
  api.registerService({
    id: "digital-human-ws",
    start: async (ctx) => {
      const dir = ctx.workspaceDir ?? workspaceDir;
      await startDhWsServer(config, dir, wsPort, gatewayPort, gatewayToken, api.logger);
    },
    stop: async () => {
      await stopDhWsServer();
    },
  });

  // 4. Register HTTP admin routes
  api.registerHttpRoute({
    path: "/api/dh/health",
    auth: "gateway",
    handler: (_req, res) => {
      jsonResponse(res, 200, {
        plugin: "digital-human",
        status: "ok",
        activeSessions: dhSessionManager?.activeCount ?? 0,
        wsPort,
        timestamp: new Date().toISOString(),
      });
      return true;
    },
  });

  api.registerHttpRoute({
    path: "/api/dh/sessions",
    auth: "gateway",
    handler: (_req, res) => {
      const sessions = (dhSessionManager?.listSessions() ?? []).map((s) => ({
        sessionId: s.sessionId,
        startedAt: new Date(s.createdAt).toISOString(),
        lastActivityAt: new Date(s.lastActivityAt).toISOString(),
      }));
      jsonResponse(res, 200, { sessions, count: sessions.length });
      return true;
    },
  });

  api.registerHttpRoute({
    path: "/api/dh/sessions/",
    auth: "gateway",
    match: "prefix",
    handler: async (req, res) => {
      if (req.method !== "POST") return false;
      const urlPath = req.url ?? "/";
      const m = urlPath.match(/\/api\/dh\/sessions\/([^/]+)\/stop(?:\?.*)?$/);
      if (!m) return false;
      const sessionId = m[1]!;
      if (!dhSessionManager?.getSession(sessionId)) {
        jsonResponse(res, 404, { error: "Session not found", sessionId });
        return true;
      }
      await dhSessionManager!.stopSession(sessionId);
      jsonResponse(res, 200, { stopped: true, sessionId });
      return true;
    },
  });

  api.logger.info(
    `[digital-human] Plugin registered. WS server will start on port ${wsPort}.`,
  );
}
