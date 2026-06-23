// P6: gated routing of coding turns through the ported MetaCoder engine
// (packages/coding-engine, @winclaw/coding-engine) instead of pi-coding-agent.
//
// SAFE / opt-in: only engages when config.codingEngine === "metacoder" AND the
// model speaks the anthropic-messages API (the engine owns its own Anthropic SDK
// call and only supports that wire format). Everything else falls through to the
// existing createAgentSession path with zero behavioural change.
//
// The engine is loaded via dynamic import from the copy bundled into
// dist/coding-engine/ (by scripts/copy-coding-engine.ts), NOT a bare
// "@winclaw/coding-engine" specifier — that would make tsdown try to bundle the
// 20MB engine into the static build, and would require a workspace dependency
// that breaks a standalone `npm install -g .`. The relative bundled-path import
// is resolved at runtime only when the gate actually triggers.
import type { EmbeddedRunAttemptParams } from "./types.js";

// ── Local structural types (no compile-time dependency on the engine package) ──
/** WinClaw custom tool shape the engine bridge accepts. */
export type WinClawToolLike = {
  label?: string;
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: (partial: unknown) => void,
  ) => Promise<unknown>;
  ownerOnly?: boolean;
};

/** The session surface attempt.ts drives (cast to pi's AgentSession at the call site). */
export type RoutedAgentSession = {
  readonly agent: unknown;
  readonly sessionId: string;
  readonly messages: unknown[];
  prompt: (text: string, options?: unknown) => Promise<void>;
  subscribe: (listener: (event: unknown) => void) => () => void;
  dispose: () => void;
};

type EngineModule = {
  createMetaCoderSession: (opts: {
    cwd: string;
    model: string;
    appendSystemPrompt?: string;
    winclawTools?: WinClawToolLike[];
    initialMessages?: unknown[];
    apiKey?: string;
    baseUrl?: string;
  }) => { session: RoutedAgentSession };
};

// Coding-intent signals. The ported MetaCoder engine is a full planning agent and
// is heavier than pi-coding-agent, so we only route GENUINE coding tasks through it
// — ordinary chat (status checks, questions, conversation) stays on the fast pi path.
// Multilingual (EN / 中文 / 日本語) to match the typical user base.
const CODING_INTENT_PATTERNS: RegExp[] = [
  // EN: coding verb + a code-ish object
  /\b(write|create|build|implement|generate|make|fix|debug|refactor|optimi[sz]e|compile|run|add|update|port|migrate)\b[^.!?\n]{0,48}\b(code|program(me)?|script|function|class|method|module|app|application|web ?site|web ?page|component|api|endpoint|server|cli|bot|game|simulation|algorithm|unit ?test|regex|query|schema|parser|library|package|feature|bug|error|crash|file|html|css|component)\b/i,
  // EN: standalone coding nouns / tooling
  /\b(refactor|debug(ging)?|compile|deploy|algorithm|recursion|regex|stack ?trace|null ?pointer|segfault|git\b|repository|repo\b|npm\b|pnpm\b|pip\b|docker(file)?|kubernetes|webpack|vite\b|eslint|typescript|javascript|python|golang|rust|react|vue|node\.?js|sql)\b/i,
  // EN: source-file extensions
  /\.(py|js|ts|tsx|jsx|mjs|cjs|go|rs|java|cpp|cc|hpp|rb|php|html|css|scss|sql|sh|ps1|json|ya?ml|toml)\b/i,
  // code fences / obvious code tokens
  /```|=>|\bdef \b|\bfunction\b|\bclass \b|\bimport \b|\bconst \b|\bpublic static\b|\bSELECT .* FROM\b/i,
  // 中文：编程动词 + 对象
  /(编写|编程|写(一个|个|段|份)?(程序|代码|脚本|函数|网页|页面|应用|组件|爬虫|接口|算法|游戏|模拟|效果图|小工具|工具))|实现(一个|个|下)?|重构|调试|编译|部署|代码|脚本|算法|函数|接口|数据库|前端|后端|爬虫|修复?(bug|错误|代码|崩溃)|开发(一个|个)?|程序/,
  // 日本語
  /(プログラム|コード|実装|関数|クラス|デバッグ|リファクタ|コンパイル|アルゴリズム|スクリプト|開発|バグ修正)/,
];

/** Heuristic: does the user's message look like a genuine coding task? */
export function isLikelyCodingTask(prompt: string | undefined): boolean {
  if (!prompt || typeof prompt !== "string") {return false;}
  return CODING_INTENT_PATTERNS.some((re) => re.test(prompt));
}

/**
 * True when this turn should be routed through the ported MetaCoder engine.
 * Requires: config opt-in (`codingEngine: "metacoder"`) + an anthropic-messages model
 * (the engine only supports that wire format) + the message actually looks like a
 * coding task. Ordinary chat falls through to the fast pi-coding-agent.
 * (`codingEngine: "metacoder-always"` skips the heuristic and routes every turn.)
 */
export function shouldUseMetaCoderEngine(params: EmbeddedRunAttemptParams): boolean {
  const mode = params.config?.codingEngine;
  if (mode !== "metacoder" && mode !== "metacoder-always") {return false;}
  if (params.model.api !== "anthropic-messages") {return false;}
  if (mode === "metacoder-always") {return true;}
  return isLikelyCodingTask(params.prompt);
}

/** Load the engine bundle copied into dist/coding-engine/ next to the built output. */
async function loadEngine(): Promise<EngineModule> {
  const url = new URL("./coding-engine/index.mjs", import.meta.url);
  return (await import(url.href)) as EngineModule;
}

/**
 * Build a MetaCoder-backed session configured from WinClaw's resolved
 * model/provider/auth. WinClaw-native custom tools are bridged into the engine so
 * coding turns retain access to grc_* / memory / messaging tools.
 */
/** Minimal structural view of pi's SessionManager — just the history accessor we need. */
type SessionContextSource = {
  buildSessionContext: () => { messages: unknown[] };
};

export async function createMetaCoderEmbeddedSession(opts: {
  params: EmbeddedRunAttemptParams;
  cwd: string;
  systemPromptText: string;
  /** WinClaw custom (non-built-in) tools to bridge; engine supplies its own built-ins. */
  winclawTools: WinClawToolLike[];
  /** Source of the prior conversation, to seed the engine for multi-turn resume. */
  sessionManager?: SessionContextSource;
}): Promise<{ session: RoutedAgentSession }> {
  const { params, cwd, systemPromptText, winclawTools, sessionManager } = opts;
  const mod = await loadEngine();

  const apiKey = (await params.authStorage.getApiKey(params.provider)) ?? undefined;
  const providerCfg = params.config?.models?.providers?.[params.model.provider];
  const baseUrl =
    (typeof params.model.baseUrl === "string" && params.model.baseUrl.length > 0
      ? params.model.baseUrl
      : undefined) ??
    (typeof providerCfg?.baseUrl === "string" ? providerCfg.baseUrl : undefined);

  // Seed prior conversation so a coding turn resumes with full context. pi's
  // AgentMessage[] is converted to the engine's transcript format internally.
  let initialMessages: unknown[] | undefined;
  try {
    initialMessages = sessionManager?.buildSessionContext().messages;
  } catch {
    initialMessages = undefined;
  }

  return mod.createMetaCoderSession({
    cwd,
    model: params.modelId,
    appendSystemPrompt: systemPromptText,
    winclawTools,
    apiKey,
    baseUrl,
    initialMessages: initialMessages as never,
  });
}
