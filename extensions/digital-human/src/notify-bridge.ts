/**
 * @file notify-bridge.ts
 * @description Bridges Winclaw events into the Qwen Realtime session so the
 * digital human can verbalize owner notifications (new mail, task completion,
 * calendar reminders, channel mentions).
 *
 * ## Design
 *
 * Winclaw internally publishes events on an {@link EventEmitter} ("winclawBus").
 * This bridge subscribes to a fixed catalogue of event names, converts each
 * payload into a language-agnostic {@link NotifyItem}, and schedules it for
 * injection into the Qwen conversation as a `system` role message via
 * {@link QwenRealtimeClient.sendSystemEvent}. Qwen then verbalises the message
 * in the owner's preferred language (driven by system instructions).
 *
 * ## Priority semantics
 *
 * - `high`    — Inject immediately. Qwen's server-side VAD is configured with
 *               `interrupt_response: true`, so an in-flight response will be
 *               auto-cancelled to make room for the new one.
 * - `normal`  — Buffered; the next `responseDone` from the client triggers one
 *               flush. If no response is active, flushes immediately instead.
 * - `low`     — Same as `normal` today (piggy-back on `responseDone`). A future
 *               iteration may delay low-priority notifications until an
 *               observed user turn so they feel like conversational asides.
 *               TODO: gate low-priority flushes on user-transcript activity.
 *
 * ## Deduplication
 *
 * Items may set `dedupKey`. If the same key has been delivered within
 * `dedupWindowMs` (default 60s), later items are silently dropped.
 *
 * ## Queue overflow
 *
 * When the internal queue exceeds `maxQueueSize`, entries are discarded in
 * priority order (low → normal). `high` items are never dropped.
 *
 * ## Integration plan (next phase)
 *
 * The following wiring will happen in a future pass over `realtime-handler.ts`
 * (this file MUST NOT be touched in Phase 3):
 *
 *   1. After the `QwenRealtimeClient` instance for a session is constructed
 *      and `connect()` has resolved, create a `NotifyBridge` using that client
 *      and a `winclawBus: EventEmitter` obtained from the plugin host context.
 *   2. Keep the bridge alive for the lifetime of the session.
 *   3. On session teardown (disconnect, error, process exit) call
 *      `bridge.dispose()` BEFORE disconnecting the Qwen client so pending
 *      notifications are not emitted into a closing socket.
 *
 * Pseudo-code for the integration step:
 *
 * ```ts
 * const notifyBridge = new NotifyBridge({
 *   qwenClient,
 *   winclawBus: host.getEventBus(),
 * });
 * session.onCleanup(() => notifyBridge.dispose());
 * ```
 */

import type { EventEmitter } from "node:events";
import type { QwenRealtimeClient } from "./integrations/qwen-realtime.js";
import type { ChatEventPayload } from "./gateway-bridge.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NotifyPriority = "high" | "normal" | "low";

export interface NotifyItem {
  /** Unique id used to guard against double-enqueue in test/integration code. */
  id: string;
  priority: NotifyPriority;
  /** Short human-readable description; Qwen will re-word in owner's language. */
  summary: string;
  /** Optional BCP-47ish hint passed through to Qwen (e.g. "ja", "en"). */
  hintLanguage?: string;
  /** Originating subsystem: "email" | "calendar" | "task" | "channel" | etc. */
  source?: string;
  /** When the event was received by the bridge. */
  receivedAt: Date;
  /** Items sharing the same key within `dedupWindowMs` are collapsed. */
  dedupKey?: string;
}

export interface NotifyBridgeLogger {
  info: (m: string, ...a: unknown[]) => void;
  warn: (m: string, ...a: unknown[]) => void;
  error: (m: string, ...a: unknown[]) => void;
}

export interface NotifyBridgeOptions {
  qwenClient: QwenRealtimeClient;
  /** EventEmitter carrying winclaw domain events. */
  winclawBus: EventEmitter;
  /** Ms between allowed deliveries for the same dedupKey. Default 60_000. */
  dedupWindowMs?: number;
  /** Max queue length before dropping low-priority. Default 20. */
  maxQueueSize?: number;
  /** Optional logger. Defaults to console. */
  logger?: NotifyBridgeLogger;
}

// ---------------------------------------------------------------------------
// Winclaw event payload contracts (duck-typed — only fields we consume).
// ---------------------------------------------------------------------------

