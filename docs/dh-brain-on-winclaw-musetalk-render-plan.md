# 改修方案 — 道B: winclaw を頭脳に、L20 VM(純MuseTalk)を口パク描画専用に

> **目的**: L20 VM が純 MuseTalk 描画API化(Qwen3.5-omni 非搭載)されたのに合わせ、**winclaw 側で Qwen3.5-omni-flash-realtime を回して対話を実行**し、数字人が winclaw の**記憶(memory-core)**と**8つの身分 markdown(SOUL/IDENTITY/USER/AGENTS/TOOLS/HEARTBEAT/BOOTSTRAP/BOOT)**の role 設定を共有できるようにする。
> **参考実装**: `C:\work\digtal-human\autoproject-project\backend`(同じ構成を本番運用中)
> **形態**: 改修方案(レビュー用)。実装は承認後。

---

## 1. なぜ変えるか(現状の構造的限界)

現状の道A(musetalk)は、対話の頭脳が **VM 側**にあり、winclaw は WebRTC offer を中継するだけ([realtime-handler.ts:284-317](../extensions/digital-human/src/realtime-handler.ts) で `qwen=bypassed` し early-return)。そのため winclaw の **役割・記憶・ツールが VM の Qwen に一切渡らない**。

VM が純 MuseTalk 化された今、VM 内に Qwen は無い。**winclaw が頭脳を持たない限り数字人は喋れない**。よって道B(winclaw=頭脳、VM=描画)へ移行する。

---

## 2. 目標アーキテクチャ(autoproject と同型)

```
┌─────────┐  ①mic PCM16k (b64, DH WS)        ┌────────────────────────────────────────┐
│ Browser │ ───────────────────────────────▶ │ winclaw digital-human plugin (頭脳)     │
│         │                                   │  RealtimeSessionHandler                 │
│         │  ⑤ai_audio 24k (再生)            │   └ QwenRealtimeClient                   │
│         │ ◀───────────────────────────────  │       (ASR+LLM+TTS, identity+memory+FC) │
│         │                                   └───────────────┬────────────────────────┘
│         │                                      ②TTS 24k PCM │ (response.audio.delta)
│         │                                                   ▼
│         │                                   ③control_ws へ 4800B フレームで push
│         │                                                   │  wss://avatar.myaiportal.net/ws/{sid}
│         │  ④avatar video (WebRTC, recvonly)                 ▼
│         │ ◀──────────────────────────────  ┌────────────────────────────────────────┐
└─────────┘                                  │ L20 VM 純MuseTalk (input_mode=passthrough)│
                                             │  PCM受領→口パク推論→映像をWebRTCで返す  │
                                             └────────────────────────────────────────┘
```

- **頭脳 = winclaw**(Qwen を自前で実行。役割・記憶・ツール全部 winclaw 管轄)
- **VM = 描画専用**(`input_mode:"passthrough"` のまま。注入 PCM で口パク。LLM/TTS 無し)
- マイク音声は **winclaw 経由**(ブラウザ→DH WS→winclaw Qwen)。**VM には直接送らない**(現状と逆)
- VM への WebRTC は**映像受信専用(recvonly)**になり、マイク publish は外す
- TTS 再生はブラウザの AudioContext(`ai_audio`)で行う(autoproject の既定 ITC-BOTH と同じ)

### autoproject で実証済みの肝(参考 file:line)
- 音声注入: `itc_avatar_client.py:563` `ItcAvatarSession.send_audio_data()` → `await self.ws.send(audio_data)`(生PCM)
- フレーム化: `_DH_MIN_FRAME_SIZE = 4800`(= 100ms @ 24kHz/16bit/mono)。`realtime_handlers.py:450-455` で 4800B 単位に切って `dh.send_audio`
- **24kHz のまま送る(リサンプルしない)**。VM 側が内部で 16kHz に変換。16kにすると 1.5倍遅再生/口パクズレ(`realtime_handlers.py:85-99`)
- 応答終了: バッファ flush 後 `{"type":"audio_end"}` を control_ws に送る(`reset_to_ready`, `itc_avatar_client.py:598`)→ MuseTalk が idle(瞬き/呼吸)へ
- 割り込み: server VAD speech_started で `{"type":"interrupt"}`
- room 作成: `POST /sessions` body `{role_id, input_mode:"passthrough", ttl_seconds}`(`dhsaas_client.py:240`)

