# Meta-Coder × Winclaw 統合提案

> **対象**: `C:\work\winclaw-avatar`
> **目的**: `C:\work\meta-coder` (Claude Code 系の本格的 AI コーディングエージェント) を Winclaw のコア能力として組み込み、**ゲーム / 複雑ソフトウェア / マルチメディア生成等の重作業**を winclaw 経由で実行可能にする。
> **方針**: Winclaw 本体エージェントは引き続き軽量な dispatcher。重い実装作業は meta-coder にデリゲートし、結果を winclaw 配下のワークスペースに残し、必要に応じて DH voice で進捗報告する。

---

## 1. なぜ meta-coder か

### 1.1 Winclaw 既存エージェントの限界

現在の winclaw embedded agent (`src/auto-reply/reply/agent-runner.ts`) は:
- ✅ 軽量タスク (メール返信、SNS 投稿、メモリ検索) 向け
- ❌ **複雑で長時間** のコード生成 (例: 100+ ファイル、テスト付きアプリ) には:
  - `model_context_window_exceeded` 多発 (実機ログ確認済 — 4/9, 4/9 多数)
  - 計画 → 実装 → テスト → 修復のループが浅い
  - LSP / グラフ / worktree など coding-grade 機能の不足

### 1.2 Meta-coder が持っているもの

`C:\work\meta-coder/src` を実調査:

| カテゴリ | 内容 |
|---|---|
| **Tool 数** | **65 個** (`tools/` 直下) |
| ファイル操作 | `FileEditTool`, `FileReadTool`, `FileWriteTool`, `GlobTool`, `GrepTool` |
| 実行 | `BashTool`, `LSPTool`, `AgentTool` (sub-agent) |
| グラフ知識 | `GraphCommunitiesTool`, `GraphExplainTool`, `GraphGodNodesTool`, `GraphNeighborsTool`, `GraphPathTool`, `GraphQueryTool` (= graphify) |
| 計画/隔離 | `EnterPlanModeTool`, `ExitPlanModeTool`, `EnterWorktreeTool`, `ExitWorktreeTool` |
| 拡張 | `DiscoverSkillsTool`, `ListMcpResourcesTool`, MCP plugin system |
| 内蔵スキル | `simplify`, `verify`, `modernize`, `newproject`, `systest`, `stuck`, `dream`, `hunter`, `loop` (skills/bundled) |
| エントリ | `entrypoints/cli.tsx` (interactive), `cli/print.ts` (`--print` headless), **`entrypoints/mcp.ts` (MCP サーバー)** |
| モデル | Claude Opus / Sonnet / Haiku、Bedrock、第三方 API |

**特に重要**: `entrypoints/mcp.ts` が **既に MCP サーバーとして動作** する。65 tool が MCP 経由で外部から呼べる。

---

## 2. 統合パターン (4 候補)

### 2.A MCP サーバー統合 (★推奨)

```
Winclaw process
  └─ MCP client (既存の plugin-sdk MCP 接続)
       └─ stdio → Meta-Coder MCP Server (subprocess)
                    ├─ FileEditTool
                    ├─ BashTool
                    ├─ GraphQueryTool
                    └─ ...全 65 tool
```

- **長所**: meta-coder の改修ゼロ、winclaw 側で接続するだけ
- **長所**: stdio スコープで隔離、プロセスクラッシュが winclaw を巻き込まない
- **短所**: 各 tool 呼び出しがインタラクティブ。LLM が逐次判断しないため複雑な計画タスクには不向き
- **適用**: 軽-中程度のコーディング操作 (1 ファイル編集、grep、graph query 等)

### 2.B 「Meta-coder セッション丸ごと delegate」スキル (★★最推奨)

```
Winclaw skill: meta_coder_run
  ├─ 引数: { prompt, workdir, timeoutMin }
  └─ 子プロセスで `meta-coder --print "..."` (headless) を起動
       ├─ 専用 worktree 内で動作
       ├─ 進捗を SSE / file watch で winclaw に報告
       └─ 完了で結果 (生成物 path + summary) を返却
```

- **長所**: 「ゲーム作って」と一発で言えば 30 分後に動くゲームが workspace に残る
- **長所**: winclaw agent は **prompt を作るだけ**でよい、推論コストの大半を meta-coder が負担
- **長所**: `--bare` / `--print` モードは meta-coder で実装済み (`src/cli/print.ts`)
- **短所**: 長時間タスク → DH voice の async receipt パターン必須
- **適用**: ゲーム、Web サイト、CLI ツール、ライブラリ等の "プロジェクト級" 生成
- **DH 連携**: Phase C で実装済の `chatSendAsync` + `notify.dh` レシートパターンとシームレスに繋がる

