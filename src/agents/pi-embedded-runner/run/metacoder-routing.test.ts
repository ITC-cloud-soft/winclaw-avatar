import { describe, expect, it } from "vitest";
import type { EmbeddedRunAttemptParams } from "./types.js";
import { isLikelyCodingTask, shouldUseMetaCoderEngine } from "./metacoder-routing.js";

// shouldUseMetaCoderEngine reads config.codingEngine + model.api + params.prompt,
// so a minimal partial is sufficient (cast through unknown).
function makeParams(opts: { codingEngine?: string; api?: string; prompt?: string }): EmbeddedRunAttemptParams {
  return {
    config: opts.codingEngine === undefined ? {} : { codingEngine: opts.codingEngine },
    model: { api: opts.api ?? "anthropic-messages" },
    prompt: opts.prompt ?? "",
  } as unknown as EmbeddedRunAttemptParams;
}

const CODING = "请写一个 Python 脚本读取 CSV";
const CHAT = "查看各个ai同事的状态，检查任务执行情况";

describe("isLikelyCodingTask", () => {
  it("matches genuine coding requests (EN/中文/日本語)", () => {
    for (const p of [
      "write a function to reverse a string",
      "implement a recursive-descent parser in calc.mjs",
      "fix the bug in src/index.ts",
      "debug this stack trace",
      "编写一个 太阳系九大行星模拟运行的效果图",
      "帮我写个爬虫脚本",
      "実装してください: フィボナッチ関数",
      "build a REST API endpoint",
    ]) {
      expect(isLikelyCodingTask(p)).toBe(true);
    }
  });

  it("does NOT match ordinary chat / status checks", () => {
    for (const p of [
      "你是谁？",
      "查看各个ai同事的状态，检查任务执行情况",
      "summarize today's meeting notes",
      "what's the weather like",
      "给我写一封邮件", // 写信，非编程
      "",
    ]) {
      expect(isLikelyCodingTask(p)).toBe(false);
    }
  });
});

describe("shouldUseMetaCoderEngine", () => {
  it("routes a CODING task when codingEngine=metacoder + anthropic-messages", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder", prompt: CODING }))).toBe(true);
  });

  it("does NOT route ordinary chat even with codingEngine=metacoder (stays on pi)", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder", prompt: CHAT }))).toBe(false);
  });

  it("metacoder-always routes EVERY turn (even non-coding)", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder-always", prompt: CHAT }))).toBe(true);
  });

  it("does NOT route when codingEngine is unset (default = pi)", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ prompt: CODING }))).toBe(false);
  });

  it("does NOT route when codingEngine is explicitly 'pi'", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "pi", prompt: CODING }))).toBe(false);
  });

  it("does NOT route a coding task for non-anthropic-messages models", () => {
    for (const api of ["openai-completions", "openai-responses", "google-generative-ai", "ollama"]) {
      expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder", api, prompt: CODING }))).toBe(false);
    }
  });

  it("does NOT route when config is entirely absent", () => {
    const params = { model: { api: "anthropic-messages" }, prompt: CODING } as unknown as EmbeddedRunAttemptParams;
    expect(shouldUseMetaCoderEngine(params)).toBe(false);
  });
});
