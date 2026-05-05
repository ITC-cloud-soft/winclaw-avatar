/**
 * @file identity-loader.test.ts
 * @description Tests the nickname + relationship parsing added in the FC
 * production-wiring pass. Name extraction is already covered implicitly by
 * the instructions-builder tests — here we focus on the newly added
 * {@link IdentityLoader.extractNickname} and
 * {@link IdentityLoader.extractRelationship} helpers and their integration
 * with {@link IdentityLoader.load}.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { IdentityLoader } from "./identity-loader.js";

describe("IdentityLoader.extractNickname", () => {
  const loader = new IdentityLoader("/tmp/does-not-matter");

  it("parses YAML-style key", () => {
    expect(loader.extractNickname("nickname: Taro-kun")).toBe("Taro-kun");
  });

  it("parses markdown **bold** style", () => {
    expect(loader.extractNickname("**Nickname**: Hiro-san")).toBe("Hiro-san");
  });

  it("parses Japanese 呼び方 heading + `あなたのこと` sub-key", () => {
    const md =
      "# Identity\n\n## 呼び方 / Nickname\nあなたのこと: \"Taro-kun\"\n\n## 関係性\n恋人\n";
    expect(loader.extractNickname(md)).toBe("Taro-kun");
  });

  it("parses bare line after heading", () => {
    const md = "## 愛称\nご主人様\n";
    expect(loader.extractNickname(md)).toBe("ご主人様");
  });

  it("strips surrounding quotes of various kinds", () => {
    expect(loader.extractNickname("nickname: 「ご主人様」")).toBe("ご主人様");
    expect(loader.extractNickname("**nickname**: 'Hanako'")).toBe("Hanako");
  });

  it("returns null when nothing matches", () => {
    expect(loader.extractNickname("random text without nickname")).toBeNull();
  });
});

describe("IdentityLoader.extractRelationship", () => {
  const loader = new IdentityLoader("/tmp/does-not-matter");

  it("parses YAML-style", () => {
    expect(loader.extractRelationship("relationship: 恋人")).toBe("恋人");
  });

  it("parses markdown bold style", () => {
    expect(loader.extractRelationship("**Relationship**: 親友")).toBe("親友");
  });

  it("parses heading + bare line", () => {
    const md = "## 関係性 / Relationship\nメンター\n";
    expect(loader.extractRelationship(md)).toBe("メンター");
  });

  it("parses Japanese 関係性 key", () => {
    expect(loader.extractRelationship("関係性: 兄妹")).toBe("兄妹");
  });

  it("returns null when absent", () => {
    expect(loader.extractRelationship("# no relationship info here")).toBeNull();
  });
});

describe("IdentityLoader.load — nickname + relationship integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "winclaw-idloader-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function writeFixture(
    files: Partial<Record<"SOUL.md" | "IDENTITY.md" | "USER.md" | "AGENTS.md", string>>,
  ): void {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(tmpDir, name), content!, "utf-8");
    }
  }

  it("surfaces nickname + relationship on the returned identity", async () => {
    writeFixture({
      "IDENTITY.md":
        "name: Aika\n\n## 呼び方 / Nickname\nあなたのこと: \"Taro-kun\"\n\n## 関係性 / Relationship\n恋人\n",
    });
    const identity = await new IdentityLoader(tmpDir).load();
    expect(identity.name).toBe("Aika");
    expect(identity.nickname).toBe("Taro-kun");
    expect(identity.relationship).toBe("恋人");
  });

  it("leaves nickname / relationship undefined when unparseable", async () => {
    writeFixture({
      "IDENTITY.md": "name: Aika\nvibe: friendly and warm\n",
    });
    const identity = await new IdentityLoader(tmpDir).load();
    expect(identity.name).toBe("Aika");
    expect(identity.nickname).toBeUndefined();
    expect(identity.relationship).toBeUndefined();
  });

  it("tolerates missing IDENTITY.md", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const identity = await new IdentityLoader(tmpDir).load();
    expect(identity.name).toBe("WinClaw");
    expect(identity.nickname).toBeUndefined();
    expect(identity.relationship).toBeUndefined();
  });
});
