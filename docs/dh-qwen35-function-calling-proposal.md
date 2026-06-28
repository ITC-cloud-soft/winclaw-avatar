# Digital-Human Voice: Qwen3.5-Omni-Flash-Realtime Function Calling 統合提案

> **対象**: `winclaw-avatar/extensions/digital-human`
> **目的**: 現行の STT+Gateway+TTS 三段パイプラインを、**qwen3.5-omni-flash-realtime の Function Calling を直接使う単段パイプライン**に置き換え、Winclaw 本体のメモリ/タスク実行能力を音声レイテンシで呼び出せるようにする。
> **参考実装**: `C:\work\digtal-human\autoproject-project\backend` (production で稼働中)

---

## 1. 現状と課題

### 1.1 現行アーキテクチャ (`realtime-handler.ts`)

```
User audio → Qwen STT → transcript → Gateway chat.send → Agent Pipeline
  → Agent answer → chat event (delta/final)
  → Qwen TTS (speakText) → audio → ByteDance DH lip sync
```

`qwen3-omni-flash-realtime` は function calling をサポートしないため、
**音声理解 (STT) → テキスト LLM (Gateway agent) → 音声合成 (TTS)** と 3 回モデルを呼んでいる。

### 1.2 問題点

| # | 課題 | 影響 |
|---|---|---|
| 1 | **レイテンシ**: STT 完了待ち → Agent 推論 → TTS 生成の直列パイプライン | 発話開始まで 1.5〜3 秒 |
| 2 | **音声ニュアンスの喪失**: テキスト中間表現で感情/トーンが落ちる | 返答が平板 |
| 3 | **Agent pipeline と memory-bridge の多重化**: テキスト chat と音声 chat で memory 書き込みが別経路 | 会話履歴の一貫性欠如、重複/順序ズレ |
| 4 | **割り込みの不安定さ**: STT バッファと Gateway stream をまたぐキャンセルが難しい | 「止めて」が効かない瞬間がある |
| 5 | **「主人への要件報告」が非対応**: Winclaw 側で発生したイベント (メール着信、タスク完了、カレンダー通知) を DH 経由で音声通知するチャンネルが無い | 受動的な応答のみになる |

---

## 2. 提案: Qwen 3.5 Realtime Function Calling に一本化

### 2.1 新アーキテクチャ

```
User audio ──┐
             │  (同一の Realtime WS)
Winclaw event ─► DH Handler ──► Qwen 3.5 Realtime (Omni Flash)
             │                   ├─ 音声理解 + 推論 + 音声合成 (単段)
             │                   └─ Function Call ──► Winclaw Tool Router
             │                                         ├─ memory.search
User audio ◄─┘                                         ├─ memory.append
                                                       ├─ task.run
                                                       ├─ channel.send
                                                       └─ notify.speak  (← 逆方向 push)
```

キーポイント:
- **Qwen 3.5 が対話の中心**。Gateway agent pipeline はバイパス。
- **memory は single source of truth**: `memory-core` プラグインに直接 function call。webchat と音声が同じ memory に読み書き。
- **Winclaw → DH push**: Winclaw 側のイベント (新着メール、タスク完了等) が `notify.speak(text, priority)` を介して Qwen のコンテキストに inject され、音声で要約報告される。

### 2.2 参考実装との対応

| 参考実装 (Python) | winclaw-avatar 移植先 (TypeScript) |
|---|---|
| `app/integrations/qwen_realtime.py` | `extensions/digital-human/src/integrations/qwen-realtime.ts` 拡張 |
| `_build_instructions()` + tool 定義 (`RECALL_EARLIER_TOOL` 等) | `realtime-handler.ts` 内に新規 `buildToolDefinitions()` |
| `send_function_result(call_id, result)` | `qwen-realtime.ts` に `sendFunctionResult()` 追加 (既にあるコメントに「not supported」と書いてあるので更新) |
| `app/services/function_call_handler.py` | `extensions/digital-human/src/tool-router.ts` (新規) |
| `RECALL_EARLIER_TOOL`, `INTERNET_SEARCH_TOOL`, `MEDIA_CONTROL_TOOL` | winclaw 向けに `memory.*`, `task.*`, `channel.*`, `notify.speak` に差し替え |

