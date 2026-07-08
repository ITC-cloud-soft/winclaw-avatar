/**
 * @fileoverview TaskBridge — dispatches WinClaw Agent tasks detected in Qwen
 * AI responses and feeds the results back to the digital-human voice session.
 *
 * Design reference: §4.5 of winclaw-avatar-digital-human-realtime-voice-plan.md
 *
 * Responsibilities:
 *  1. Parse `[TASK:xxx]` markers from Qwen text responses.
 *  2. Notify the user that a task is being processed via Qwen voice synthesis.
 *  3. Execute the task through the injected WinClaw agent runner with a
 *     configurable timeout.
 *  4. Report the task result back to Qwen for voice synthesis.
 *  5. Record task results to the memory-bridge.
 *
 * Task marker protocol (defined in IdentityLoader instructions):
 * ```
 * AI response:  "好的，我来帮您查询。[TASK:查询明天的天气]"
 * Backend:      TaskBridge.parseTaskFromResponse() → { description: "查询明天的天气" }
 *               TaskBridge.executeTask(task) → { success: true, summary: "明天晴天28°C" }
 *               TaskBridge.reportResult(result) → Qwen.sendText("任务完成：明天晴天…")
 * ```
 */

import type { QwenRealtimeClient } from "./integrations/qwen-realtime.js";
import type { MemoryBridge } from "./memory-bridge.js";
import type { TaskBridgeConfig } from "./config.js";

// ---------------------------------------------------------------------------
// AgentRunner — defined here to avoid circular imports
// (realtime-handler.ts re-exports this interface)
// ---------------------------------------------------------------------------

/**
 * WinClaw agent runner interface used for task execution.
 *
 * Implemented by the WinClaw PI Embedded Runner and injected into both
 * {@link TaskBridge} and {@link RealtimeSessionHandler} at session startup.
 */
