// Focused unit assertions for the adapter pure-logic, run against the built bundle
// (these helpers depend on engine internals so they can't run in WinClaw's vitest).
import { piHistoryToMetaCoder, bridgeWinClawTool } from "./dist/index.mjs";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    process.stdout.write("✓ " + name + "\n");
  } else {
    fail++;
    process.stdout.write("✗ " + name + "\n");
  }
}

// ── piHistoryToMetaCoder ──────────────────────────────────────────────
// content() helper: MetaCoder messages are { type, message:{ role, content }, ... }
const role = (m) => m.message.role;
const content = (m) => m.message.content;

// 1) Coalescing: assistant(2 tool_use) → toolResult A → toolResult B
//    must become: [assistant(2 tool_use), ONE user with 2 tool_result blocks]
{
  const history = [
    { role: "user", content: "do two things" },
    {
      role: "assistant",
      content: [
        { type: "toolCall", id: "t1", name: "Read", arguments: { f: "a" } },
        { type: "toolCall", id: "t2", name: "Read", arguments: { f: "b" } },
      ],
    },
    { role: "toolResult", toolCallId: "t1", content: [{ type: "text", text: "AAA" }], isError: false },
    { role: "toolResult", toolCallId: "t2", content: [{ type: "text", text: "BBB" }], isError: false },
  ];
  const out = piHistoryToMetaCoder(history);
  check("coalesce: 4 pi msgs → 3 metacoder msgs", out.length === 3);
  check("coalesce: msg roles = user, assistant, user", role(out[0]) === "user" && role(out[1]) === "assistant" && role(out[2]) === "user");
  const trBlocks = content(out[2]).filter((b) => b.type === "tool_result");
  check("coalesce: both tool_results in ONE user message", trBlocks.length === 2);
  check("coalesce: tool_result ids preserved", trBlocks[0].tool_use_id === "t1" && trBlocks[1].tool_use_id === "t2");
  const auBlocks = content(out[1]).filter((b) => b.type === "tool_use");
  check("coalesce: assistant has 2 tool_use blocks", auBlocks.length === 2 && auBlocks[0].id === "t1");
}

// 2) Thinking dropped; text + tool_use kept
{
  const out = piHistoryToMetaCoder([
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "secret reasoning" },
        { type: "text", text: "hello" },
        { type: "toolCall", id: "x", name: "Bash", arguments: {} },
      ],
    },
  ]);
  const blocks = content(out[1]);
  check("thinking: no thinking block survives", !blocks.some((b) => b.type === "thinking"));
  check("thinking: text + tool_use kept", blocks.some((b) => b.type === "text") && blocks.some((b) => b.type === "tool_use"));
}

// 3) Assistant that is thinking-only becomes empty → skipped (Anthropic rejects empty assistant)
{
  const out = piHistoryToMetaCoder([
    { role: "user", content: "q" },
    { role: "assistant", content: [{ type: "thinking", thinking: "only thoughts" }] },
    { role: "user", content: "q2" },
  ]);
  check("empty-assistant: thinking-only assistant dropped", out.length === 2 && role(out[0]) === "user" && role(out[1]) === "user");
}

// ── bridgeWinClawTool ─────────────────────────────────────────────────
{
  let executed = null;
  const win = {
    label: "My Tool",
    name: "winclaw_thing",
    description: "does a thing",
    parameters: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
    execute: async (_id, args) => {
      executed = args;
      return { content: [{ type: "text", text: "RESULT:" + args.x }] };
    },
  };
  const t = bridgeWinClawTool(win);
  check("bridge: name passthrough", t.name === "winclaw_thing");
  check("bridge: inputJSONSchema = win.parameters", t.inputJSONSchema === win.parameters);
  check("bridge: userFacingName uses label", t.userFacingName() === "My Tool");

  const res = await t.call({ x: "hi" }, { toolUseId: "tu1" }, null, null);
  check("bridge: execute was invoked with args", executed && executed.x === "hi");
  check("bridge: call returns { data: anthropic blocks }", Array.isArray(res.data) && res.data[0].type === "text" && res.data[0].text === "RESULT:hi");

  const block = t.mapToolResultToToolResultBlockParam(res.data, "tu1");
  check("bridge: mapToolResult wraps into tool_result", block.type === "tool_result" && block.tool_use_id === "tu1" && block.content === res.data);

  const perm = await t.checkPermissions({ x: "hi" });
  check("bridge: checkPermissions allows", perm.behavior === "allow");
}

process.stdout.write("\n[ADAPTER UNITS] " + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