### 2.C ハイブリッド (2.A + 2.B)

- 小タスク: 2.A (MCP tool を直接呼ぶ)
- 大タスク: 2.B (`meta_coder_run` skill で丸投げ)
- 判定基準: prompt の動詞・期待出力サイズ

→ **本提案ではこのハイブリッドを最終形**とする。

### 2.D In-process import (除外)

meta-coder は CLI として設計されており、TUI (Ink) と密結合。Library 化は大改修必要 → **不採用**。

---

## 3. 推奨アーキテクチャ

### 3.1 全体図

```
DH voice / WhatsApp text / webchat
    ↓
Winclaw Gateway Agent (dispatcher)
    ↓
  分岐:
  ├─ 軽タスク (返信生成 / 検索) → 既存 embedded agent + 通常 tool
  ├─ 中タスク (1 ファイル編集 / refactor) → MCP-meta-coder-tools (パターン A)
  └─ 大タスク (新プロジェクト / ゲーム作成) → meta_coder_run skill (パターン B)
                                                  ↓
                                           Worktree 隔離 + 子 meta-coder プロセス
                                                  ↓
                                           完了 → notify.dh で音声報告
                                                  ↓
                                           成果物は workspace/projects/<id>/ に残る
```

### 3.2 タスク振り分けロジック

`src/auto-reply/reply/agent-runner.ts` の system prompt に以下を追加:

```
[TOOL ROUTING]

Use **meta_coder_run** when the user asks for ANY of these:
  - "ゲーム作って" "create a game"
  - "アプリ作って" "build an app" "make a website"
  - "コード書いて" with multi-file expectation
  - "プロジェクト作って" "scaffold ..."
  - Image/audio/video generation pipelines requiring custom code
  - Any task that needs planning + implementation + testing in one shot

Use **direct file tools** (Read/Write/Edit/Bash) for:
  - Single-file edits / one-line tweaks
  - Quick fixes pointed at specific known files
  - Reading config / inspecting state
```

### 3.3 `meta_coder_run` Skill 仕様

#### 3.3.1 場所
`extensions/meta-coder-bridge/` 新規プラグイン (winclaw plugin SDK)

#### 3.3.2 Tool 定義

```ts
{
  name: "meta_coder_run",
  description:
    "Delegate a complex programming task to Meta-Coder. Use for game/app/" +
    "website creation, multi-file refactoring, or any task requiring plan→" +
    "implement→test loops. Returns a receipt immediately; the actual result " +
    "(workspace path + summary) is delivered later via notify.dh.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Natural-language description of the desired output, " +
          "as if speaking to a senior engineer. Be specific about " +
          "language/framework/runtime constraints.",
      },
      kind: {
        type: "string",
        enum: ["game", "webapp", "cli-tool", "library", "media-pipeline", "refactor", "other"],
      },
      timeoutMin: { type: "integer", default: 30 },
      workdir: {
        type: "string",
        description: "Optional sub-path under workspace/projects/ — auto-named if omitted",
      },
      modelTier: {
        type: "string",
        enum: ["haiku", "sonnet", "opus"],
        default: "sonnet",
      },
    },
    required: ["prompt", "kind"],
  },
}
```

#### 3.3.3 内部動作

```ts
async function metaCoderRun(args, ctx) {
  // 1. Workspace 隔離
  const projectId = randomUUID();
  const projectDir = path.join(workspaceRoot, "projects", `${args.kind}-${projectId}`);
  await fs.mkdir(projectDir, { recursive: true });

  // 2. レシート即返却 (Phase C 非同期パターン)
  const receipt = { receipt: projectId, status: "running", path: projectDir };
  ctx.async.spawn(async () => {
    // 3. meta-coder --print headless で起動
    const proc = spawn("meta-coder", [
      "--print",
      "--cwd", projectDir,
      "--model", args.modelTier,
      args.prompt,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    let output = "";
    proc.stdout.on("data", (chunk) => {
      output += chunk;
      // 4. 中間進捗を 30秒ごとに notify.dh で voice 報告 (任意)
      throttledNotify(ctx, projectId, summarize(output));
    });
    const exitCode = await onClose(proc);

    // 5. 完了時 notify.dh で完了報告
    const summary = await summarizeProject(projectDir);
    await ctx.gw.request("notify.dh", {
      sessionId: ctx.dhSessionId,
      priority: "normal",
      text: exitCode === 0
        ? `[NOTIFY] ${args.kind} の生成が完了しました。${summary}`
        : `[NOTIFY] ${args.kind} の生成が失敗しました。終了コード ${exitCode}`,
    });
  });
  return receipt;
}
```

