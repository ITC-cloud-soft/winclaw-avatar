// P4: MetaCoderSession — implements the pi AgentSession surface that WinClaw's
// subscribeEmbeddedPiSession + attempt.ts drive, backed by the ported engine.
import { ask } from "../QueryEngine.js";
import { getAllBaseTools } from "../tools.js";
import { getDefaultAppState } from "../state/AppStateStore.js";
import { FileStateCache } from "../utils/fileStateCache.js";
import { getCommands } from "../commands.js";
import { enableConfigs } from "../utils/config.js";
import { SdkToPiTranslator, type PiAgentEvent, type PiAgentMessage, type SDKMessage } from "./translate.js";
import { bridgeWinClawTools, type WinClawToolLike } from "./tool-bridge.js";
import { piHistoryToMetaCoder } from "./history.js";

export type AgentSessionEventListener = (event: PiAgentEvent) => void;

export type MetaCoderSessionOptions = {
  cwd: string;
  model: string;
  appendSystemPrompt?: string;
  /** WinClaw-native tools (grc_*, memory, messaging) injected alongside the engine's own. */
  winclawTools?: WinClawToolLike[];
  /** Prior conversation (pi AgentMessage[]) to seed the engine for multi-turn resume. */
  initialMessages?: PiAgentMessage[];
  /**
   * Anthropic-style API target for the engine's own LLM call (it owns the call;
   * it does NOT use WinClaw's injected streamFn). When provided, these are applied
   * to the process env for the duration of each prompt() so the engine's Anthropic
   * SDK client points at WinClaw's configured provider (e.g. a custom baseUrl).
   */
  apiKey?: string;
  baseUrl?: string;
};

type AgentLike = {
  streamFn: unknown;
  setSystemPrompt: (v: string) => void;
  replaceMessages: (ms: PiAgentMessage[]) => void;
};

let configsEnabled = false;

export class MetaCoderSession {
  private listeners = new Set<AgentSessionEventListener>();
  private translator = new SdkToPiTranslator();
  private _isStreaming = false;
  private _systemPrompt = "";
  private abortController: AbortController | null = null;
  private appState = getDefaultAppState();
  private fileCache = new FileStateCache(2000, 50 * 1024 * 1024);
  // Prior conversation seed (from WinClaw's sessionManager or replaceMessages).
  // The full transcript = _seedHistory ++ engine-produced (translator) messages.
  private _seedHistory: PiAgentMessage[] = [];

  // pi AgentSession reaches into these private fields via applySystemPromptOverrideToSession
  _baseSystemPrompt?: string;
  _rebuildSystemPrompt?: (toolNames: string[]) => string;

  readonly agent: AgentLike = {
    streamFn: undefined, // WinClaw reassigns this; the ported engine ignores it (it owns its own LLM call)
    setSystemPrompt: (v: string) => {
      this._systemPrompt = v;
    },
    replaceMessages: (ms: PiAgentMessage[]) => {
      // WinClaw's list supersedes: reseed and drop engine-accumulated messages,
      // so the next prompt() resumes from exactly this transcript.
      this._seedHistory = Array.isArray(ms) ? ms.slice() : [];
      this.translator.reset();
    },
  };

  constructor(private opts: MetaCoderSessionOptions) {
    this._systemPrompt = opts.appendSystemPrompt ?? "";
    this._seedHistory = opts.initialMessages?.slice() ?? [];
    // bypass permission prompts for unattended runs
    const as = this.appState as unknown as { toolPermissionContext?: { mode?: string } };
    if (as.toolPermissionContext) {
      as.toolPermissionContext.mode = "bypassPermissions";
    }
  }

  get sessionId(): string {
    return this.translator.sessionId;
  }
  get messages(): PiAgentMessage[] {
    return [...this._seedHistory, ...this.translator.getMessages()];
  }
  get isStreaming(): boolean {
    return this._isStreaming;
  }
  get isCompacting(): boolean {
    return false; // engine self-manages compaction
  }

