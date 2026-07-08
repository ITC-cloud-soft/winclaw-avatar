/**
 * @file qwen-voices.ts
 * @description Voice catalog for **qwen3-omni-flash-realtime-2025-12-01**（docs/22）。
 *
 * ★2026-07-08 收敛（docs/22 决策④）: 目录收敛为旧模型 `qwen3-omni-flash-realtime` **实际受理**
 * 的 11 个音色（前端/后端 `_VALID_QWEN_VOICES` 的 10 个 + 日语音色 `Ono Anna`）。
 * 删除了 qwen3.5 目录里旧模型**不受理**的名字（Aura/Breeze/Maple/River/Amber/Cove/Sage/Willow/
 * Aria/Bella/…/Luna 等）——否则 voice_change 会放行旧模型不认的音色导致 400/断连。
 * 三处音色目录（前端 voices.ts / 后端 _VALID_QWEN_VOICES / 本文件）须保持一致。
 */

/** Supported language categories for Qwen voices. */
export type QwenVoiceLanguage = "zh" | "en" | "multi";

/** Gender label for a Qwen voice. */
export type QwenVoiceGender = "female" | "male" | "neutral";

/** Descriptor for a single Qwen voice. */
export interface QwenVoice {
  /** Stable identifier sent in `session.update.voice`. */
  id: string;
  /** Human-readable display name (usually same as id). */
  displayName: string;
  /** Best-fit gender classification. */
  gender: QwenVoiceGender;
  /** Primary language this voice was tuned for. */
  language: QwenVoiceLanguage;
  /** Descriptive tags for UI grouping / filtering. */
  tags: string[];
}

/**
 * Full Qwen 3.5 realtime voice catalog, grouped by language.
 *
 * NOTE: The `multi` group are multilingual voices that work well across
 * Chinese, English and Japanese. Use them when the owner's language is mixed.
 */
export const QWEN_VOICE_CATALOG: {
  zh: QwenVoice[];
  en: QwenVoice[];
  multi: QwenVoice[];
} = {
  // 旧模型 qwen3-omni-flash-realtime が受理する音色（前端/後端の 10 個 + Ono Anna）。
  // すべて多言語対応（zh/en/ja…）。language は UI 分類の目安で、全て "multi" 扱い。
  zh: [],
  en: [],
  multi: [
    // 女声（前端 voices.ts と同一）
    { id: "Serena",   displayName: "Serena",   gender: "female", language: "multi", tags: ["warm", "default", "zh", "en", "ja"] },
    { id: "Cherry",   displayName: "Cherry",   gender: "female", language: "multi", tags: ["young", "zh", "en", "ja"] },
    { id: "Chelsie",  displayName: "Chelsie",  gender: "female", language: "multi", tags: ["bright", "zh", "en", "ja"] },
    { id: "Jennifer", displayName: "Jennifer", gender: "female", language: "multi", tags: ["soft", "zh", "en", "ja"] },
    { id: "Katerina", displayName: "Katerina", gender: "female", language: "multi", tags: ["mellow", "zh", "en", "ja"] },
    // 男声
    { id: "Ethan",    displayName: "Ethan",    gender: "male",   language: "multi", tags: ["calm", "zh", "en", "ja"] },
    { id: "Ryan",     displayName: "Ryan",     gender: "male",   language: "multi", tags: ["deep", "zh", "en", "ja"] },
    { id: "Aiden",    displayName: "Aiden",    gender: "male",   language: "multi", tags: ["cool", "zh", "en", "ja"] },
    { id: "Neil",     displayName: "Neil",     gender: "male",   language: "multi", tags: ["professional", "zh", "en", "ja"] },
    { id: "Vincent",  displayName: "Vincent",  gender: "male",   language: "multi", tags: ["calm", "zh", "en", "ja"] },
    // ★日语専用音色（docs/22 决策③）
    { id: "Ono Anna", displayName: "Ono Anna", gender: "female", language: "multi", tags: ["japanese", "ja", "zh", "en"] },
  ],
};

/** Default voice for qwen3-omni-flash-realtime（旧模型受理）。 */
export const DEFAULT_VOICE = "Serena";

/** Flat list of every voice id in the catalog. */
export const QWEN_VOICE_IDS = [
  ...QWEN_VOICE_CATALOG.zh.map((v) => v.id),
  ...QWEN_VOICE_CATALOG.en.map((v) => v.id),
  ...QWEN_VOICE_CATALOG.multi.map((v) => v.id),
] as const;

/** String-literal union of all Qwen voice ids. */
export type QwenVoiceId = (typeof QWEN_VOICE_IDS)[number];

/** Flat list of every voice descriptor in the catalog. */
export const QWEN_VOICES: readonly QwenVoice[] = [
  ...QWEN_VOICE_CATALOG.zh,
  ...QWEN_VOICE_CATALOG.en,
  ...QWEN_VOICE_CATALOG.multi,
];

/** Return the {@link QwenVoice} descriptor for an id, or `undefined` if unknown. */
export function findVoice(id: string): QwenVoice | undefined {
  return QWEN_VOICES.find((v) => v.id === id);
}
