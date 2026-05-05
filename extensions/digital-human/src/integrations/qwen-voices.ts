/**
 * @file qwen-voices.ts
 * @description Voice catalog for qwen3.5-omni-flash-realtime.
 *
 * The qwen 3.5 voice catalog is a complete replacement of the qwen3 catalog
 * (which only had `Cherry` and a few others). Canonical list sourced from the
 * reference implementation `autoproject/backend/app/api/v1/voices.py`.
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
  zh: [
    { id: "Cherry",  displayName: "Cherry",  gender: "female",  language: "zh", tags: ["warm", "young"] },
    { id: "Serena",  displayName: "Serena",  gender: "female",  language: "zh", tags: ["warm", "default"] },
    { id: "Ethan",   displayName: "Ethan",   gender: "male",    language: "zh", tags: ["calm"] },
    { id: "Chelsie", displayName: "Chelsie", gender: "female",  language: "zh", tags: ["bright"] },
    { id: "Aura",    displayName: "Aura",    gender: "female",  language: "zh", tags: ["soft"] },
    { id: "Breeze",  displayName: "Breeze",  gender: "neutral", language: "zh", tags: ["airy"] },
    { id: "Maple",   displayName: "Maple",   gender: "female",  language: "zh", tags: ["mellow"] },
    { id: "River",   displayName: "River",   gender: "male",    language: "zh", tags: ["deep"] },
    { id: "Amber",   displayName: "Amber",   gender: "female",  language: "zh", tags: ["warm"] },
    { id: "Cove",    displayName: "Cove",    gender: "male",    language: "zh", tags: ["cool"] },
    { id: "Sage",    displayName: "Sage",    gender: "neutral", language: "zh", tags: ["calm"] },
    { id: "Willow",  displayName: "Willow",  gender: "female",  language: "zh", tags: ["gentle"] },
  ],
  en: [
    { id: "Aria",   displayName: "Aria",   gender: "female", language: "en", tags: ["bright"] },
    { id: "Bella",  displayName: "Bella",  gender: "female", language: "en", tags: ["warm"] },
    { id: "Claire", displayName: "Claire", gender: "female", language: "en", tags: ["professional"] },
    { id: "Daniel", displayName: "Daniel", gender: "male",   language: "en", tags: ["professional"] },
    { id: "Eric",   displayName: "Eric",   gender: "male",   language: "en", tags: ["calm"] },
    { id: "Frank",  displayName: "Frank",  gender: "male",   language: "en", tags: ["deep"] },
    { id: "Grace",  displayName: "Grace",  gender: "female", language: "en", tags: ["soft"] },
    { id: "Henry",  displayName: "Henry",  gender: "male",   language: "en", tags: ["mature"] },
    { id: "Ivy",    displayName: "Ivy",    gender: "female", language: "en", tags: ["young"] },
    { id: "Jack",   displayName: "Jack",   gender: "male",   language: "en", tags: ["friendly"] },
    { id: "Kate",   displayName: "Kate",   gender: "female", language: "en", tags: ["clear"] },
    { id: "Leo",    displayName: "Leo",    gender: "male",   language: "en", tags: ["warm"] },
  ],
  multi: [
    { id: "Luna", displayName: "Luna", gender: "female", language: "multi", tags: ["multilingual", "zh", "en", "ja"] },
  ],
};

/** Default voice for qwen3.5-omni-flash-realtime. */
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
