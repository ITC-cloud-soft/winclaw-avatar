# Per-session system_prompt 対応 — 改修計画（多言語/人格制御）

> **目的**: winclaw-avatar の数字人 (MuseTalk 道A) で、セッション毎に system_prompt を指定し、対話言語・人格を winclaw 側から制御できるようにする。
> **現状の問題**: winclaw は dh-saas に `role_id` しか渡さず、VM(OpenAvatarChat) のグローバル日本語 prompt（`_inject_jp_prompt.py` 注入）に固定される。
> **対象リポジトリ**: ① OpenAvatarChat (VM), ② dh-saas backend, ③ winclaw-avatar
> **作業形態**: 別 session が実装。本書は実装者向けの完全な指示書。

---

## 0. 背景（なぜ必要か）

### 0.1 現状のアーキテクチャと制約

| システム | 対話 LLM の実行場所 | system_prompt | 言語制御 |
|---|---|---|---|
| **autoproject** (`dh.paripi-erp.com`) | 自前バックエンドで Qwen-Omni を DashScope 直結実行 (`qwen_session_manager.py` → `QwenRealtimeClient` → `dashscope.OmniRealtimeConversation`) | セッション毎に `instructions=device.role.system_prompt` | ✅ 任意言語 |
| **winclaw-avatar** (道A) | VM の OpenAvatarChat が Qwen-Omni を実行 | 渡していない → VM グローバル YAML (`_inject_jp_prompt.py` の日本語) | ❌ 日本語固定 |

autoproject は VM を**口パク描画専用**に使い、LLM は自前で持つため言語を自由に制御できる。
winclaw 道A は対話を VM に委譲したので、**VM 側が per-session prompt を受け付けない限り言語を制御できない**。

### 0.2 根本原因（コードレベル）

dh-saas → VM(worker) の room 作成 (`dh-saas/backend/src/app/integrations/itc_avatar_vm.py:create_room`) が転送するのは:
```python
body = { "role_id", "ttl_seconds", "input_mode" }
if chassis_config: body["chassis_config"] = chassis_config  # ロボット制御用 opaque のみ
```
→ **`system_prompt` を渡す経路が存在しない**。

VM の OpenAvatarChat handler (`_inject_jp_prompt.py` で改修済み) は:
```python
if getattr(context.config, "system_prompt", ""):
    session_update_params["instructions"] = context.config.system_prompt
```
→ `context.config` は**グローバル worker YAML**。per-session ではない。

### 0.3 ゴール

3 層に `system_prompt` (per-session) の経路を新設し、winclaw が session 作成時に渡せるようにする:
```
winclaw (session作成 body に system_prompt)
   → dh-saas SessionCreate schema に system_prompt 追加
   → create_room body に転送
   → VM /api/v1/rooms が per-room system_prompt を受領
   → OpenAvatarChat が当該 room の Qwen instructions に適用 (グローバル YAML より優先)
```

**設計原則**: 後方互換。`system_prompt` 未指定時は現行通りグローバル YAML にフォールバック。

---

## 1. 改修対象① — OpenAvatarChat (VM 上)

> 場所: BytePlus HK VM `150.5.135.24:8282` 上の `/data/openavatarchat/`
> 参考: 既存の `dh-saas/byteplus-vm/_inject_jp_prompt.py` が触っている同じファイル群

### 1.1 `/api/v1/rooms` ハンドラ — per-room system_prompt 受領

**ファイル**: OpenAvatarChat の room 作成 API（`src/.../rooms` ルーター。`_inject_jp_prompt.py` が触る `llm_handler_qwen_omni.py` の近辺、または FastRTC server の room エンドポイント）

**変更内容**:
- `POST /api/v1/rooms` のリクエストボディに **`system_prompt: Optional[str] = None`** を受け付ける
- room/session のコンテキストに保存（`room.system_prompt` 等）
- **理由**: dh-saas が per-session で渡す prompt をこの room に紐づけるため

### 1.2 Qwen-Omni handler — per-room prompt をグローバルより優先

**ファイル**: `/data/openavatarchat/src/handlers/llm/qwen_omni/llm_handler_qwen_omni.py`
（`_inject_jp_prompt.py` が `system_prompt` config field と `session_update_params["instructions"]` を追加済みの箇所）

**現状コード** (inject 後):
```python
if getattr(context.config, "system_prompt", ""):
    session_update_params["instructions"] = context.config.system_prompt
```

**変更後**:
```python
# per-room (per-session) prompt があれば最優先、無ければグローバル YAML
room_prompt = getattr(context, "room_system_prompt", "") or ""
global_prompt = getattr(context.config, "system_prompt", "") or ""
effective = room_prompt or global_prompt
if effective:
    session_update_params["instructions"] = effective
```
- `context.room_system_prompt` は 1.1 で room 作成時に保存した値
- **理由**: per-session 指定があればそれを使い、無ければ従来のグローバル日本語にフォールバック（後方互換）

