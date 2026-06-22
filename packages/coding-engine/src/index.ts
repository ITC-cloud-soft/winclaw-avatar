// @winclaw/coding-engine — public API.
// The MetaCoder coding engine, ported into WinClaw as native Node code (Path B),
// exposed behind a pi-agent-core-compatible AgentSession surface so WinClaw can
// drive coding turns through it in place of pi-coding-agent.
export {
  MetaCoderSession,
  createMetaCoderSession,
  type MetaCoderSessionOptions,
  type AgentSessionEventListener,
} from "./adapter/session.js";

export {
  SdkToPiTranslator,
  type PiAgentEvent,
  type PiAgentMessage,
  type PiAssistantMessage,
  type PiToolResultMessage,
  type PiAssistantMessageEvent,
  type SDKMessage,
} from "./adapter/translate.js";

export {
  bridgeWinClawTool,
  bridgeWinClawTools,
  type WinClawToolLike,
  type WinClawToolResult,
  type WinClawToolContent,
} from "./adapter/tool-bridge.js";

export { piHistoryToMetaCoder } from "./adapter/history.js";
