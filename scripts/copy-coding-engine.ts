#!/usr/bin/env tsx
/**
 * Bundle the ported MetaCoder coding engine (@winclaw/coding-engine) into the
 * main WinClaw dist so a standalone `npm install -g .` works without the
 * workspace symlink. The engine is a self-contained ESM bundle; we (re)build it
 * and copy index.mjs + index.d.ts into dist/coding-engine/.
 *
 * At runtime, metacoder-routing.ts imports "@winclaw/coding-engine" first (dev /
 * workspace) and falls back to ./coding-engine/index.mjs (this copy) when the
 * workspace package isn't resolvable (global install).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const enginePkg = path.join(projectRoot, "packages", "coding-engine");
const engineDist = path.join(enginePkg, "dist");
const outDir = path.join(projectRoot, "dist", "coding-engine");

function buildEngine() {
  const buildScript = path.join(enginePkg, "build.mjs");
  const haveDeps = fs.existsSync(path.join(enginePkg, "node_modules"));
  const havePrebuilt = fs.existsSync(path.join(engineDist, "index.mjs"));
  if (!fs.existsSync(buildScript) || (!haveDeps && havePrebuilt)) {
    // No build harness, or deps not installed but a prebuilt bundle exists ->
    // use the existing dist/index.mjs as-is (e.g. a checked-in/ported bundle).
    console.warn("[copy-coding-engine] skipping rebuild; using existing engine bundle");
    return;
  }
  console.log("[copy-coding-engine] building engine bundle...");
  try {
    execFileSync(process.execPath, [buildScript], { cwd: enginePkg, stdio: "inherit" });
  } catch (err) {
    if (havePrebuilt) {
      console.warn(
        "[copy-coding-engine] engine rebuild failed; falling back to existing bundle:",
        err instanceof Error ? err.message : String(err),
      );
    } else {
      throw err;
    }
  }
}

function copyEngine() {
  const indexMjs = path.join(engineDist, "index.mjs");
  const indexDts = path.join(engineDist, "index.d.ts");
  if (!fs.existsSync(indexMjs)) {
    throw new Error(`[copy-coding-engine] engine bundle missing: ${indexMjs}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(indexMjs, path.join(outDir, "index.mjs"));
  if (fs.existsSync(indexDts)) {
    fs.copyFileSync(indexDts, path.join(outDir, "index.d.ts"));
  }
  const sizeMb = (fs.statSync(indexMjs).size / (1024 * 1024)).toFixed(1);
  console.log(`[copy-coding-engine] copied engine (${sizeMb}MB) → dist/coding-engine/`);
}

buildEngine();
copyEngine();
console.log("[copy-coding-engine] Done");
