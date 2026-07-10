# daoB-secui — daoB-metacoder-dh + 数字人秘书 A案 UI(docs/10 §4.2/§14.5)
#  1) 新 control-ui(secretary-panel + 身份桥 + 成果物 preview + avatar オンデマンド
#     + 語音 UI 制御 ui_action + 数字人 room 能動解放)で置換
#  2) DH プラグイン src を差し替え:
#     - index.ts       : 成果物配信 + avatar_pause/resume + WS dead-connection 検知
#     - realtime-handler.ts : avatar オンデマンド + 語音 UI 制御の確定的兜底(_tryVoiceUiIntent)
#     - integrations/avatar-provider.ts : stop() で dh-saas room を能動 DELETE(全 minted 解放)
#     - tools/catalog.ts : ui_action ツール(subtitle/fullscreen/voice 追加)
#  3) サーバ側 CSP / iframe 埋込ヘッダを patch(内嵌 iframe 解禁)
#
# ★レイヤ順序: 高頻変更(control-ui / dh-src)を末尾へ、静的で高コストな
#   playwright+chromium / skills / CSP patch を先頭へ置き、UI/src だけの再ビルドで
#   chromium レイヤをキャッシュ再利用できるようにしている。
FROM itccloudsoft/winclaw-node:daoB-metacoder-dh

# ---- 静的・高コスト層(base にのみ依存 → UI/src 変更で再実行されない)----
# O1 技能化: 高頻タスク generate_pdf を確定性 skill(pdf-report)へ固定。
#  ★playwright + chromium を事前導入(metacoder が turn 内で ~150MB chromium を現装 →
#    ~10 分/クラッシュの主因を回避)。render.py は playwright.sync_api を使う。
RUN pip3 install --no-cache-dir --break-system-packages playwright \
 && python3 -m playwright install --with-deps chromium \
 && rm -rf /root/.cache/pip
COPY skills-pdf-report /usr/local/lib/node_modules/winclaw/skills/pdf-report
# excel-fill 技能: テンプレ xlsx への確定性記入(合併セル→アンカー解決 + 保存後検証 +
#  全ファイル all-or-nothing + 失敗時 非ゼロ終了)。agent の openpyxl 現写事故(合併セル
#  例外握り潰し→空欄成果物・偽 done)を根絶。openpyxl は base に在るが保険で明示導入。
RUN pip3 install --no-cache-dir --break-system-packages openpyxl && rm -rf /root/.cache/pip
COPY skills-excel-fill /usr/local/lib/node_modules/winclaw/skills/excel-fill
RUN sed -i 's#for s in doc-extract research skill-creator;#for s in doc-extract research skill-creator pdf-report excel-fill;#' \
      /usr/local/bin/entrypoint-node.sh
# サーバ側 CSP / iframe 埋込ヘッダ patch:
#  - connect-src に ai-meta(localhost 任意ポート)+ *.myaiportal.net
#  - img-src / frame-src に blob:(成果物 preview の画像/PDF)
#  - frame-ancestors を ai-meta オリジン許可へ / X-Frame-Options: DENY 除去
RUN sed -i \
  -e 's#https://\*\.volces\.com#https://*.volces.com http://localhost:* http://127.0.0.1:* https://*.myaiportal.net#g' \
  -e "s#img-src 'self' data: https:#img-src 'self' data: https: blob:#g" \
  -e "s#frame-ancestors 'none'#frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000 https://meta.myaiportal.net https://*.myaiportal.net; frame-src 'self' blob: data:#g" \
  -e 's#res.setHeader("X-Frame-Options", "DENY");##g' \
  /usr/local/lib/node_modules/winclaw/dist/gateway-cli-*.js
# 音乐 bundle: <audio> が跨域音乐 CDN(网易 m*.music.126.net / joox 等)から MP3 を
#  読むには CSP に media-src が要る。既定は default-src 'self' フォールバックで **媒体が
#  ブロックされ再生できない**(「已暂停」の真因)。media-src を追加(PoC は https 広めに許可)。
RUN sed -i \
  -e "s#img-src 'self' data: https: blob:#img-src 'self' data: https: blob:; media-src 'self' https: data: blob:#g" \
  /usr/local/lib/node_modules/winclaw/dist/gateway-cli-*.js

# 日本語 漢字→仮名読み(kuromoji.js 形態素解析)を DH 拡張へ導入。
#  qwen3-omni-flash TTS は共有漢字を中国語読みする(新橋→xinqiao / 住所→zhusuo)ため、
#  TTS 前に kuromoji で任意漢字を読み(カタカナ)へ変換し発音を確定させる。dict 同梱(~15MB)。
#  ★静的層(dh-src 変更で再実行されない位置)に置きキャッシュ再利用。
RUN cd /usr/local/lib/node_modules/winclaw/extensions/digital-human \
 && npm install --no-audit --no-fund --save kuromoji@0.1.2 \
 && rm -rf /root/.npm

# ★pdf.worker.mjs 補完: coding-engine の index.mjs は同ディレクトリの `./pdf.worker.mjs`
#   を import するが、winclaw dist 同梱漏れで **dist/coding-engine/pdf.worker.mjs が無く**、
#   PDF 回読/検証が "Cannot find module .../pdf.worker.mjs" で失敗 → タスクが成果物(PDF)を
#   生成しても "回読検証" で落ち **完了マークされず running のまま**になる(実測: NVIDIA
#   財務分析タスク)。pdfjs-dist の実体を coding-engine 直下へ配置し import を解決する。
# ★版本一致(2026-07-10 修正): node_modules の pdfjs-dist は 5.7.284 だが、coding-engine が
#   **内联している pdfjs API は 5.4.296**。前は node_modules の worker(5.7.284)を貼っていた為、
#   PDF 回読で "API version 5.4.296 does not match Worker version 5.7.284" で落ち、タスクが
#   PDF を生成しても検証で失敗し**完了しない**(実機 NVIDIA 財務報告)。coding-engine の API に
#   **正確に一致する 5.4.296 の worker** を /tmp へ pin install して貼る(node_modules は不変)。
RUN cd /tmp && npm init -y >/dev/null 2>&1 \
 && npm install --no-audit --no-fund --no-save pdfjs-dist@5.4.296 \
 && cp /tmp/node_modules/pdfjs-dist/build/pdf.worker.mjs \
       /usr/local/lib/node_modules/winclaw/dist/coding-engine/pdf.worker.mjs \
 && node -e "const s=require('fs').readFileSync('/usr/local/lib/node_modules/winclaw/dist/coding-engine/pdf.worker.mjs','utf8'); if(!s.includes('5.4.296')) throw new Error('pdf.worker version mismatch — expected 5.4.296'); console.log('pdf.worker pinned to 5.4.296 OK')" \
 && rm -rf /tmp/node_modules /tmp/package.json /tmp/package-lock.json /root/.npm \
 && ls -la /usr/local/lib/node_modules/winclaw/dist/coding-engine/pdf.worker.mjs

# ---- 高頻変更層(control-ui / dh-src)は末尾 → chromium レイヤを再利用 ----
# cachebust: --build-arg で毎回変え、control-ui/dh-src の COPY を確実に再実行させる
# (BuildKit の COPY 層キャッシュが稀に誤再利用し dh-src 変更が反映されない事象の対策)。
ARG DHSRC_BUST=0
RUN echo "dh-src cachebust=${DHSRC_BUST}" > /tmp/.dhsrc_bust
RUN rm -rf /usr/local/lib/node_modules/winclaw/dist/control-ui
COPY control-ui /usr/local/lib/node_modules/winclaw/dist/control-ui
COPY dh-src/ /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/
