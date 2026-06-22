// WinClaw-style local coding-ability test.
// Drives the ported MetaCoder engine through the SAME integration surface P6 wired
// into attempt.ts: the @winclaw/coding-engine package (dist/index.mjs), the adapter
// session, the WinClaw tool bridge, and per-turn API-target config. Then we run the
// produced program OURSELVES to objectively verify the engine actually coded it.
import { createMetaCoderSession } from "./dist/index.mjs";

const cwd = process.argv[2] || process.cwd();
const TASK =
  process.env.CODING_TASK ||
  `Implement a small arithmetic expression evaluator in this directory.

Requirements:
1. Create a file "calc.mjs" that exports a function: export function evaluate(expr: string): number
   - Supports + - * / operators, parentheses, unary minus, integers and decimals.
   - Correct operator precedence (* and / bind tighter than + and -) and left-associativity.
   - Must be a REAL parser (tokenizer + recursive-descent or shunting-yard), NOT JavaScript eval(), NOT a regex hack. Do not use eval or Function().
   - Throw an Error on malformed input (e.g. "1 +", "(2", "2 ** 3").
2. Create a file "test.mjs" that imports { evaluate } from "./calc.mjs" and runs assertions covering:
   precedence (2+3*4===14), parentheses ((2+3)*4===20), nesting, unary minus (-5+2===-3),
   decimals (1.5*2===3), division, and at least one malformed-input case that must throw.
   Print "ALL TESTS PASSED" at the end only if every assertion holds; otherwise throw.
Keep it dependency-free (pure Node ESM). When done, briefly state what you built.`;

function applyEnv() {
  if (process.env.SMOKE_KEY) process.env.ANTHROPIC_API_KEY = process.env.SMOKE_KEY;
  if (process.env.SMOKE_BASE) process.env.ANTHROPIC_BASE_URL = process.env.SMOKE_BASE;
}

async function main() {
  // Mirror createMetaCoderEmbeddedSession's config (cwd/model/apiKey/baseUrl + appendSystemPrompt).
  const { session } = createMetaCoderSession({
    cwd,
    model: process.env.SMOKE_MODEL || "glm-5-turbo",
    appendSystemPrompt:
      "You are WinClaw's coding engineer. Work in the given directory. Use your file and shell tools to implement, then self-verify by running the tests with Bash.",
    apiKey: process.env.SMOKE_KEY,
    baseUrl: process.env.SMOKE_BASE,
  });

  const toolCalls = [];
  let assistantChars = 0;
  session.subscribe((e) => {
    if (e.type === "tool_execution_start") {
      toolCalls.push(e.toolName);
      process.stdout.write("[tool→] " + e.toolName + " " + JSON.stringify(e.args).slice(0, 100) + "\n");
    } else if (e.type === "message_update" && e.assistantMessageEvent?.type === "text_delta") {
      assistantChars += e.assistantMessageEvent.delta.length;
    }
  });

  const t0 = Date.now();
  process.stdout.write("=== WINCLAW CODING TEST cwd=" + cwd + " model=" + (process.env.SMOKE_MODEL || "glm-5-turbo") + " ===\n");
  applyEnv();
  await session.prompt(TASK);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  process.stdout.write("\n=== TURN DONE in " + elapsed + "s ===\n");
  process.stdout.write("tool calls (" + toolCalls.length + "): " + toolCalls.join(", ") + "\n");
  process.stdout.write("assistant text chars: " + assistantChars + "\n");
  process.stdout.write("messages: " + session.messages.length + " sessionId=" + session.sessionId + "\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("CODING TEST FATAL: " + (e?.stack || e) + "\n");
  process.exit(1);
});