#### 3.3.4 リソース・ガード

| 項目 | デフォルト | 上書き |
|---|---|---|
| 同時実行数 | 1 | `metaCoder.maxConcurrent` |
| プロセスタイムアウト | 30 分 | tool 引数 `timeoutMin` |
| ディスク予算 | 5 GB / project | `metaCoder.diskQuotaMB` |
| バッシュ実行ポリシー | meta-coder の既存 permission | 既存の許可リストに依存 |
| 中止 | `meta_coder_abort(receipt)` tool | - |

### 3.4 進捗・通知の流れ (DH voice 含む)

```
[T+0]    user: 「猫がネズミを捕まえるゲーム作って」
[T+0.5]  Qwen → ask_winclaw("...")
[T+5s]   agent → meta_coder_run({prompt:"...", kind:"game"})
[T+5s]   skill returns {receipt}
[T+6s]   agent reply → "承知しました、生成中です"
[T+10s]  Qwen → DH voice: "承知しました、生成中です"

[裏で 25 分かけて meta-coder がコード生成]

[T+10s..25min] 任意で notify.dh の "low" priority で進捗音声報告
   例: "計画策定完了" → "5 ファイル実装中" → "テスト中"

[T+25min] meta-coder 完了
[T+25min] skill → notify.dh {priority:"normal", text:"[NOTIFY] game の生成が完了しました。
                  workspace/projects/game-abc/ に index.html (Phaser.js) ..."}
[T+25min] DH voice: "報告です。ゲームの生成が完了しました。projects フォルダに..."
```

---

## 4. 既存資産との整合

| 既存機能 | meta-coder 統合後 |
|---|---|
| `embedded agent` (auto-reply) | 軽タスクで残存。meta_coder_run を 1 tool として保持 |
| `memory-core` plugin | 不変。meta-coder が生成中に直接読み書きしない (workspace は隔離) |
| `notify.dh` RPC | 完了通知の transport として再利用 |
| Phase C `chatSendAsync` | meta_coder_run のレシート → 完了の経路にそのまま使える |
| Worktree (winclaw 既存) | meta-coder の `EnterWorktreeTool` と二重になる可能性 → 外側 winclaw が worktree を切り、meta-coder は内部で更に切るのは禁止 |
| `dream` (memory consolidation) | 別系統。meta-coder の "dream" スキル (`src/skills/bundled/dream.ts`) は無視 |
| `graphify` | meta-coder 内蔵の Graph* tools と機能重複。winclaw 側で持つ knowledge graph と別空間として扱う (生成プロジェクトの理解は meta-coder 内で完結) |

---

## 5. 実装ロードマップ

### Phase 1 — Bridge プラグイン雛形 (2 日)
- [ ] `extensions/meta-coder-bridge/` 新規 winclaw プラグイン
- [ ] `meta-coder` バイナリ存在チェック (`bun pm ls meta-coder` または `where meta-coder`)
- [ ] 単発呼出: `meta_coder_run` tool — 子プロセス起動、headless 出力収集、完了で結果返却 (同期 first cut)
- [ ] テスト: シンプル prompt (例: "Hello world ユーティリティ Python で") で生成→workspace に成果物確認

### Phase 2 — 非同期レシート + 通知 (1.5 日)
- [ ] レシート即返却モード (timeoutMin > 5 のとき自動 async)
- [ ] `notify.dh` での完了通知接続
- [ ] `meta_coder_status({receipt})` / `meta_coder_abort({receipt})` 補助 tool

### Phase 3 — エージェント統合 (1 日)
- [ ] `auto-reply/reply/agent-runner.ts` system prompt に TOOL ROUTING ガイド追加
- [ ] DH instructions-builder にも一行追加: 「ゲーム/アプリ作成依頼は ask_winclaw に転送」
- [ ] 試験シナリオ:
  - 「Tic-tac-toe を React で作って」
  - 「LINE bot のコードを Python で書いて」
  - 「動画から字幕を抽出する CLI を作って」

