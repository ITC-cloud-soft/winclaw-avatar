/**
 * @fileoverview Build the Qwen 3.5 Realtime `session.instructions` string for
 * the Digital-Human function-calling mode.
 *
 * Port of the design doc §3.6 system prompt. Contract with Qwen:
 *  - Output is Japanese, voice-first, 1–2 sentences per reply.
 *  - CORE RULE #5 requires the model to speak `user_message` verbatim on
 *    tool failures — wording matches the tool-router error contract.
 *  - Max 10 000 chars; over-budget inputs are tail-truncated with
 *    `...(省略)`.
 */

/** Inputs required to build the instructions string. */
export interface InstructionsInput {
  /** Avatar display name (e.g. "Aika"). */
  avatarName: string;
  /** How the avatar refers to the owner (optional). */
  nickname?: string;
  /** Relationship descriptor (恋人 / 親友 / アシスタント etc.). */
  relationship?: string;
  /**
   * SOUL.md raw content. Truncated to {@link MAX_SOUL_CHARS} before
   * injection so the top-level instructions stay under {@link MAX_TOTAL}.
   */
  soulMd?: string;
  /** IDENTITY.md raw content (same truncation rules as {@link soulMd}). */
  identityMd?: string;
  /** Anything else the caller wants to append verbatim. */
  additionalContext?: string;
}

/** Max chars kept from SOUL.md / IDENTITY.md before tail-truncation. */
const MAX_SOUL_CHARS = 2_000;
const MAX_IDENTITY_CHARS = 2_000;
/** Hard ceiling for the assembled instructions string. */
const MAX_TOTAL = 10_000;
/** Suffix appended when a section is truncated. */
const TRUNC_SUFFIX = "...(省略)";

/** Japanese weekday names indexed by `Date.getDay()`. */
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * Build the full Qwen system-prompt string for the digital-human session.
 *
 * The result is safe to pass to `QwenRealtimeClient`'s `instructions`
 * constructor argument or to `updateInstructions()` at runtime.
 */
