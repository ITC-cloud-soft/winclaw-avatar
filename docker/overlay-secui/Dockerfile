# daoB-secui — daoB-metacoder-dh + 数字人秘书 A案 UI(docs/10 §4.2/§14.5)
#  1) 新 control-ui(secretary-panel 右3段 + 顶栏削除 + 身份桥 fetch)で置換
#  2) サーバ側 CSP connect-src に ai-meta(localhost 任意ポート)追加(節点 UI が /files /tasks を叩く)
FROM itccloudsoft/winclaw-node:daoB-metacoder-dh
RUN rm -rf /usr/local/lib/node_modules/winclaw/dist/control-ui
COPY control-ui /usr/local/lib/node_modules/winclaw/dist/control-ui
RUN sed -i 's#https://\*\.volces\.com#https://*.volces.com http://localhost:* http://127.0.0.1:*#g' /usr/local/lib/node_modules/winclaw/dist/gateway-cli-*.js
