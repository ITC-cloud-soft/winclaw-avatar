/**
 * @fileoverview MemoryBridge — bridges real-time digital-human voice sessions
 * into WinClaw's unified memory system (memory-core plugin).
 *
 * Design reference: §5.1 of winclaw-avatar-digital-human-realtime-voice-plan.md
 *
 * Responsibilities:
 *  1. Record user speech transcripts, AI responses, and task results.
 *  2. Flush pending entries to `workspace/memory/YYYY-MM-DD.md` with a 3-second
 *     debounce to avoid excessive disk I/O during streaming dialogue.
 *  3. Expose `searchMemory` / `getMemory` wrappers that delegate to the
 *     memory-core plugin instance (mirrors `memory_search` / `memory_get` tools).
 *  4. Preload today's and yesterday's memory files at session start so Qwen
 *     has a compact recent-history context.
 *  5. Write a session-end marker and trigger a full memory reindex on cleanup.
 *
 * Memory file format (compatible with WinClaw text-chat memory entries):
 * ```markdown
 * ### 数字人语音对话
 * - **HH:MM:SS** [主人(语音)] <transcript>
 * - **HH:MM:SS** [AI(语音)] <response>
 * - **HH:MM:SS** [系统] [任务] <desc>
 * [结果] 成功/失败: <result>
 * ```
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// memory-core plugin interface
// ---------------------------------------------------------------------------

/**
 * Minimal interface that `MemoryBridge` requires from the memory-core plugin.
 *
 * The concrete implementation is provided by the WinClaw `memory-core`
 * extension at runtime; this interface keeps the digital-human plugin
 * decoupled from memory-core's internal types.
 */
export interface MemoryCorePlugin {
  /**
   * Perform a hybrid BM25 + vector semantic search over all indexed memory
   * files and return the top-K matching chunks.
   */
  search(params: MemorySearchParams): Promise<MemorySearchResult[]>;

  /**
   * Read a specific line range from a memory file by its workspace-relative
   * or absolute path.
   */
  get(params: MemoryGetParams): Promise<string>;

  /**
   * Mark the memory store as dirty, signalling the indexer to schedule an
   * incremental reindex on the next idle tick.
   */
  markDirty(): void;

  /**
   * Force a synchronous (or best-effort async) full reindex of all memory
   * files.  Called at session end to ensure the voice dialogue is immediately
   * searchable in subsequent sessions.
   */
  reindex(): Promise<void>;
}

/** Parameters for {@link MemoryCorePlugin.search}. */
export interface MemorySearchParams {
  /** Natural-language or keyword query string. */
  query: string;
  /** Maximum number of results to return (default: 5). */
  topK?: number;
  /**
   * Workspace-relative paths to restrict the search scope.
   * Use `'memory/'` to include all daily logs.
   */
  paths?: string[];
}

/** A single memory search result chunk. */
export interface MemorySearchResult {
  /** The matched text snippet. */
  content: string;
  /** Workspace-relative path of the source file. */
  source: string;
  /** Relevance score in [0, 1]. */
  score: number;
  /** 1-based line number of the first line of the chunk. */
  startLine?: number;
  /** 1-based line number of the last line of the chunk. */
  endLine?: number;
}

