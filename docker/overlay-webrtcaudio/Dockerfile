# =============================================================================
# webrtcAudio overlay — thin layer on the known-good daoB-local image.
# =============================================================================
# WHY an overlay (not a full npm-pack rebuild):
#   A full rebuild from the working tree swaps EVERY file — including the
#   digital-human EXTENSION backend (index.ts / realtime-handler.ts / ws-routes
#   .ts) which currently carries unfinished WIP. Shipping that WIP broke the DH
#   page (the panel stopped mounting → it rendered the chat composer instead).
#   The 方案1 change lives ONLY in the built UI (dist/control-ui), so we layer
#   just that one directory on top of daoB-local and leave its proven core +
#   extension untouched. This mirrors how daoB-local itself was assembled.
#
# Build context must contain ./control-ui (a fresh `vite build` of ui/, i.e.
# the repo's dist/control-ui, carrying the ?webrtcAudio=1 toggle).
# Build ON the VM, where the daoB-local base image exists locally:
#   docker build -t itccloudsoft/winclaw-node:daoB-webrtcaudio3 .
FROM itccloudsoft/winclaw-node:daoB-local

# Overlay the rebuilt control UI (adds the webrtcAudio gesture-unmute path).
# COPY merges over the existing dir; index.html now points at the new bundle.
COPY control-ui/ /usr/local/lib/node_modules/winclaw/dist/control-ui/