---

## 3. 詳細設計

### 3.0 統一パイプライン原則 (重要)

Qwen Function Calling の tool 実行 `task_run` / `channel_send` は **WhatsApp / text-chat と同じ gateway agent パイプラインを経由する**。Winclaw agent が "universal dispatcher" であり、DH の voice はもう一つの入力チャンネルにすぎない。

```
User voice → Qwen 3.5 FC → tool call "task_run" or "channel_send"
                          ↓
                    GatewayBridge.chatSendAndWait(sessionKey, naturalLanguage)
                          ↓
                    Winclaw Gateway Agent pipeline  ← WhatsApp と同じ
                          ↓ (delta → final chat event)
                    Final text を受信
                          ↓
                    sendFunctionResult(callId, {status,text})
                          ↓
                    Qwen が結果を音声化

Winclaw → Agent (何らかのトリガー) → chat event with notification marker
                          ↓
                    NotifyBridge.pushFromChatEvent(payload)
                          ↓
                    sendSystemEvent on Qwen → voice report
```

→ DH voice からの `task_run` は「自然言語の依頼を agent に投げる」だけ。agent が registered skills / cron / channel_send を自分で呼び分ける。DH プラグイン側で `cron.run` / `send` の RPC を直叩きしない。

### 3.1 Tool カタログ (winclaw 版)

参考実装の 4 tool は KB 検索中心だったが、winclaw では memory + task 実行がコア:

```ts
// extensions/digital-human/src/tools/catalog.ts
export const WINCLAW_DH_TOOLS: QwenToolDefinition[] = [
  {
    name: "memory_search",
    description:
      "Search the owner's long-term memory. Use when the user refers to " +
      "past events, decisions, or preferences that aren't in the current " +
      "conversation window. BM25 + vector hybrid search.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query in the user's language" },
        top_k: { type: "integer", default: 5 },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_get",
    description:
      "Read a specific line range from a memory file when the user asks " +
      "about a particular day or topic memo. Requires the file path " +
      "returned by memory_search.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        startLine: { type: "integer" },
        endLine: { type: "integer" },
      },
      required: ["path"],
    },
  },
  {
    name: "task_run",
    description:
      "Execute a Winclaw task on behalf of the owner. Use when the user " +
      "asks to DO something (send a message, schedule a meeting, summarise " +
      "emails, post to SNS). The task name must match a registered skill. " +
      "Returns {status, summary} which you MUST speak verbatim.",
    parameters: {
      type: "object",
      properties: {
        taskName: {
          type: "string",
          description:
            "Registered skill/task name e.g. 'email.summarize', " +
            "'calendar.schedule', 'sns.post'",
        },
        args: { type: "object", additionalProperties: true },
      },
      required: ["taskName"],
    },
  },
  {
    name: "channel_send",
    description:
      "Send a message through a specific channel (email, LINE, Slack, " +
      "Telegram, WhatsApp). Use when the owner asks to send something. " +
      "NEVER invent recipients — ask the owner if ambiguous.",
    parameters: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["email", "line", "slack", "telegram", "whatsapp"],
        },
        recipient: { type: "string" },
        body: { type: "string" },
      },
      required: ["channel", "recipient", "body"],
    },
  },
  {
    name: "internet_search",
    description:
      "Search the web for real-time info (weather, news, stock, etc.). " +
      "Do NOT use for owner-specific info (use memory_search) or for tasks " +
      "(use task_run).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];
```

