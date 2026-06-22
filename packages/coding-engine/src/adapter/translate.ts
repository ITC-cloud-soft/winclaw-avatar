// P4: translate MetaCoder SDKMessage stream → pi-agent-core AgentEvent stream.
// Structural (inline) pi types — at the WinClaw boundary these match
// @mariozechner/pi-agent-core / pi-ai shapes without importing them here.

export type PiTextContent = { type: "text"; text: string };
export type PiThinkingContent = { type: "thinking"; thinking: string };
export type PiToolCall = { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> };
export type PiAssistantContent = PiTextContent | PiThinkingContent | PiToolCall;

export type PiAssistantMessage = {
  role: "assistant";
  content: PiAssistantContent[];
  api: string;
  provider: string;
  model: string;
  usage: { input: number; output: number; cacheRead?: number; cacheWrite?: number; cost?: { total: number } };
  stopReason: string;
  timestamp: number;
  errorMessage?: string;
};
export type PiToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: PiTextContent[];
  isError: boolean;
  timestamp: number;
};
export type PiAgentMessage = PiAssistantMessage | PiToolResultMessage | { role: "user"; content: string; timestamp: number };

export type PiAssistantMessageEvent =
  | { type: "start"; partial: PiAssistantMessage }
  | { type: "text_start"; contentIndex: number; partial: PiAssistantMessage }
  | { type: "text_delta"; contentIndex: number; delta: string; partial: PiAssistantMessage }
  | { type: "text_end"; contentIndex: number; content: string; partial: PiAssistantMessage }
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: PiAssistantMessage }
  | { type: "done"; reason: "stop" | "length" | "toolUse"; message: PiAssistantMessage };

export type PiAgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: PiAgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: PiAgentMessage; toolResults: PiToolResultMessage[] }
  | { type: "message_start"; message: PiAgentMessage }
  | { type: "message_update"; message: PiAgentMessage; assistantMessageEvent: PiAssistantMessageEvent }
  | { type: "message_end"; message: PiAgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean };

// ── MetaCoder SDKMessage (subset we read) ──
type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean }
  | { type: string; [k: string]: unknown };

export type SDKMessage = {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: { role?: string; content?: AnthropicBlock[] | string; model?: string; usage?: Record<string, number> };
  result?: string;
  is_error?: boolean;
  num_turns?: number;
  usage?: Record<string, number>;
};

/**
 * Stateful translator: feed each SDKMessage, get back zero or more PiAgentEvents.
 * Tracks tool name by id (for tool_execution_end) and accumulates the message list.
 */
export class SdkToPiTranslator {
  private toolNames = new Map<string, string>();
  private messages: PiAgentMessage[] = [];
  private model = "unknown";
  sessionId = "";

  getMessages(): PiAgentMessage[] {
    return this.messages.slice();
  }

  /** Clear accumulated messages (used when WinClaw replaces the transcript). */
  reset(): void {
    this.messages = [];
    this.toolNames.clear();
  }

  /**
   * Record a user prompt. The engine's ask() does NOT echo the user input as an
   * SDKMessage, so we add it ourselves to keep the transcript complete (and valid
   * for resume — Anthropic requires the conversation to start with a user turn).
   */
  pushUserMessage(text: string): void {
    this.messages.push({ role: "user", content: text, timestamp: 0 });
  }

  private buildAssistant(blocks: AnthropicBlock[], usage?: Record<string, number>): PiAssistantMessage {
    const content: PiAssistantContent[] = [];
    for (const b of blocks) {
      if (b.type === "text") {content.push({ type: "text", text: (b as { text: string }).text });}
      else if (b.type === "thinking") {content.push({ type: "thinking", thinking: (b as { thinking: string }).thinking });}
      else if (b.type === "tool_use") {
        const tb = b as { id: string; name: string; input: Record<string, unknown> };
        content.push({ type: "toolCall", id: tb.id, name: tb.name, arguments: tb.input || {} });
      }
    }
    return {
      role: "assistant",
      content,
      api: "anthropic-messages",
      provider: "anthropic",
      model: this.model,
      usage: {
        input: usage?.input_tokens ?? 0,
        output: usage?.output_tokens ?? 0,
        cacheRead: usage?.cache_read_input_tokens,
        cacheWrite: usage?.cache_creation_input_tokens,
      },
      stopReason: "stop",
      timestamp: 0,
    };
  }

  translate(m: SDKMessage): PiAgentEvent[] {
    const out: PiAgentEvent[] = [];

    if (m.type === "system" && m.subtype === "init") {
      if (m.session_id) {this.sessionId = m.session_id;}
      if (m.message?.model) {this.model = m.message.model;}
      return out; // agent_start is emitted by the session at prompt() start
    }

    if (m.type === "assistant" && m.message) {
      const blocks = Array.isArray(m.message.content) ? m.message.content : [];
      if (m.message.model) {this.model = m.message.model;}
      const assistant = this.buildAssistant(blocks, m.message.usage);
      this.messages.push(assistant);

      out.push({ type: "message_start", message: assistant });

      // Stream text/thinking as a single delta each (MetaCoder yields whole blocks)
      let idx = 0;
      for (const b of blocks) {
        if (b.type === "text") {
          const text = (b as { text: string }).text;
          out.push({
            type: "message_update",
            message: assistant,
            assistantMessageEvent: { type: "text_delta", contentIndex: idx, delta: text, partial: assistant },
          });
          idx++;
        } else if (b.type === "thinking") {
          const think = (b as { thinking: string }).thinking;
          out.push({
            type: "message_update",
            message: assistant,
            assistantMessageEvent: { type: "thinking_delta", contentIndex: idx, delta: think, partial: assistant },
          });
          idx++;
        }
      }
      out.push({ type: "message_end", message: assistant });

      // Tool calls → tool_execution_start
      for (const b of blocks) {
        if (b.type === "tool_use") {
          const tb = b as { id: string; name: string; input: Record<string, unknown> };
          this.toolNames.set(tb.id, tb.name);
          out.push({ type: "tool_execution_start", toolCallId: tb.id, toolName: tb.name, args: tb.input });
        }
      }
      return out;
    }

    if (m.type === "user" && m.message && Array.isArray(m.message.content)) {
      for (const b of m.message.content) {
        if (b.type === "tool_result") {
          const rb = b as { tool_use_id: string; content: unknown; is_error?: boolean };
          const name = this.toolNames.get(rb.tool_use_id) ?? "unknown";
          const resultText =
            typeof rb.content === "string"
              ? rb.content
              : Array.isArray(rb.content)
                ? (rb.content as AnthropicBlock[]).filter((x) => x.type === "text").map((x) => (x as { text: string }).text).join("")
                : JSON.stringify(rb.content);
          const trMsg: PiToolResultMessage = {
            role: "toolResult",
            toolCallId: rb.tool_use_id,
            toolName: name,
            content: [{ type: "text", text: resultText }],
            isError: !!rb.is_error,
            timestamp: 0,
          };
          this.messages.push(trMsg);
          out.push({
            type: "tool_execution_end",
            toolCallId: rb.tool_use_id,
            toolName: name,
            result: resultText,
            isError: !!rb.is_error,
          });
        }
      }
      return out;
    }

    if (m.type === "result") {
      // terminal: agent_end emitted by session after the generator drains
      return out;
    }

    return out; // ignore stream_event / status / rate_limit / unknown
  }
}
