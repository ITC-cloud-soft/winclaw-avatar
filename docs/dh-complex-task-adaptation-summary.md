# 复杂任务适应改造 + 数字人プラグイン復活 — 改修・検証総括

> 作成: 2026-06-29 / 対象: winclaw-avatar(Docker node 镜像)+ ai-meta-poc(node provisioner)
> 目的: winclaw-asr の「metacoder 复杂任务 playbook」を winclaw-avatar 版へ移植し、AGENTS.md を ai-meta-poc のコード+DB に反映。併せて数字人(musetalk)プラグインの欠落を修復。
> 参考: `C:/work/winclaw-asr/docs/metacoder-complex-task-playbook.md`, `doc-extract-skill-proposal.md`
> 関連 skill: `winclaw-metacoder-webchat`, `byteplus-l20-vm` / memory: `metacoder-complex-task-adapt`, `metacoder-docker-image-bake`

---

## 1. 概要(3層 + ai-meta-poc 反映 + DH 復活)

| 層 | 内容 | 置き場所 |
|---|---|---|
| ① 引擎 | metacoder idle-timeout 60s→**600s**(大生成の誤殺防止) | winclaw-avatar 镜像(dist) |
| ② skill | **doc-extract**(二進文書→テキスト, 去重+体積制御)+ **research**(研究編排) | 镜像に焼込 + workspace 展開 |
| ④ 依存 | python doc libs(PyMuPDF/python-pptx/python-docx/openpyxl) | Dockerfile |
| ⑤ 配線 | `skills.load.extraDirs` を entrypoint 生成 config に追加 | entrypoint |
| ③ 行動制約 | **AGENTS.md**(通用执行纪律 + 业务 playbook 4領域8skill + 研究强制流程 铁律1-6) | **ai-meta-poc コード(seed_personas.py)+ DB(aimeta.db)** |
| 追加 | **数字人プラグイン復活**(entrypoint マージが persist の `plugins` を落としていた回帰の修正) | entrypoint |

実装はマルチエージェント workflow(PM→並列コーダー3→レビュー→テスト)。idle600 パッチ/repack/rebuild/DB/再デプロイはメインが直列実施。

---

## 2. 具体的な変更点

### 2.1 winclaw-avatar 镜像(engine 層)
- **`dist/coding-engine/index.mjs`**: SSE `__idle` 守卫の `setTimeout(... , 60000)` → **`600000`**(1箇所)。
- **`docker/skills/doc-extract/{SKILL.md, extract.py}` + `docker/skills/research/SKILL.md`**(新規): winclaw-asr から verbatim。`extract.py` は stem 去重 + `--max-chars`(既定6000)+ temp/SOURCE.md スキップの実版。
- **`docker/Dockerfile.node.daoB`**:
  - `pip3 install --break-system-packages PyMuPDF python-pptx python-docx openpyxl` 追加。
  - `COPY docker/skills /home/winclaw/.metacoder/skills` + chown(engine の user skills dir = `CLAUDE_CONFIG_DIR=/home/winclaw/.metacoder`)。
- **`docker/entrypoint-node.sh`**:
  - jq 生成 config に `skills: { load: { extraDirs: ["/home/winclaw/.metacoder/skills"], watch: true } }`。
  - gateway 起動前に `cp -rn /home/winclaw/.metacoder/skills/* $WINCLAW_DIR/workspace/.claude/skills/`(AGENTS.md の相対パス `.claude/skills/doc-extract/extract.py` を成立させる)。
  - **persist マージに `plugins: (.[1].plugins // .[0].plugins)` 追加**(回帰修正。これが無いと再作成のたびに数字人プラグインが消える)。

### 2.2 ai-meta-poc(AGENTS.md → コード+DB)
- **`backend/scripts/agents_md_template.txt`**(新規, ~19KB): 最終 AGENTS.md(companion 人格 `{{call_user}}` 保持 + 執行紀律 + 业务 playbook + 研究强制流程)。コンテナ用に研究コマンドを `python .claude/skills/doc-extract/extract.py --batch "<dir>" --out "<dir>/SOURCE.md"`(正斜杠・workspace 相対)へ調整。
- **`backend/scripts/seed_personas.py`**:
  - `_COMMON_AGENTS` を `agents_md_template.txt` から読込(空/欠落時は fallback)。
  - `upsert_builtin_personas` を**既存 builtin の `agents_md` のみ上書き**に変更(他の md 列は温存)。
- **DB `backend/aimeta.db`**: seeder 実行で `persona_templates.agents_md`(builtin 4: lover/bestie/sister/mentor)を更新。

> 仕組み: 各ノードの AGENTS.md は ai-meta-poc の DB → workspace マウントで供給。新規ノードは自動、既存は reinject で反映。

### 2.3 镜像 / レジストリ
- `winclaw-node:daoB-metacoder`、`itccloudsoft/winclaw-node:daoB-metacoder`、**`itccloudsoft/winclaw-node:latest`**(provisioner が `config.py:84 WINCLAW_NODE_IMAGE` で latest 参照のため retag+push)。最終 digest `f87789c…`。

---

## 3. 検証の動作と結果

