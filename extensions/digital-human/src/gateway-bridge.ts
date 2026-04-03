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
  }

  /**
   * Send user message to the WinClaw agent pipeline via chat.send RPC.
   * Returns the runId. Actual response arrives via chat events.
   */
  async chatSend(sessionKey: string, message: string): Promise<string> {
    const idempotencyKey = randomUUID();
    await this.request("chat.send", {
      sessionKey,
      message,
      idempotencyKey,
      deliver: false,
    });
    return idempotencyKey;
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
