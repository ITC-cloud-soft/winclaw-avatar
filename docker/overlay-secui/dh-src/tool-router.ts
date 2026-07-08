/**
 * @fileoverview ToolRouter — dispatch Qwen function-call events to winclaw
 * capabilities.
 *
 * The router is the ONLY place tools get executed. Every dispatch path must
 * either return a JSON-encoded `{status:"ok", ...}` result or a
 * `{status:"failed", user_message:"..."}` payload the model speaks verbatim.
 *
 * See `docs/dh-qwen35-function-calling-proposal.md` §3.5.
 *
 * ## Architecture
 *
 * `task_run` and `channel_send` route through the SAME Gateway agent pipeline
 * that WhatsApp / text-chat use. The router builds a natural-language request
 * from the tool args and dispatches it via {@link GatewayBridge.chatSendAndWait},
 * which returns the agent's final reply. That reply becomes the tool result
 * delivered back to Qwen via `sendFunctionResult`, so Qwen can verbalise the
 * outcome. No direct `cron.run` / `send` RPCs — the agent decides how to
 * execute the request with its full tool catalogue + memory.
 *
 * `memory_search`, `memory_get`, `internet_search` keep direct adapter calls —
 * memory is in-process and web-search is a plugin-level adapter, neither
 * benefits from the agent round-trip.
 *
 * Error contract
 * --------------
 * Handlers NEVER throw. Any exception is caught at the outer boundary and
 * wrapped into a `status:"failed"` result with a plain-Japanese
 * `user_message` describing the failure to the owner.
 */

import type { QwenFunctionCall } from "./integrations/qwen-realtime.js";
import type {
  MemoryCorePlugin,
  MemorySearchResult,
} from "./memory-bridge.js";
import type { GatewayBridge } from "./gateway-bridge.js";
import { writeSecretaryInbox } from "./secretary-inbox.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Result shape expected from an internet-search backend, if configured. */
export interface WebSearchResult {
  answer: string;
  sources?: string[];
}

/** Injected dependencies for the tool router. */
export interface ToolRouterDeps {
  /** Memory-core plugin instance — required. */
  memory: MemoryCorePlugin;
  /**
   * Gateway bridge — used to route `task_run` and `channel_send` through the
   * unified Winclaw agent pipeline (same path as WhatsApp / text-chat).
   */
  gwBridge: GatewayBridge;
  /**
   * Gateway session key for this DH voice session. Reused across tool calls
   * so the agent sees a coherent conversation thread that merges text chat,
   * voice, and tool-driven task dispatches.
   */
  sessionKey: string;
  /**
   * The DH voice session id. Used as the `sessionId` of `notify.dh` RPCs
   * when late-arriving async tool results need to be pushed back as owner
   * notifications.
   */
  dhSessionId: string;
  /**
   * Optional web-search adapter. When omitted, the `internet_search` tool
   * responds with a polite "under construction" user_message.
   */
  webSearchFn?: (query: string) => Promise<WebSearchResult>;
  /**
   * Absolute path to the DH workspace. Used by `task_run` to ALSO register a
   * secretary inbox file (`<workspaceDir>/inbox/<uuid>.json`) so the
   * ai-meta-poc poller can claim the voice task as a managed task.
   *
   * When omitted, the inbox double-write is skipped silently — the existing
   * gateway dispatch is unaffected. The handler injects
   * {@link import("./realtime-handler.js")}'s `workspaceDir` here.
   */
  workspaceDir?: string;
  /**
   * Legacy: single deadline for the agent's reply. Honoured as a back-compat
   * alias for `earlyTimeoutMs` when the async pattern is not configured.
   */
  chatTimeoutMs?: number;
  /**
   * Async receipt — ms before returning `{receipt, user_message}` to Qwen
   * instead of blocking the tool call. @default 15_000
   */
  earlyTimeoutMs?: number;
  /**
   * Async receipt — late ceiling waiting for the actual agent reply after
   * the early deadline fires. @default 600_000 (10 min)
   */
  lateTimeoutMs?: number;
}