---

## 3. 改修箇所(winclaw サーバ側: `extensions/digital-human/src/`)

### 3.1 新規 `integrations/musetalk-audio-sink.ts`(autoproject の `ItcAvatarSession` 相当)
control_ws へ音声を push する薄いクライアント。
- `connect()`: `ws`(npm `ws`)で `controlWs`(例 `wss://avatar.myaiportal.net/ws/{sid}`)へ接続。認証は owner token(query or header。VM の実装に合わせ要確認)
- `sendAudioData(pcm: Buffer)`: 4800B 未満は `\x00` パディング → `ws.send(pcm)`(binary)。内部バッファに貯めて 4800B 単位で送る
- `audioEnd()`: `ws.send(JSON.stringify({type:"audio_end"}))`
- `interrupt()`: `ws.send(JSON.stringify({type:"interrupt"}))`
- `close()`
- **理由**: winclaw の TTS を VM に流す唯一の経路。現状 MuseTalk には winclaw→VM の音声経路が存在しない

### 3.2 `integrations/avatar-provider.ts` — `MuseTalkAvatarProvider.startSession`
- `input_mode: "passthrough"` は**維持**(これが描画専用モード。autoproject も同じ)
- `system_prompt` の送出を**削除**(winclaw が prompt を所有するので不要)
- 戻り値の `controlWs` を**サーバ側で使う**(従来はブラウザ用情報として返すだけだった)
- **理由**: winclaw が control_ws を開いて音声 push するため

### 3.3 `realtime-handler.ts` — バイパス撤去(中核)
現状 [:284-317](../extensions/digital-human/src/realtime-handler.ts) の `if (isMuseTalk) { … return }` を改修:
1. dh-saas session 発行 + `dh_stream_info` 送信(映像用 WebRTC 記述子)は**残す**
2. early-return を**やめ**、以降の **Qwen クライアント構築 + ToolRouter + identity + memory** 配線([:319-464])に**合流**させる
3. 新たに `MuseTalkAudioSink` を `connect()` し、`controlWs`/owner token を渡す
4. `handleQwenAudio(pcm, 24000)`([:809-827])を分岐:
   - musetalk モード: **リサンプルせず** 24kHz のまま `audioSink.sendAudioData(pcm)`(4800B フレーム)+ 任意でブラウザへ `ai_audio` 送信(再生用)
   - byteplus モード: 従来通り(24k→16k リサンプル + `dhSession.sendAudioData`)
5. 応答完了 `onResponseDone`: `audioSink.audioEnd()`
6. 割り込み(server VAD speech_started): `audioSink.interrupt()`
7. `handleAudioMessage(pcm)`: ブラウザ mic → `qwenClient.sendAudio`(qwenClient が存在するので機能する)
- **理由**: winclaw を頭脳にする本体

### 3.4 `realtime-handler.ts` — `handleMuseTalkOffer`(映像用 WebRTC)
- 現状の SDP offer プロキシは**維持**(映像は引き続き VM→ブラウザ WebRTC)
- ただしブラウザ offer が **video recvonly**(mic 無し)になる前提で VM とネゴ。VM 側が mic transceiver を要求しないか要確認(autoproject は WebRTC は映像戻しのみ)

### 3.5 `index.ts` — dispatch
- `audio`/`text`/`video` ケースは既に handler を呼ぶ。qwenClient が存在するようになるので**そのまま機能**
- musetalk モードでも camera の `video` を Qwen に送るか(マルチモーダル)は任意。送らないなら UI 側でカメラ→WS 送出を止める(現状の `handleVideoMessage` クラッシュも解消)

---

## 4. 改修箇所(UI 側: `ui/src/`)