interface EmailReceivedPayload {
  from?: string;
  subject?: string;
  preview?: string;
}

interface TaskCompletedPayload {
  name?: string;
  resultSummary?: string;
  urgent?: boolean;
}

interface CalendarReminderPayload {
  title?: string;
  minutesUntil?: number;
}

interface ChannelMessagePayload {
  channel?: string;
  sender?: string;
  preview?: string;
  mention?: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<NotifyPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Bridges winclaw events to the digital-human voice channel as spoken
 * notifications.
 */
export class NotifyBridge {
  private readonly queue: NotifyItem[] = [];
  private readonly recentlyDelivered = new Map<string, number>();
  /** Ordered list of teardown callbacks for `.dispose()`. */
  private readonly teardown: Array<() => void> = [];

  private readonly dedupWindowMs: number;
  private readonly maxQueueSize: number;
  private readonly log: NotifyBridgeLogger;

  /** True while Qwen is generating a response (set by `responseStarted`). */
  private isSessionResponding = false;
  /** Counter used to generate unique ids when caller omits them. */
  private idCounter = 0;
  /** Flag set once `.dispose()` has been called — blocks further delivery. */
  private disposed = false;
  /** Guard so concurrent push/responseDone calls do not overlap `_flush()`. */
  private flushing = false;

  constructor(private readonly opts: NotifyBridgeOptions) {
    this.dedupWindowMs = opts.dedupWindowMs ?? 60_000;
    this.maxQueueSize = opts.maxQueueSize ?? 20;
    this.log = opts.logger ?? {
      // eslint-disable-next-line no-console
      info: (m, ...a) => console.log(`[NotifyBridge] ${m}`, ...a),
      // eslint-disable-next-line no-console
      warn: (m, ...a) => console.warn(`[NotifyBridge] ${m}`, ...a),
      // eslint-disable-next-line no-console
      error: (m, ...a) => console.error(`[NotifyBridge] ${m}`, ...a),
    };

    this._subscribe();
  }

  // -------------------------------------------------------------------------
  // Subscription wiring
  // -------------------------------------------------------------------------