### 1.3 デプロイ
- `_inject_jp_prompt.py` と同じ要領（src bind-mount で CUDA リビルド不要）
- OpenAvatarChat コンテナ再起動 → `enable_batch_scheduler=true` を維持確認
- 各ファイルは編集前に `.bak` バックアップ（既存スクリプトの慣習に倣う）

### 1.4 検証（VM 単体）
```bash
# room 作成時に system_prompt を渡して、Qwen がその言語で応答するか
curl -k -X POST https://150.5.135.24:8282/api/v1/rooms \
  -H "Authorization: Bearer <worker_api_key>" -H "X-Itc-Avatar-Appid: <appid>" \
  -H "Content-Type: application/json" \
  -d '{"role_id":"role_t_99b9_227f9afd","system_prompt":"You are an English-speaking assistant. Always respond in English.","ttl_seconds":900,"input_mode":"passthrough"}'
# → その後 WebRTC で繋いで英語で話すか確認
```

---

## 2. 改修対象② — dh-saas backend

> 場所: `C:\work\digtal-human\dh-saas\backend\src\app`

### 2.1 `SessionCreate` schema に system_prompt 追加

**ファイル**: `schemas/__init__.py` (L184 付近)

**現状**:
```python
class SessionCreate(BaseModel):
    role_id: str
    ttl_seconds: int = 900
    input_mode: str = "passthrough"
    chassis_config: Optional[Any] = Field(default=None, ...)
```

**変更後** — フィールド追加:
```python
class SessionCreate(BaseModel):
    role_id: str
    ttl_seconds: int = 900
    input_mode: str = "passthrough"
    chassis_config: Optional[Any] = Field(default=None, ...)
    system_prompt: Optional[str] = Field(
        default=None,
        description=(
            "Per-session LLM system prompt override. When provided, the Worker "
            "(OpenAvatarChat) uses it as Qwen-Omni instructions instead of the "
            "global YAML default. Lets the caller control dialogue language / persona."
        ),
    )
```
- **理由**: API 入口で per-session prompt を受け取る

### 2.2 `itc_avatar_vm.create_room` に system_prompt 転送

**ファイル**: `integrations/itc_avatar_vm.py` (L69 `create_room`)

**変更後**:
```python
async def create_room(
    self,
    role_id: str,
    ttl_seconds: int = 900,
    input_mode: str = "passthrough",
    chassis_config: dict[str, Any] | None = None,
    system_prompt: str | None = None,   # NEW
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "role_id": role_id,
        "ttl_seconds": ttl_seconds,
        "input_mode": input_mode,
    }
    if chassis_config is not None:
        body["chassis_config"] = chassis_config
    if system_prompt:                    # NEW: only forward when non-empty
        body["system_prompt"] = system_prompt
    ...  # 以降同じ
```
- **理由**: VM の `/api/v1/rooms`（改修①）へ転送する

### 2.3 `create_session` で system_prompt を引き渡す

**ファイル**: `api/v1/sessions.py` (L73 `create_room` 呼び出し)

**変更後**:
```python
vm_resp = await client.create_room(
    worker_role_id,
    body.ttl_seconds,
    body.input_mode,
    chassis_config=body.chassis_config,
    system_prompt=body.system_prompt,   # NEW
)
```
- **理由**: API 入口で受けた system_prompt を VM まで流す

### 2.4 検証（dh-saas 経由）
```bash
curl -X POST https://dh-saas-control-plane.azurewebsites.net/api/v1/sessions \
  -H "Authorization: Bearer tk_..." -H "Content-Type: application/json" \
  -d '{"role_id":"role_t_99b9_227f9afd","input_mode":"passthrough","system_prompt":"Always respond in English."}'
# → session 作成成功 + その後の対話が英語になるか
```

---

## 3. 改修対象③ — winclaw-avatar

> 場所: `C:\work\winclaw-avatar\extensions\digital-human`

### 3.1 config に systemPrompt（または言語）設定を追加

**ファイル**: `src/config.ts` の `dh.musetalk` schema

**変更後**:
```ts
musetalk: z.object({
  dhsaasUrl: z.string().default(""),
  tenantToken: z.string().default(""),
  defaultRoleId: z.string().default(""),
  // NEW: per-session system prompt (language / persona control)
  systemPrompt: z.string().default(""),
}).prefault({}),
```
`winclaw.plugin.json` にも同フィールドをミラー。
- **理由**: 運用者が winclaw.json で対話言語/人格を指定できるようにする
- **推奨デフォルト**（多言語自動）: 空のままなら従来通り VM デフォルト。設定例として「相手の言語に合わせて返答」プロンプトを用意

### 3.2 MuseTalkAvatarProvider が system_prompt を送る

**ファイル**: `src/integrations/avatar-provider.ts` (L119 の body)

**現状**:
```ts
body: JSON.stringify({
  role_id: roleId,
  ttl_seconds: 900,
  input_mode: "passthrough",
}),
```

**変更後**:
```ts
body: JSON.stringify({
  role_id: roleId,
  ttl_seconds: 900,
  input_mode: "passthrough",
  ...(this.systemPrompt ? { system_prompt: this.systemPrompt } : {}),
}),
```
- `this.systemPrompt` は config から注入（`createAvatarProvider` で `config.dh.musetalk.systemPrompt` を渡す）
- **理由**: dh-saas（改修②）へ per-session prompt を渡す

