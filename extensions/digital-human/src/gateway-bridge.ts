/**
 * @fileoverview GatewayBridge — lightweight WebSocket client that connects
 * back to the WinClaw Gateway on ws://127.0.0.1:{port}.
 *
 * Implements the Gateway wire protocol (req/res/event frames) to:
 *   1. Send `chat.send` RPCs (user speech → agent pipeline)
 *   2. Receive `chat` events (agent response deltas/finals)
 *
 * This makes the DH plugin work exactly like WhatsApp/Telegram — a channel
 * that routes through the full agent pipeline with tools + memory.
 */

import WebSocket from "ws";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
    timestamp: number;
  };
  errorMessage?: string;
  usage?: { input: number; output: number; totalTokens: number };
  stopReason?: string;
}

type ChatEventHandler = (payload: ChatEventPayload) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingRun {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
  buffer: string;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// GatewayBridge
// ---------------------------------------------------------------------------

export class GatewayBridge {
  private ws: WebSocket | null = null;
  private readonly gatewayUrl: string;
  private readonly token: string;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private chatEventHandlers = new Map<string, ChatEventHandler>(); // sessionKey → handler
  private pendingRuns = new Map<string, PendingRun>(); // runId → awaiter
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualClose = false;
  private connectRequestId: string | null = null;

  constructor(gatewayPort: number, token: string) {
    this.gatewayUrl = `ws://127.0.0.1:${gatewayPort}`;
    this.token = token;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isManualClose = false;
      try {
        this.ws = new WebSocket(this.gatewayUrl);
      } catch (err) {
        reject(err);
        return;
      }

      let settled = false;

      this.ws.on("open", () => {
        console.log("[GatewayBridge] Connected to gateway");
        this.reconnectAttempts = 0;
      });

      this.ws.on("message", (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        // Handle connect challenge
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const nonce = (msg.payload as Record<string, unknown>)?.nonce ?? "";
          this.connectRequestId = randomUUID();
          this.sendFrame({
            type: "req",
            id: this.connectRequestId,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "gateway-client",
                version: "1.0.0",
                platform: "node",
                mode: "backend",
              },
              auth: {
                token: this.token,
              },
              role: "operator",
              scopes: ["operator.read", "operator.write", "operator.admin"],
              caps: [],
            },
          });
          return;
        }

        // Handle RPC responses
        if (msg.type === "res") {
          const id = msg.id as string;

          // Check if this is the connect response (authentication result)
          if (id === this.connectRequestId) {
            this.connectRequestId = null;
            if (msg.ok) {
              this.connected = true;
              if (!settled) { settled = true; resolve(); }
              console.log("[GatewayBridge] Authenticated with gateway");
            } else {
              const err = msg.error as { message?: string } | undefined;
              console.error("[GatewayBridge] Auth failed:", err?.message);
              if (!settled) { settled = true; reject(new Error(err?.message ?? "Auth failed")); }
            }
            return;
          }

          // Regular RPC response
          const pending = this.pendingRequests.get(id);
          if (pending) {
            this.pendingRequests.delete(id);
            clearTimeout(pending.timer);
            if (msg.ok) {
              pending.resolve(msg.payload);
            } else {
              const err = msg.error as { message?: string } | undefined;
              pending.reject(new Error(err?.message ?? "RPC error"));
            }
          }
          return;
        }

        // Handle events (chat events)
        if (msg.type === "event" && msg.event === "chat") {
          const payload = msg.payload as ChatEventPayload;
          if (payload?.sessionKey) {
            const handler = this.chatEventHandlers.get(payload.sessionKey);
            if (handler) {
              try { handler(payload); } catch (e) {
                console.error("[GatewayBridge] Chat event handler error:", e);
              }
            }
          }
          // Also route to per-runId awaiters (chatSendAndWait).
          if (payload?.runId) {
            this.dispatchToPendingRun(payload);
          }
          return;
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        console.log("[GatewayBridge] Disconnected from gateway");
        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
        console.error("[GatewayBridge] WebSocket error:", err.message);
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Gateway connection timeout"));
        }
      }, 10_000);
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("GatewayBridge disconnected"));
    }
    this.pendingRequests.clear();
    for (const [, pending] of this.pendingRuns) {
      clearTimeout(pending.timer);
      pending.reject(new Error("GatewayBridge disconnected"));
    }
    this.pendingRuns.clear();
  }

  /**
   * Send user message to the WinClaw agent pipeline via chat.send RPC.
   * Returns the runId. Actual response arrives via chat events.
   */
  async chatSend(sessionKey: string, message: string): Promise<string> {
    const idempotencyKey = randomUUID();
    console.info(
      `[GW:${sessionKey}] ↗️ chat.send runId=<pending>  msg="${message.slice(0, 150)}"`
    );
    const res = await this.request("chat.send", {
      sessionKey,
      message,
      idempotencyKey,
      deliver: false,
    });
    // Gateway returns { runId, status } — use the real runId for event matching
    const runId = (res as any)?.runId || idempotencyKey;
    console.info(`[GW:${sessionKey}] ↗️ chat.send runId=${runId}  ack`);
    return runId;
  }

  /**
   * Send a chat message and wait for its final (or error) response.
   * Accumulates deltas and resolves with the full final text.
   *
   * Coexists with {@link onChatEvent} — both fire for the same events when
   * both are registered. Useful for DH function-calling where a tool call
   * needs to route through the same Gateway agent pipeline that WhatsApp /
   * text-chat use, and then return the agent's reply to Qwen as a tool result.
   *
   * @throws on `error` / `aborted` states, or when the timeout elapses.
   */
  async chatSendAndWait(
    sessionKey: string,
    message: string,
    opts?: { timeoutMs?: number },
  ): Promise<string> {
    const timeoutMs = opts?.timeoutMs ?? 180_000;
    const runId = await this.chatSend(sessionKey, message);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRuns.delete(runId);
        console.warn(
          `[GW:${sessionKey}] ⚠️ chat.timeout runId=${runId}  waited ${timeoutMs}ms`
        );
        reject(new Error("chatSendAndWait: timeout"));
      }, timeoutMs);
      this.pendingRuns.set(runId, {
        resolve: (value) => {
          clearTimeout(timer);
          this.pendingRuns.delete(runId);
          console.info(
            `[GW:${sessionKey}] ↘️ chat.final runId=${runId}  text="${(value ?? "").slice(0, 150)}"`
          );
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          this.pendingRuns.delete(runId);
          console.warn(
            `[GW:${sessionKey}] ⚠️ chat.error runId=${runId}  ${err instanceof Error ? err.message : String(err)}`
          );
          reject(err);
        },
        buffer: "",
        timer,
      });
    });
  }

  /**
   * Send a chat message and wait — but only for a short early deadline.
   *
   * Resolves to one of two shapes:
   *
   *   { done: true,  text }                          — agent replied fast
   *   { done: false, runId, continuation }           — early deadline fired;
   *       `continuation` is a promise that resolves with the eventual final
   *       text when the agent truly finishes (up to `lateTimeoutMs` later).
   *       It rejects on the late deadline or on agent error/abort.
   *
   * This is the building block for the Phase C "async receipt" pattern —
   * caller returns the receipt to Qwen immediately, and pipes the late
   * `continuation` into `notify.dh` for spoken announcement.
   *
   * Flow trace:
   *   chat.send RPC → runId
   *     ├─ within earlyTimeoutMs → final → { done:true, text }
   *     └─ earlyTimeoutMs elapses → { done:false, runId, continuation }
   *                                   continuation keeps same pendingRun entry
   *                                   with extended lateTimeoutMs deadline.
   */
  async chatSendAsync(
    sessionKey: string,
    message: string,
    opts?: { earlyTimeoutMs?: number; lateTimeoutMs?: number },
  ): Promise<
    | { done: true; text: string }
    | { done: false; runId: string; continuation: Promise<string> }
  > {
    const earlyTimeoutMs = opts?.earlyTimeoutMs ?? 15_000;
    const lateTimeoutMs = opts?.lateTimeoutMs ?? 600_000;
    const runId = await this.chatSend(sessionKey, message);

    // Tri-state outcome resolved by whichever of these fires first:
    //   1. final/error arrives before earlyTimeoutMs → "fast" path
    //   2. earlyTimeoutMs elapses                    → "late" path; we
    //      switch the pendingRun onto a fresh `latePromise` and a new
    //      lateTimeoutMs timer; the caller awaits `continuation`.
    let earlySettle!: (
      outcome: { kind: "fast-final"; text: string }
        | { kind: "fast-error"; err: Error }
        | { kind: "late-start" },
    ) => void;
    const earlyOutcome = new Promise<
      | { kind: "fast-final"; text: string }
      | { kind: "fast-error"; err: Error }
      | { kind: "late-start" }
    >((r) => { earlySettle = r; });

    let lateResolve!: (v: string) => void;
    let lateReject!: (err: Error) => void;
    const continuation = new Promise<string>((res, rej) => {
      lateResolve = res;
      lateReject = rej;
    });

    let earlyFired = false;
    let settled = false;
    let lateTimer: ReturnType<typeof setTimeout> | null = null;

    const earlyTimer = setTimeout(() => {
      if (settled) return;
      earlyFired = true;
      earlySettle({ kind: "late-start" });
      // Re-arm the pendingRun with a long deadline. The entry stays in
      // the map so dispatchToPendingRun can still route final/error here.
      const pending = this.pendingRuns.get(runId);
      if (pending) {
        clearTimeout(pending.timer);
        lateTimer = setTimeout(() => {
          this.pendingRuns.delete(runId);
          console.warn(
            `[GW:${sessionKey}] ⚠️ chat.late-timeout runId=${runId}  waited ${lateTimeoutMs}ms`,
          );
          lateReject(new Error("chatSendAsync: late timeout"));
        }, lateTimeoutMs);
        pending.timer = lateTimer;
      } else {
        lateReject(new Error("chatSendAsync: pendingRun vanished"));
      }
    }, earlyTimeoutMs);

    this.pendingRuns.set(runId, {
      resolve: (value) => {
        settled = true;
        clearTimeout(earlyTimer);
        if (lateTimer) clearTimeout(lateTimer);
        this.pendingRuns.delete(runId);
        if (earlyFired) {
          console.info(
            `[GW:${sessionKey}] ↘️ chat.late-final runId=${runId}  text="${(value ?? "").slice(0, 150)}"`,
          );
          lateResolve(value);
        } else {
          console.info(
            `[GW:${sessionKey}] ↘️ chat.final runId=${runId}  text="${(value ?? "").slice(0, 150)}"`,
          );
          earlySettle({ kind: "fast-final", text: value });
        }
      },
      reject: (err) => {
        settled = true;
        clearTimeout(earlyTimer);
        if (lateTimer) clearTimeout(lateTimer);
        this.pendingRuns.delete(runId);
        if (earlyFired) {
          lateReject(err);
        } else {
          earlySettle({ kind: "fast-error", err });
        }
      },
      buffer: "",
      timer: earlyTimer,
    });

    const outcome = await earlyOutcome;
    if (outcome.kind === "fast-final") {
      return { done: true, text: outcome.text };
    }
    if (outcome.kind === "fast-error") {
      throw outcome.err;
    }
    return { done: false, runId, continuation };
  }

  /**
   * Register a handler for chat events on a specific sessionKey.
   */
  onChatEvent(sessionKey: string, handler: ChatEventHandler): void {
    this.chatEventHandlers.set(sessionKey, handler);
  }

  /**
   * Unregister a chat event handler.
   */
  offChatEvent(sessionKey: string): void {
    this.chatEventHandlers.delete(sessionKey);
  }

  /**
   * Check whether a given runId is currently being awaited by
   * {@link chatSendAndWait}. Used by listeners (e.g. NotifyBridge) to skip
   * events that originate from an in-flight tool-call round-trip so they
   * are not double-handled (once as tool result, once as system notification).
   */
  isPendingRun(runId: string): boolean {
    return this.pendingRuns.has(runId);
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  async request(method: string, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("GatewayBridge not connected");
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 60_000);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.sendFrame({ type: "req", id, method, params });
    });
  }

  private dispatchToPendingRun(payload: ChatEventPayload): void {
    const pending = this.pendingRuns.get(payload.runId);
    if (!pending) return;

    const text = payload.message?.content?.[0]?.text ?? "";

    switch (payload.state) {
      case "delta":
        if (text) pending.buffer += text;
        return;
      case "final": {
        // Prefer the final message text if present; fall back to accumulated deltas.
        const finalText = text || pending.buffer;
        pending.resolve(finalText);
        return;
      }
      case "error":
        pending.reject(new Error(payload.errorMessage ?? "chat run error"));
        return;
      case "aborted":
        pending.reject(new Error("chat run aborted"));
        return;
    }
  }

  private sendFrame(frame: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[GatewayBridge] Max reconnect attempts reached");
      return;
    }
    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
    console.log(`[GatewayBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualClose) {
        this.connect().catch((err) => {
          console.error("[GatewayBridge] Reconnect failed:", err.message);
        });
      }
    }, delay);
  }
}
