/**
 * @fileoverview IdentityLoader — reads WinClaw workspace bootstrap files and
 * assembles a compact Qwen Realtime `instructions` string for the digital-human
 * plugin.
 *
 * Design reference: §4.1 of winclaw-avatar-digital-human-realtime-voice-plan.md
 *
 * Bootstrap files read (from workspace directory):
 *  - SOUL.md     → personality, values, tone  (highest priority, up to 1500 chars)
 *  - USER.md     → who the owner is           (up to 500 chars)
 *  - IDENTITY.md → name, vibe, style          (up to 500 chars)
 *  - AGENTS.md   → behaviour rules            (up to 800 chars)
 *
 * Truncation strategy mirrors WinClaw's existing bootstrap trimmer:
 *   head 70% + tail 20% + truncation marker
 *   (constants: BOOTSTRAP_HEAD_RATIO = 0.7, BOOTSTRAP_TAIL_RATIO = 0.2)
 *
 * The assembled instructions string is kept under MAX_INSTRUCTIONS (4000 chars)
 * to preserve Qwen Realtime response quality.
 */

import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants (mirror values from src/agents/pi-embedded-helpers/bootstrap.ts)
// ---------------------------------------------------------------------------

/** Maximum total length of the assembled Qwen instructions string. */
const MAX_INSTRUCTIONS = 4_000;

/** Fraction of per-file budget kept from the head of the file. */
const BOOTSTRAP_HEAD_RATIO = 0.7;

/** Fraction of per-file budget kept from the tail of the file. */
const BOOTSTRAP_TAIL_RATIO = 0.2;

/** Per-file character budgets (sum ≈ 3300, leaving ~700 for fixed scaffolding). */
const BUDGET_SOUL = 1_500;
const BUDGET_USER = 500;
const BUDGET_IDENTITY = 500;
const BUDGET_AGENTS = 800;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The resolved digital-human identity returned by {@link IdentityLoader.load}.
 */
export interface DigitalHumanIdentity {
  /**
   * Fully assembled instructions string to send in the Qwen
   * `session.update` event. Length is guaranteed ≤ MAX_INSTRUCTIONS.
   */
  instructions: string;

  /** Agent name extracted from IDENTITY.md (falls back to `"WinClaw"`). */
  name: string;

  /**
   * Vibe / style description extracted from IDENTITY.md
   * (empty string when not found).
   */
  vibe: string;

  /** Raw content of SOUL.md (empty string when file is absent). */
  rawSoul: string;

  /** Raw content of IDENTITY.md (empty string when file is absent). */
  rawIdentity: string;

  /** Raw content of USER.md (empty string when file is absent). */
  rawUser: string;

  /** Raw content of AGENTS.md (empty string when file is absent). */
  rawAgents: string;
}

/**
 * Callback invoked by {@link IdentityLoader.watch} whenever a watched file
 * changes and the identity has been reloaded.
 */
export type IdentityChangeCallback = (newIdentity: DigitalHumanIdentity) => void | Promise<void>;

// ---------------------------------------------------------------------------
// IdentityLoader
// ---------------------------------------------------------------------------

/**
 * Loads WinClaw workspace bootstrap files and assembles Qwen Realtime
 * `instructions` for the digital-human session.
 *
 * @example
 * ```typescript
 * const loader = new IdentityLoader('/home/user/.winclaw/workspace');
 * const identity = await loader.load();
 * console.log(identity.name);        // "Aria"
 * console.log(identity.instructions); // assembled Qwen instructions
 *
 * // Enable hot-reload during a live session.
 * loader.watch(async (updated) => {
 *   await qwenClient.updateInstructions(updated.instructions);
 * });
 *
 * // Cleanup when session ends.
 * loader.unwatch();
 * ```
 */
/** Options for {@link IdentityLoader}. */
export interface IdentityLoaderOptions {
  /**
   * Maximum character length for the assembled Qwen instructions string.
   * Corresponds to `config.identity.maxInstructionsChars`.
   * @default 4000
   */
  maxInstructionsChars?: number;
  /**
   * Additional voice-specific instructions appended verbatim at the end of
   * the assembled instructions string.
   * Corresponds to `config.identity.voiceInstructions`.
   */
  voiceInstructions?: string;
}

