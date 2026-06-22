import { describe, expect, it } from "vitest";
import type { EmbeddedRunAttemptParams } from "./types.js";
import { shouldUseMetaCoderEngine } from "./metacoder-routing.js";

// shouldUseMetaCoderEngine only reads params.config.codingEngine + params.model.api,
// so a minimal partial is sufficient (cast through unknown).
function makeParams(opts: { codingEngine?: string; api?: string }): EmbeddedRunAttemptParams {
  return {
    config: opts.codingEngine === undefined ? {} : { codingEngine: opts.codingEngine },
    model: { api: opts.api ?? "anthropic-messages" },
  } as unknown as EmbeddedRunAttemptParams;
}

describe("shouldUseMetaCoderEngine", () => {
  it("routes to metacoder when codingEngine=metacoder AND api=anthropic-messages", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder", api: "anthropic-messages" }))).toBe(true);
  });

  it("does NOT route when codingEngine is unset (default = pi-coding-agent)", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ api: "anthropic-messages" }))).toBe(false);
  });

  it("does NOT route when codingEngine is explicitly 'pi'", () => {
    expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "pi", api: "anthropic-messages" }))).toBe(false);
  });

  it("does NOT route for non-anthropic-messages models even with codingEngine=metacoder", () => {
    for (const api of ["openai-completions", "openai-responses", "google-generative-ai", "ollama"]) {
      expect(shouldUseMetaCoderEngine(makeParams({ codingEngine: "metacoder", api }))).toBe(false);
    }
  });

  it("does NOT route when config is entirely absent", () => {
    const params = { model: { api: "anthropic-messages" } } as unknown as EmbeddedRunAttemptParams;
    expect(shouldUseMetaCoderEngine(params)).toBe(false);
  });
});
