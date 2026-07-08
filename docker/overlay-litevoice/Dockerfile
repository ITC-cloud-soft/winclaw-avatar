# lite-voice + tunable-VAD overlay on the webrtcaudio3 image (which itself is
# daoB-local + control-ui). Swaps only the two DH extension source files; all
# changes are env-gated (WINCLAW_DH_LITE_VOICE / WINCLAW_DH_VAD_MS), so with no
# envs set the behavior is identical to daoB-local.
FROM itccloudsoft/winclaw-node:daoB-webrtcaudio3
COPY realtime-handler.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/realtime-handler.ts
COPY qwen-realtime.ts /usr/local/lib/node_modules/winclaw/extensions/digital-human/src/integrations/qwen-realtime.ts
