# daoB-intl — daoB-clean + 工具恢复 + 海外部署默认 env(自包含,重建/provision 即用)
#   realtime-handler.ts: lite-voice 下也 setTools(恢复 6 个 agent 工具)
#   ENV: 海外新加坡端点 + lite-voice 中文 prompt + FC 可用的 qwen3.5 模型
# (intl 账号 key 放挂载的 config,不烤进镜像)
FROM itccloudsoft/winclaw-node:daoB-clean
COPY realtime-handler.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/realtime-handler.ts
ENV WINCLAW_DH_DASHSCOPE_HOST=dashscope-intl.aliyuncs.com
ENV WINCLAW_DH_LITE_VOICE=1
ENV WINCLAW_DH_MODEL=qwen3.5-omni-flash-realtime