**Tool は**  "能力 (capability)" **単位で公開**し、具体的なスキル名は `task_run` の引数で指定する設計。Winclaw のスキル数がいくら増えても Qwen に渡す tool 定義は 5 個で済む。

### 3.2 Winclaw → DH プッシュ通知 (主人への要件報告)

> **Phase C 実装済み (2026-04-19)**: 下記の「gateway chat event を組み立てる」生配線は、
> 新しい gateway RPC **`notify.dh`** によって構造化された API に置き換えられた。
> 以降 winclaw 内部コンポーネントはマーカー文字列 (`[HIGH]` 等) を手で組まず、
> `notify.dh` を呼ぶだけで DH セッションに音声通知が届く。実装は
> `src/gateway/server-methods/notify-dh.ts` を参照。

**推奨 API — `notify.dh`** (canonical notification pathway):

```ts
await gateway.request("notify.dh", {
  sessionId: "session-abc",       // 省略時は全 DH セッションにブロードキャスト
  priority: "high",               // "high" | "normal" | "low"
  text: "新着メール: 山田さんから会議の件",
  hintLanguage: "ja",             // 任意
  source: "email",                // "email" | "task" | "calendar" | "channel" | "manual"
  dedupKey: "email:yamada:meeting", // 任意 — NotifyBridge 側で重複抑制
});
```

内部動作:
- Handler は `[HIGH]`/`[NORMAL→[NOTIFY]]`/`[LOW]` マーカーを前置し、`role: "system"`、`state: "final"` の chat event を生成
- 送信先 sessionKey は `dh-notify:<sessionId>` または broadcast 時は `dh-notify:broadcast`
- DH 側 (`realtime-handler.ts` FC mode) はこの 2 つの key を `notifyBridge.pushFromChatEvent` に配線済み
- 既存の main sessionKey (`agent:main:main`) のマーカー付き final event も引き続きフォールバックとして受理される (後方互換)

Winclaw コンポーネント (email / task / calendar / channel etc.) が **gateway chat event** として通知を emit し、DH は gateway のその sessionKey を購読して音声化する。WhatsApp が gateway の outbound channel であるのと同じく、DH voice も outbound channel として扱われる。

```ts
// NotifyBridge は 2 つのエントリを持つ:
//   1) push()                — テスト / 直接投入用
//   2) pushFromChatEvent()   — gateway chat event 経由のプッシュ

class NotifyBridge {
  pushFromChatEvent(payload: ChatEventPayload): void {
    if (payload.state !== "final") return;            // delta は無視
    const raw = payload.message?.content?.[0]?.text ?? "";
    // [URGENT] / [HIGH] / [LOW] / [NOTIFY] prefix で優先度を判別
    // マーカーが付いていない event は通常の agent 応答とみなし無視
    // マーカーを除去した本文を summary として push()
  }
}

// Wiring (realtime-handler.ts, FC mode):
gwBridge.onChatEvent(this.sessionKey, (p) => notifyBridge.pushFromChatEvent(p));
```

Winclaw 側 (例: メール受信 plugin) は、gateway で chat event を emit する際に content を `[NOTIFY] 新着メール: alice 「meeting」` のように組み立てるだけでよい。**これは WhatsApp が同じ path でメッセージを受け取るのと完全に同じフロー**。既存の EventEmitter bus (`email.received` / `task.completed` 等) もテスト / レガシー互換のため残すが、production では chat event path を推奨する。

### 3.3 Memory の共通化

現在の `memory-bridge.ts` は STT 経由の transcript を memory file に書いているが、Qwen 3.5 に切り替えると:

- **ユーザー transcript**: `conversation.item.input_audio_transcription.completed` イベント → そのまま既存の `MemoryBridge.appendTranscript()` へ
- **アシスタント発話**: `response.audio_transcript.done` → `appendTranscript(role='assistant')`
- **Function call 結果**: `response.function_call_arguments.done` の前後で `appendToolUse()` フック追加