  private _subscribe(): void {
    const bus = this.opts.winclawBus;
    const qwen = this.opts.qwenClient;

    // --- winclaw domain events ---
    const onEmail = (p: EmailReceivedPayload): void => {
      // 日本語ユーザー向けのサマリ（Qwen が owner 言語で言い直す）
      const from = p?.from ?? "不明な差出人";
      const subject = p?.subject ?? "(件名なし)";
      this.push({
        priority: "normal",
        source: "email",
        summary: `新着メール: ${from} 「${subject}」`,
        dedupKey: `email:${from}:${subject}`,
      });
    };
    const onTask = (p: TaskCompletedPayload): void => {
      const name = p?.name ?? "タスク";
      const result = p?.resultSummary ? `: ${p.resultSummary}` : "";
      this.push({
        priority: p?.urgent ? "high" : "low",
        source: "task",
        summary: `タスク完了: ${name}${result}`,
        dedupKey: `task:${name}`,
      });
    };
    const onCalendar = (p: CalendarReminderPayload): void => {
      const title = p?.title ?? "予定";
      const minutes = typeof p?.minutesUntil === "number" ? p.minutesUntil : 15;
      const priority: NotifyPriority = minutes <= 5 ? "high" : "normal";
      this.push({
        priority,
        source: "calendar",
        summary: `カレンダーリマインド: ${minutes} 分後に「${title}」`,
        dedupKey: `calendar:${title}`,
      });
    };
    const onChannel = (p: ChannelMessagePayload): void => {
      const channel = p?.channel ?? "チャンネル";
      const sender = p?.sender ?? "誰か";
      const preview = p?.preview ?? "";
      this.push({
        priority: p?.mention ? "high" : "normal",
        source: "channel",
        summary: `#${channel} ${sender}: ${preview}`,
        dedupKey: `channel:${channel}:${sender}:${preview}`,
      });
    };

    bus.on("email.received", onEmail);
    bus.on("task.completed", onTask);
    bus.on("calendar.reminder", onCalendar);
    bus.on("channel.message", onChannel);
    this.teardown.push(() => bus.off("email.received", onEmail));
    this.teardown.push(() => bus.off("task.completed", onTask));
    this.teardown.push(() => bus.off("calendar.reminder", onCalendar));
    this.teardown.push(() => bus.off("channel.message", onChannel));

    // --- Qwen lifecycle events ---
    const onResponseStarted = (): void => {
      this.isSessionResponding = true;
    };
    const onResponseDone = (): void => {
      this.isSessionResponding = false;
      // Flush one non-high item now that the session is idle.
      void this._flush();
    };

    qwen.on("responseStarted", onResponseStarted);
    qwen.on("responseDone", onResponseDone);
    this.teardown.push(() => qwen.off("responseStarted", onResponseStarted));
    this.teardown.push(() => qwen.off("responseDone", onResponseDone));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Enqueue a notification manually. Auto-fills `id` and `receivedAt` if missing.
   */
  push(
    item: Omit<NotifyItem, "id" | "receivedAt"> &
      Partial<Pick<NotifyItem, "id" | "receivedAt">>
  ): void {
    if (this.disposed) {
      this.log.warn("push() called after dispose() — dropped", item.summary);
      return;
    }

    const now = Date.now();

    // Deduplication
    if (item.dedupKey) {
      const lastDelivered = this.recentlyDelivered.get(item.dedupKey);
      if (lastDelivered !== undefined && now - lastDelivered < this.dedupWindowMs) {
        this.log.info(`dedup drop: ${item.dedupKey}`);
        return;
      }
      // Also collapse same-key items still sitting in the queue.
      if (this.queue.some((q) => q.dedupKey === item.dedupKey)) {
        this.log.info(`dedup drop (queued): ${item.dedupKey}`);
        return;
      }
    }

    const full: NotifyItem = {
      id: item.id ?? `ntf-${++this.idCounter}-${now}`,
      receivedAt: item.receivedAt ?? new Date(now),
      priority: item.priority,
      summary: item.summary,
      hintLanguage: item.hintLanguage,
      source: item.source,
      dedupKey: item.dedupKey,
    };

    // Priority-sorted insert (stable for equal priority).
    const rank = PRIORITY_RANK[full.priority];
    let insertAt = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (PRIORITY_RANK[this.queue[i]!.priority] > rank) {
        insertAt = i;
        break;
      }
    }
    this.queue.splice(insertAt, 0, full);

    this._enforceCapacity();
    void this._flush();
  }

  /**
   * Enqueue a notification derived from a Gateway chat event. Used to wire
   * the "Winclaw → Agent → chat event → voice" push path.
   *
   * Filtering rules:
   *   - Only `state === "final"` events are surfaced.
   *   - The text is scanned for a priority marker prefix (`[URGENT]` /
   *     `[HIGH]` / `[LOW]`) that determines {@link NotifyPriority}. Missing
   *     marker → `normal`.
   *   - Events without an explicit notification marker (either the priority
   *     prefix OR a `[NOTIFY]` prefix OR `role === "system"` in the
   *     message) are ignored, so regular agent replies do not leak into
   *     the notification stream.
   */
  pushFromChatEvent(payload: ChatEventPayload): void {
    if (this.disposed) return;
    if (!payload || payload.state !== "final") return;

    const rawText = payload.message?.content?.[0]?.text ?? "";
    if (!rawText) return;

    const role = payload.message?.role ?? "";
    const { priority, text, isNotification } = NotifyBridge.parseChatNotification(
      rawText,
      role,
    );
    if (!isNotification) return;
    if (!text) return;

    this.push({
      priority,
      summary: text,
      source: "winclaw",
      dedupKey: `chat:${payload.runId}`,
    });
  }