### 4.1 `ui/src/ui/dh-session-controller.ts` — `initMuseTalkViewer`([:360-429])
- **STT recorder を停止しない**([:368-372] の `recorder.stop()` を削除)。winclaw がマイクを必要とするため、`AudioRecorder` → `ws.sendAudio` を**動かし続ける**
- `onAiAudio` のガード([:288] `if (!this.rtcViewer)`)を見直し: musetalk モードでは winclaw TTS をブラウザで再生する必要があるため、viewer があっても `player.playChunk` する(VM の WebRTC 音声は使わない)
- `onAiResponseStarted`/`onAiResponseDone` のミュート制御は有効化(エコー抑制)

### 4.2 `ui/src/lib/musetalk-webrtc-viewer.ts` — `join`([:74-189])
- **マイクを VM に publish しない**([:104-133] の getUserMedia + `addTransceiver(micTrack, sendrecv)` を削除)。winclaw がマイクを所有
- 音声トランシーバは `recvonly`(VM が音声を返さないなら不要)、video は `recvonly`
- DataChannel 'control' は VM の emit ループ起動条件次第。autoproject は control_ws 駆動なので、純描画 VM では **DataChannel 不要の可能性**。要確認(残しても害は少ない)
- 受信した映像のみ `<video>` に描画(音声は AudioStreamPlayer 側で再生)
- **理由**: マイク所有権を winclaw に移し、VM は映像描画専用にする

---

## 5. 身分(8 markdown)と記憶の共有 — ユーザー要件の本丸