→ **memory-bridge は API 変更なし、入口だけ切り替え** で webchat と voice が同じ memory file (`workspace/memory/YYYY-MM-DD.md`) を共有する。

### 3.4 Qwen-realtime.ts の改修ポイント

現在の `_buildFullSessionPayload()` (L932) に tool/function 対応を追加:

```ts
// Before (L940-948):
// NOTE: Realtime WebSocket API does NOT support function calling / tools.
// ← この NOTE は qwen3-omni-flash-realtime 時代の制限。削除。

// After:
private _buildFullSessionPayload(): SessionUpdatePayload {
  return {
    modalities: ["text", "audio"],
    voice: this._voice,
    input_audio_format: this._inputAudioFormat,
    output_audio_format: this._outputAudioFormat,
    input_audio_transcription: { model: this._voiceModel },
    turn_detection: this._serverVad
      ? { type: "server_vad", interrupt_response: true, create_response: true }
      : null,
    instructions: this._currentInstructions || undefined,
    tools: this._tools ?? [],  // ← 新規
  };
}

// 新規メソッド:
async sendFunctionResult(callId: string, resultJson: string): Promise<void> {
  this._sendMessage({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: resultJson,
    },
  });
  this._sendMessage({ type: "response.create" });
}

async sendSystemEvent(text: string): Promise<void> {
  this._sendMessage({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{ type: "input_text", text }],
    },
  });
}
```

イベントハンドリング拡張 (`_handleServerEvent` 相当):

```ts
case "response.function_call_arguments.done": {
  const { call_id, name, arguments: argsJson } = event;
  this._callbacks.onFunctionCall?.({ callId: call_id, name, argumentsJson: argsJson });
  break;
}
```

### 3.5 Tool Router

**重要**: `task_run` / `channel_send` は gateway agent パイプラインを経由する。直接 RPC (`cron.run` / `send`) を叩かない。memory / internet_search はそれぞれ in-process adapter と plugin-level adapter を使う (agent round-trip は不要)。

```ts
// extensions/digital-human/src/tool-router.ts

export class ToolRouter {
  constructor(private readonly deps: {
    memory: MemoryCorePlugin;
    gwBridge: GatewayBridge;   // ← chat.send path
    sessionKey: string;         // ← DH voice session key (WhatsApp と共有可)
    webSearchFn?: (q: string) => Promise<WebSearchResult>;
    chatTimeoutMs?: number;     // default 30s
  }) {}

  async handle(call: FunctionCall): Promise<string> {
    // memory_search / memory_get / internet_search は従来どおり直接 adapter

    // task_run: 自然言語リクエストに整形 → agent に投げる → 返信を tool_result に
    //   build: `タスク実行: ${taskName} を実行してください。引数: ${JSON}`
    //   const finalText = await gwBridge.chatSendAndWait(sessionKey, msg, { timeoutMs });
    //   return JSON.stringify({ status: "ok", user_message: extractSpeakable(finalText) });

    // channel_send: 同じく agent に「LINE で 山田さん に「本文」と送ってください」を投げる
    //   agent が channel plugin を呼び分ける
  }
}
```

ポイント:
1. Agent は full tool catalogue (cron / skills / channel_send / memory / embedding search) を持っているので、DH plugin 側で複雑な dispatch ロジックを持たなくてよい。
2. `chatSendAndWait` は `GatewayBridge` が per-runId で delta を bufferingし、`state: "final"` で resolve する。timeout (30s default) で reject → `user_message: "応答がタイムアウトしました。"`。
3. Agent が `<voice>...</voice>` tag を含めた場合、そのタグ内テキストを優先的に `user_message` に採用する (DH voice でも既存の short-summary 規約を再利用)。