/** Parameters for {@link MemoryCorePlugin.get}. */
export interface MemoryGetParams {
  /** Workspace-relative or absolute path of the memory file. */
  filePath: string;
  /** 1-based start line (inclusive). Defaults to 1. */
  startLine?: number;
  /** 1-based end line (inclusive). Defaults to end-of-file. */
  endLine?: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type MemoryRole = "user" | "assistant" | "system";
type MemoryEntryType = "voice" | "task";

interface MemoryEntry {
  timestamp: Date;
  role: MemoryRole;
  type: MemoryEntryType;
  content: string;
}

// ---------------------------------------------------------------------------
// MemoryBridge
// ---------------------------------------------------------------------------

/**
 * Bridges the digital-human voice session into WinClaw's memory system.
 *
 * @example
 * ```typescript
 * const bridge = new MemoryBridge(
 *   '/home/user/.winclaw/workspace',
 *   memoryPlugin,
 *   'digital-human',
 * );
 *
 * // At session start — inject recent memory context into Qwen.
 * const recentCtx = await bridge.preloadRecentMemory();
 * await qwenClient.sendText(`[系统提示-近期记忆摘要]\n${recentCtx}`);
 *
 * // During session — record dialogue turns.
 * bridge.recordUserSpeech('帮我查一下明天的会议');
 * bridge.recordAIResponse('好的，我来查一下...');
 * bridge.recordTaskResult('查询明天会议', '下午2点与ABC公司视频会议', true);
 *
 * // At session end.
 * await bridge.onSessionEnd('用户询问了会议安排并请求生成提纲');
 * ```
 */
/** Options for {@link MemoryBridge}. */
export interface MemoryBridgeOptions {
  /**
   * Debounce delay before pending entries are flushed to disk (ms).
   * Corresponds to `config.memory.flushDebounceMs`.
   * @default 3000
   */
  flushDebounceMs?: number;
  /**
   * Number of recent days to preload at session start.
   * 0 = disabled, 1 = today only, 2 = today + yesterday (default), etc.
   * Corresponds to `config.memory.preloadDays`.
   * @default 2
   */
  preloadDays?: number;
}

export class MemoryBridge {
  /** Absolute path to today's daily log file (`memory/YYYY-MM-DD.md`). */
  private readonly dailyLogPath: string;

  /** Entries awaiting the next debounced flush. */
  private pendingEntries: MemoryEntry[] = [];

  /** Active debounce timer handle, or `null` when idle. */
  private flushTimer: NodeJS.Timeout | null = null;

  /** Debounce delay in milliseconds (from options or 3-second default). */
  private readonly flushDelayMs: number;

  /** Number of recent days to preload at session start. */
  private readonly preloadDays: number;

  /** Default debounce delay (used when options are not provided). */
  private static readonly DEFAULT_FLUSH_DELAY_MS = 3_000;

  /**
   * @param workspaceDir  - Absolute path to the WinClaw workspace directory.
   * @param memoryPlugin  - Injected memory-core plugin instance.
   * @param agentId       - Identifier of the owning agent (used for future
   *                        per-agent memory scoping; stored for reference).
   * @param options       - Optional tuning parameters (flush delay, preload days).
   */
  constructor(
    private readonly workspaceDir: string,
    private readonly memoryPlugin: MemoryCorePlugin,
    private readonly agentId: string,
    options: MemoryBridgeOptions = {},
  ) {
    this.flushDelayMs = options.flushDebounceMs ?? MemoryBridge.DEFAULT_FLUSH_DELAY_MS;
    this.preloadDays = options.preloadDays ?? 2;
    const today = this.formatDate(new Date());
    this.dailyLogPath = join(workspaceDir, "memory", `${today}.md`);
  }

  // -------------------------------------------------------------------------
  // Write path — recording dialogue turns
  // -------------------------------------------------------------------------

  /**
   * Record a user voice transcript.
   *
   * Call this when Qwen fires an `input_audio_transcription.completed` event.
   * Empty or whitespace-only transcripts are silently discarded.
   *
   * @param transcript - The STT-transcribed text of what the user said.
   */
  recordUserSpeech(transcript: string): void {
    if (!transcript.trim()) return;
    this.enqueue({
      timestamp: new Date(),
      role: "user",
      type: "voice",
      content: transcript,
    });
  }

  /**
   * Record an AI voice response.
   *
   * Call this when Qwen fires a `response.audio_transcript.done` event.
   * Empty or whitespace-only texts are silently discarded.
   *
   * @param text - The full synthesized response text for this turn.
   */
  recordAIResponse(text: string): void {
    if (!text.trim()) return;
    this.enqueue({
      timestamp: new Date(),
      role: "assistant",
      type: "voice",
      content: text,
    });
  }