/** Channels allowed by the tool catalog's `channel_send.channel` enum. */
const ALLOWED_CHANNELS = new Set([
  "email",
  "line",
  "slack",
  "telegram",
  "whatsapp",
]);

/** Targets allowed by the tool catalog's `ui_action.target` enum. */
const UI_ACTION_TARGETS = new Set([
  "artifact",
  "task_panel",
  "controls",
  "mic",
  "camera",
  "avatar",
]);

/** Verbs allowed by the tool catalog's `ui_action.action` enum. */
const UI_ACTION_VERBS = new Set([
  "show",
  "hide",
  "toggle",
  "on",
  "off",
  "open",
  "close",
]);

// ---------------------------------------------------------------------------
// ToolRouter
// ---------------------------------------------------------------------------

/**
 * Dispatches `QwenFunctionCall` events to the matching winclaw capability.
 *
 * @example
 * ```ts
 * const router = new ToolRouter({ memory, gwBridge, sessionKey });
 * qwenClient.on("functionCall", async (call) => {
 *   const result = await router.handle(call);
 *   await qwenClient.sendFunctionResult(call.callId, result);
 * });
 * ```
 */
export class ToolRouter {
  constructor(private readonly deps: ToolRouterDeps) {}

  /**
   * Execute the requested tool and return a JSON-encoded result string.
   *
   * The returned string is suitable for passing straight to
   * {@link import("./integrations/qwen-realtime.js").QwenRealtimeClient.sendFunctionResult}.
   */
  async handle(call: QwenFunctionCall): Promise<string> {
    let args: Record<string, unknown>;
    try {
      args = call.argumentsJson
        ? (JSON.parse(call.argumentsJson) as Record<string, unknown>)
        : {};
    } catch (primaryErr) {
      // Qwen occasionally truncates the arguments JSON on long inputs in
      // audio mode (observed: missing closing `}` / quote). Attempt a best-
      // effort repair before giving up.
      const repaired = ToolRouter.tryRepairJson(call.argumentsJson);
      if (repaired) {
        try {
          args = JSON.parse(repaired) as Record<string, unknown>;
          console.warn(
            `[ToolRouter] ⚠️ Repaired truncated arguments JSON for ${call.name}: "${call.argumentsJson.slice(0, 80)}…" → "${repaired.slice(0, 80)}…"`,
          );
        } catch {
          return ToolRouter.fail(
            "申し訳ありません、リクエストの形式が正しくありません。",
            primaryErr,
          );
        }
      } else {
        return ToolRouter.fail(
          "申し訳ありません、リクエストの形式が正しくありません。",
          primaryErr,
        );
      }
    }

    try {
      switch (call.name) {
        case "ask_winclaw":
          return await this.handleAskWinclaw(args);
        case "memory_search":
          return await this.handleMemorySearch(args);
        case "memory_get":
          return await this.handleMemoryGet(args);
        case "task_run":
          return await this.handleTaskRun(args);
        case "channel_send":
          return await this.handleChannelSend(args);
        case "internet_search":
          return await this.handleInternetSearch(args);
        case "ui_action":
          return this.handleUiAction(args);
        default:
          return ToolRouter.fail(
            `申し訳ありません、「${call.name}」という操作には対応していません。`,
          );
      }
    } catch (err) {
      return ToolRouter.fail(
        "申し訳ありません、その操作は現在実行できません。",
        err,
      );
    }
  }

  // -------------------------------------------------------------------------
  // ask_winclaw — forward verbatim to the Winclaw agent (generic fallback)
  // -------------------------------------------------------------------------

  /**
   * Pass the owner's natural-language request to the Winclaw agent via the
   * Gateway chat pipeline. This is the "when in doubt" tool — the agent
   * interprets intent, picks the right skills, and returns a reply that we
   * surface back to Qwen verbatim.
   */
  private async handleAskWinclaw(
    args: Record<string, unknown>,
  ): Promise<string> {
    const request = typeof args.request === "string" ? args.request.trim() : "";
    if (!request) {
      return ToolRouter.fail("ご要望の内容を教えていただけますか。");
    }
    // Forward verbatim — no reformatting. The agent handles natural language.
    return this.dispatchViaGateway(
      request,
      "winclaw との通信に失敗しました。",
      (final) => final || "winclaw から応答がありませんでした。",
    );
  }