**エラー時の `user_message` 規約** は参考実装をそのまま踏襲。Qwen の instructions に「`status=failed` の時は `user_message` を **そのまま読み上げる**」と明記する (参考実装の CORE RULES #8 相当)。

### 3.6 Instructions (system prompt)

参考実装の `_build_instructions()` を winclaw 向けに書き換え:

```
[Time: {now}]

[IDENTITY]
あなたは主人の AI 伴侶 **{avatarName}** です。性格: {personalityFromSOUL_md}
関係性: {relationship}、主人への呼び方: {nickname}

[CORE RULES]
1. 簡潔: 音声応答は 1〜2 文。
2. 言語一致: 主人の言語で返す。
3. 割り込み: 「止めて」系には "わかりました" と一言で停止。
4. ツールの使用は黙って実行。「検索します…」は不要。
5. status=failed の時は user_message を一字一句そのまま読み上げる。
6. [OWNER NOTIFICATION] が注入されたら、主人の言語で簡潔に要約して報告。
   (例: "新しいメールが来ました。A さんから会議の件です")

[TOOLS]
  memory_search / memory_get — 主人の長期記憶
  task_run                   — Winclaw タスク実行
  channel_send               — メッセージ送信
  internet_search            — リアルタイム情報

[DECISION FLOW]
  主人が質問 → 自分の知識で答えられるか?
    YES → そのまま答える
    NO  → memory_search してから答える
  主人が依頼 → task_run / channel_send
  イベント通知 → 要約して報告
```

---

## 4. マイグレーション計画

### Phase 1: Qwen 側の変更 (1-2 日)

- [ ] `qwen-realtime.ts` の model を `qwen3.5-omni-flash-realtime` に昇格 (既にデフォルト)
- [ ] `SessionUpdatePayload` に `tools` 追加
- [ ] `sendFunctionResult()` / `sendSystemEvent()` / `createResponse()` 追加
- [ ] `on_function_call_arguments_done` イベントハンドラー追加
- [ ] 単体テスト: 既存の接続/STT/TTS テストが壊れないことを確認

### Phase 2: Tool Router + 配線 (2-3 日)

- [x] `tool-router.ts` 実装 + ユニットテスト (mock memory/task/channel)
- [x] `realtime-handler.ts` で `QwenRealtimeClient.on("functionCall", ...)` を Tool Router に繋ぐ
- [x] 既存の `gateway-bridge.ts` (STT→Gateway) を **feature flag で無効化可能に** (fallback 用)
- [x] instructions に winclaw 版の system prompt を組み込み
- [x] 結合テスト: memory_search, task_run の 2 tool で E2E

### Phase 3: Notify Bridge (1-2 日)

- [x] `notify-bridge.ts` 実装
- [x] Winclaw イベントバス購読 (email, task, calendar, channel)
- [x] Priority queue + flush タイミング制御 (high: 即割込 / normal: response.done 後 / low: 次ターン)
- [ ] 手動テスト: メール送信 → 主人に音声報告まで (blocked — Winclaw 本体がまだ内部イベントバスを plugin 側へ公開していない。DH プラグイン内でローカル `EventEmitter` を作成し、NotifyBridge に接続済みなので、host 側が emit すれば即動作する。TODO: `api.getEventBus()` 相当の API が入ったら切替)

### Phase 2.5: 本番配線の仕上げ (完了)

- [x] `task_run` → `TaskRunnerAdapter` 経由。既定アダプタは `GatewayBridge.request("cron.run", ...)`。adapter 未注入時は「準備中」で graceful degradation。
- [x] `channel_send` → `ChannelRegistryAdapter` 経由。既定アダプタは gateway `send` RPC。enum (`email/line/slack/telegram/whatsapp`) を router 側で検証。
- [x] `internet_search` → `webSearchFn` adapter 経由。Winclaw native programmatic API は現在未公開 (`src/agents/tools/web-search.ts` は CLI tool であり plugin からは直接使えない)。`HandlerDeps.webSearchFn` を通すので host が解決できれば即利用可。未注入時は「準備中」。Qwen 内蔵 `enable_search` は tools と排他のため使用しない。
- [x] `IdentityLoader` に `nickname` / `relationship` 抽出を追加 (YAML / markdown bold / `## 呼び方` heading / 日本語・英語キー対応)。`buildInstructions()` に連鎖して `[IDENTITY]` セクションに反映。
- [x] `HandlerDeps` と `SessionManagerConfig` に `taskRunner` / `channelRegistry` / `webSearchFn` / `winclawBus` を追加 → plugin host (`index.ts`) からデフォルトアダプタと local EventEmitter を注入。
- [x] NotifyBridge 有無のログ (`NotifyBridge enabled` / `disabled (no winclawBus ...)`) を runtime に追加。

**残 TODO (本リポジトリ外の API に依存):**

- Winclaw host 側で「plugin 向け event bus」を公開したら、`extensions/digital-human/src/index.ts` の `winclawBus = new EventEmitter()` を差し替える (`TODO(plugin-host)` マーカー済み)。
- Winclaw に native web-search の programmatic adapter が追加されたら、同ファイルの `webSearchFn` を resolve する実装を追加する (`TODO(plugin-host)` マーカー済み)。
- cron.run でカバーしきれない skill / agent 呼び出しが必要になったら、`TaskRunnerAdapter` の実装を `skills.run` や直接 in-process runner にスイッチする (`TODO(plugin-host)` マーカー済み)。

### Phase C: 非同期レシート (async receipt pattern, 完了)

長時間かかる agent タスク (メール要約、複数ステップ処理など) で DH 側が 180s 待ち続けて
VAD が応答を合成しないまま「無音化」していた問題への対策。**DH 側だけで完結** する
改修で、agent 側のロジックは一切変えない。

**フロー**:

```
Qwen function_call: ask_winclaw(request="メール全部まとめて")
  ↓
ToolRouter.dispatchViaGateway
  ↓
GatewayBridge.chatSendAsync(sessionKey, message, { earlyTimeoutMs:15s, lateTimeoutMs:600s })
  ├─ agent が 15s 以内に final を返す
  │    → { done:true, text } → { status:"ok", user_message:<voice> }   (既存動作)
  │
  └─ earlyTimeoutMs 経過 (agent 継続中)
       → { done:false, runId, continuation } を即返す
       → Qwen に { status:"ok", receipt, user_message:"承知しました、確認中です…" }
       → Qwen は user_message を読み上げて session を解放 (VAD 復活)
       → しばらくして continuation が resolve:
            ToolRouter.scheduleLateDelivery:
              gateway.request("notify.dh", {
                sessionId, priority:"normal",
                text: "[NOTIFY] 先ほどのご要件の結果です: …",
                source:"async-tool-result", dedupKey:"late-<runId>"
              })
            → NotifyBridge がそれを受信して qwenClient.sendSystemEvent + createResponse
            → 主人に「報告です: メール 5 件まとめました」等を音声で配信
```

**変更点**:

- `gateway-bridge.ts`: 新 API `chatSendAsync`。既存 `chatSendAndWait` はそのまま残す。
- `tool-router.ts`: `dispatchViaGateway` が `chatSendAsync` を使う。`done:false` なら
  receipt を Qwen に返し、`scheduleLateDelivery` で continuation を monitor → `notify.dh` RPC で push。
- `ToolRouterDeps.dhSessionId` を追加 — `notify.dh` の `sessionId` に使う。
- `config.ts`: `dhTool.earlyTimeoutMs` / `dhTool.lateTimeoutMs` を新設 (z.default 15s / 600s)。
- `instructions-builder.ts`: `status=ok` + `receipt` ケースを Qwen に教える
  (user_message だけ読み上げて後続の OWNER NOTIFICATION を待つ規約)。
- `realtime-handler.ts`: `ToolRouter` 構築時に `dhSessionId: this.sessionId` と
  timeout 設定を渡す。

**エッジケース / 未対応**:

1. 同時に複数の async tool が飛び、同一 agent sessionKey 上で順序が混ざる可能性。
   現状は `dedupKey: late-<runId>` で NotifyBridge 側が重複を抑制。順序制御は
   していない (到達順に音声化される)。
2. DH session が `continuation` 完了前に閉じた場合、`scheduleLateDelivery` は
   まだ走っていて notify.dh を投げるが、NotifyBridge は既に dispose 済み。
   `gwBridge.request` は成功 / 失敗どちらでも副作用なし (log 警告のみ)。
3. Qwen の「reciept が含まれる時は user_message だけ読んで後続の通知を待つ」
   という運用は、instructions で明示しているが LLM 判断なので一定確率で外す。
   そのため `[NOTIFY]` マーカーを text に付け、NotifyBridge 側が独立して
   「先ほどのご要件の結果です: …」をそのまま発話するように寄せている。
4. late timeout (600s) 時は notify.dh で `完了できませんでした` が発話される。

### Phase 4: 切り替え + 観測 (1 日)

- [ ] Feature flag `DH_MODE=function_calling`, `DH_MODE=legacy_pipeline` で切替
- [ ] デフォルト `function_calling`、問題発生時は legacy に即ロールバック可能
- [ ] ログ/メトリクス: tool call 数, 平均レイテンシ, failure rate
- [ ] 1 週間並走 → 問題なければ legacy パス削除

**合計見積**: 5-8 日 (1 人工)

---

## 5. 互換性と Gateway の位置付け

- **text-chat (webchat, WhatsApp 等)** は引き続き Gateway agent pipeline。変更なし。
- **voice (DH)** のみ Qwen function calling に切替。
- **memory は共通** なので、webchat で話したことが音声でも参照できる (逆も可)。
- **task_run の実装本体** は winclaw 既存の `TaskRunner` をそのまま呼ぶ → **スキル資産は 100% 再利用**。

---

## 6. リスクと対策

| リスク | 対策 |
|---|---|
| Qwen 3.5 Realtime の function calling が実運用で不安定 | Feature flag で legacy パイプラインに即戻せる |
| Tool 呼び出し失敗時の UX 劣化 | `status=failed` + `user_message` 規約で「失敗を素直に告げる」モデル行動を強制 |
| Notify 割込で会話が散漫になる | priority: low/normal はターン終わりまで待つキュー設計 |
| memory 書き込みの重複 (音声 + Qwen が両方書く可能性) | memory-bridge を唯一の writer とし、Qwen には直接書かせない (tool 経由のみ) |
| テスト負債 | 参考実装にある `test_qwen35_function_calling.py` を ts 版に移植して CI に載せる |

---

## 7. 参考資料

- 参考実装のコア 3 ファイル:
  - `C:\work\digtal-human\autoproject-project\backend\app\integrations\qwen_realtime.py` (899 行)
  - `C:\work\digtal-human\autoproject-project\backend\app\services\function_call_handler.py` (757 行)
  - `C:\work\digtal-human\autoproject-project\backend\app\services\qwen_session_manager.py` (707 行)
- DashScope Realtime API docs: https://help.aliyun.com/zh/model-studio/qwen-omni-realtime

---

## 8. 結論

**「STT+Gateway+TTS」を「Qwen 3.5 Realtime + Function Calling」に置き換える** ことで:

1. **レイテンシ 1/2〜1/3** (単段パイプライン)
2. **Winclaw の memory/task 能力を音声で直接利用可能**
3. **主人への能動的な音声報告** を実現
4. **既存資産 (memory-core, TaskRunner, Channels) は 100% 再利用** — 差分実装は薄い

Gateway agent pipeline は webchat 等のテキストチャンネルで引き続き使われるため、**片方ずつロールアウト可能**。音声側だけ先に切り替える安全な移行が可能です。