  /**
   * Record a WinClaw Agent task result.
   *
   * Call this after `TaskBridge.executeTask()` completes.
   *
   * @param taskDesc - Human-readable task description (e.g. from `[TASK:xxx]`).
   * @param result   - Task output summary string.
   * @param success  - Whether the task completed successfully.
   */
  recordTaskResult(taskDesc: string, result: string, success: boolean): void {
    const statusLabel = success ? "成功" : "失败";
    this.enqueue({
      timestamp: new Date(),
      role: "system",
      type: "task",
      content: `[任务] ${taskDesc}\n[结果] ${statusLabel}: ${result}`,
    });
  }

  // -------------------------------------------------------------------------
  // Read path — memory retrieval
  // -------------------------------------------------------------------------

  /**
   * Perform a semantic (hybrid BM25 + vector) search over all WinClaw memory
   * files, including voice dialogue logs and text-chat logs.
   *
   * Delegates to `memory-core`'s `memory_search` tool.  The search scope is
   * `['MEMORY.md', 'memory/']` so both long-term memory and daily logs are
   * included.
   *
   * @param query - Natural-language or keyword query string.
   * @param topK  - Maximum number of results to return (default: 5).
   * @returns     Array of ranked memory chunks, highest relevance first.
   */
  async searchMemory(
    query: string,
    topK: number = 5,
  ): Promise<MemorySearchResult[]> {
    return this.memoryPlugin.search({
      query,
      topK,
      paths: ["MEMORY.md", "memory/"],
    });
  }

  /**
   * Read a specific line range from a memory file.
   *
   * Delegates to `memory-core`'s `memory_get` tool.
   *
   * @param filePath  - Workspace-relative or absolute path of the memory file.
   * @param startLine - 1-based start line (inclusive); defaults to 1.
   * @param endLine   - 1-based end line (inclusive); defaults to end of file.
   * @returns         The requested lines as a single string.
   */
  async getMemory(
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<string> {
    return this.memoryPlugin.get({ filePath, startLine, endLine });
  }

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  /**
   * Preload a compact summary of today's and yesterday's memory files.
   *
   * The summary is intended to be injected into Qwen's conversation context
   * at session start (Plan §5.3 Option C) so the assistant has implicit
   * short-term recall without needing to issue [RECALL:xxx] queries for
   * recent topics.
   *
   * Each file is truncated to 500 characters (head only, for performance).
   *
   * @returns Formatted multi-section string, or an empty string when both
   *          files are absent.
   */
  async preloadRecentMemory(): Promise<string> {
    if (this.preloadDays === 0) return "";

    const today = new Date();
    const dates: Date[] = [];
    for (let i = this.preloadDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    const contents = await Promise.all(
      dates.map((d) =>
        this.safeReadFile(
          join(this.workspaceDir, "memory", `${this.formatDate(d)}.md`),
        ),
      ),
    );

    const labels = dates.map((d) => {
      const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
      if (diff === 0) return "今天";
      if (diff === 1) return "昨天";
      return `${diff}天前`;
    });

    const parts: string[] = [];
    for (let i = 0; i < dates.length; i++) {
      const content = contents[i];
      if (content !== null) {
        parts.push(`[${labels[i]}的记忆摘要]\n${this.headTruncate(content, 500)}`);
      }
    }

    return parts.join("\n\n");
  }

  /**
   * Write a session-end marker to the daily log and trigger a memory reindex.
   *
   * Call this from `RealtimeSessionHandler.cleanup()` after the Qwen and
   * ByteDance connections have been closed.
   *
   * @param sessionSummary - A brief human-readable summary of what was
   *   discussed or accomplished in this voice session.
   */
  async onSessionEnd(sessionSummary: string): Promise<void> {
    // Flush any remaining pending entries before writing the end marker.
    await this.flushImmediately();

    const time = this.formatTime(new Date());
    const endMarker =
      `\n- **${time}** [系统] 数字人语音会话结束。` +
      `摘要: ${sessionSummary}\n`;

    await this.ensureMemoryDir();
    await appendFile(this.dailyLogPath, endMarker, "utf-8");

    // Trigger a full reindex so this session's content is immediately
    // searchable in the next session.
    await this.memoryPlugin.reindex();
  }

  /**
   * Notify the memory-core plugin that the daily log has been modified and
   * should be scheduled for incremental reindexing.
   *
   * Exposed as a public method so callers can explicitly flag dirty state
   * when they write to the memory store through other code paths.
   */
  markDirty(): void {
    this.memoryPlugin.markDirty();
  }

  // -------------------------------------------------------------------------
  // Private — flush mechanics
  // -------------------------------------------------------------------------

  /**
   * Push a new entry onto the pending queue and arm the debounce timer if it
   * is not already running.
   */
  private enqueue(entry: MemoryEntry): void {
    this.pendingEntries.push(entry);
    this.scheduleFlush();
  }

  /**
   * Schedule a debounced flush.  Does nothing when a timer is already active
   * (the existing timer will fire after flushDelayMs from its own start).
   */
  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((err: unknown) => {
        console.error("[MemoryBridge] Flush error:", err);
      });
    }, this.flushDelayMs);
  }

