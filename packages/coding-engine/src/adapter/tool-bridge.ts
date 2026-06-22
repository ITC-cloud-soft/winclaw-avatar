// P5: bridge WinClaw AnyAgentTool (TypeBox schema + execute) → MetaCoder Tool
// (zod-or-JSONSchema + call), so the ported engine can invoke WinClaw-native
// tools (grc_*, memory, messaging) alongside its own getAllBaseTools().
//
// Strategy mirrors MetaCoder's own MCP-tool adapter (services/mcp/client.ts):
// spread the generic MCPTool to inherit ~20 sane defaults + render stubs, then
// override the few fields that carry the WinClaw tool's identity & behaviour.
// We feed the TypeBox schema straight through as `inputJSONSchema` (TypeBox IS
// JSON Schema), exactly as MCP tools do — the engine prefers inputJSONSchema
// over the zod inputSchema when present (utils/api.ts:158).
import { MCPTool } from "../tools/MCPTool/MCPTool.js";

// ── WinClaw side (structural; no hard import so the engine stays standalone) ──
export type WinClawTextContent = { type: "text"; text: string };
export type WinClawImageContent = { type: "image"; data: string; mimeType: string };
export type WinClawToolContent = WinClawTextContent | WinClawImageContent;
export type WinClawToolResult = { content: WinClawToolContent[]; details?: unknown };

export type WinClawToolLike = {
  label?: string;
  name: string;
  description: string;
  /** TypeBox TSchema — a JSON Schema object at runtime. */
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: (partial: WinClawToolResult) => void,
  ) => Promise<WinClawToolResult>;
  ownerOnly?: boolean;
};

// ── Anthropic tool_result content blocks (what mapToolResult... must yield) ──
type AnthropicResultBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function toAnthropicResultBlocks(content: WinClawToolContent[] | undefined): AnthropicResultBlock[] {
  if (!Array.isArray(content) || content.length === 0) {return [{ type: "text", text: "" }];}
  return content.map((c) =>
    c.type === "image"
      ? ({ type: "image", source: { type: "base64", media_type: c.mimeType, data: c.data } } as const)
      : ({ type: "text", text: c.text } as const),
  );
}

const MAX_DESC = 1024;

/**
 * Wrap one WinClaw tool as a MetaCoder Tool the engine can dispatch.
 * The returned object is shaped like a MetaCoder built tool (plain-async `call`
 * returning `{ data }` + `mapToolResultToToolResultBlockParam`).
 */
export function bridgeWinClawTool(win: WinClawToolLike): unknown {
  const desc = win.description ?? "";
  return {
    ...MCPTool,
    isMcp: false,
    name: win.name,
    // The WinClaw tool's JSON Schema, used verbatim by the API layer.
    inputJSONSchema: win.parameters as never,
    async description() {
      return desc;
    },
    async prompt() {
      return desc.length > MAX_DESC ? desc.slice(0, MAX_DESC) + "… [truncated]" : desc;
    },
    isReadOnly() {
      return false;
    },
    isConcurrencySafe() {
      return false;
    },
    // WinClaw tools are gated by WinClaw's own sender/role permissioning, not the
    // engine's. Allow at the engine layer; never prompt.
    async checkPermissions(input: Record<string, unknown>) {
      return { behavior: "allow" as const, updatedInput: input };
    },
    userFacingName() {
      return win.label || win.name;
    },
    async call(
      args: Record<string, unknown>,
      context: { toolUseId?: string; abortController?: AbortController },
      _canUseTool: unknown,
      _parentMessage: unknown,
      onProgress?: (p: { toolUseID: string; data: unknown }) => void,
    ) {
      const toolUseId = context?.toolUseId ?? "";
      const signal = context?.abortController?.signal;
      const onUpdate = onProgress && toolUseId
        ? (partial: WinClawToolResult) =>
            onProgress({ toolUseID: toolUseId, data: { type: "winclaw_progress", partial } })
        : undefined;
      const result = await win.execute(toolUseId, args, signal, onUpdate);
      // `data` is the Anthropic-shaped content array; mapToolResult... wraps it.
      return { data: toAnthropicResultBlocks(result?.content) };
    },
    mapToolResultToToolResultBlockParam(content: AnthropicResultBlock[], toolUseID: string) {
      return { tool_use_id: toolUseID, type: "tool_result" as const, content };
    },
  };
}

/** Bridge a list of WinClaw tools. */
export function bridgeWinClawTools(wins: WinClawToolLike[]): unknown[] {
  return wins.map((w) => bridgeWinClawTool(w));
}
