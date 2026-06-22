// P7 (history resume): convert WinClaw's pi-agent-core AgentMessage[] history into
// MetaCoder's transcript Message[] so the ported engine can resume a multi-turn
// coding conversation. WinClaw creates a fresh session per incoming message and
// seeds it with the accumulated transcript; without this, every coding turn would
// start blind. We reuse the engine's own message constructors so the envelope
// (uuid/timestamp/usage/…) is always shaped exactly as the engine expects.
import { createAssistantMessage, createUserMessage } from "../utils/messages.js";
import type { PiAgentMessage } from "./translate.js";

// ── pi runtime block shapes (from @mariozechner/pi-ai) ──
type PiText = { type: "text"; text: string };
type PiThinking = { type: "thinking"; thinking: string };
type PiToolCall = { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> };
type PiImage = { type: "image"; data: string; mimeType: string };
type PiAssistantBlock = PiText | PiThinking | PiToolCall;
type PiUserBlock = PiText | PiImage;

// ── Anthropic content blocks the engine's constructors accept ──
type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean };

function piUserBlocksToAnthropic(blocks: PiUserBlock[]): AnthropicBlock[] {
  return blocks.map((b) =>
    b.type === "image"
      ? ({ type: "image", source: { type: "base64", media_type: b.mimeType, data: b.data } } as const)
      : ({ type: "text", text: b.text } as const),
  );
}

function piToolResultContent(blocks: PiUserBlock[]): Array<{ type: "text"; text: string }> {
  const out = blocks
    .filter((b): b is PiText => b.type === "text")
    .map((b) => ({ type: "text" as const, text: b.text }));
  return out.length ? out : [{ type: "text", text: "" }];
}

/**
 * Convert a pi history into MetaCoder transcript messages.
 *
 * - user            → user message (string or content blocks)
 * - assistant       → assistant message; text + tool_use kept, thinking dropped
 *                     (signature-less thinking blocks can be rejected on replay)
 * - toolResult run  → ONE user message holding all the tool_result blocks
 *                     (Anthropic requires every tool_use's result in the same
 *                     following user turn; consecutive pi toolResults coalesce)
 *
 * Returns `unknown[]` — the engine's Message[] type is internal/erased; the
 * objects are constructed by the engine's own helpers so the shape is correct.
 */
export function piHistoryToMetaCoder(history: PiAgentMessage[]): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  while (i < history.length) {
    const msg = history[i] as PiAgentMessage & {
      role: string;
      content?: unknown;
      toolCallId?: string;
      isError?: boolean;
    };

    if (msg.role === "toolResult") {
      // Coalesce a run of consecutive toolResult messages into one user turn.
      const blocks: AnthropicBlock[] = [];
      while (i < history.length && (history[i] as { role: string }).role === "toolResult") {
        const tr = history[i] as unknown as {
          toolCallId: string;
          content: PiUserBlock[];
          isError?: boolean;
        };
        blocks.push({
          type: "tool_result",
          tool_use_id: tr.toolCallId,
          content: piToolResultContent(Array.isArray(tr.content) ? tr.content : []),
          is_error: !!tr.isError,
        });
        i++;
      }
      if (blocks.length) {
        out.push(createUserMessage({ content: blocks as never }));
      }
      continue;
    }

    if (msg.role === "assistant") {
      const piBlocks = (Array.isArray(msg.content) ? msg.content : []) as PiAssistantBlock[];
      const blocks: AnthropicBlock[] = [];
      for (const b of piBlocks) {
        if (b.type === "text") {
          blocks.push({ type: "text", text: b.text });
        } else if (b.type === "toolCall") {
          blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.arguments || {} });
        }
        // thinking intentionally dropped
      }
      // Skip assistant turns that became empty after dropping thinking — Anthropic
      // rejects empty assistant content.
      if (blocks.length) {
        out.push(createAssistantMessage({ content: blocks as never }));
      }
      i++;
      continue;
    }

    // user (or any other role treated as user text)
    const content = msg.content;
    if (typeof content === "string") {
      out.push(createUserMessage({ content }));
    } else if (Array.isArray(content)) {
      out.push(createUserMessage({ content: piUserBlocksToAnthropic(content as PiUserBlock[]) as never }));
    }
    i++;
  }
  return out;
}