  /**
   * Cancel any pending debounce timer and flush immediately.
   * Used by `onSessionEnd` to ensure no entries are lost at cleanup.
   */
  private async flushImmediately(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Drain the pending-entries queue and append all entries to the daily log
   * file in a single `appendFile` call.
   *
   * After a successful write, `memoryPlugin.markDirty()` is called to
   * schedule an incremental reindex.
   */
  private async flush(): Promise<void> {
    if (this.pendingEntries.length === 0) return;

    // Atomically drain the queue.
    const entries = this.pendingEntries.splice(0);

    const lines: string[] = [];
    for (const entry of entries) {
      const time = this.formatTime(entry.timestamp);
      const prefix = this.rolePrefix(entry.role);
      lines.push(`- **${time}** [${prefix}] ${entry.content}`);
    }

    // Prepend the section header on each flush so each batch is self-labelled
    // when reading the raw Markdown file.
    const block = `\n### 数字人语音对话\n${lines.join("\n")}\n`;

    await this.ensureMemoryDir();
    await appendFile(this.dailyLogPath, block, "utf-8");

    this.memoryPlugin.markDirty();
  }

  // -------------------------------------------------------------------------
  // Private — utilities
  // -------------------------------------------------------------------------

  /**
   * Ensure the `workspace/memory/` directory exists.
   * Creates it (including parents) if absent.
   */
  private async ensureMemoryDir(): Promise<void> {
    await mkdir(dirname(this.dailyLogPath), { recursive: true });
  }

  /**
   * Read a file and return its contents, or `null` if the file does not exist
   * or cannot be read.
   */
  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Truncate text to at most `maxLen` characters, keeping only the head.
   * A trailing `...` is appended when text is shortened.
   */
  private headTruncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "...";
  }

  /**
   * Format a Date as `YYYY-MM-DD` in local time (ISO date portion).
   *
   * We intentionally use local time rather than UTC so the filename matches
   * the user's perceived calendar date.
   */
  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Format a Date as `HH:MM:SS` in local time for the memory log timestamp.
   */
  private formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  /**
   * Map an entry role to the display prefix used in the Markdown log.
   *
   * Format matches the WinClaw unified memory spec (§5.4):
   *  - `主人(语音)` for user voice transcripts
   *  - `AI(语音)`   for AI voice responses
   *  - `系统`       for system / task entries
   */
  private rolePrefix(role: MemoryRole): string {
    switch (role) {
      case "user":
        return "主人(语音)";
      case "assistant":
        return "AI(语音)";
      case "system":
        return "系统";
    }
  }
}
