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

// 秘书安全门(§15.3 / docs/10 §18): 无人值守の coding turn で実行を許さない
// 危険コマンド。対外(curl/wget/ssh/scp/...)、破壊的(rm -r*)、公開(git push/
// npm publish)、提権/系统(sudo/chmod/chown/kill/shutdown/mkfs/dd)。
// これらは §15 で「主人の二次確認が要る」分類 = 無人時は deny。
const SECRETARY_DENY_CMD =
  /(^|[\s;&|`(){}])(curl|wget|ssh|scp|sftp|rsync|nc|ncat|netcat|telnet|rm|sudo|chmod|chown|kill|pkill|shutdown|reboot|mkfs|dd)\b|\bgit\s+push\b|\bnpm\s+publish\b/i;

// エンジン native の alwaysDenyRules 用。Bash(cmd:*) は当該コマンドで始まる全実行を
// deny。対外(curl/wget/ssh/scp/...)、破壊(rm)、提権(sudo/chmod/chown/kill/...)、
// 公開(git push/npm publish)、WebFetch(任意 URL 取得)を hard-deny。
// これらは §15 で「主人の二次確認が要る」分類 = 無人時は deny。
const SECRETARY_DENY_RULES: string[] = [
  "Bash(curl:*)",
  "Bash(wget:*)",
  "Bash(ssh:*)",
  "Bash(scp:*)",
  "Bash(sftp:*)",
  "Bash(rsync:*)",
  "Bash(nc:*)",
  "Bash(ncat:*)",
  "Bash(telnet:*)",
  "Bash(rm:*)",
  "Bash(sudo:*)",
  "Bash(chmod:*)",
  "Bash(chown:*)",
  "Bash(kill:*)",
  "Bash(pkill:*)",
  "Bash(shutdown:*)",
  "Bash(reboot:*)",
  "Bash(mkfs:*)",
  "Bash(dd:*)",
  "Bash(git push:*)",
  "Bash(npm publish:*)",
  "WebFetch",
];

/** 許可可否を判定。deny なら理由文字列、allow なら null。 */
function evaluateSecretaryPermission(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  const name = toolName.toLowerCase();
  if (name === "bash" || name === "exec" || name === "shell") {
    const cmd = String((input.command ?? input.cmd ?? "") || "");
    if (SECRETARY_DENY_CMD.test(cmd)) {
      return `命令被秘书安全策略拒绝(对外/破坏性/提权操作需主人显式授权): ${cmd.slice(0, 120)}`;
    }
  }
  return null;
}

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
    // 無人値守の能力門控(§15.3 / docs/10 §18)。bypassPermissions は全許可で
    // 危険コマンドも通すため使わない。mode="default" + エンジン native の
    // alwaysDenyRules(Bash(cmd:*) パターン)で、対外/破壊/提権コマンドを
    // hard-deny する。default では deny に当たらない bash は自動許可されるので、
    // ホワイトリストではなくブラックリスト(deny)方式。read-only/Write/python 等は通る。
    // alwaysDenyRules[source] は **文字列配列**("Bash(rm:*)" 形式)。
    // getDenyRules が permissionRuleValueFromString で各文字列を解析する
    // (permissions.ts:213-220)。'session' は有効な PERMISSION_RULE_SOURCES。
    const as = this.appState as unknown as {
      toolPermissionContext?: {
        mode?: string;
        alwaysDenyRules?: Record<string, string[]>;
      };
    };
    if (as.toolPermissionContext) {
      as.toolPermissionContext.mode = "default";
      as.toolPermissionContext.alwaysDenyRules = {
        ...(as.toolPermissionContext.alwaysDenyRules ?? {}),
        session: [
          ...((as.toolPermissionContext.alwaysDenyRules ?? {}).session ?? []),
          ...SECRETARY_DENY_RULES,
        ],
      };
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
    // z.ai の anthropic endpoint は Bearer 認証必須。ANTHROPIC_AUTH_TOKEN も
    // per-turn で設定/復元し、isClaudeAISubscriber() の OAuth 経路を抑止する。
    const prevAuth = process.env.ANTHROPIC_AUTH_TOKEN;
    if (this.opts.apiKey) {
      process.env.ANTHROPIC_API_KEY = this.opts.apiKey;
      process.env.ANTHROPIC_AUTH_TOKEN = this.opts.apiKey;
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
      // 秘书安全门(§15.3 / docs/10 §18): 无人值守下,对外/破坏性/提权の
      // shell 命令を deny。それ以外(python/node/file 操作/web 検索等)は allow。
      // 主 agent の §15 推理層と二重防御を成す。
      const canUseTool = async (toolOrName: unknown, input: Record<string, unknown>) => {
        // canUseTool の第1引数は **ツールオブジェクト**(.name を持つ)。名前文字列ではない。
        const tname = String((toolOrName as { name?: string })?.name ?? toolOrName ?? "");
        const denyReason = evaluateSecretaryPermission(tname, input);
        if (denyReason) {
          return { behavior: "deny" as const, message: denyReason };
        }
        return { behavior: "allow" as const, updatedInput: input };
      };

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

      // 認証が通った後、最終答案(result)の後にエンジンがもう1回 z.ai へ投げ、
      // その SSE が「first chunk 後に無音・無 close」で永久停止することがある。
      // 手動イテレータ化し、(a) result 受信で即 break、(b) 60s 無音で保険 break。
      // __mcIter.return() は await しない(僵死 generator の cleanup で再ハングするため)。
      const __mcIter = (ask({
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
      } as never) as AsyncIterable<SDKMessage>)[Symbol.asyncIterator]();
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let __mcRes: any;
        let __mcTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          __mcRes = await Promise.race([
            __mcIter.next(),
            new Promise((rs) => {
              __mcTimer = setTimeout(() => rs({ __idle: true }), 60000);
            }),
          ]);
        } catch {
          break;
        } finally {
          if (__mcTimer) clearTimeout(__mcTimer);
        }
        if (!__mcRes || __mcRes.done) break;
        if (__mcRes.__idle) {
          try {
            this.abortController?.abort();
          } catch {}
          try {
            if (__mcIter.return) void Promise.resolve(__mcIter.return()).catch(() => {});
          } catch {}
          break;
        }
        const m = __mcRes.value as SDKMessage;
        for (const evt of this.translator.translate(m)) {
          this.emit(evt);
        }
        if (m && (m as { type?: string }).type === "result") {
          try {
            this.abortController?.abort();
          } catch {}
          try {
            if (__mcIter.return) void Promise.resolve(__mcIter.return()).catch(() => {});
          } catch {}
          break;
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
      if (prevAuth === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN;
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = prevAuth;
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
