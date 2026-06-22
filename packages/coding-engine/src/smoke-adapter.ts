// P4 smoke: drive MetaCoderSession, subscribe, verify translated AgentEvent stream.
import { createMetaCoderSession } from "./adapter/session.js";
import type { PiAgentEvent } from "./adapter/translate.js";

async function main() {
  const cwd = process.argv[2] || process.cwd();
  const { session } = createMetaCoderSession({
    cwd,
    model: process.env.SMOKE_MODEL || "glm-5-turbo",
    appendSystemPrompt: "You are a coding agent running inside WinClaw.",
  });

  const counts: Record<string, number> = {};
  let streamedText = "";
  const toolCalls: string[] = [];

  const unsub = session.subscribe((e: PiAgentEvent) => {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.type === "message_update") {
      const ev = e.assistantMessageEvent;
      if (ev.type === "text_delta") {
        streamedText += ev.delta;
        process.stdout.write("[Δtext] " + JSON.stringify(ev.delta.slice(0, 80)) + "\n");
      } else if (ev.type === "thinking_delta") {
        process.stdout.write("[Δthink] " + JSON.stringify(ev.delta.slice(0, 60)) + "\n");
      }
    } else if (e.type === "tool_execution_start") {
      toolCalls.push(e.toolName);
      process.stdout.write("[tool→] " + e.toolName + " " + JSON.stringify(e.args).slice(0, 120) + "\n");
    } else if (e.type === "tool_execution_end") {
      process.stdout.write("[tool✓] " + e.toolName + " err=" + e.isError + " " + String(e.result).slice(0, 120) + "\n");
    } else if (e.type === "agent_start" || e.type === "agent_end") {
      process.stdout.write("[" + e.type + "]\n");
    }
  });

  process.stdout.write("=== P4 ADAPTER SMOKE cwd=" + cwd + " ===\n");
  await session.prompt(
    process.env.SMOKE_PROMPT ||
      "Read package.json, tell me the project name in one sentence, then create ADAPTER_OK.txt containing 'p4-adapter-works'.",
  );
  unsub();

  process.stdout.write("\n=== EVENT COUNTS ===\n");
  for (const [k, v] of Object.entries(counts)) process.stdout.write("  " + k + ": " + v + "\n");
  process.stdout.write("tools called: " + toolCalls.join(", ") + "\n");
  process.stdout.write("final messages: " + session.messages.length + " sessionId=" + session.sessionId + "\n");
  process.stdout.write("streamed assistant chars: " + streamedText.length + "\n");

  // Assertions for M-P4
  const ok =
    (counts["agent_start"] || 0) >= 1 &&
    (counts["agent_end"] || 0) >= 1 &&
    (counts["message_update"] || 0) >= 1 &&
    (counts["tool_execution_start"] || 0) >= 1 &&
    (counts["tool_execution_end"] || 0) >= 1;
  process.stdout.write("\n[P4 VERDICT] " + (ok ? "PASS — full AgentEvent stream emitted" : "FAIL — missing event types") + "\n");
}

main().catch((e) => {
  process.stderr.write("P4 SMOKE FATAL: " + (e?.stack || e) + "\n");
  process.exit(1);
});
