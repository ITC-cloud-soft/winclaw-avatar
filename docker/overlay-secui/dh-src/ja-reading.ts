/**
 * ja-reading.ts — 日本語漢字→仮名読み(kuromoji.js 形態素解析)。
 *
 * qwen3-omni-flash TTS は共有漢字を中国語読みしがち(新橋→xinqiao / 住所→zhusuo)。
 * system prompt の言語ロックだけでは孤立漢字語を矯正しきれないため、TTS へ渡す**前**に
 * kuromoji で任意漢字トークンを読み(カタカナ)へ置換し、発音を確定させる。
 *
 * - `initJaReading()` を起動時に呼び、辞書を非同期ロード(~1s)。
 * - `jaKanjiToKana(text)` は tokenizer 準備後は同期変換。未準備/漢字なしは素通し(安全)。
 * - カタカナ読みは TTS が明確に発音できる(曖昧性ゼロ)。カナ/記号/英数字はそのまま。
 */

// kuromoji は CJS。ESM から default import(Node の相互運用)。型は緩め(any 扱い)。
import kuromoji from "kuromoji";
import { createRequire } from "module";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tokenizer = { tokenize: (t: string) => Array<{ surface_form: string; reading?: string }> };

let tokenizer: Tokenizer | null = null;
let building = false;

/** kuromoji 辞書のパス。拡張同梱の node_modules/kuromoji/dict を解決(失敗時は固定パス)。 */
function resolveDicPath(): string {
  try {
    const require = createRequire(import.meta.url);
    return path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict");
  } catch {
    return "/usr/local/lib/node_modules/winclaw/extensions/digital-human/node_modules/kuromoji/dict";
  }
}

/** 辞書を非同期ロードして tokenizer を用意。多重呼び出しは無害(冪等)。 */
export function initJaReading(): void {
  if (tokenizer || building) return;
  building = true;
  const dicPath = resolveDicPath();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (kuromoji as any)
      .builder({ dicPath })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .build((err: unknown, tok: any) => {
        building = false;
        if (err) {
          console.error("[ja-reading] kuromoji build failed:", err);
          return;
        }
        tokenizer = tok as Tokenizer;
        console.info("[ja-reading] kuromoji tokenizer ready (dic=" + dicPath + ")");
      });
  } catch (e) {
    building = false;
    console.error("[ja-reading] kuromoji init threw:", e);
  }
}

const KANJI_RE = /[々一-鿿豈-﫿]/;

/**
 * 日本語テキストの漢字を含むトークンを読み(カタカナ)へ置換して返す。
 * tokenizer 未準備 / 漢字を含まない場合は原文をそのまま返す(TTS を止めない)。
 */
export function jaKanjiToKana(text: string): string {
  if (!tokenizer || !KANJI_RE.test(text)) return text;
  try {
    const tokens = tokenizer.tokenize(text);
    let out = "";
    for (const tk of tokens) {
      const surf = tk.surface_form;
      const reading = tk.reading;
      // 漢字を含み、読み(カタカナ)がある語 → 読みへ。それ以外(かな/記号/英数)は原形。
      if (KANJI_RE.test(surf) && reading && reading !== "*") {
        out += reading;
      } else {
        out += surf;
      }
    }
    return out;
  } catch (e) {
    console.error("[ja-reading] tokenize failed:", e);
    return text;
  }
}
