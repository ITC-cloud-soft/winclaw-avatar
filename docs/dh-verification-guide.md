# Digital Human 動作確認ガイド (Phase A+B+C)

対象バージョン: `winclaw 2026.4.17`
対象モード: `dhMode = "function_calling"` (既定)

## 1. 起動と前提

```bash
# 停止中であることを確認
netstat -ano | grep ":18789"
# 起動
winclaw start    # or: winclaw daemon start
```

ログで以下を確認 (新しい観測ログ = Phase A で追加):

```
[DH:<sessionId>] 🎯 Session started  mode=function_calling  tools=ask_winclaw,memory_search,...
[Handler:<sessionId>] notify.dh subscribed keys=[dh-notify:<sessionId>, dh-notify:broadcast]
```

`tools=` に `ask_winclaw` が**最初**に出ていれば Qwen が優先的に使う位置に並んでいる。

## 2. 音声テストフレーズ (diagnosis §2.4.D1)

各フレーズを発話し、直後のログで期待パターンが出るか確認する。

### A. 汎用フォールバック (`ask_winclaw`)

| 発話 | 期待 |
|---|---|
| 「最近のメールをチェックして要約してほしい」 | `Qwen→tool: ask_winclaw` → `Tool→Qwen: ask_winclaw status=ok` → 音声でメール要約 |
| 「今日やらなきゃいけないことを整理して」 | `Qwen→tool: ask_winclaw` → 答えが音声で返る |
| 「そういえば昨日の打ち合わせで決まったこと覚えてる？」 | `Qwen→tool: memory_search` もしくは `ask_winclaw` |

**NGパターン (Phase A+B の目的であるバグ)**: ツール呼び出しログが出ずに avatar が自前の作文で答えるケース。これが出たら instructions が届いていないかツール未登録の疑い。

### B. 明示的ツール

| 発話 | 期待 |
|---|---|
| 「田中さんに Slack で『打ち合わせ了解』って送って」 | `Qwen→tool: channel_send` |
| 「天気を教えて」 | `Qwen→tool: internet_search` (web_search 設定時) |
| 「覚えてる？先週の Aika との会話」 | `Qwen→tool: memory_search` |

### C. ツール不要の発話 (作り話せず素で答える)

| 発話 | 期待 |
|---|---|
| 「おはよう」 | ツール呼ばずに短い挨拶 |
| 「1+1 は？」 | ツール呼ばずに「2です」 |
| 「日本の首都は？」 | ツール呼ばずに「東京です」 |

### D. 通知 (Phase C / `notify.dh`)

別ターミナルで RPC を投げ、avatar が喋るか確認:

```bash
# 特定セッション宛
winclaw dev rpc notify.dh '{
  "sessionId":"<自分のセッションid>",
  "priority":"high",
  "text":"新着メールが届きました。山田さんから会議の件です。",
  "source":"email",
  "hintLanguage":"ja"
}'

# 全セッションへ broadcast
winclaw dev rpc notify.dh '{
  "priority":"normal",
  "text":"ビルドが完了しました"
}'
```

期待ログ:
```
notify.dh dispatched priority=high sessionIds=<sid> source=email
NotifyBridge: inject [HIGH] 新着メール...
```

avatar が「[OWNER NOTIFICATION] を受け取った」扱いで要約を発話する。

### E. フェイルパス (`status=failed` の発話ルール)

ネットワーク切断時 / タスク未定義時に `user_message` を**一字一句そのまま**読み上げているか確認。付け足しや言い換えが出たら instructions CORE RULE #5 が効いていない。

## 3. ブラウザ UI で見えるもの (Phase A-4)

DevTools の Network タブで WebSocket を開くと、新フレーム型が流れる:
- `{type:"tool_call", data:{name, args, callId}}` — ツール呼び出し時
- `{type:"tool_result", data:{name, callId, status, summary, error?}}` — 結果返送時

## 4. 並行性チェック

「メール確認して」「今の天気は？」を連続発話 (間 1 秒未満)。
gateway-bridge の `pendingRuns` は runId キーなので 2 つの `chatSendAndWait` は独立に進行する。両方の結果が順に音声化されるか、片方がタイムアウトで落ちていないか確認。

## 5. 重複抑止チェック

別チャネル (WhatsApp 等) から話しかけ、同じ runId の `final` イベントが `agent:main:main` sessionKey に届く。このとき:
- avatar 本人の `chatSendAndWait` 中であれば `isPendingRun(runId)` が `true` となり、NotifyBridge は `return` して **二重発話しない**。
- 未知の runId なら proactive announce として読み上げる。

## 6. よくある失敗の切り分け

| 症状 | 調べる場所 |
|---|---|
| avatar が作文で答えてしまう | ログに `🎯 Session started ... tools=ask_winclaw,...` が無い → `setTools` 失敗 or `dhMode≠function_calling` |
| `Qwen→tool: ask_winclaw` は出るが音声が返らない | `chat.timeout` ログ確認。agent 側で処理が止まっている |
| `notify.dh` が avatar に届かない | `notify.dh subscribed keys=[...]` ログ、RPC 応答の `deliveredTo` |
| fail 時に言い換えしてしまう | Qwen instructions の CORE RULE #5 未適用。`buildInstructions` の戻り値を確認 |

## 7. ロールバック

```bash
# 環境変数で一発戻し
export DH_MODE=legacy_pipeline
winclaw restart
```
