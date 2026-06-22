// P7 history-resume test: prove a coding turn resumes prior context.
// Mirrors WinClaw's model: a FRESH session per message, seeded with the prior
// transcript (initialMessages) — exactly what createMetaCoderEmbeddedSession does
// from sessionManager. Turn 1 states a secret; Turn 2 (new session, seeded with
// turn-1 history) must recall it and write it to disk. If it can, resume works.
import { createMetaCoderSession } from "./dist/index.mjs";
import fs from "node:fs";
import path from "node:path";

const cwd = process.argv[2] || process.cwd();
const CODENAME = "BLUEFALCON";
const NUMBER = "4271";

const baseOpts = {
  cwd,
  model: process.env.SMOKE_MODEL || "glm-5-turbo",
  appendSystemPrompt: "You are WinClaw's coding engineer. Be concise.",
  apiKey: process.env.SMOKE_KEY,
  baseUrl: process.env.SMOKE_BASE,
};

async function runTurn(label, opts, promptText) {
  const { session } = createMetaCoderSession(opts);
  const tools = [];
  session.subscribe((e) => {
    if (e.type === "tool_execution_start") tools.push(e.toolName);
  });
  process.stdout.write(`\n--- ${label} ---\n`);
  await session.prompt(promptText);
  process.stdout.write(`${label} tools: [${tools.join(", ")}] messages: ${session.messages.length}\n`);
  return session.messages;
}

async function main() {
  process.stdout.write("=== P7 RESUME TEST cwd=" + cwd + " ===\n");

  // Turn 1 — state the secret (no tools needed).
  const h1 = await runTurn(
    "TURN 1 (state secret)",
    baseOpts,
    `Remember these two facts for later: the project codename is ${CODENAME} and the magic number is ${NUMBER}. Just reply "noted" — do not write any files.`,
  );

  // Turn 2 — BRAND NEW session, seeded ONLY with turn-1 transcript.
  const h2 = await runTurn(
    "TURN 2 (recall in fresh session)",
    { ...baseOpts, initialMessages: h1 },
    `Earlier in this conversation I gave you a project codename and a magic number. Without asking me again, write a file named recall.txt containing exactly: CODENAME=<the codename> NUMBER=<the number>`,
  );

  const outPath = path.join(cwd, "recall.txt");
  let fileContent = "";
  try {
    fileContent = fs.readFileSync(outPath, "utf8").trim();
  } catch {
    /* missing */
  }
  process.stdout.write("\nrecall.txt: " + JSON.stringify(fileContent) + "\n");
  process.stdout.write("turn-1 transcript messages seeded into turn 2: " + h1.length + "\n");
  process.stdout.write("turn-1 roles: " + h1.map((m) => m.role).join(",") + "\n");

  const recalledName = fileContent.includes(CODENAME);
  const recalledNum = fileContent.includes(NUMBER);
  const ok = recalledName && recalledNum;
  process.stdout.write(
    "\n[P7 VERDICT] " +
      (ok
        ? "PASS — fresh session recalled prior-turn context (resume works)"
        : `FAIL — codename=${recalledName} number=${recalledNum}`) +
      "\n",
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write("P7 TEST FATAL: " + (e?.stack || e) + "\n");
  process.exit(1);
});
