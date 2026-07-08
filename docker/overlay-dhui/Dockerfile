# daoB-metacoder-dh — 秘书バックエンド(metacoder/gate/skill-creator)+ 正常な DH avatar UI
# 問題: daoB-metacoder は full npm-pack で control-ui が壊れ、DH パネルが出ずチャットにフォールバック。
# 対処: daoB-intl(overlay 由来=正常)の control-ui で丸ごと置換。バックエンド/秘书机能はそのまま。
FROM itccloudsoft/winclaw-node:daoB-metacoder
RUN rm -rf /usr/local/lib/node_modules/winclaw/dist/control-ui
COPY control-ui /usr/local/lib/node_modules/winclaw/dist/control-ui
