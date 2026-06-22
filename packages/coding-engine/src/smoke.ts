// M1 smoke driver: run one real coding turn through the ported MetaCoder engine, headless.
import { ask } from "./QueryEngine.js";
import { getAllBaseTools } from "./tools.js";
import { getDefaultAppState } from "./state/AppStateStore.js";
import { FileStateCache } from "./utils/fileStateCache.js";
import { getCommands } from "./commands.js";
import { enableConfigs } from "./utils/config.js";

async function main() {
  enableConfigs(); // unlock MetaCoder's config-read guard before any config access
  const cwd = process.argv[2] || process.cwd();
  let appState = getDefaultAppState();
  // Bypass permission prompts for headless unattended run (= --dangerously-skip-permissions)
  const asAny = appState as unknown as { toolPermissionContext?: { mode?: string } };
  if (asAny.toolPermissionContext) asAny.toolPermissionContext.mode = "bypassPermissions";
  const fileCache = new FileStateCache(2000, 50 * 1024 * 1024);
  const allTools = getAllBaseTools();
  const tools = allTools.filter((t: { prompt?: unknown; name?: string }) => typeof t.prompt === "function");
  process.stdout.write(
    "[tools] " + tools.length + "/" + allTools.length + " usable; dropped: " +
    allTools.filter((t: { prompt?: unknown; name?: string }) => typeof t.prompt !== "function").map((t) => t.name).join(",") + "\n",
  );
  const commands = await getCommands(cwd);

  const canUseTool = async (_tool: unknown, input: Record<string, unknown>) => ({
    behavior: "allow" as const,
    updatedInput: input,
  });

  const prompt =
    process.env.SMOKE_PROMPT ||
    "List the files in the current directory, read package.json if present, then in one sentence tell me what this project is. Then create a file HELLO.txt containing the text 'ported-engine-works'.";

  process.stdout.write("=== SMOKE START cwd=" + cwd + " model=" + (process.env.SMOKE_MODEL || "glm-5-turbo") + " ===\n");

  for await (const m of ask({
    prompt,
    cwd,
    tools,
    commands,
    mcpClients: [],
    canUseTool: canUseTool as never,
    getAppState: () => appState,
    setAppState: (f: (p: typeof appState) => typeof appState) => {
      appState = f(appState);
    },
    getReadFileCache: () => fileCache,
    setReadFileCache: () => {},
    userSpecifiedModel: process.env.SMOKE_MODEL || "glm-5-turbo",
    abortController: new AbortController(),
  } as never)) {
    const msg = m as Record<string, unknown>;
    const type = msg.type as string;
    if (type === "system") {
      process.stdout.write("[system/" + (msg.subtype as string) + "] session=" + (msg.session_id as string) + "\n");
    } else if (type === "assistant") {
      const blocks = ((msg.message as Record<string, unknown>)?.content as unknown[]) || [];
      for (const b of blocks as Record<string, unknown>[]) {
        if (b.type === "text") process.stdout.write("[assistant] " + String(b.text).slice(0, 500) + "\n");
        if (b.type === "tool_use")
          process.stdout.write("[tool_use] " + String(b.name) + " " + JSON.stringify(b.input).slice(0, 160) + "\n");
      }
    } else if (type === "user") {
      const blocks = ((msg.message as Record<string, unknown>)?.content as unknown[]) || [];
      for (const b of blocks as Record<string, unknown>[]) {
        if (b.type === "tool_result")
          process.stdout.write("[tool_result] " + String((b as Record<string, unknown>).content).slice(0, 250) + "\n");
      }
    } else if (type === "result") {
      process.stdout.write(
        "\n[RESULT] subtype=" + (msg.subtype as string) + " turns=" + (msg.num_turns as number) + " err=" + (msg.is_error as boolean) + "\n",
      );
      process.stdout.write(String(msg.result || "") + "\n");
    }
  }
  process.stdout.write("=== SMOKE END ===\n");
}

main().catch((e) => {
  process.stderr.write("SMOKE FATAL: " + (e?.stack || e) + "\n");
  process.exit(1);
});
