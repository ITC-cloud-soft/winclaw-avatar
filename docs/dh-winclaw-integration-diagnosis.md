# DH ↔ Winclaw Gateway 統合 — 現状診断と修正プラン

> **課題 (ユーザー報告)**: 数字人は Qwen 3.5 と会話するだけで、WhatsApp のように winclaw gateway と実際に連携できていない。
> **目的**: Qwen 3.5 Function Calling で winclaw の能力 (memory / task / channel / notify) にアクセスできる状態を**実際に動作**させる。

---

## 1. 現状コードの再確認

### 1.1 実装されている配線 (論理的には正しい)

| 層 | 位置 | 状態 |
|---|---|---|
| Qwen FC session.update に tools 送信 | `qwen-realtime.ts: _buildFullSessionPayload()` | ✅ `tools: this._tools` |
| Qwen → 関数呼び出しイベント受信 | `qwen-realtime.ts: on "functionCall"` | ✅ |
| `dispatchFunctionCall` → ToolRouter.handle | `realtime-handler.ts:513` | ✅ |
| ToolRouter → `gwBridge.chatSendAndWait(sessionKey, msg)` | `tool-router.ts:281` | ✅ |
| gateway から final 受信 → `sendFunctionResult` | `realtime-handler.ts:519` | ✅ |
| NotifyBridge ← chat event (marker filter) | `realtime-handler.ts:320` | ✅ |

**論理フローは WhatsApp と同じ**: 「user text → agent pipeline → reply」と「user voice → Qwen FC → tool_run → agent pipeline → reply → Qwen voice out」が同じ `chat.send` RPC を使う。

### 1.2 しかし実動作しない理由 (4 仮説)

#### H1 — **Qwen がそもそも tool を呼ばない** (最有力)

Qwen 3.5 Realtime の tool 選択は LLM 判断。以下の要因で**ツールを呼ばず、自分の知識で返答してしまう**ことが多い:

- `instructions-builder.ts` の TOOLS セクションは**列挙のみ**で、使用を**強制する wording が弱い**:
  ```
  [DECISION FLOW]
    主人が質問 → 自分の知識で答えられるか?
      YES → そのまま答える   ← Qwen がここに逃げる
      NO  → memory_search...
    主人が依頼 → task_run / channel_send を実行し…
  ```
  → 「主人が依頼」かどうかの判定を Qwen に任せており、曖昧な表現 (「今日どうだった？」等) では tool 呼び出しが起きない。

- ツール description が**能力カテゴリ単位**のため、具体的な user 発話 (「山田さんに LINE 送って」) が該当するか Qwen に推論負荷がかかる。

#### H2 — **task_run の taskName が winclaw で未登録**

- Qwen は `task_run` 呼び出し時に `taskName` を**自由生成** (例: `email.summarize`)。
- Winclaw agent は自然言語を解釈するので文字列の形は問題ないが、Qwen が「どの taskName 形式が有効か」を知らないと架空の名前を送りがち。
- `tool-router.ts:224` で組み立てるメッセージ `"タスク実行: {taskName} を実行してください。引数: {...}"` は agent には解釈できるが、Qwen の出力形式がぶれる。

#### H3 — **モードが実際には function_calling ではない可能性**

- `dhMode` のデフォルトは `"function_calling"` (config.ts)
- 環境変数 `DH_MODE` で override 可能
- 本番起動時のログで `dhMode=function_calling` が出ているかを**実機確認していない**

#### H4 — **観測性ゼロ — 何が起きているか分からない**

- Qwen から function_call イベントが届いたかのログなし
- ToolRouter で chatSendAndWait が呼ばれたかのログなし
- gateway から final が返ってきたかのログなし
- UI に tool call の可視化なし

→ ユーザーには「Qwen と雑談しているだけ」にしか見えない。実は winclaw 経由で何かしている可能性もあるが確認手段がない。

---

## 2. 修正プラン

### 2.1 Phase A — 観測性の追加 (最優先、当日実装可)

**目的**: ログを見るだけで全フローが追えるようにし、H3/H4 を切り分ける。

#### A1. 起動時ログ強化 (`realtime-handler.ts: initialize()`)
```ts
console.info(
  `[DH:${sessionId}] 🎯 Starting DH session  mode=${this.dhMode}  ` +
  `tools=${isFC ? WINCLAW_DH_TOOLS.map(t => t.name).join(",") : "n/a"}  ` +
  `memory=${!!this.memory}  bus=${!!this.winclawBus}  voice=${config.qwen.voice}`
);
```

#### A2. Function Call 受信ログ (`dispatchFunctionCall`)
```ts
console.info(
  `[DH:${sessionId}] 🔧 Qwen called tool: ${call.name}  args=${call.argumentsJson.slice(0,200)}`
);
```
結果返却も:
```ts
console.info(
  `[DH:${sessionId}] ✅ Tool result → Qwen: ${result.slice(0,200)}`
);
```