### 3.1 ビルド時検証(構文/コンパイル)
| 項目 | 結果 |
|---|---|
| `node --check dist/coding-engine/index.mjs`(idle600 後) | ✅ OK |
| `python -m py_compile docker/skills/doc-extract/extract.py` | ✅ OK |
| `bash -n docker/entrypoint-node.sh` | ✅ OK |
| jq 生成 config の妥当性(skills/plugins ブロック) | ✅ OK |
| `py_compile seed_personas.py` | ✅ OK |
| workflow レビュー / テスト | ✅ APPROVE / 全 PASS |

### 3.2 镜像内検証(`docker run --entrypoint sh`)
| 項目 | 結果 |
|---|---|
| `grep -c "__idle: true }), 600000"` | ✅ 1 |
| `ls /home/winclaw/.metacoder/skills` | ✅ doc-extract, research |
| `python3 -c "import fitz,pptx,docx,openpyxl"` | ✅ pylibs OK |

### 3.3 DB 検証(ai-meta-poc)
| 項目 | 結果 |
|---|---|
| seeder 実行(`PYTHONPATH=. .venv/Scripts/python.exe scripts/seed_personas.py`) | ✅ created=0 **updated=4** |
| builtin 4種 agents_md 長さ / doc-extract / 相対パス / `{{call_user}}` | ✅ 各 10477 / True / True / True |

### 3.4 ローカル(localhost:18799)エンドツーエンド検証
研究タスク「研究 data 目录里的资料，产出 summary.html」を送信:
| 検証 | 結果 |
|---|---|
| metacoder ルーティング | ✅ `routing coding turn ... model=glm-5.2` |
| **doc-extract 強制発火** | ✅ `data/SOURCE.md` 生成(`# SOURCE (2 files, max 6000 chars/file)` ヘッダ + ops.md/spec.md 取込) |
| **真実資料ベース産出** | ✅ `summary.html` に固有値 **Falcon9 / 300 / 99.3**(捏造でなく SOURCE.md 由来) |
| idle600 効果 | ✅ ~85秒で完走、idle abort 無し |
| transcript 永続化 | ✅ `persisted transcript: chars=270`(webchat 表示) |
| 3層(idle/skills/AGENTS) コンテナ内 | ✅ workspace/.claude/skills 展開 + AGENTS.md 19142B + config(codingEngine/skills.extraDirs/model) |

### 3.5 L20 VM(150.5.135.24)検証
| 項目 | 結果 |
|---|---|
| 新镜像 pull + AGENTS.md 配置 + winclaw_lc 再作成 | ✅(旧版 `winclaw_lc_bak_pretask2` 退避) |
| 3層(idle600 / .claude/skills / AGENTS.md / pylibs / config) | ✅ |
| **数字人プラグイン復活**(`plugins` merge 修正後) | ✅ `dh plugin: true, provider: musetalk` |
| DH WS 18790 到達性 | ✅ `curl http://172.17.0.2:18790/` → **426**(WebSocket Upgrade) |
| コンテナ IP = Caddy 上流 172.17.0.2 | ✅ 一致 |
| `https://150.5.135.24:18999/digital-human`(Caddy) | ✅ 200 |
| `https://150.5.135.24:18999/chat`(metacoder) | ✅ 経路確立 |

---

## 4. 踏んだ落とし穴 / knowhow

1. **`npm pack` の prepack が dist を再ビルドしてパッチを消す** → `npm pack --ignore-scripts` で回避(idle600 等のパッチ入り tgz を作る)。
2. **entrypoint マージが persist の `plugins` を落として数字人が消える** → マージに `plugins` 継承を追加(回帰修正)。`skills`/`agents` も generated 側を保持する設計に注意。
3. **Caddy(/tmp/Caddyfile)は winclaw_lc を docker IP `172.17.0.2` 固定で上流参照** → 再作成時に同 IP(bridge 先頭)を取れるか要確認。DH WS も `@dhws → 172.17.0.2:18790`。
4. **最小イメージで `ss`/`netstat` が機能せず誤検知** → ポート確認は `curl http://<ip>:<port>/`(DH WS は 426=Upgrade Required が正常)。
5. **`localhost` での https テストは SNI 不一致で 000** → Caddy サイトは `150.5.135.24` ホスト名バインド。実ホスト名でテストする。
6. **provisioner は `:latest` 参照**(`backend/app/core/config.py:84`)→ 新規ノードに engine 層を載せるには新镜像を `:latest` に retag+push(or `WINCLAW_NODE_IMAGE` 変更)。AGENTS.md(③)は DB 経由で別途自動反映。
7. **AGENTS.md は ai-meta-poc DB(`persona_templates.agents_md`)→ workspace マウント**で供給。镜像は AGENTS.md に非依存。既存 companion は reinject で再適用。

---

## 5. 状態と残作業

- ✅ winclaw-avatar 镜像(①②④⑤ + DH plugin merge 修正)ビルド+push(daoB-metacoder / latest)。
- ✅ ai-meta-poc コード(seed_personas.py + agents_md_template.txt)+ DB(builtin 4種)更新。
- ✅ ローカル(18799)e2e 検証、VM(18999)再デプロイ + 数字人プラグイン復活 + 構造検証。
- ⏳ **数字人 実機テスト**(18999/digital-human で表示・対話・口パク)— ユーザー実施待ち。
- ⏳ **複雑タスク 実機テスト**(18999/chat で研究/コーディング)— 数字人テスト後。
- ⏳ ローカル winclaw_local を同 plugins-merge 修正镜像へ揃える(任意)。
- 退避コンテナ `winclaw_lc_bak_pretask` / `_pretask2` / `_premetacoder` は安定確認後に削除可。