export interface AgentRunner {
  /**
   * Run a task and return a text result summary.
   *
   * @param taskDescription - Plain-language task description.
   * @param model           - Optional model identifier override.
   * @param timeoutMs       - Abort deadline in milliseconds.
   * @returns               A concise text summary of the task outcome.
   */
  run(
    taskDescription: string,
    model?: string,
    timeoutMs?: number,
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A parsed task request extracted from a Qwen AI response.
 */
export interface TaskRequest {
  /** Human-readable task description (the `xxx` inside `[TASK:xxx]`). */
  description: string;
  /** The full original text containing the task marker (for logging). */
  sourceText: string;
}

/**
 * The result of executing a task via the WinClaw agent runner.
 */
export interface TaskResult {
  /** The original task request that produced this result. */
  task: TaskRequest;
  /** Whether the task completed without error. */
  success: boolean;
  /**
   * A concise single-sentence summary of the task outcome.
   * Injected into Qwen for voice synthesis.
   */
  summary: string;
  /** Full raw output from the agent runner (may be lengthy). */
  rawOutput: string;
}

/**
 * Dependencies injected into {@link TaskBridge} at construction time.
 */
export interface TaskBridgeDeps {
  /** WinClaw agent runner that executes tasks. */
  agentRunner: AgentRunner;
  /** Qwen client used to send processing notifications and results. */
  qwenClient: QwenRealtimeClient;
  /** Memory bridge for recording task results. */
  memoryBridge: MemoryBridge;
  /** Task bridge configuration from the plugin config. */
  config: TaskBridgeConfig;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Pattern to match a single `[TASK:description]` marker anywhere in text.
 *
 * Captures the task description (may span up to 500 characters; no newlines).
 * Uses non-greedy matching so multiple markers do not bleed into each other.
 */
const TASK_MARKER_RE = /\[TASK:(.{1,500}?)\]/;

// ---------------------------------------------------------------------------
// TaskBridge
// ---------------------------------------------------------------------------

/**
 * Bridges Qwen-detected task requests to the WinClaw agent runner.
 *
 * @example
 * ```typescript
 * const bridge = new TaskBridge({
 *   agentRunner,
 *   qwenClient,
 *   memoryBridge,
 *   config: { maxWaitSeconds: 60, model: '', summaryMaxTokens: 200 },
 * });
 *
 * const task = bridge.parseTaskFromResponse(
 *   "好的，我来帮您。[TASK:查询ABC公司的联系方式]"
 * );
 * if (task) {
 *   const result = await bridge.executeTask(task);
 *   await bridge.reportResult(result);
 * }
 * ```
 */
export class TaskBridge {
  private readonly agentRunner: AgentRunner;
  private readonly qwenClient: QwenRealtimeClient;
  private readonly memoryBridge: MemoryBridge;
  private readonly config: TaskBridgeConfig;

  /**
   * Tracks tasks currently in flight so duplicate markers in the same
   * response do not trigger parallel executions.
   */
  private readonly inFlightTasks = new Set<string>();

  constructor(deps: TaskBridgeDeps) {
    this.agentRunner = deps.agentRunner;
    this.qwenClient = deps.qwenClient;
    this.memoryBridge = deps.memoryBridge;
    this.config = deps.config;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Scan an AI response text for the first `[TASK:xxx]` marker.
   *
   * Returns a {@link TaskRequest} if a marker is found, or `null` when no
   * task marker is present in the text.
   *
   * @param text - The full AI response text from `response.audio_transcript.done`.
   * @returns Parsed task request, or `null`.
   */
  parseTaskFromResponse(text: string): TaskRequest | null {
    const match = TASK_MARKER_RE.exec(text);
    if (!match) return null;

    const description = match[1].trim();
    if (!description) return null;

    return { description, sourceText: text };
  }

  /**
   * Execute a task through the WinClaw agent runner.
   *
   * Steps:
   * 1. Sends a "processing" notification to the user via Qwen voice synthesis.
   * 2. Invokes the agent runner with a configurable deadline.
   * 3. Returns a {@link TaskResult} — success or timeout/error.
   *
   * Duplicate executions for the same `description` are suppressed while a
   * matching task is already in flight.
   *
   * @param task - The task parsed by {@link parseTaskFromResponse}.
   * @returns Resolved task result (never rejects; errors become failure results).
   */
  async executeTask(task: TaskRequest): Promise<TaskResult> {
    const { description } = task;

    // Suppress concurrent duplicate tasks.
    if (this.inFlightTasks.has(description)) {
      console.info(`[TaskBridge] Suppressing duplicate in-flight task: "${description}"`);
      return {
        task,
        success: false,
        summary: "该任务正在执行中，请稍候。",
        rawOutput: "",
      };
    }

    this.inFlightTasks.add(description);

    try {
      // Notify user that the task is being processed.
      this.qwenClient.sendText(
        `好的，我正在帮您处理：${description}。请稍等一下。`,
      );

      console.info(`[TaskBridge] Executing task: "${description}"`);

      const timeoutMs = this.config.maxWaitSeconds * 1_000;
      const modelOverride = this.config.model || undefined;

      // Run the task with the configured deadline.
      const rawOutput = await this.runWithTimeout(
        this.agentRunner.run(description, modelOverride, timeoutMs),
        timeoutMs,
      );

      // Truncate the raw output to produce a concise voice-friendly summary.
      const summary = this.summarize(rawOutput, this.config.summaryMaxTokens);

      console.info(`[TaskBridge] Task completed: "${description}" — ${summary.slice(0, 80)}`);

      return { task, success: true, summary, rawOutput };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes("timeout") || errMsg.includes("超时");

      console.error(`[TaskBridge] Task failed: "${description}" — ${errMsg}`);

      const summary = isTimeout
        ? `任务"${description}"执行超时（超过${this.config.maxWaitSeconds}秒），请稍后再试。`
        : `任务"${description}"执行时遇到错误：${this.truncateForVoice(errMsg, 80)}`;

      return { task, success: false, summary, rawOutput: errMsg };
    } finally {
      this.inFlightTasks.delete(description);
    }
  }

  /**
   * Send the task result back to Qwen for voice synthesis.
   *
   * Formats the result as a natural spoken-language message and sends it via
   * `qwenClient.sendText()`, which triggers an AI voice response.
   *
   * @param result - The completed task result from {@link executeTask}.
   */
  async reportResult(result: TaskResult): Promise<void> {
    const { task, success, summary } = result;

    let reportText: string;
    if (success) {
      reportText =
        `关于"${task.description}"的任务已完成。` +
        `结果如下：${summary}` +
        `请根据这个结果简洁地回答主人。`;
    } else {
      reportText =
        `关于"${task.description}"的任务未能完成。` +
        `情况是：${summary}` +
        `请用自然的语气告知主人。`;
    }

    // Record to memory before notifying Qwen.
    try {
      this.memoryBridge.recordTaskResult(task.description, summary, success);
    } catch (err) {
      console.error("[TaskBridge] recordTaskResult error:", err);
    }

    this.qwenClient.sendText(reportText);
    console.info(
      `[TaskBridge] Result reported for "${task.description}" (success=${success})`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Race a promise against a timeout.
   *
   * @param promise   - The promise to race.
   * @param timeoutMs - Deadline in milliseconds.
   * @returns The resolved value of the promise.
   * @throws An `Error` with message `"Task execution timeout"` if the deadline
   *   is reached before the promise settles.
   */
  private runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  /**
   * Produce a voice-friendly single-sentence summary of raw agent output.
   *
   * Strips leading/trailing whitespace, collapses newlines to spaces, and
   * hard-truncates to approximately `maxTokens` characters (1 token ≈ 1.5
   * Chinese characters, so we use character count as a proxy).
   *
   * @param raw       - Full raw text output from the agent runner.
   * @param maxTokens - Approximate token budget for the summary.
   */
  private summarize(raw: string, maxTokens: number): string {
    const cleaned = raw.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    // Heuristic: 1 token ≈ 1.5 characters for Chinese/mixed text.
    const maxChars = Math.floor(maxTokens * 1.5);
    return this.truncateForVoice(cleaned, maxChars);
  }

  /**
   * Truncate a string to at most `maxChars` characters, appending `…` when
   * truncation occurs.
   *
   * @param text     - Source text.
   * @param maxChars - Maximum character count.
   */
  private truncateForVoice(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + "…";
  }
}
