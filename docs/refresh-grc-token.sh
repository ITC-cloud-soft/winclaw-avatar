#!/bin/bash
# =============================================================================
# refresh-grc-token.sh
#
# Refreshes the WinClaw GRC JWT token before it expires (24h lifetime).
# Reads GRC URL from winclaw.json, calls /auth/anonymous, updates token.
#
# Usage:
#   bash refresh-grc-token.sh                    # auto-detect GRC URL from config
#   bash refresh-grc-token.sh http://localhost:3100  # explicit GRC URL
#
# Install as cron (every 22 hours):
#   winclaw cron add --name grc-token-refresh --every 22h \
#     --exec "bash /path/to/refresh-grc-token.sh"
#
# Or via system crontab:
#   0 */22 * * * bash /c/work/winclaw-avatar/docs/refresh-grc-token.sh >> /tmp/grc-refresh.log 2>&1
#
# =============================================================================

WINCLAW_JSON="${WINCLAW_CONFIG:-$HOME/.winclaw/winclaw.json}"

# Windows path compatibility
if [ -f "C:/Users/$USERNAME/.winclaw/winclaw.json" ]; then
  WINCLAW_JSON="C:/Users/$USERNAME/.winclaw/winclaw.json"
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# ---------------------------------------------------------------------------
# Step 1: Resolve GRC URL
# ---------------------------------------------------------------------------
GRC_URL="${1:-}"

if [ -z "$GRC_URL" ]; then
  GRC_URL=$(python3 -c "import json; print(json.loads(open('$WINCLAW_JSON',encoding='utf-8').read()).get('grc',{}).get('url',''))" 2>/dev/null)
fi

if [ -z "$GRC_URL" ]; then
  log "ERROR: No GRC URL found. Pass as argument or set grc.url in winclaw.json"
  exit 1
fi

log "GRC URL: $GRC_URL"

# ---------------------------------------------------------------------------
# Step 2: Check current token
# ---------------------------------------------------------------------------
REMAINING=$(python3 -c "
import json,time,base64
j=json.loads(open('$WINCLAW_JSON',encoding='utf-8').read())
t=j.get('grc',{}).get('auth',{}).get('token','')
if t and '.' in t:
  p=t.split('.')[1]+'='*(4-len(t.split('.')[1])%4)
  d=json.loads(base64.b64decode(p))
  print(f'{(d.get(\"exp\",0)-time.time())/3600:.1f}')
else:
  print('-999')
" 2>/dev/null)

log "Current token: ${REMAINING}h remaining"

if python3 -c "exit(0 if float('$REMAINING') > 2 else 1)" 2>/dev/null; then
  log "Token still valid (>2h), skipping refresh"
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 3: Get fresh token via anonymous auth
# ---------------------------------------------------------------------------
log "Refreshing GRC token..."

RESULT=$(python3 << PYEOF
import json, hashlib, platform, uuid, urllib.request, urllib.error, sys

node_id = hashlib.sha256(f"{platform.node()}-{uuid.getnode()}".encode()).hexdigest()
grc_url = "$GRC_URL".rstrip("/")

req = urllib.request.Request(
    f"{grc_url}/auth/anonymous",
    method="POST",
    data=json.dumps({"node_id": node_id}).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "winclaw-grc-refresh/1.0"}
)

try:
    resp = urllib.request.urlopen(req, timeout=10)
    result = json.loads(resp.read())
    token = result.get("token", "")
    refresh = result.get("refreshToken", "")

    if not token:
        print("ERROR: Empty token in response")
        sys.exit(1)

    j = json.loads(open("$WINCLAW_JSON", encoding="utf-8").read())
    j.setdefault("grc", {}).setdefault("auth", {})
    j["grc"]["auth"]["token"] = token
    j["grc"]["auth"]["refreshToken"] = refresh
    open("$WINCLAW_JSON", "w", encoding="utf-8").write(json.dumps(j, indent=2, ensure_ascii=False))
    print(f"OK:{len(token)}")
except urllib.error.HTTPError as e:
    print(f"HTTP_{e.code}:{e.read().decode()[:100]}")
    sys.exit(1)
except Exception as e:
    print(f"ERR:{e}")
    sys.exit(1)
PYEOF
)

if echo "$RESULT" | grep -q "^OK:"; then
  TOKEN_LEN=$(echo "$RESULT" | cut -d: -f2)
  log "SUCCESS: GRC token refreshed (${TOKEN_LEN} chars)"
else
  log "ERROR: $RESULT"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 4: Restart gateway if running
# ---------------------------------------------------------------------------
if netstat -ano 2>/dev/null | grep -q ":18789.*LISTENING"; then
  log "Gateway is running, restarting to apply new token..."
  pkill -f "dist/entry.js" 2>/dev/null || true
  sleep 3

  WINCLAW_DIR="/c/work/winclaw-avatar"
  if [ -f "$WINCLAW_DIR/dist/entry.js" ]; then
    cd "$WINCLAW_DIR"
    NODE_DISABLE_COMPILE_CACHE=1 node dist/entry.js gateway run --port 18789 \
      > "/tmp/winclaw-gateway-$(date +%Y%m%d_%H%M%S).log" 2>&1 &
    sleep 10
    if netstat -ano 2>/dev/null | grep -q ":18789.*LISTENING"; then
      log "Gateway restarted OK"
    else
      log "WARN: Gateway may not have started"
    fi
  fi
else
  log "Gateway not running, skipping restart"
fi

log "Done."
