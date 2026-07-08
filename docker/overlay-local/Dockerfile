# Clean DH-voice image: daoB-local base + clean overlays.
# Includes the FIXED index.ts (DH WS message/close/error listeners registered
# BEFORE startSession, so the browser's MuseTalk offer isn't dropped during the
# qwen-connect window — critical when qwen init is slow, e.g. high-RTT hosts).
FROM itccloudsoft/winclaw-node:daoB-local
COPY control-ui/ /usr/local/lib/node_modules/winclaw/dist/control-ui/
COPY index.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/index.ts
COPY realtime-handler.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/realtime-handler.ts
COPY qwen-realtime.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/integrations/qwen-realtime.ts