### 5.1 身分 8ファイルの読み込み拡張
現状 [identity-loader.ts](../extensions/digital-human/src/identity-loader.ts) は **4つ**(SOUL/IDENTITY/USER/AGENTS)のみ読込。確認済みの実ファイル(`C:\Users\USER\.winclaw\workspace\`):
```
SOUL.md ✅ IDENTITY.md ✅ USER.md ✅ AGENTS.md ✅
TOOLS.md ✅ HEARTBEAT.md ✅ BOOTSTRAP.md ✅ BOOT.md ❌(無し)
```
改修:
- `IdentityLoader.load()` / `WATCHED_FILES` に **TOOLS/HEARTBEAT/BOOTSTRAP(/BOOT)** を追加(各ファイル文字数バジェット設定)
- `instructions-builder.ts`([:33-34] 付近)で FC パスが現状 **USER.md/AGENTS.md を捨てている** → 8ファイルを役割別に instructions に組み込む。`maxInstructionsChars`(既定4000、最大10000)で全体を上限管理
- `IdentityConfigSchema.hotReload` が**未使用**([identity-loader.ts] の `watch()` が呼ばれていない) → handler init で `identityLoader.watch()` を呼び、変更時 `qwenClient.updateInstructions()` で反映
- **理由**: 「8つの markdown の role 設定を共有」= これらを Qwen の instructions に確実に注入

### 5.2 記憶(memory-core)の配線 — 現状は完全に死んでいる
調査結果: **`MemoryBridge` はどこからも生成されておらず、`MemoryCorePlugin` も index.ts から注入されていない**。`recordConversation`/`preloadDays`/`recallTrigger`/`recallTopK` は宣言のみで無効。
改修:
- `index.ts` の `SessionManagerConfig`([:180-186])に **`memory`(MemoryCorePlugin)を注入**
- `realtime-handler.ts` で **`MemoryBridge` を生成**し:
  - セッション開始時 `preloadRecentMemory(preloadDays)` → 直近記憶要約を Qwen instructions に前置
  - `recordUserSpeech`(ASR transcript)/`recordAIResponse`(assistant text)で会話を `workspace/memory/YYYY-MM-DD.md` に記録
  - `memory_search`/`memory_get` ツールを Qwen の function calling に登録(`ToolRouter` 経由。既に枠組みあり)→ `recallTrigger="qwen_recall"` で Qwen が自律 recall
- **理由**: 「winclaw と記憶を共有」= 過去記憶を Qwen に前置 + recall ツール + 会話の記録

---

## 6. config(`config.ts`)
- `dh.musetalk.systemPrompt`: 道B では winclaw が prompt 所有 → **廃止 or 非推奨**(残すなら identity に追記する補助としてのみ)
- `dhMode`(function_calling/legacy)を **musetalk モードでも参照**するように(現状 musetalk は早期 return で `dhMode` 未参照)。既定 `function_calling` で Qwen+FC を使う
- `qwen` ブロックは既存のまま使用(apiKey/model=qwen3.5-omni-flash-realtime/voice=Serena/serverVad)
- `memory`/`identity` ブロックを実際に有効化(§5)

---

## 7. 実装順序(段階)

1. **音声経路の確立**(§3.1 sink + §3.3 handleQwenAudio 分岐 + §3.2 provider)
   → winclaw Qwen の TTS が VM で口パクされることを確認(まず既定の汎用 instructions で「喋る」ことを確認)
2. **マイク所有権の移行**(§4.1/§4.2 UI: recorder 維持 + VM への mic publish 停止)
   → ブラウザ→winclaw→Qwen→VM の双方向対話成立
3. **身分8ファイル**(§5.1)→ 役割が winclaw 定義で反映されることを確認
4. **記憶配線**(§5.2)→ 過去記憶の参照・recall・記録を確認
5. **config 整理 + 後片付け**(§6、camera→WS クラッシュの解消)

各段で実機テスト(`http://127.0.0.1:18789/digital-human`)。

---

## 8. リスク・要確認事項

| 項目 | 内容 |
|---|---|
| **control_ws の認証/プロトコル** | owner token の渡し方(query/header)、binary=PCM・JSON=制御 の仕様を VM 担当に確認(autoproject は `wss://.../ws/{sid}`、binary 生PCM、`{type:audio_end/interrupt/stop}`) |
| **WebRTC の mic 要否** | 純描画 VM が offer に audio sendrecv を要求するか。autoproject は映像戻しのみ。mic publish 停止後にネゴ失敗しないか要確認 |
| **DataChannel 要否** | 旧 VM は control DataChannel で emit 起動。純描画 VM が control_ws 駆動なら DataChannel 不要 |
| **サンプルレート** | TTS は 24kHz のまま送る(リサンプル禁止)。16k 送ると 1.5倍遅・口パクズレ |
| **エコー** | winclaw がマイク所有 → TTS 再生中はマイクをミュート(`onAiResponseStarted`/`Done` の既存制御を有効化) |
| **後方互換** | byteplus モードは一切変更しない(rollback パス温存)。musetalk 分岐のみ改修 |
| **二重音声** | ブラウザ再生(ai_audio)と VM WebRTC 音声の二重を避ける(VM 音声トラックは使わない/inactive) |

---

## 9. 受け入れ基準
- [ ] 数字人が winclaw の Qwen で対話する(VM は口パクのみ、`qwen=bypassed` ログが消える)
- [ ] SOUL/IDENTITY/USER/AGENTS/TOOLS/HEARTBEAT/BOOTSTRAP の role 設定が応答に反映される
- [ ] 過去記憶を参照した応答ができる(preload + recall ツール)、会話が `memory/YYYY-MM-DD.md` に記録される
- [ ] 相手の言語に追従(Qwen instructions の LANGUAGE LOCK で制御)
- [ ] function calling で winclaw のツール(task_run/channel_send 等)が呼べる
- [ ] byteplus モードは無変更で従来通り動く
- [ ] エコー・二重音声・口パクズレが無い

---

## 10. 参考(autoproject 主要 file:line)
- Qwen realtime: `app/integrations/qwen_realtime.py`(`QwenRealtimeClient`:331, `connect/update_session`:686-794, `send_audio`:891, audio out callback:238-247)
- 音声→VM: `app/integrations/itc_avatar_client.py`(`send_audio_data`:563, `reset_to_ready`:598, `_DH_MIN_FRAME_SIZE=4800`:62)
- 音声 out→control_ws 配線: `app/websocket/realtime_handlers.py`(`_on_qwen_audio`:416-479 / device:1507-1617, `_on_qwen_response_done`:490-538)
- room 作成: `app/integrations/dhsaas_client.py`(`start_session`:207-376, payload:240-244)
- instructions/role: `qwen_realtime.py:_build_instructions`:496-676
