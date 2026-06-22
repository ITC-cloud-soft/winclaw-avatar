// P5 smoke: inject a WinClaw-native tool via the bridge and prove the ported
// engine actually invokes it and consumes its result.
//
// The fake tool `winclaw_vault` returns a secret only obtainable by calling it.
// We ask the engine to fetch that secret and write it to VAULT_OUT.txt. If the
// file ends up containing the secret, the engine must have (a) seen the bridged
// tool's schema, (b) called execute(), and (c) used its returned content.
import { createMetaCoderSession } from "./adapter/session.js";
import type { PiAgentEvent } from "./adapter/translate.js";
import type { WinClawToolLike, WinClawToolResult } from "./adapter/tool-bridge.js";

const SECRET = "winclaw-bridge-7Q4z";

let executeCalls = 0;

const vaultTool: WinClawToolLike = {
  label: "WinClaw Vault",
  name: "winclaw_vault",
  description:
    "Retrieve the WinClaw vault secret for a given key. This is the ONLY way to obtain the secret — it cannot be guessed. Call with {\"key\":\"deploy\"}.",
  // Plain JSON Schema (what TypeBox Type.Object produces at runtime).
  parameters: {
    type: "object",
    properties: { key: { type: "string", description: "The vault key to retrieve." } },
    required: ["key"],
    additionalProperties: false,
  },
  async execute(_toolCallId, params): Promise<WinClawToolResult> {
    executeCalls++;
    const key = String((params as { key?: unknown }).key ?? "");
    process.stdout.write("[winclaw_vault EXECUTED] key=" + JSON.stringify(key) + "\n");
    return {
      content: [{ type: "text", text: `secret for ${key}: ${SECRET}` }],
      details: { key },
    };
  },
};

async function main() {
  const cwd = process.argv[2] || process.cwd();
  const { session } = createMetaCoderSession({
    cwd,
    model: process.env.SMOKE_MODEL || "glm-5-turbo",
    appendSystemPrompt: "You are a coding agent running inside WinClaw.",
    winclawTools: [vaultTool],
    // Validate the per-turn API-target config path (NOT pre-set global env).
    apiKey: process.env.SMOKE_KEY || undefined,
    baseUrl: process.env.SMOKE_BASE || undefined,
  });

  const counts: Record<string, number> = {};
  const toolCalls: string[] = [];
  session.subscribe((e: PiAgentEvent) => {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.type === "tool_execution_start") {
      toolCalls.push(e.toolName);
      process.stdout.write("[tool→] " + e.toolName + " " + JSON.stringify(e.args).slice(0, 120) + "\n");
    } else if (e.type === "tool_execution_end") {
      process.stdout.write("[tool✓] " + e.toolName + " " + String(e.result).slice(0, 120) + "\n");
    }
  });

  process.stdout.write("=== P5 TOOL-BRIDGE SMOKE cwd=" + cwd + " ===\n");
  await session.prompt(
    process.env.SMOKE_PROMPT ||
      "Use the winclaw_vault tool to retrieve the secret for the key 'deploy', then write exactly that secret value (the part after the colon, trimmed) into a file named VAULT_OUT.txt. Do not invent a value — you must call the tool.",
  );

  process.stdout.write("\n=== EVENT COUNTS ===\n");
  for (const [k, v] of Object.entries(counts)) process.stdout.write("  " + k + ": " + v + "\n");
  process.stdout.write("tools called: " + toolCalls.join(", ") + "\n");
  process.stdout.write("winclaw_vault.execute() call count: " + executeCalls + "\n");

  const fs = await import("node:fs");
  const path = await import("node:path");
  const outPath = path.join(cwd, "VAULT_OUT.txt");
  let fileContent = "";
  try {
    fileContent = fs.readFileSync(outPath, "utf8");
  } catch {
    /* missing */
  }
  process.stdout.write("VAULT_OUT.txt: " + JSON.stringify(fileContent) + "\n");

  const calledBridge = toolCalls.includes("winclaw_vault") && executeCalls >= 1;
  const secretFlowed = fileContent.includes(SECRET);
  const ok = calledBridge && secretFlowed;
  process.stdout.write(
    "\n[P5 VERDICT] " +
      (ok
        ? "PASS — engine invoked bridged WinClaw tool and consumed its result"
        : "FAIL — calledBridge=" + calledBridge + " secretFlowed=" + secretFlowed) +
      "\n",
  );
  // The engine leaves lingering handles (otel/timers) that keep the event loop
  // alive; force a clean teardown so headless runs exit promptly.
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write("P5 SMOKE FATAL: " + (e?.stack || e) + "\n");
  process.exit(1);
});