### 3.3 （将来）SOUL.md / IDENTITY.md から生成

Stage 2 として、winclaw の avatar persona (SOUL.md/IDENTITY.md) を system_prompt に変換して渡せば、**winclaw の人格と VM 対話の人格が一致**する。今回はまず config 文字列で OK。

### 3.4 検証
```
winclaw.json: dh.musetalk.systemPrompt = "Always respond in the user's language."
→ winclaw 起動 → DH 開始 → 中国語で話すと中国語、英語で話すと英語で返る
```

---

## 4. 実装順序（依存関係）

```
① OpenAvatarChat (VM)  ← 最初。これが無いと②③を送っても無視される
        ↓ 検証 1.4 (VM単体で system_prompt が効くか)
② dh-saas backend       ← VM が受けられるようになってから
        ↓ 検証 2.4 (dh-saas経由で効くか)
③ winclaw-avatar        ← 最後。経路が通ってから送り始める
        ↓ 検証 3.4 (winclaw から言語制御できるか)
```

**重要**: ① → ② → ③ の順。逆順だと「送っているのに無視される」状態になり切り分け困難。各段階で検証コマンドを実行してから次へ。

---

## 5. 後方互換・リスク

| 項目 | 対策 |
|---|---|
| 既存セッション（system_prompt 無し） | 全層で `if system_prompt` ガード。未指定なら従来のグローバル YAML にフォールバック |
| autoproject への影響 | autoproject は VM の dh-saas session 経路を**対話に使っていない**（自前 Qwen）。影響なし |
| VM グローバル日本語 prompt | 残置。per-session 指定が無い限り従来通り |
| CUDA リビルド | 不要（src bind-mount、`_inject_jp_prompt.py` と同手法） |
| `enable_batch_scheduler` | 改修後も `true` 維持を確認（false だと別 avatar 化） |

---

## 6. 推奨 system_prompt（多言語自動）

winclaw.json に設定する推奨値（言語自動追従 + 簡潔）:
```
You are a warm, concise voice companion. ALWAYS reply in the SAME language the
user speaks (Japanese/Chinese/English/etc). Within one reply use only that
language's words and pronunciation — do not mix languages. Keep replies to 1-2
sentences, conversational and natural. Proper nouns may stay in their original form.
```
（日本語固定をやめ、相手の言語に自動追従。winclaw-avatar の Qwen FC 版で実績のある「STRICT LANGUAGE」方針と同じ）

---

## 6.5 実装ステータス（2026-06-19 時点）

| 層 | 状態 | 備考 |
|---|---|---|
| ② dh-saas | ✅ **完了** | schema / create_room / create_session の3箇所を後方互換改修。v3.25-l20 デプロイ済。autoproject 挙動不変を確認。ロールバック手順はメモリに記録 |
| ③ winclaw | ✅ **完了** | `config.ts` + `winclaw.plugin.json` に `dh.musetalk.systemPrompt` 追加、`avatar-provider.ts` が空でなければ `system_prompt` を session body に同梱。ユニットテスト10件通過（後方互換含む）。**未ビルド/未デプロイ**（VM① 完了後にまとめて tarball 化推奨） |
| ① VM (OpenAvatarChat) | ⏳ 未着手 | これが入るまでは ③ が prompt を送っても VM が無視（無害・後方互換） |

**エンドツーエンド有効化の残作業**:
1. VM① 実装（§1）
2. `winclaw.json` の `dh.musetalk.systemPrompt` に §6 推奨プロンプトを設定
3. winclaw 再ビルド → tarball → 管理者 PowerShell で再インストール → `winclaw gateway`

## 7. 受け入れ基準

- [ ] VM: `/api/v1/rooms` に `system_prompt` を渡すと当該 room の Qwen がその指示に従う（検証 1.4）
- [ ] dh-saas: `/api/v1/sessions` の `system_prompt` が VM まで届く（検証 2.4）
- [ ] winclaw: `winclaw.json` の `dh.musetalk.systemPrompt` で対話言語が変わる（検証 3.4）
- [ ] system_prompt 未指定時は従来通り（後方互換）
- [ ] 中国語・英語・日本語で話しかけ、それぞれの言語で応答する（多言語自動 prompt 使用時）

---

## 8. 各リポジトリの担当 session への引き継ぎ要点

- **VM 担当**: `_inject_jp_prompt.py` を参考に、per-room override を追加（§1）。`llm_handler_qwen_omni.py` と rooms ハンドラ。バックアップ必須。
- **dh-saas 担当**: schema + create_room + create_session の 3 箇所（§2）。後方互換ガード必須。
- **winclaw 担当**: config + avatar-provider の 2 箇所（§3）。`createAvatarProvider` への systemPrompt 注入を忘れずに。

全 3 層が揃って初めて機能する。**①から順に**、各層の検証コマンドで疎通を確認しながら進めること。
