// M1 build harness: bundle MetaCoder engine (QueryEngine) under Node,
// stubbing the never-executed TUI/render layer via an esbuild plugin.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// esbuild lives in monorepo root .pnpm; resolve its lib main directly
import { globSync } from "node:fs";
import fs from "node:fs";
function findEsbuild() {
  const root = path.join(here, "../../node_modules/.pnpm");
  const dirs = fs.readdirSync(root).filter((d) => d.startsWith("esbuild@"));
  for (const d of dirs) {
    const p = path.join(root, d, "node_modules/esbuild/lib/main.js");
    if (fs.existsSync(p)) return p;
  }
  throw new Error("esbuild not found in .pnpm");
}
const esbuild = require(findEsbuild());

const srcDir = path.join(here, "src");

// Dirs whose modules are pure TUI/render-layer — never executed headless.
// Any import into these resolves to a universal no-op stub.
const TUI_DIRS = [
  "components",
  "ink",
  "keybindings",
  "voice",
  "screens",
  "proactive",
  // non-core feature subsystems (gated/lazy, not needed for headless coding)
  "bridge",
  "coordinator",
  "native-ts",
  "assistant",
];
const tuiRe = new RegExp(`(^|/)(${TUI_DIRS.join("|")})/`);

// Bare npm packages to stub: gated/native/provider/telemetry subsystems not
// used by headless file-coding. Routed to the same no-op stub so they need
// neither install nor runtime resolution. (Real LLM client @anthropic-ai/sdk
// is NOT here — it must work.)
const STUB_PKGS = new Set([
  "@anthropic-ai/bedrock-sdk",
  "@anthropic-ai/foundry-sdk",
  "@anthropic-ai/vertex-sdk",
  "@anthropic-ai/mcpb",
  "@aws-sdk/client-bedrock",
  "@aws-sdk/client-bedrock-runtime",
  "@aws-sdk/client-sts",
  "@aws-sdk/credential-provider-node",
  "@aws-sdk/credential-providers",
  "@azure/identity",
  "@smithy/core",
  "@smithy/node-http-handler",
  "@smithy/types",
  "google-auth-library",
  "@growthbook/growthbook",
  "@modelcontextprotocol/sdk",
  "vscode-jsonrpc",
  "vscode-jsonrpc/node.js",
  "vscode-languageserver-protocol",
  "vscode-languageserver-protocol/node.js",
  "vscode-languageserver-types",
  "@ant/computer-use-input",
  "@ant/computer-use-swift",
  "@ant/computer-use-mcp",
  "@ant/claude-for-chrome-mcp",
  "audio-capture-napi",
  "image-processor-napi",
  "color-diff-napi",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-logs",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/semantic-conventions",
  "@opentelemetry/exporter-logs-otlp-grpc",
  "@opentelemetry/exporter-logs-otlp-http",
  "@opentelemetry/exporter-logs-otlp-proto",
  "@opentelemetry/exporter-metrics-otlp-grpc",
  "@opentelemetry/exporter-metrics-otlp-http",
  "@opentelemetry/exporter-metrics-otlp-proto",
  "@opentelemetry/exporter-prometheus",
  "@opentelemetry/exporter-trace-otlp-grpc",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/exporter-trace-otlp-proto",
]);

const tuiStubPlugin = {
  name: "tui-stub",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      // relative/src-path imports into TUI dirs
      if (tuiRe.test(args.path) && !args.path.startsWith("@") && !path.isAbsolute(args.path)) {
        return { path: args.path, namespace: "tui-stub" };
      }
      // bare npm packages on the denylist
      if (STUB_PKGS.has(args.path)) {
        return { path: args.path, namespace: "tui-stub" };
      }
      return null;
    });
    build.onLoad({ filter: /.*/, namespace: "tui-stub" }, () => ({
      // Recursive CJS Proxy: any property chain / call returns another proxy,
      // toPrimitive → "". Survives init-time deep access on stubbed modules
      // (e.g. SandboxManager.getFsReadConfig) without throwing.
      contents: `
        const mk = () => new Proxy(function(){ return mk(); }, {
          get: (_t, p) => {
            if (p === "default") return proxy;
            if (p === Symbol.toPrimitive) return () => "";
            if (p === Symbol.iterator) return function*(){};
            if (p === "then") return undefined;
            return mk();
          },
          apply: () => mk(),
          construct: () => mk(),
        });
        const proxy = mk();
        module.exports = proxy;
      `,
      loader: "js",
    }));
  },
};

esbuild
  .build({
    entryPoints: [path.join(srcDir, "QueryEngine.ts")],
    bundle: true,
    write: true,
    outfile: "dist/engine.mjs",
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "error",
    logLimit: 0,
    metafile: true,
    // MetaCoder's Bun build injects a MACRO global (version/urls); define it for esbuild.
    define: {
      MACRO: JSON.stringify({
        VERSION: "3.3.0-winclaw-port",
        PACKAGE_URL: "winclaw/coding-engine",
        NATIVE_PACKAGE_URL: "winclaw/coding-engine",
        FEEDBACK_CHANNEL: "winclaw",
        BUILD_TIME: "2026-05-13",
        VERSION_CHANGELOG: "",
        ISSUES_EXPLAINER: "winclaw coding-engine port",
      }),
    },
    // Bundle all pure-JS npm deps IN (avoids raw-Node ESM extensionless-import
    // breakage, e.g. jsonc-parser). Only true natives stay external.
    external: ["sharp", "@vscode/ripgrep"],
    // ESM output needs a require() shim for bundled CJS deps (execa/cross-spawn
    // do require('child_process') etc.)
    banner: {
      js:
        "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" +
        // ANT-ONLY call sites reference these without imports (upstream ant-strip
        // removes both call + import). Provide global no-op shims so non-stripped
        // builds don't ReferenceError; they return undefined for non-ant models.
        "globalThis.resolveAntModel = globalThis.resolveAntModel || (() => undefined);" +
        "globalThis.getAntModelOverrideConfig = globalThis.getAntModelOverrideConfig || (() => undefined);" +
        "globalThis.getAntModels = globalThis.getAntModels || (() => []);" +
        "globalThis.getAntModelOverrideSection = globalThis.getAntModelOverrideSection || (() => '');" +
        "globalThis.maskModelCodename = globalThis.maskModelCodename || ((x) => x);",
    },
    alias: {
      src: srcDir,
      // real targeted stubs for packages accessed at module-init via named imports
      "@anthropic-ai/sandbox-runtime": path.join(srcDir, "_stubs/sandbox-runtime.ts"),
    },
    loader: { ".tsx": "tsx", ".ts": "ts", ".json": "json" },
    plugins: [tuiStubPlugin],
  })
  .then((r) => {
    const fsmod = require("node:fs");
    const sz = fsmod.statSync(path.join(here, "dist/engine.mjs")).size;
    console.log("BUILD OK. inputs:", Object.keys(r.metafile.inputs).length, "bundle:", (sz / 1024).toFixed(0) + "KB");
  })
  .catch((e) => {
    const errs = e.errors || [];
    console.log("RESIDUAL RESOLVE ERRORS:", errs.length);
    const seen = {};
    for (const er of errs) {
      const m = (er.text.match(/Could not resolve "([^"]+)"/) || [])[1] || er.text.slice(0, 70);
      const norm = m.replace(/^(\.\.\/)+/, "@/").replace(/^\.\//, "@self/");
      seen[norm] = (seen[norm] || 0) + 1;
    }
    for (const [k, v] of Object.entries(seen).sort((a, b) => b[1] - a[1])) {
      console.log("  " + v + "  " + k);
    }
  });