#### A3. Gateway RPC ログ (`gateway-bridge.ts: chatSendAndWait`)
既存の `chatSend` ログに加え、runId 単位で delta/final も:
```ts
console.info(`[GW:${sessionKey}] ↗️ chat.send  runId=${runId}  msg="${msg.slice(0,100)}"`);
// on final:
console.info(`[GW:${sessionKey}] ↘️ chat.final runId=${runId}  text="${finalText.slice(0,100)}"`);
```

#### A4. UI への tool 可視化 (任意)
browser client に新プロトコル:
```ts
{ type: "tool_call", data: { name, args } }
{ type: "tool_result", data: { name, result } }
```
→ 開発者がブラウザ devtools で見える。

### 2.2 Phase B — Instructions の強化 (Qwen に tool を使わせる)

**問題**: Qwen 3.5 は「自分の知識で答えられるか」を**楽観的に判断**するため、winclaw-specific なことまで自分で答えてしまう。

#### B1. DECISION FLOW の書き換え (厳格化)

```
[DECISION FLOW — 必ず守る]

以下の **動詞が含まれる発話** は必ず `ask_winclaw` または適切なツールを呼ぶ:
  「送って」「送信して」「送る」「投稿して」「投げて」 → channel_send or task_run
  「実行して」「やって」「処理して」「試して」 → task_run
  「メール読んで」「チェックして」「確認して」 → task_run
  「覚えてる？」「昨日の話」「この前の」 → memory_search
  「今の天気」「最新の」「今日の株価」「ニュース」 → internet_search

ツールを呼ばずに答えて良いのは以下のみ:
  - 挨拶 (おはよう/こんにちは)
  - 感情的な応答 (うん/大丈夫)
  - 一般常識の質問 (「日本の首都は？」)
  - 雑談・共感

上記以外で**判断に迷ったら ask_winclaw を呼ぶ**。自分で作り話をしない。
```

#### B2. **新規ツール `ask_winclaw(request)` を追加** (最重要)

Qwen が「どのツールを呼べばいいか分からない」時のフォールバックを提供:

```ts
{
  name: "ask_winclaw",
  description:
    "Forward the owner's request to the Winclaw agent when you're unsure " +
    "which specific tool to use, OR when the task requires multiple steps " +
    "(e.g. 'read my email and summarize it to Slack'). Winclaw has full " +
    "access to email, calendar, SNS, memory, tasks, and more. " +
    "ALWAYS call this instead of answering about the owner's personal " +
    "data/state when you're not 100% sure the answer is in your own " +
    "context. The agent's reply comes back as the tool result — speak it verbatim.",
  parameters: {
    type: "object",
    properties: {
      request: {
        type: "string",
        description: "The owner's request or question, in natural language",
      },
    },
    required: ["request"],
  },
}
```

これは `task_run` と `channel_send` を**包含する汎用窓口**。Qwen は迷ったらこれを呼べば良い。gateway agent は自然言語を自力で分解・実行する。

ToolRouter 実装:
```ts
case "ask_winclaw":
  return this.dispatchViaGateway(
    args.request as string,   // そのまま流す
    "winclaw との通信に失敗しました。",
    (final) => final || "winclaw から応答がありませんでした。",
  );
```

→ **実質 WhatsApp と同じ経路**を Qwen FC 経由で実現。

#### B3. tool 呼び出しの silent 化

Qwen が「検索しますね…」と前置きして audio を吐いてから tool を呼ぶと遅延 2 倍。Instructions で禁止:
```
[ツール使用ルール]
- ツール呼び出しの前に前置きを話さない (「検索します」「送りますね」など禁止)
- ツール結果を受け取ってから初めて話す
- 結果は 1〜2 文で要約 (長文禁止)
```

### 2.3 Phase C — 通知経路の標準化 [✅ 実装済み 2026-04-19]

> **実装**: `notify.dh` RPC を `src/gateway/server-methods/notify-dh.ts` に追加。
> DH 側 (`extensions/digital-human/src/realtime-handler.ts`) は `dh-notify:<sessionId>` と
> `dh-notify:broadcast` の 2 つの sessionKey を購読。winclaw コンポーネントはマーカー文字列を
> 組まず、構造化された `notify.dh` を呼ぶだけで DH が音声で主人に通知する。
> 詳細は `docs/dh-qwen35-function-calling-proposal.md` §3.2 を参照。


#### C1. Winclaw 側が**通知を送るための明確な API**が必要

現在 NotifyBridge は「gateway chat event で `[HIGH]` マーカー付き final を受けたら通知」という実装。しかし、

- winclaw 本体のどのコンポーネントがこの chat event を emit するのか未定義
- session key は DH の `agent:main:main` を共用 — 複数 DH セッションがあれば全てに届く

#### 提案: 専用 session key + gateway-side API

