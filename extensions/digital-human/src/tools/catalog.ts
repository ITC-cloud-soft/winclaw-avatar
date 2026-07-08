/**
 * @fileoverview Winclaw Digital-Human tool catalog for Qwen 3.5 Realtime
 * function calling.
 *
 * The 5 tools below are "capability"-level (not per-skill) — `task_run`
 * multiplexes the entire winclaw skill registry through a single tool
 * definition, keeping the Qwen tools list short and stable as skills grow.
 *
 * See `docs/dh-qwen35-function-calling-proposal.md` §3.1.
 */

import type { QwenToolDefinition } from "../integrations/qwen-realtime.js";

/** Full list of tools exposed to Qwen when `dhMode === "function_calling"`. */
export const WINCLAW_DH_TOOLS: QwenToolDefinition[] = [
  {
    type: "function",
    name: "ask_winclaw",
    description:
      "Forward the owner's request or question to the Winclaw agent. " +
      "ALWAYS use this when: (1) you're unsure which specific tool to use, " +
      "(2) the task requires multiple steps (e.g. 'read my email and post a summary to Slack'), " +
      "(3) the owner asks about their personal data/state/history that you don't have in your current context. " +
      "Winclaw has full access to email, calendar, SNS, memory, tasks, notifications, and all connected channels. " +
      "The agent's reply comes back as the tool result — speak it verbatim after integrating 1-2 sentences.",
    parameters: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description:
            "The owner's request in natural language, in the same language they spoke",
        },
      },
      required: ["request"],
    },
  },
  {
    type: "function",
    name: "memory_search",
    description:
      "Search the owner's long-term memory. Use when the user refers to " +
      "past events, decisions, or preferences that aren't in the current " +
      "conversation window. BM25 + vector hybrid search.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query in the user's language",
        },
        top_k: { type: "integer", default: 5 },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "memory_get",
    description:
      "Read a specific line range from a memory file when the user asks " +
      "about a particular day or topic memo. Requires the file path " +
      "returned by memory_search.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        startLine: { type: "integer" },
        endLine: { type: "integer" },
      },
      required: ["path"],
    },
  },
  {
    type: "function",
    name: "task_run",
    description:
      "Execute a Winclaw task on behalf of the owner. Use when the user " +
      "asks to DO something (send a message, schedule a meeting, summarise " +
      "emails, post to SNS). The task name must match a registered skill. " +
      "Returns {status, summary} which you MUST speak verbatim.",
    parameters: {
      type: "object",
      properties: {
        taskName: {
          type: "string",
          description:
            "Registered skill/task name e.g. 'email.summarize', " +
            "'calendar.schedule', 'sns.post'",
        },
        args: { type: "object", additionalProperties: true },
      },
      required: ["taskName"],
    },
  },
  {
    type: "function",
    name: "channel_send",
    description:
      "Send a message through a specific channel (email, LINE, Slack, " +
      "Telegram, WhatsApp). Use when the owner asks to send something. " +
      "NEVER invent recipients — ask the owner if ambiguous.",
    parameters: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["email", "line", "slack", "telegram", "whatsapp"],
        },
        recipient: { type: "string" },
        body: { type: "string" },
      },
      required: ["channel", "recipient", "body"],
    },
  },
  {
    type: "function",
    name: "internet_search",
    description:
      "Search the web for real-time info (weather, news, stock, etc.). " +
      "Do NOT use for owner-specific info (use memory_search) or for tasks " +
      "(use task_run).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "ui_action",
    description:
      "Control the digital-human interface itself — show/hide/toggle panels " +
      "and devices on the owner's screen. Use ONLY for UI-surface actions the " +
      "owner asks for by voice (e.g. 'open the artifact', 'hide the controls', " +
      "'turn on the mic', 'switch the avatar'). This does NOT execute any " +
      "backend work — for real tasks use task_run, for questions use " +
      "ask_winclaw. Returns {status:'ok', user_message} to speak verbatim.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: [
            "artifact",
            "task_panel",
            "controls",
            "mic",
            "camera",
            "avatar",
            "subtitle",
            "fullscreen",
            "voice",
            "music",
          ],
          description:
            "The UI element/device to act on: artifact (成果物/PDF preview), " +
            "task_panel, controls (control bar), mic, camera, avatar (数字人形象), " +
            "subtitle (字幕), fullscreen (immersive stage), voice (speaker voice), " +
            "music (music player — play/pause/stop a song).",
        },
        action: {
          type: "string",
          enum: ["show", "hide", "toggle", "on", "off", "open", "close", "play", "pause", "stop"],
          description: "The operation to perform on the target.",
        },
        name: {
          type: "string",
          description:
            "Optional name/id — the artifact filename when target='artifact', " +
            "the spoken voice descriptor (e.g. '活泼'/'日語'/'小夏') when " +
            "target='voice', or a JSON track {playUrl,title,artist,cover,loop} " +
            "when target='music' & action='play'.",
        },
      },
      required: ["target", "action"],
    },
  },
];

/**
 * Feature flags controlling which tools are exposed to Qwen.
 *
 * When a flag is omitted or `true`, the corresponding tool is included.
 * Passing `false` drops that tool from the returned list — useful when a
 * dependency (e.g. a web-search client) is unavailable in the current
 * deployment.
 */
export interface ToolFlags {
  askWinclaw?: boolean;
  memorySearch?: boolean;
  memoryGet?: boolean;
  taskRun?: boolean;
  channelSend?: boolean;
  internetSearch?: boolean;
  /**
   * UI-control tool (`ui_action`). Enabled by default — lets the owner drive
   * the digital-human interface (panels / mic / camera / avatar) by voice.
   */
  uiControl?: boolean;
}

/** Map from tool name to the flag field that enables/disables it. */
const FLAG_BY_NAME: Record<string, keyof ToolFlags> = {
  ask_winclaw: "askWinclaw",
  memory_search: "memorySearch",
  memory_get: "memoryGet",
  task_run: "taskRun",
  channel_send: "channelSend",
  internet_search: "internetSearch",
  ui_action: "uiControl",
};

/**
 * Return the subset of {@link WINCLAW_DH_TOOLS} that should be exposed given
 * the feature-flag configuration. Unknown flags are ignored; defaults to
 * "all enabled".
 */
export function buildToolList(flags: ToolFlags = {}): QwenToolDefinition[] {
  return WINCLAW_DH_TOOLS.filter((tool) => {
    const key = FLAG_BY_NAME[tool.name];
    if (!key) return true;
    const value = flags[key];
    return value === undefined ? true : value;
  });
}