  subscribe(listener: AgentSessionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: PiAgentEvent): void {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* listener errors must not break the engine loop */
      }
    }
  }

  async prompt(
    text: string,
    options?: { images?: Array<{ type: "image"; data: string; mimeType: string }> },
  ): Promise<void> {
    if (!configsEnabled) {
      enableConfigs();
      configsEnabled = true;
    }
    this._isStreaming = true;
    this.abortController = new AbortController();
    this.emit({ type: "agent_start" });
    this.emit({ type: "turn_start" });

    // Point the engine's own Anthropic SDK client at WinClaw's configured provider.
    // The engine reads ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL from env; scope the
    // override to this turn and restore afterwards so we never leak global state.
    const prevKey = process.env.ANTHROPIC_API_KEY;
    const prevBase = process.env.ANTHROPIC_BASE_URL;
    if (this.opts.apiKey) {
      process.env.ANTHROPIC_API_KEY = this.opts.apiKey;
    }
    if (this.opts.baseUrl) {
      process.env.ANTHROPIC_BASE_URL = this.opts.baseUrl;
    }

    try {
      const allTools = getAllBaseTools() as unknown as Array<{ prompt?: unknown; name?: string }>;
      const baseTools = allTools.filter((t) => typeof t.prompt === "function");
      // P5: bridge WinClaw-native tools and inject alongside the engine's own.
      const bridged = (this.opts.winclawTools?.length
        ? bridgeWinClawTools(this.opts.winclawTools)
        : []) as Array<{ prompt?: unknown; name?: string }>;
      const tools = [...baseTools, ...bridged];
      const commands = await getCommands(this.opts.cwd);
      const canUseTool = async (_t: unknown, input: Record<string, unknown>) => ({
        behavior: "allow" as const,
        updatedInput: input,
      });

      const sp = this._systemPrompt || undefined;

      // Seed the engine with the prior conversation (seed history + any earlier
      // turns produced this session) so multi-turn coding resumes with context.
      // Snapshot BEFORE recording this turn's user prompt (that goes via `prompt`).
      const priorMessages = piHistoryToMetaCoder(this.messages);
      // Record this user turn so it persists in the transcript for the next turn.
      this.translator.pushUserMessage(text);

      // P-image: bridge WinClaw prompt images → Anthropic content blocks so
      // vision-capable coding turns see them. Images are prompt-local (per
      // WinClaw), so they go in the prompt, not the persisted transcript.
      const images = options?.images ?? [];
      const promptContent =
        images.length > 0
          ? [
              { type: "text", text },
              ...images.map((img) => ({
                type: "image",
                source: { type: "base64", media_type: img.mimeType, data: img.data },
              })),
            ]
          : text;

      for await (const m of ask({
        prompt: promptContent as never,
        cwd: this.opts.cwd,
        tools,
        commands,
        mcpClients: [],
        mutableMessages: priorMessages as never,
        canUseTool: canUseTool as never,
        getAppState: () => this.appState,
        setAppState: (f: (p: typeof this.appState) => typeof this.appState) => {
          this.appState = f(this.appState);
        },
        getReadFileCache: () => this.fileCache,
        setReadFileCache: () => {},
        userSpecifiedModel: this.opts.model,
        appendSystemPrompt: sp,
        abortController: this.abortController,
      } as never) as AsyncIterable<SDKMessage>) {
        for (const evt of this.translator.translate(m)) {
          this.emit(evt);
        }
      }

      // turn complete
      this.emit({ type: "agent_end", messages: this.translator.getMessages() });
    } finally {
      this._isStreaming = false;
      this.abortController = null;
      // restore env to avoid leaking the per-turn provider override
      if (prevKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = prevKey;
      }
      if (prevBase === undefined) {
        delete process.env.ANTHROPIC_BASE_URL;
      } else {
        process.env.ANTHROPIC_BASE_URL = prevBase;
      }
    }
  }

  async steer(text: string): Promise<void> {
    // minimal: a steer is a follow-up prompt in the same session
    await this.prompt(text);
  }

  async abort(): Promise<void> {
    this.abortController?.abort();
  }

  abortCompaction(): void {
    /* engine self-manages compaction; nothing to abort */
  }

  dispose(): void {
    this.abortController?.abort();
    this.listeners.clear();
  }
}

export function createMetaCoderSession(opts: MetaCoderSessionOptions): { session: MetaCoderSession } {
  return { session: new MetaCoderSession(opts) };
}