  /**
   * Parse priority marker + NOTIFY prefix from a chat event text.
   *
   * Accepted prefixes (case-insensitive, tolerant of internal/trailing
   * whitespace, may appear in any order and repeated):
   *   `[URGENT]` / `[HIGH]` → priority=high, isNotification
   *   `[LOW]`               → priority=low,  isNotification
   *   `[NOTIFY]`            → priority=normal, isNotification
   *
   * A `role === "system"` message is always considered a notification even
   * without a marker.
   */
  private static parseChatNotification(
    rawText: string,
    role: string,
  ): { priority: NotifyPriority; text: string; isNotification: boolean } {
    let text = rawText.trim();
    let priority: NotifyPriority = "normal";
    let sawMarker = false;

    // Consume any leading [URGENT]/[HIGH]/[LOW]/[NOTIFY] markers (in any
    // order). Tolerant of case and inner whitespace: `[ HIGH ]`, `[high]`,
    // `[Notify]` all match.
    const markerRe = /^\[\s*(URGENT|HIGH|LOW|NOTIFY)\s*\]\s*/i;
    // Safety cap so a pathological input cannot loop forever.
    for (let i = 0; i < 8; i++) {
      const m = text.match(markerRe);
      if (!m) break;
      const tag = m[1]!.toUpperCase();
      text = text.slice(m[0].length);
      sawMarker = true;
      if (tag === "URGENT" || tag === "HIGH") {
        // High wins over lower priorities already set.
        priority = "high";
      } else if (tag === "LOW") {
        if (priority !== "high") priority = "low";
      }
      // NOTIFY leaves priority as-is (normal default).
    }

    const isNotification = sawMarker || role === "system";
    return { priority, text: text.trim(), isNotification };
  }

  /** Remove all subscriptions. Subsequent bus events are ignored. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const fn of this.teardown) {
      try {
        fn();
      } catch (err) {
        this.log.error("teardown fn threw", err);
      }
    }
    this.teardown.length = 0;
    this.queue.length = 0;
  }

  // -------------------------------------------------------------------------
  // Internal: flush / inject
  // -------------------------------------------------------------------------

  private async _flush(): Promise<void> {
    if (this.disposed) return;
    // Serialize — prevent concurrent _flush() invocations from interleaving
    // injections. Re-entrant pushes while we're awaiting an inject will be
    // picked up because we loop until the queue is drained (or busy-gate hit).
    if (this.flushing) return;
    this.flushing = true;
    try {
      // 1) Immediately deliver any high-priority items (front of queue).
      while (!this.disposed && this.queue.length > 0 && this.queue[0]!.priority === "high") {
        const item = this.queue.shift()!;
        await this._safeInject(item);
      }

      // 2) Normal/low only flush when the session is idle.
      if (this.disposed || this.isSessionResponding) return;

      // 3) Deliver exactly one non-high item per idle window.
      const next = this.queue.shift();
      if (next) {
        await this._safeInject(next);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async _safeInject(item: NotifyItem): Promise<void> {
    // Record delivery timestamp BEFORE the await so concurrent pushes with
    // the same dedupKey are suppressed while the inject is still in flight.
    if (item.dedupKey) {
      this.recentlyDelivered.set(item.dedupKey, Date.now());
    }
    try {
      await this._inject(item);
    } catch (err) {
      this.log.error(`inject failed (id=${item.id})`, err);
    }
  }

  private async _inject(item: NotifyItem): Promise<void> {
    const text = this._formatForQwen(item);
    await this.opts.qwenClient.sendSystemEvent(text);
  }

  private _formatForQwen(item: NotifyItem): string {
    // 日本語: Qwen に「owner の言語で簡潔に読み上げる」ことを指示するテンプレート。
    const header = "[OWNER NOTIFICATION — speak this concisely in the owner's language]";
    const meta: string[] = [`priority=${item.priority}`];
    if (item.source) meta.push(`source=${item.source}`);
    if (item.hintLanguage) meta.push(`lang=${item.hintLanguage}`);
    return `${header}\n[${meta.join(", ")}] ${item.summary}`;
  }

  // -------------------------------------------------------------------------
  // Internal: capacity enforcement
  // -------------------------------------------------------------------------

  /**
   * When queue exceeds `maxQueueSize`, drop oldest low-priority items, then
   * normal. `high` is never dropped.
   */
  private _enforceCapacity(): void {
    if (this.queue.length <= this.maxQueueSize) return;

    for (const prio of ["low", "normal"] as const) {
      while (this.queue.length > this.maxQueueSize) {
        const idx = this.queue.findIndex((q) => q.priority === prio);
        if (idx < 0) break;
        const dropped = this.queue.splice(idx, 1)[0]!;
        this.log.warn(
          `queue overflow: dropping ${dropped.priority} id=${dropped.id} "${dropped.summary}"`
        );
      }
      if (this.queue.length <= this.maxQueueSize) return;
    }
    // All remaining are high — cannot drop.
    if (this.queue.length > this.maxQueueSize) {
      this.log.warn(
        `queue still over capacity (${this.queue.length}) — all remaining are high priority`
      );
    }
  }
}