export class IdentityLoader {
  /** File system watchers keyed by filename. */
  private readonly watchers = new Map<string, fs.FSWatcher>();

  /** Names of the bootstrap files that trigger a reload on change. */
  private static readonly WATCHED_FILES = [
    "SOUL.md",
    "IDENTITY.md",
    "USER.md",
    "AGENTS.md",
  ] as const;

  /** Effective max character limit (from options or default constant). */
  private readonly maxInstructionsChars: number;

  /** Extra voice-specific instructions appended to assembled instructions. */
  private readonly voiceInstructions: string;

  /**
   * @param workspaceDir - Absolute path to the WinClaw workspace directory
   *   (e.g. `~/.winclaw/workspace`).  The constructor does not validate
   *   whether the path exists; errors surface lazily during {@link load}.
   * @param options      - Optional tuning parameters (max length, extra instructions).
   */
  constructor(
    private readonly workspaceDir: string,
    options: IdentityLoaderOptions = {},
  ) {
    this.maxInstructionsChars = options.maxInstructionsChars ?? MAX_INSTRUCTIONS;
    this.voiceInstructions = options.voiceInstructions ?? "";
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Read all four bootstrap files from {@link workspaceDir} and assemble a
   * {@link DigitalHumanIdentity}.  Missing files are silently treated as empty
   * strings, matching WinClaw's tolerant bootstrap loading behaviour.
   */
  async load(): Promise<DigitalHumanIdentity> {
    const [soul, identity, user, agents] = await Promise.all([
      this.readBootstrapFile("SOUL.md"),
      this.readBootstrapFile("IDENTITY.md"),
      this.readBootstrapFile("USER.md"),
      this.readBootstrapFile("AGENTS.md"),
    ]);

    const name = this.extractField(identity, "name") ?? "WinClaw";
    const vibe = this.extractField(identity, "vibe") ?? "";

    const instructions = this.assembleInstructions(soul, identity, user, agents);

    return {
      instructions,
      name,
      vibe,
      rawSoul: soul,
      rawIdentity: identity,
      rawUser: user,
      rawAgents: agents,
    };
  }

  /**
   * Register a callback that fires whenever any of the four bootstrap files
   * change on disk.  Only one watch registration is active at a time; calling
   * `watch()` again replaces the previous callback (files are re-used).
   *
   * Uses Node.js `fs.watch` with a 300 ms debounce to coalesce rapid saves.
   *
   * @param callback - Invoked with the freshly loaded identity after a change.
   *   Async callbacks are awaited; thrown errors are caught and logged.
   */
  watch(callback: IdentityChangeCallback): void {
    // Clear any existing watchers first so we don't double-watch.
    this.unwatch();

    // Debounce timer shared across all watched files.
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleChange = (): void => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        this.load().then(callback).catch((err: unknown) => {
          console.error("[IdentityLoader] Hot-reload failed:", err);
        });
      }, 300);
    };

    for (const filename of IdentityLoader.WATCHED_FILES) {
      const filePath = join(this.workspaceDir, filename);
      try {
        const watcher = fs.watch(filePath, { persistent: false }, handleChange);
        watcher.on("error", () => {
          // File may not yet exist; ignore watch errors silently.
        });
        this.watchers.set(filename, watcher);
      } catch {
        // fs.watch throws synchronously if the path is invalid on some
        // platforms; treat as non-fatal — the file may be created later.
      }
    }
  }

  /**
   * Stop all active file system watchers registered by {@link watch}.
   * Safe to call even if `watch()` was never invoked.
   */
  unwatch(): void {
    for (const watcher of this.watchers.values()) {
      try {
        watcher.close();
      } catch {
        // Already closed — ignore.
      }
    }
    this.watchers.clear();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Read a single bootstrap file from the workspace directory.
   * Returns an empty string when the file does not exist or cannot be read.
   */
  private async readBootstrapFile(filename: string): Promise<string> {
    try {
      return await readFile(join(this.workspaceDir, filename), "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * Extract a named field from IDENTITY.md.
   *
   * Supports two source formats:
   *  1. YAML frontmatter:  `name: Aria`
   *  2. Markdown bold:     `**Name**: Aria`
   *
   * The search is case-insensitive for the Markdown variant.
   * Returns `null` when the field is not found.
   *
   * @param content - Full content of IDENTITY.md.
   * @param field   - Field name to look up (e.g. `"name"`, `"vibe"`).
   */
  extractField(content: string, field: string): string | null {
    // YAML frontmatter style: `field: value` at the start of a line.
    const yamlPattern = new RegExp(`^${escapeRegex(field)}:\\s*(.+)$`, "m");
    const yamlMatch = content.match(yamlPattern);
    if (yamlMatch) {
      return yamlMatch[1].trim();
    }

    // Markdown bold style: `**Field**: value` (case-insensitive field name).
    const mdPattern = new RegExp(
      `\\*\\*${escapeRegex(field)}\\*\\*:\\s*(.+)`,
      "i",
    );
    const mdMatch = content.match(mdPattern);
    if (mdMatch) {
      return mdMatch[1].trim();
    }

    return null;
  }

  /**
   * Assemble all file contents into a single Qwen `instructions` string.
   *
   * Priority (highest to lowest): SOUL → USER → IDENTITY → AGENTS.
   * Each section is individually truncated to its budget using the WinClaw
   * head-70% + tail-20% strategy, then the whole string is hard-capped at
   * {@link MAX_INSTRUCTIONS} characters.
   *
   * Voice-mode specific instructions are prepended:
   *  - No Markdown formatting (output will be converted to speech).
   *  - Conversational / natural spoken tone.
   *  - [TASK:xxx] dispatch protocol.
   *  - [RECALL:xxx] memory retrieval protocol.
   */
  private assembleInstructions(
    soul: string,
    identity: string,
    user: string,
    agents: string,
  ): string {
    const parts: string[] = [];

    // ── Identity context (from workspace SOUL.md, IDENTITY.md, etc.) ──────
    if (soul) {
      parts.push("## Your Personality", this.truncate(soul, BUDGET_SOUL));
    }
    if (identity) {
      parts.push("\n## Your Identity", this.truncate(identity, BUDGET_IDENTITY));
    }
    if (user) {
      parts.push("\n## About Your Owner", this.truncate(user, BUDGET_USER));
    }
    if (agents) {
      parts.push("\n## Behavior Rules", this.truncate(agents, BUDGET_AGENTS));
    }

    // ── Voice conversation rules ──────────────────────────────────────────
    parts.push(
      "\n## Voice Mode Rules",
      "You are speaking face-to-face with your owner via a digital human avatar.",
      "Keep replies concise (1-3 sentences). Use natural spoken language, no Markdown.",
      "Match the language the owner speaks (Chinese/English/Japanese).",
      "",
      "When you receive text prefixed with [TTS], read it aloud naturally.",
      "Summarize [TTS] content faithfully into ≤200 chars, then speak it.",
      "Do NOT add unrelated content when reading [TTS] text.",
    );

    // ── Extra voice instructions from config (identity.voiceInstructions) ──
    if (this.voiceInstructions) {
      parts.push("\n## 附加语音指令", this.voiceInstructions);
    }

    let result = parts.join("\n");

    // Hard-cap the total length using the configurable limit.
    const cap = this.maxInstructionsChars;
    if (result.length > cap) {
      result = result.substring(0, cap - 20) + "\n[...精简版]";
    }

    return result;
  }

  /**
   * Truncate a bootstrap file's content to at most `maxLen` characters using
   * WinClaw's head-70% + tail-20% strategy.
   *
   * When truncation occurs a human-readable marker is inserted between the
   * retained head and tail sections.
   *
   * @param text   - Source text to truncate.
   * @param maxLen - Maximum allowed character count.
   */
  private truncate(text: string, maxLen: number): string {
    const trimmed = text.trimEnd();
    if (trimmed.length <= maxLen) {
      return trimmed;
    }

    const headChars = Math.floor(maxLen * BOOTSTRAP_HEAD_RATIO);
    const tailChars = Math.floor(maxLen * BOOTSTRAP_TAIL_RATIO);

    const head = trimmed.slice(0, headChars);
    const tail = trimmed.slice(-tailChars);

    return `${head}\n[...已精简...]\n${tail}`;
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Escape special regex metacharacters in a literal string so it can be safely
 * embedded in a `RegExp` constructor pattern.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