- DH handler 起動時に `dh-notify:${sessionId}` という session key をサブスクライブ
- winclaw 側に新 RPC を追加: `notify.dh { sessionId?, priority, text }`
  - `sessionId` 省略時は全 DH セッションにブロードキャスト
  - 内部的には `chat.send` と同じ通知 event を発行
- gateway 側で notify event → 指定 session key に routing

これにより:
- winclaw エージェント/スキル/自動化が `notify.dh { priority:"high", text:"新着メール..." }` を呼ぶだけで音声通知
- マーカー文字列 (`[HIGH]` 等) の convention に依存しない (構造化)

### 2.4 Phase D — 実機デバッグ手順書

#### D1. 検証シナリオ (順に試す)

1. **起動確認**: ログに `dhMode=function_calling tools=memory_search,memory_get,task_run,channel_send,internet_search,ask_winclaw` が出るか
2. **Tool 呼び出し trigger**:
   - 「山田さんにLINEで『明日の会議OK』って送って」 → `channel_send` 呼ばれる
   - 「未読メール要約して」 → `task_run` or `ask_winclaw`
   - 「昨日何話したっけ」 → `memory_search`
   - 「今日の天気」 → `internet_search`
3. **通知経路**:
   - winclaw で `notify.dh { priority:"high", text:"新着メール: ..." }` を手動 RPC
   - DH が音声で読み上げるか確認

#### D2. ダメな時の切り分け

| 症状 | 原因 | 対処 |
|---|---|---|
| Qwen 起動ログに `tools=...` が無い | FC モード無効 | `config.dhMode` / `DH_MODE` env 確認 |
| Qwen が tool を呼ばない (function_call event 来ない) | Instructions 弱い | Phase B の DECISION FLOW 適用 |
| function_call は来るが gateway に届かない | ToolRouter エラー | dispatchFunctionCall ログ確認 |
| gateway は受けたが final 返らない | Agent タイムアウト or hang | gateway-bridge ログ、runId の pending 状態 |
| final 来るが Qwen が話さない | sendFunctionResult 失敗 | Qwen WS 状態確認、audio_appended 再確認 |

---

## 3. 実装規模

| Phase | 内容 | 工数 | 優先度 |
|---|---|---|---|
| **A** | 観測性ログ (5 箇所) + UI プロトコル | 0.5 日 | ★★★ |
| **B1** | Instructions 厳格化 | 0.5 日 | ★★★ |
| **B2** | `ask_winclaw` ツール追加 | 0.5 日 | ★★★ |
| **B3** | Silent tool 呼び出しルール | 0.2 日 | ★★ |
| **C1** | `notify.dh` gateway RPC | 1 日 | ★★ (winclaw 本体変更) |
| **D**  | 検証 + 手順書 | 0.5 日 | ★★★ |
| **合計** | | **3 日** | |

### 最小マイルストーン (MVP)
Phase A + B1 + B2 + D の **2 日分**で「DH が winclaw 経由で実際に行動する」状態が観測可能に。Phase C は winclaw 本体側の変更なので並行ないし後追い。

---

## 4. Phase E — 長期的視点 (参考、別 sprint)

### 4.1 ハイブリッド/プロキシモード
Qwen の FC が不安定な場合、

```
Option 1 (現状): Qwen FC → tool dispatch
Option 2 (プロキシ): Qwen は全発話を `ask_winclaw` に転送 → agent が全部決める
Option 3 (ハイブリッド): Qwen は chitchat 以外は全部 `ask_winclaw` に転送
```

Option 3 は「Qwen は talkative な顔 + STT/TTS」「winclaw agent が脳」という設計 —
**まさに WhatsApp 体験を voice に拡張したもの**。Qwen 内蔵 memory/reasoning を使わない分、結果が予測可能で debug しやすい。

### 4.2 Gateway 側の session key ルーティング
現在 DH は `agent:main:main` 固定。本格運用時:
- 複数ユーザ対応: `user:{userId}:dh`
- multi-avatar 切替: `avatar:{avatarId}:dh`
- `notify.dh` の routing 精度向上

---

## 5. 結論

**現状のコードは論理的には正しい**が、以下 3 つのどれか (または全部) で機能していない:

1. Qwen が自信過剰でツール呼ばない (Instructions 弱い) ← **Phase B**
2. 何が起きているか見えない (観測性ゼロ) ← **Phase A**
3. winclaw 本体側から DH に通知する API が未定義 ← **Phase C**

Phase A (観測) + B (指示強化 + `ask_winclaw` 汎用 tool) を**即日実装** → 実機で挙動確認 → 不足に応じて Phase C 追加、が最短経路です。

特に `ask_winclaw` 単一ツールは「迷ったら winclaw へ」という DH のデフォルト行動を定着させ、**WhatsApp 体験の voice 版**を実現します。

ご review お願いします。承認後に Team 編成して即着手します。