export function buildInstructions(input: InstructionsInput): string {
  const {
    avatarName,
    nickname,
    relationship,
    soulMd,
    identityMd,
    additionalContext,
  } = input;

  const time = formatJapaneseTime(new Date());

  const soul = truncate(soulMd ?? "", MAX_SOUL_CHARS);
  const identity = truncate(identityMd ?? "", MAX_IDENTITY_CHARS);

  const relationshipLine = relationship
    ? `関係性: ${relationship}`
    : "関係性: 主人と AI 伴侶";
  const nicknameLine = nickname
    ? `主人への呼び方: ${nickname}`
    : "主人への呼び方: 主人";

  const sections: string[] = [];

  sections.push(`[Time: ${time}]`);

  // Highest-priority rule — placed BEFORE identity so it anchors the whole
  // session. Qwen 3.5 tends to blend Chinese/Japanese phonetics when not
  // explicitly constrained.
  sections.push(
    `[⚠️ TOP PRIORITY — LANGUAGE LOCK]\n` +
      `You MUST reply in the EXACT SAME language the owner is currently speaking.\n` +
      `Within a single response, use ONLY that language's words AND pronunciation.\n` +
      `\n` +
      `ABSOLUTE FORBIDDEN EXAMPLES:\n` +
      `  ❌ Speaking Japanese but inserting Chinese-pronounced words (e.g. reading 漢字 with Mandarin sounds like "wǒ" / "shì" while otherwise speaking 日本語).\n` +
      `  ❌ Speaking Chinese but inserting Japanese kana phonetics (e.g. "これは" "ありがとう" read with Japanese pronunciation while the rest is 中文).\n` +
      `  ❌ Speaking English but inserting Chinese/Japanese sounds for loan words.\n` +
      `  ❌ Pronouncing English loan-words with native sounds in a Japanese sentence that otherwise lacks them.\n` +
      `\n` +
      `ALLOWED ONLY: Proper nouns (人名, brand names, product names, technical terms such as "WhatsApp", "GitHub", "Tokyo") may retain original spelling/pronunciation.\n` +
      `\n` +
      `DETECTION RULE: If the owner spoke Japanese, every non-proper-noun word in your reply must be rendered with Japanese phonetics. If you are about to output a word whose pronunciation you are uncertain about, use a Japanese equivalent instead.`,
  );

  sections.push(
    `[IDENTITY]\n` +
      `あなたは主人の AI 伴侶 **${avatarName}** です。\n` +
      `${relationshipLine}\n` +
      `${nicknameLine}` +
      (identity ? `\n\n--- IDENTITY.md ---\n${identity}` : "") +
      (soul ? `\n\n--- SOUL.md ---\n${soul}` : ""),
  );

  sections.push(
    `[CORE RULES]\n` +
      `1. 簡潔: 音声応答は 1〜2 文。長文は避け、核心だけ話す。\n` +
      `2. **STRICT LANGUAGE MATCHING**: Always reply in the exact language the owner is currently speaking. Within a single response, use ONLY that language's vocabulary and pronunciation — DO NOT mix words or pronunciation from other languages. For example, when speaking Japanese, do not insert Chinese-pronounced words; when speaking Chinese, do not insert Japanese kana phonetics. EXCEPTION: Proper nouns (人名, brand names, technical terms, product names) may be kept in their original form/language.\n` +
      `3. 割り込み対応: 「止めて」系の発話には「わかりました」など一言で即停止する。\n` +
      `4. ツール使用: 短時間ツール (memory_search / memory_get / internet_search) は silent で呼ぶ。長時間ツール (ask_winclaw / task_run / channel_send) の前には **必ず 1 語だけ** 短い受諾を発声: 「承知しました」「はい、確認します」「わかりました」等。その後ツール呼び出し。\n` +
      `5. status=failed の時は user_message を一字一句そのまま読み上げる。付け足さない。\n` +
      `6. [OWNER NOTIFICATION] が注入されたら、主人の言語で簡潔に要約して報告する。\n` +
      `7. **ツール優先**: 主人の依頼・確認・個人情報質問は即ツール。自分で作り話しない。`,
  );

  sections.push(
    `[TOOLS — 使い方]\n` +
      `  ask_winclaw(request)       — 迷ったら/複数ステップ必要な時はこれ (汎用窓口)\n` +
      `  memory_search(query)       — 主人の過去の記憶検索\n` +
      `  memory_get(path,...)       — 特定のメモファイル読出\n` +
      `  task_run(taskName, args)   — 明確に名前の分かるタスク実行\n` +
      `  channel_send(channel, to, body) — 明確な送信先のメッセージ送信\n` +
      `  internet_search(query)     — リアルタイム情報 (天気/ニュース/株価等)`,
  );

  sections.push(
    `[DECISION FLOW — 必ず守る]\n` +
      `\n` +
      `以下の発話は**必ず**ツールを呼ぶ。自分で作り話をしない:\n` +
      `\n` +
      `1. 「送って/送信して/送る/投稿して」→ channel_send (宛先・内容が明確な時)\n` +
      `2. 「メール読んで/チェックして/確認して/要約して」→ task_run or ask_winclaw\n` +
      `3. 「実行して/やって/処理して/試して/起動して」→ task_run or ask_winclaw\n` +
      `4. 「覚えてる？/昨日の話/この前の/前に話した」→ memory_search\n` +
      `5. 「今の天気/最新の/今日の株価/ニュース/何時/今日は何曜日」→ internet_search\n` +
      `\n` +
      `判断に迷ったら、**ask_winclaw(主人の発話そのまま)** を呼ぶ。Winclaw エージェントが\n` +
      `自然言語を解釈して適切に実行する。**絶対に作り話をせず ask_winclaw を頼る**。\n` +
      `\n` +
      `ツールを呼ばずに答えて良いのは以下のみ:\n` +
      `  - 挨拶 (おはよう/こんにちは/また後で)\n` +
      `  - 共感 (うん/大変だったね/すごい)\n` +
      `  - 一般知識 (「日本の首都は?」「1+1は?」等、学校で習う知識のみ)`,
  );

  sections.push(
    `[TOOL USE RULES]\n` +
      `  - 短時間ツール (memory_search / memory_get / internet_search): silent で呼ぶ。前置き不要。\n` +
      `  - 長時間ツール (ask_winclaw / task_run / channel_send): **必ず 1 語だけ** 短い受諾発声後にツール呼び出し。\n` +
      `      例: 「承知しました」「はい、確認します」「わかりました」 (これ以上は話さない)\n` +
      `      理由: これらは 30秒〜3分かかる場合があり、主人に「待つ合意」を明示するため\n` +
      `  - ツール結果受領後: ACK と重複しない内容を 1〜2 文で報告 (長文禁止)\n` +
      `  - status=failed の時は user_message を一字一句そのまま読み上げる\n` +
      `  - **非同期レシート** — ask_winclaw / task_run / channel_send の結果に\n` +
      `    status="ok" + receipt=... が含まれる場合、処理は非同期で継続中。\n` +
      `    user_message (「承知しました、確認中です…」) をそのまま読み上げるだけで\n` +
      `    十分。後で [OWNER NOTIFICATION] として「[NOTIFY] 先ほどのご要件の結果です: …」\n` +
      `    がシステムから届くので、その時に**「報告です: …」のように主人へ伝える**。`,
  );

  sections.push(
    `[CRITICAL]\n` +
      `主人の個人的な状態・履歴・予定・連絡先・受信メール等に関する質問は、自分の推測で\n` +
      `答えずに必ず memory_search か ask_winclaw を呼ぶ。「思い出せない」と答えるのは\n` +
      `ツールを呼んだ後でのみ許可。`,
  );

  if (additionalContext && additionalContext.trim()) {
    sections.push(`[ADDITIONAL CONTEXT]\n${additionalContext.trim()}`);
  }

  const full = sections.join("\n\n");
  return truncate(full, MAX_TOTAL);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a `Date` as `YYYY年MM月DD日 HH:MM (weekday_jp)` in local time.
 *
 * Exported only via tests — the production call site always passes the
 * current wall-clock `new Date()`.
 */
export function formatJapaneseTime(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const w = WEEKDAY_JA[d.getDay()] ?? "?";
  return `${y}年${mo}月${da}日 ${hh}:${mm} (${w})`;
}

/**
 * Tail-truncate `text` to at most `max` characters, appending
 * {@link TRUNC_SUFFIX} when truncation occurred.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const keep = Math.max(0, max - TRUNC_SUFFIX.length);
  return text.slice(0, keep) + TRUNC_SUFFIX;
}
