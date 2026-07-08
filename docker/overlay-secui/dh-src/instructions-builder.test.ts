/**
 * @file instructions-builder.test.ts
 * @description Unit tests for {@link buildInstructions}.
 */

import { describe, it, expect } from "vitest";
import { buildInstructions, formatJapaneseTime } from "./instructions-builder.js";

describe("formatJapaneseTime", () => {
  it("formats as YYYY年MM月DD日 HH:MM (weekday)", () => {
    // 2026-04-19 is a Sunday.
    const d = new Date(2026, 3, 19, 9, 5, 0);
    expect(formatJapaneseTime(d)).toBe("2026年04月19日 09:05 (日)");
  });
});

describe("buildInstructions — structure", () => {
  it("contains the required section headers", () => {
    const s = buildInstructions({ avatarName: "Aika" });
    expect(s).toContain("[Time:");
    expect(s).toContain("[IDENTITY]");
    expect(s).toContain("[CORE RULES]");
    expect(s).toContain("[TOOLS");
    expect(s).toContain("[DECISION FLOW");
    expect(s).toContain("Aika");
  });

  it("embeds the verbatim Japanese CORE RULES 1-7", () => {
    const s = buildInstructions({ avatarName: "Aika" });
    expect(s).toContain("音声応答は 1〜2 文");
    expect(s).toContain("STRICT LANGUAGE MATCHING");
    expect(s).toContain("割り込み対応");
    expect(s).toContain("user_message を一字一句そのまま読み上げる");
    expect(s).toContain("[OWNER NOTIFICATION]");
    expect(s).toContain("CAMERA POLICY");
  });

  it("lists all winclaw DH tools (including ask_winclaw)", () => {
    const s = buildInstructions({ avatarName: "Aika" });
    expect(s).toContain("ask_winclaw");
    expect(s).toContain("memory_search");
    expect(s).toContain("memory_get");
    expect(s).toContain("task_run");
    expect(s).toContain("channel_send");
    expect(s).toContain("internet_search");
  });

  it("enforces the strict DECISION FLOW anti-hallucination wording", () => {
    const s = buildInstructions({ avatarName: "Aika" });
    expect(s).toContain("絶対に作り話をせず");
  });

  it("injects SOUL.md and IDENTITY.md bodies", () => {
    const s = buildInstructions({
      avatarName: "Aika",
      soulMd: "優しくて、好奇心旺盛。",
      identityMd: "名前: Aika / vibe: 明るい",
    });
    expect(s).toContain("優しくて、好奇心旺盛。");
    expect(s).toContain("名前: Aika / vibe: 明るい");
  });

  it("renders nickname and relationship when supplied", () => {
    const s = buildInstructions({
      avatarName: "Aika",
      nickname: "ダーリン",
      relationship: "恋人",
    });
    expect(s).toContain("関係性: 恋人");
    expect(s).toContain("主人への呼び方: ダーリン");
  });

  it("appends additionalContext", () => {
    const s = buildInstructions({
      avatarName: "Aika",
      additionalContext: "現在の場所は東京。",
    });
    expect(s).toContain("[ADDITIONAL CONTEXT]");
    expect(s).toContain("現在の場所は東京。");
  });
});

describe("buildInstructions — truncation", () => {
  it("truncates oversized SOUL.md to ~2000 chars", () => {
    const soul = "あ".repeat(5000);
    const s = buildInstructions({ avatarName: "Aika", soulMd: soul });
    // The injected SOUL section cannot exceed 2000 chars (+ suffix).
    const idx = s.indexOf("--- SOUL.md ---");
    expect(idx).toBeGreaterThanOrEqual(0);
    const soulSection = s.slice(idx);
    expect(soulSection).toContain("...(省略)");
    // Within the SOUL block the run of 'あ' cannot exceed 2000 - suffix.
    const runMatch = soulSection.match(/あ+/);
    expect(runMatch).toBeTruthy();
    expect(runMatch![0].length).toBeLessThanOrEqual(2000);
  });

  it("applies an outer 10 000-char ceiling", () => {
    // Even with absurd additionalContext we stay under 10 000.
    const s = buildInstructions({
      avatarName: "Aika",
      additionalContext: "x".repeat(50_000),
    });
    expect(s.length).toBeLessThanOrEqual(10_000);
    expect(s.endsWith("...(省略)")).toBe(true);
  });

  it("never truncates a small input", () => {
    const s = buildInstructions({ avatarName: "Aika" });
    expect(s.endsWith("...(省略)")).toBe(false);
  });
});
