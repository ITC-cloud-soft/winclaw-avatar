/**
 * WinClaw i18n — Lightweight internationalization engine
 *
 * Design: no external dependencies, lazy-loads locale JSON on demand,
 * and notifies Lit Element subscribers via a simple listener set.
 *
 * Usage:
 *   import { t, setLocale, detectLocale, subscribeLocale, getLocale,
 *            getSupportedLocales, LOCALE_NAMES, SUPPORTED_LOCALES } from '../i18n';
 */

import type { LocaleMessages } from './types';

// ---------------------------------------------------------------------------
// Supported locales
// ---------------------------------------------------------------------------

export const SUPPORTED_LOCALES = [
  'zh-CN', 'zh-TW', 'en', 'ja', 'ko',
  'fr', 'de', 'es', 'pt', 'ru', 'vi', 'th', 'id',
] as const;

export type Locale = typeof SUPPORTED_LOCALES[number];

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let currentLocale: Locale = 'en';
let messages: LocaleMessages = {} as LocaleMessages;
const loadedLocales = new Map<Locale, LocaleMessages>();

/** Registered callbacks — each Lit component that calls subscribeLocale()
 *  adds an entry here so it is re-rendered whenever the locale changes. */
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// Locale detection
// ---------------------------------------------------------------------------

/**
 * Detects the preferred locale for the current user.
 *
 * Priority:
 *  1. `winclaw-locale` key in localStorage  (user's explicit choice)
 *  2. navigator.language / navigator.languages  (browser preference)
 *     - exact match first, then language-prefix match (e.g. "zh" → "zh-CN")
 *  3. Fallback: "en"
 */
export function detectLocale(): Locale {
  // 0. URL ?lang= — 最優先。ai-meta 母画面(meta.myaiportal.net)が iframe URL に
  //    現在の表示言語を載せて渡す(zh/en/ja)。母画面の言語切替に内嵌 chat を追従させる
  //    ため、localStorage/navigator より優先する。値は portal コード(zh/en/ja)も受理し
  //    control-ui ロケール(zh-CN/en/ja)へ正規化する。
  try {
    const search = new URLSearchParams(
      typeof location !== 'undefined' ? location.search : '',
    );
    const hash = new URLSearchParams(
      typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '',
    );
    const mapped = mapPortalLang(search.get('lang') ?? hash.get('lang'));
    if (mapped) return mapped;
  } catch {
    // location/URL 解析不可な環境は無視
  }

  // 1. Persisted user selection
  try {
    const saved = localStorage.getItem('winclaw-locale') as Locale | null;
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable in some sandboxed contexts
  }

  // 2. Browser language preference — try each candidate in order
  const candidates: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (navigator.languages && navigator.languages.length > 0) {
      candidates.push(...navigator.languages);
    } else if (navigator.language) {
      candidates.push(navigator.language);
    }
  }

  for (const lang of candidates) {
    // 2a. Exact match
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
    // 2b. Prefix match: "zh-HK" → "zh-CN", "pt-BR" → "pt"
    const prefix = lang.split('-')[0];
    const prefixMatch = SUPPORTED_LOCALES.find(
      (l) => l === prefix || l.startsWith(`${prefix}-`),
    );
    if (prefixMatch) return prefixMatch;
  }

  // 3. Fallback
  return 'en';
}

/**
 * portal 言語コード(zh / en / ja …)や生の URL 値を control-ui の {@link Locale} へ
 * 正規化する。既知 locale の直接一致 → prefix 一致 → zh 特例(zh → zh-CN)の順。
 * 未知/空は null(呼び出し側で次の優先度へフォールバック)。
 */