  // -------------------------------------------------------------------------
  // memory_search
  // -------------------------------------------------------------------------

  private async handleMemorySearch(
    args: Record<string, unknown>,
  ): Promise<string> {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return ToolRouter.fail("検索するキーワードを教えていただけますか。");
    }

    const topK =
      typeof args.top_k === "number" && args.top_k > 0
        ? Math.min(Math.floor(args.top_k), 20)
        : 5;

    const results = await this.deps.memory.search({ query, topK });
    const mapped = results.slice(0, topK).map((r: MemorySearchResult) => ({
      path: r.source,
      snippet: r.content,
      score: r.score,
      startLine: r.startLine,
      endLine: r.endLine,
    }));

    return JSON.stringify({ status: "ok", results: mapped });
  }

  // -------------------------------------------------------------------------
  // memory_get
  // -------------------------------------------------------------------------

  private async handleMemoryGet(
    args: Record<string, unknown>,
  ): Promise<string> {
    const filePath = typeof args.path === "string" ? args.path.trim() : "";
    if (!filePath) {
      return ToolRouter.fail("読み出すファイルのパスが必要です。");
    }
    const startLine =
      typeof args.startLine === "number" ? args.startLine : undefined;
    const endLine =
      typeof args.endLine === "number" ? args.endLine : undefined;

    const text = await this.deps.memory.get({ filePath, startLine, endLine });
    return JSON.stringify({ status: "ok", text });
  }

  // -------------------------------------------------------------------------
  // task_run
  // -------------------------------------------------------------------------

  /**
   * Route the task request through the Gateway agent pipeline. The router
   * composes a Japanese natural-language request from `taskName` + `args`,
   * sends it via `chat.send`, and waits for the agent's final reply. The
   * agent is responsible for actually executing the work (tasks, skills,
   * scripts) using its full toolset — we only formalize the request.
   */
  private async handleTaskRun(
    args: Record<string, unknown>,
  ): Promise<string> {
    const taskName =
      typeof args.taskName === "string" ? args.taskName.trim() : "";
    if (!taskName) {
      return ToolRouter.fail("実行するタスク名が必要です。");
    }
    const taskArgs =
      args.args && typeof args.args === "object" && !Array.isArray(args.args)
        ? (args.args as Record<string, unknown>)
        : {};

    const argsJson = Object.keys(taskArgs).length
      ? ` 引数: ${ToolRouter.safeStringify(taskArgs)}`
      : "";
    // O1 技能化(dh-voice-control-everything-plan §2.3 O1): 既知の高頻タスクは
    // metacoder に **毎回コードを現写させず**、事前配置した確定性 skill を必ず使わせる。
    // これで ~10 分/試行錯誤/chromium 現装クラッシュを排除する。router 側の確定短絡=
    // gateway へ渡す自然語を「skill 強制」の指示文に差し替えるだけ(engine は非改)。
    const skillHint = ToolRouter.SKILL_TASKS[taskName];
    const message = skillHint
      ? `タスク実行: ${taskName}。${skillHint}${argsJson}`
      : `タスク実行: ${taskName} を実行してください。${argsJson}`;

    // Double-write: register this voice task as a MANAGED task by dropping a
    // secretary inbox file. The ai-meta-poc poller claims it and produces a
    // deliverable + GitHub artifact. Best-effort — `writeSecretaryInbox` never
    // throws, so a failure here cannot disrupt the gateway dispatch below.
    // We register the full natural-language `message` as the prompt so the
    // managed task sees the same intent (taskName + args) the agent receives.
    if (this.deps.workspaceDir) {
      void writeSecretaryInbox(this.deps.workspaceDir, message, {
        source: "voice",
      });
    }

    return this.dispatchViaGateway(
      message,
      "タスクを実行できませんでした。",
      (finalText) => `${taskName} の処理を受け付けました。`,
    );
  }

  // -------------------------------------------------------------------------
  // channel_send
  // -------------------------------------------------------------------------

  /**
   * Route the outbound message through the Gateway agent pipeline. The agent
   * already knows how to dispatch to every connected channel (email / line /
   * slack / telegram / whatsapp) — we just phrase the request naturally.
   */
  private async handleChannelSend(
    args: Record<string, unknown>,
  ): Promise<string> {
    const channel = typeof args.channel === "string" ? args.channel : "";
    const recipient = typeof args.recipient === "string" ? args.recipient : "";
    const body = typeof args.body === "string" ? args.body : "";
    if (!channel || !recipient || !body) {
      return ToolRouter.fail(
        "送信先・宛先・本文のいずれかが不足しています。",
      );
    }
    if (!ALLOWED_CHANNELS.has(channel)) {
      return ToolRouter.fail(
        `「${channel}」は対応していないチャンネルです。`,
      );
    }

    const label = ToolRouter.channelLabel(channel);
    const message = `${label}で ${recipient} に「${body}」と送ってください`;

    return this.dispatchViaGateway(
      message,
      "メッセージを送信できませんでした。",
      () => `${label} に送信しました。`,
    );
  }

  /**
   * Shared helper: send `message` through the gateway as if it were a user
   * chat turn, wait for the agent's final reply, and turn that reply into
   * a tool-result payload.
   */
  private async dispatchViaGateway(
    message: string,
    fallbackFailMessage: string,
    fallbackOkMessage: (finalText: string) => string,
  ): Promise<string> {
    // Phase C (async receipt) flow trace:
    //   chat.send → pendingRun
    //     ├─ within earlyTimeoutMs → fast path: return {status:ok, user_message}
    //     └─ earlyTimeoutMs elapses → fast return {status:ok, receipt, user_message:"確認中"}
    //          later: continuation resolves → notify.dh RPC → NotifyBridge speaks
    const earlyTimeoutMs =
      this.deps.earlyTimeoutMs ?? this.deps.chatTimeoutMs ?? 15_000;
    // 25分。task_run はリサーチ+PDF生成等で 10分超も普通(観測: NVIDIA 5頁 PDF が
    // 約10.5分)。従来の 10分では late-timeout で完了通知が破棄されていた。
    const lateTimeoutMs = this.deps.lateTimeoutMs ?? 1_500_000;
    try {
      const r = await this.deps.gwBridge.chatSendAsync(
        this.deps.sessionKey,
        message,
        { earlyTimeoutMs, lateTimeoutMs },
      );
      if (r.done) {
        const speakable = ToolRouter.extractSpeakable(r.text);
        const userMessage = speakable || fallbackOkMessage(r.text);
        return JSON.stringify({
          status: "ok",
          summary: speakable || userMessage,
          user_message: userMessage,
        });
      }
      // Early timeout — return receipt, schedule late delivery via notify.dh.
      this.scheduleLateDelivery(r.runId, r.continuation, message);
      return JSON.stringify({
        status: "ok",
        receipt: r.runId,
        user_message: "承知しました、確認中です。完了次第お知らせします。",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const userMessage = msg.includes("timeout")
        ? "応答がタイムアウトしました。"
        : fallbackFailMessage;
      return JSON.stringify({
        status: "failed",
        user_message: userMessage,
        error: msg,
      });
    }
  }

  /**
   * Watch for a late-arriving agent reply and push it back through
   * `notify.dh` so the Winclaw NotifyBridge can speak it as an owner
   * notification. Best-effort — failures are logged, never thrown.
   */
  private scheduleLateDelivery(
    runId: string,
    continuation: Promise<string>,
    originalRequest: string,
  ): void {
    const reqPreview = originalRequest.slice(0, 60);
    // sessionId は敢えて omit してブロードキャスト(dh-notify:broadcast)する。
    // 非同期タスクは分単位で走るため、完了時にはユーザが元のタブを閉じて別セッションで
    // 再接続していることが多い。session 固定だと死んだセッションに届いて消える。
    // broadcast なら「今アクティブな avatar」が読み上げる(再接続耐性)。
    continuation
      .then((finalText) => {
        const speakable = ToolRouter.extractSpeakable(finalText) || finalText;
        const text = `[NOTIFY] 先ほどのご依頼が完了しました: ${speakable.slice(0, 500)}`;
        console.info(
          `[ToolRouter] ↘️ late-delivery(broadcast) runId=${runId}  req="${reqPreview}…"`,
        );
        this.deps.gwBridge
          .request("notify.dh", {
            priority: "normal",
            text,
            source: "async-tool-result",
            dedupKey: `late-${runId}`,
          })
          .catch((err: unknown) => {
            console.warn(
              `[ToolRouter] Late-delivery notify.dh failed runId=${runId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ToolRouter] Late-delivery final failed runId=${runId}: ${msg}`,
        );
        // late-timeout(処理継続中の可能性大)は「失敗」と断定しない。
        const isTimeout = msg.includes("timeout");
        const text = isTimeout
          ? `[NOTIFY] 先ほどのご依頼は処理に時間がかかっています。完了しましたら成果物一覧に表示されます。`
          : `[NOTIFY] 先ほどのご依頼が完了できませんでした: ${msg.slice(0, 200)}`;
        this.deps.gwBridge
          .request("notify.dh", {
            priority: "normal",
            text,
            source: "async-tool-error",
            dedupKey: `late-err-${runId}`,
          })
          .catch(() => {});
      });
  }

  // -------------------------------------------------------------------------
  // internet_search
  // -------------------------------------------------------------------------

  private async handleInternetSearch(
    args: Record<string, unknown>,
  ): Promise<string> {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return ToolRouter.fail("検索したいキーワードを教えてください。");
    }

    // If an explicit webSearchFn adapter is injected, use it.
    if (this.deps.webSearchFn) {
      const r = await this.deps.webSearchFn(query);
      return JSON.stringify({
        status: "ok",
        answer: r.answer,
        sources: r.sources?.slice(0, 3),
      });
    }

    // Otherwise forward to the winclaw agent via gateway — the agent has
    // its own web search capability. This lets us avoid needing a separate
    // search adapter in the DH plugin when winclaw already has one wired.
    const message = `インターネットで検索してください: ${query}`;
    return this.dispatchViaGateway(
      message,
      "検索に失敗しました。",
      (final) => final || `「${query}」を検索しましたが結果が取得できませんでした。`,
    );
  }

  // -------------------------------------------------------------------------
  // ui_action — control the DH interface itself (no gateway round-trip)
  // -------------------------------------------------------------------------

  /**
   * Validate a UI-surface control request and return a speakable confirmation.
   *
   * Unlike the other handlers, `ui_action` performs NO gateway round-trip and
   * NO backend work — it is a pure control signal. The realtime-handler
   * forwards the `{type:"tool_call", name:"ui_action", ...}` frame to the
   * browser, where `dh-websocket.ts` dispatches a `dh-ui-action` DOM event and
   * `app-render.ts` applies it to the actual UI. This method only validates the
   * enums and produces the `user_message` the avatar speaks back.
   */
  private handleUiAction(args: Record<string, unknown>): string {
    const target = typeof args.target === "string" ? args.target.trim() : "";
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (!target || !action) {
      return ToolRouter.fail("操作対象と動作を指定してください。");
    }
    if (!UI_ACTION_TARGETS.has(target)) {
      return ToolRouter.fail(
        `「${target}」という画面操作の対象には対応していません。`,
      );
    }
    if (!UI_ACTION_VERBS.has(action)) {
      return ToolRouter.fail(
        `「${action}」という画面操作には対応していません。`,
      );
    }

    const targetLabel = ToolRouter.uiTargetLabel(target);
    const actionLabel = ToolRouter.uiActionLabel(action);
    return JSON.stringify({
      status: "ok",
      user_message: `${targetLabel}を${actionLabel}。`,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Build a `{status:"failed", user_message, error?}` JSON string.
   *
   * The `user_message` is the text Qwen will speak verbatim to the owner
   * per CORE RULE #5 of the DH system prompt.
   */
  /**
   * Best-effort repair of a truncated JSON string. Qwen 3.5 realtime
   * occasionally cuts off the closing `}`/`"`/`]` when streaming long
   * function-call arguments in audio mode. We walk the string, track
   * open string/brace/bracket state, and append the missing closers.
   *
   * Returns the repaired string, or `null` if we cannot guess the fix.
   */
  static tryRepairJson(raw: string | undefined | null): string | null {
    if (!raw) return null;
    let s = raw.trim();
    if (!s.startsWith("{") && !s.startsWith("[")) return null;

    let inString = false;
    let escaped = false;
    const stack: string[] = []; // expected closers, LIFO

    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inString) {
        if (escaped) { escaped = false; continue; }
        if (c === "\\") { escaped = true; continue; }
        if (c === '"') { inString = false; continue; }
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === "{") { stack.push("}"); continue; }
      if (c === "[") { stack.push("]"); continue; }
      if (c === "}" || c === "]") {
        if (stack[stack.length - 1] === c) stack.pop();
      }
    }

    // If we ended inside a string, close it.
    if (inString) s += '"';
    // If the last meaningful char was a `,` we need to drop it before closing.
    s = s.replace(/,\s*$/, "");
    // Append remaining closers.
    while (stack.length) s += stack.pop();

    try {
      JSON.parse(s);
      return s;
    } catch {
      return null;
    }
  }

  /**
   * O1 技能化: taskName → 「対応 skill を必ず使い、コードを現写しない」強制指示文。
   * ここに載る taskName は確定性 skill 経路へ短絡する(handleTaskRun)。未載のタスクは
   * 従来どおり自然語で gateway に委ねる(後方互換)。
   */
  private static readonly SKILL_TASKS: Record<string, string> = {
    "document.generate_pdf":
      "pdf-report skill を必ず使用してください。HTML や playwright のコードを新規に書くこと、" +
      "および playwright/chromium のインストールは禁止です(chromium は導入済)。" +
      "内容 JSON(content.json)のみ作成し、" +
      '`python3 .claude/skills/pdf-report/render.py content.json --out "<タイトル>.pdf"` を実行してください。',
  };

  private static fail(userMessage: string, err?: unknown): string {
    const payload: Record<string, unknown> = {
      status: "failed",
      user_message: userMessage,
    };
    if (err !== undefined) {
      payload.error = err instanceof Error ? err.message : String(err);
    }
    return JSON.stringify(payload);
  }

  /** Shorten an agent reply into something Qwen can speak back naturally. */
  private static extractSpeakable(text: string): string {
    if (!text) return "";
    // Prefer <voice> summary tag if the agent emitted one.
    const m = text.match(/<voice>([\s\S]*?)<\/voice>/);
    if (m && m[1]) return m[1].trim();
    // Otherwise strip markdown artefacts and trim.
    return text
      .replace(/<voice>[\s\S]*?<\/voice>/g, "")
      .replace(/\*\*/g, "")
      .replace(/[#`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }

  private static channelLabel(channel: string): string {
    switch (channel) {
      case "line": return "LINE";
      case "slack": return "Slack";
      case "telegram": return "Telegram";
      case "whatsapp": return "WhatsApp";
      case "email": return "メール";
      default: return channel;
    }
  }

  /** Japanese label for a `ui_action.target` value. */
  private static uiTargetLabel(target: string): string {
    switch (target) {
      case "artifact": return "成果物";
      case "task_panel": return "タスクパネル";
      case "controls": return "操作パネル";
      case "mic": return "マイク";
      case "camera": return "カメラ";
      case "avatar": return "アバター";
      default: return target;
    }
  }

  /** Japanese verb for a `ui_action.action` value. */
  private static uiActionLabel(action: string): string {
    switch (action) {
      case "show": return "表示しました";
      case "hide": return "非表示にしました";
      case "toggle": return "切り替えました";
      case "on": return "オンにしました";
      case "off": return "オフにしました";
      case "open": return "開きました";
      case "close": return "閉じました";
      default: return action;
    }
  }
}
