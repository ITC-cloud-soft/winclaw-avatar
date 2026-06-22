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

/** True when this coding turn should be routed through the ported MetaCoder engine. */
export function shouldUseMetaCoderEngine(params: EmbeddedRunAttemptParams): boolean {
  return params.config?.codingEngine === "metacoder" && params.model.api === "anthropic-messages";
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