export function mapPortalLang(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  // 直接一致(zh-CN / en / ja / ko …)
  if ((SUPPORTED_LOCALES as readonly string[]).includes(v)) return v as Locale;
  const lower = v.toLowerCase();
  // portal は 'zh' を渡す → 簡体を既定に
  if (lower === 'zh') return 'zh-CN';
  // prefix 一致(zh-hk → zh-CN, pt-br → pt)
  const prefix = lower.split('-')[0];
  const hit = SUPPORTED_LOCALES.find(
    (l) => l.toLowerCase() === prefix || l.toLowerCase().startsWith(`${prefix}-`),
  );
  return hit ?? null;
}

// ---------------------------------------------------------------------------
// Locale loading and switching
// ---------------------------------------------------------------------------

/**
 * Lazy-loads the requested locale pack (if not already cached),
 * updates the active locale, persists the choice, and notifies all
 * subscribed Lit components to re-render.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!loadedLocales.has(locale)) {
    // Dynamic import — bundlers (Vite / Rollup) will code-split each locale
    // into a separate chunk automatically.
    const mod = await import(`./locales/${locale}.json`);
    loadedLocales.set(locale, mod.default as LocaleMessages);
  }

  currentLocale = locale;
  messages = loadedLocales.get(locale)!;

  try {
    localStorage.setItem('winclaw-locale', locale);
  } catch {
    // ignore
  }

  // Notify all subscribed components
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Translation function
// ---------------------------------------------------------------------------

/**
 * Resolves a dot-path translation key against the currently active locale.
 *
 * @param key    Dot-separated path, e.g. `'dh.startSession'`
 * @param params Optional interpolation map, e.g. `{ name: 'WinClaw' }`.
 *               Placeholders in the translation string are written as `{name}`.
 * @returns      The translated string, or `key` itself as a fallback when
 *               the path cannot be resolved.
 *
 * @example
 *   t('app.title')                        // "WinClaw AI Assistant"
 *   t('status.model', { name: 'GPT-4' }) // "Model: GPT-4"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  // Traverse the nested message object
  let val: unknown = messages as unknown;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return key;
    val = (val as Record<string, unknown>)[part];
  }

  if (typeof val !== 'string') return key;

  // Simple {placeholder} interpolation
  if (params) {
    return val.replace(/\{(\w+)\}/g, (_, k: string) =>
      String(params[k] ?? `{${k}}`),
    );
  }

  return val;
}

// ---------------------------------------------------------------------------
// Subscription API for Lit components
// ---------------------------------------------------------------------------

/**
 * Subscribes to locale changes. Call this in `connectedCallback` and store
 * the returned unsubscribe function for use in `disconnectedCallback`.
 *
 * @param callback  Invoked (synchronously) after every locale switch.
 *                  Typically `() => this.requestUpdate()` in a Lit component.
 * @returns         An unsubscribe function.
 *
 * @example
 *   // Inside a LitElement:
 *   private _unsubLocale?: () => void;
 *
 *   override connectedCallback() {
 *     super.connectedCallback();
 *     this._unsubLocale = subscribeLocale(() => this.requestUpdate());
 *   }
 *
 *   override disconnectedCallback() {
 *     super.disconnectedCallback();
 *     this._unsubLocale?.();
 *   }
 */
export function subscribeLocale(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Returns the currently active locale code. */
export function getLocale(): Locale {
  return currentLocale;
}

/** Returns the full list of supported locale codes (readonly tuple). */
export function getSupportedLocales(): typeof SUPPORTED_LOCALES {
  return SUPPORTED_LOCALES;
}

// ---------------------------------------------------------------------------
// Native language display names
// ---------------------------------------------------------------------------

/**
 * Maps each supported locale code to its name written in that very language.
 * Used to populate the language-picker UI without requiring translations.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en':    'English',
  'ja':    '日本語',
  'ko':    '한국어',
  'fr':    'Français',
  'de':    'Deutsch',
  'es':    'Español',
  'pt':    'Português',
  'ru':    'Русский',
  'vi':    'Tiếng Việt',
  'th':    'ภาษาไทย',
  'id':    'Bahasa Indonesia',
};
