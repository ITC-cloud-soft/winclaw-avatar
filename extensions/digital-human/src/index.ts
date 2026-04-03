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
import { ZodError } from "zod";
import { WebSocketServer, WebSocket, type RawData as WsRawData } from "ws";

import { digitalHumanConfigSchema, type DigitalHumanConfig } from "./config.js";
import { SessionManager } from "./session-manager.js";
import type { SessionManagerConfig } from "./session-manager.js";
import { GatewayBridge } from "./gateway-bridge.js";
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

// (No stubs needed — all reasoning goes through GatewayBridge)

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

  const managerConfig: SessionManagerConfig = {
    config,
    workspaceDir,
    gwBridge: dhGwBridge,
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

    // Initialize the session (connects to Qwen + ByteDance DH).
    // The RealtimeSessionHandler will emit dh_stream_info to the client ws
    // automatically via its sendToClient() during initialize().
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
        return;
      }

      // ── Message routing loop ──────────────────────────────────────────
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