### Phase 4 — 観測・ガード (1 日)
- [ ] 進捗 SSE / file-watch ベース throttled progress 報告
- [ ] ディスク予算チェック (project ごと最大 5GB、超過で abort)
- [ ] 同時実行数制限
- [ ] meta-coder 出力の構造化 parser (生成ファイル一覧抽出)

### Phase 5 — MCP-tool 直結 (オプション、1 日)
- [ ] パターン A: meta-coder を MCP server として常駐起動
- [ ] winclaw plugin-sdk から MCP 接続、軽タスクで FileEdit/Grep 等を直叩き
- [ ] エージェントの判断で「skill 経由 (重) vs MCP 直 (軽)」を選択

**合計: 6.5 日**

---

## 6. 想定使用シーン

| ユーザー発話 | 想定動作 |
|---|---|
| 「猫がネズミを捕まえるブラウザゲーム作って」 | meta_coder_run({kind:"game"}) → 25分後に Phaser.js プロジェクトが workspace に |
| 「家計簿アプリを作りたい、SwiftUI で」 | meta_coder_run({kind:"webapp"}) — ↑ 同様、Xcode プロジェクト |
| 「この LINE bot に来たメッセージを翻訳する skill 書いて」 | embedded agent → ファイル 1 個作成 (meta-coder 不要) |
| 「ニュース要約 → MP3 生成パイプラインを Python で」 | meta_coder_run({kind:"media-pipeline"}) |
| 「main.py のこの関数 リファクタして」 | embedded agent + 通常 tool (meta-coder 不要) |
| 「全モジュールのテストカバレッジを 80% に上げて」 | meta_coder_run({kind:"refactor"}) — 大規模なので delegate |

---

## 7. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| **コスト爆発** (Opus で 1 タスク $5+) | 利用料金 | デフォルト Sonnet、ユーザー prompt の `modelTier` で制御 + 月次予算上限 |
| **暴走** (meta-coder が無限ループ) | プロセス hang / disk 枯渇 | `timeoutMin`, ディスク予算, `meta_coder_abort` |
| **任意コード実行** (BashTool) | セキュリティ | meta-coder の permission ファイルを winclaw が管理、worktree 内のみ書き込み許可 |
| **隠れた API key 漏洩** | meta-coder にも `.env` 自動読込みがある | meta-coder 起動時に `--env-isolate` 相当 (要 meta-coder 改修) もしくは scratch ENV のみで起動 |
| **二重ワークツリー** (winclaw + meta-coder 両方) | 状態混乱 | meta-coder の `EnterWorktreeTool` は winclaw 起動時に no-op 化 (環境変数 `WINCLAW_DISABLE_WORKTREE=1` 等) |
| **長時間タスクで DH session 切断** | 完了通知が届かない | `dh-notify:broadcast` を fallback、ユーザー再接続時に保留通知をフラッシュ |
| **GraphQuery 二重持ち** | リソース無駄 | meta-coder 側 graph はプロジェクト内限定、winclaw 全体 graphify と分離 |

---

## 8. 検討した代替案

| 代替 | 採用しなかった理由 |
|---|---|
| Claude Code (公式) を使う | meta-coder と同等機能 + ローカル開発済み資産があるため再利用優先 |
| GPT-Engineer / Aider 等の OSS | プラグイン生態系・MCP 対応・成熟度で meta-coder 優位 |
| Embedded agent を強化 | model context を巨大化させると不安定。**専用プロセスに分離する方が安全** |
| Cursor / VS Code Cline | GUI 前提 → DH voice / WhatsApp 自動化との接続が困難 |

---

## 9. 結論

**Meta-coder を「重作業 specialist」として MCP/skill 経由で組み込む** ことで:

1. **DH 音声 1 言で「ゲーム作って」が成立** (delegate → 25分後に音声報告 → workspace に成果物)
2. **既存 winclaw embedded agent は軽タスクのまま** で安定
3. **Phase C の非同期レシート + notify.dh** にそのまま乗る (新規プロトコル不要)
4. **65 個の高品質 tool が即利用可能** (graphify / LSP / worktree など coding-grade 機能)
5. **隔離・予算・abort** によるリスク管理可能

**最初の MVP は Phase 1+2+3 の 4.5 日**。検証して問題なければ Phase 4+5 を追加で計 6.5 日。

ご review お願いします。承認後、Team を編成して即着手します。
