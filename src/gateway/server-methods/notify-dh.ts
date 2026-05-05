/**
 * @file notify-dh.ts
 * @description Gateway RPC handler for `notify.dh` — the canonical way for
 * Winclaw internal components (agents, skills, hooks, automations) to push
 * voice notifications into Digital Human (DH) sessions.
 *
 * ## Wire contract
 *
 * ```ts
 * await gateway.request("notify.dh", {
 *   sessionId?: string,                     // omit to broadcast to all DH sessions
 *   priority: "high" | "normal" | "low",
 *   text: string,                           // min 1 char
 *   hintLanguage?: string,                  // e.g. "ja", "en"
 *   source?: string,                        // "email" | "task" | "calendar" | "channel" | ...
 *   dedupKey?: string,
 * });
 * ```
 *
 * ## Delivery strategy
 *
 * A `chat` event is emitted (via the gateway broadcaster) with
 * `state: "final"` and a message text prefixed with a priority marker
 * (`[HIGH]` / `[NORMAL]` / `[LOW]`). The DH plugin's {@link NotifyBridge}
 * subscribes to dedicated notification session keys and parses these markers
 * out again.
 *
 * The event is addressed using a dedicated sessionKey:
 *
 * - `dh-notify:<sessionId>`  — when a specific sessionId is provided
 * - `dh-notify:broadcast`    — when no sessionId is provided (fan-out)
 *
 * DH sessions register listeners on BOTH their own `dh-notify:<id>` key AND
 * the `dh-notify:broadcast` key so either form reaches every active avatar.
 *
 * The gateway broadcaster delivers the event to every connected client, and
 * the DH-side gateway-bridge routes it by sessionKey to whichever handler
 * (NotifyBridge forwarder) is registered — no subscription registry is
 * required on the gateway side.
 */

import { z } from "zod";
import {
  ErrorCodes,
  errorShape,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const NotifyDhParamsSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  priority: z.enum(["high", "normal", "low"]),
  text: z.string().min(1),
  hintLanguage: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  dedupKey: z.string().trim().min(1).optional(),
});

export type NotifyDhParams = z.infer<typeof NotifyDhParamsSchema>;

// ---------------------------------------------------------------------------
// sessionKey helpers
// ---------------------------------------------------------------------------

/** Dedicated notification sessionKey for a specific DH session. */
export function dhNotifySessionKey(sessionId: string): string {
  return `dh-notify:${sessionId}`;
}

/** Well-known broadcast sessionKey subscribed by every DH session. */
export const DH_NOTIFY_BROADCAST_SESSION_KEY = "dh-notify:broadcast";

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

function priorityMarker(priority: NotifyDhParams["priority"]): string {
  // NotifyBridge.parseChatNotification accepts [HIGH]/[LOW]/[NOTIFY]/[URGENT].
  // "normal" has no dedicated marker; use [NOTIFY] so the bridge still
  // classifies it as a notification rather than a regular agent reply.
  switch (priority) {
    case "high":
      return "[HIGH]";
    case "low":
      return "[LOW]";
    default:
      return "[NOTIFY]";
  }
}

/**
 * Build the chat-event payload that NotifyBridge.pushFromChatEvent consumes.
 * Exported for unit tests.
 */
export function buildNotifyDhChatPayload(params: {
  sessionKey: string;
  runId: string;
  params: NotifyDhParams;
  now?: number;
}): {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "final";
  message: {
    role: string;
    content: Array<{ type: "text"; text: string }>;
    timestamp: number;
  };
} {
  const { priority, text, hintLanguage, source, dedupKey } = params.params;
  const marker = priorityMarker(priority);
  const body = `${marker} ${text}`;
  return {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq: 0,
    state: "final",
    message: {
      role: "system",
      content: [{ type: "text", text: body }],
      timestamp: params.now ?? Date.now(),
    },
    // Extra hints are carried alongside the message; NotifyBridge ignores
    // unknown fields on the envelope so this is additive only.
    ...(hintLanguage || source || dedupKey
      ? {
          notifyMeta: {
            ...(hintLanguage ? { hintLanguage } : {}),
            ...(source ? { source } : {}),
            ...(dedupKey ? { dedupKey } : {}),
          },
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const notifyDhHandlers: GatewayRequestHandlers = {
  "notify.dh": ({ params, respond, context }) => {
    const parsed = NotifyDhParamsSchema.safeParse(params);
    if (!parsed.success) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid notify.dh params: ${parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ")}`,
        ),
      );
      return;
    }

    const p = parsed.data;
    const now = Date.now();
    const sessionIds: string[] = p.sessionId
      ? [p.sessionId]
      : [];
    // When sessionId omitted, emit only on the broadcast key. DH sessions
    // subscribe to `dh-notify:broadcast` in addition to their own key, so a
    // single event reaches every active avatar.
    const sessionKeys = p.sessionId
      ? [dhNotifySessionKey(p.sessionId)]
      : [DH_NOTIFY_BROADCAST_SESSION_KEY];

    let deliveredTo = 0;
    for (const sessionKey of sessionKeys) {
      const runId = `notify-${now}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = buildNotifyDhChatPayload({
        sessionKey,
        runId,
        params: p,
        now,
      });
      try {
        // Fan out via the gateway broadcaster. Connected DH clients filter
        // by sessionKey on their side (via GatewayBridge.onChatEvent).
        context.broadcast("chat", payload);
        context.nodeSendToSession(sessionKey, "chat", payload);
        deliveredTo += 1;
      } catch (err) {
        context.logGateway.warn(
          `notify.dh broadcast failed sessionKey=${sessionKey} err=${String(err)}`,
        );
      }
    }

    context.logGateway.info(
      `notify.dh dispatched priority=${p.priority} sessionIds=${
        sessionIds.length > 0 ? sessionIds.join(",") : "<broadcast>"
      } source=${p.source ?? "-"} dedupKey=${p.dedupKey ?? "-"}`,
    );

    respond(true, {
      ok: true,
      deliveredTo,
      sessionKeys,
    });
  },
};
