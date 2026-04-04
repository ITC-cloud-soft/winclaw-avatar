#!/bin/bash
# =============================================================================
# refresh-claude-token.sh
#
# Refreshes the Claude Code OAuth token and restarts WinClaw Gateway.
# For use in cron or Git Bash on Windows.
#
# Usage:
#   bash C:/work/winclaw-avatar/docs/refresh-claude-token.sh
#
# Cron (every 6 hours):
#   0 */6 * * * bash /c/work/winclaw-avatar/docs/refresh-claude-token.sh >> /tmp/claude-token-refresh.log 2>&1
#
# =============================================================================

set -euo pipefail

CREDS_FILE="C:/Users/$USERNAME/.claude/.credentials.json"
WINCLAW_DIR="/c/work/winclaw-avatar"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

log() { echo "$LOG_PREFIX $1"; }

# ---------------------------------------------------------------------------
# Step 1: Check current token
# ---------------------------------------------------------------------------
if [ ! -f "$CREDS_FILE" ]; then
    log "ERROR: $CREDS_FILE not found"
    exit 1
fi

CURRENT_TOKEN=$(python3 -c "import json; print(json.loads(open('$CREDS_FILE',encoding='utf-8').read())['claudeAiOauth']['accessToken'])")
REMAINING=$(python3 -c "import json,time;c=json.loads(open('$CREDS_FILE',encoding='utf-8').read());r=(c['claudeAiOauth']['expiresAt']/1000-time.time())/3600;print(f'{r:.1f}')")

log "Current token: ${CURRENT_TOKEN:0:20}... (${REMAINING}h remaining)"

# ---------------------------------------------------------------------------
# Step 2: Refresh via claude CLI
# ---------------------------------------------------------------------------
log "Running claude auth status to trigger refresh..."
CLAUDE_CODE_SKIP_UPDATE_CHECK=1 claude auth status 2>/dev/null || true
sleep 2

# Re-read
NEW_TOKEN=$(python3 -c "import json; print(json.loads(open('$CREDS_FILE',encoding='utf-8').read())['claudeAiOauth']['accessToken'])")
NEW_REMAINING=$(python3 -c "import json,time;c=json.loads(open('$CREDS_FILE',encoding='utf-8').read());r=(c['claudeAiOauth']['expiresAt']/1000-time.time())/3600;print(f'{r:.1f}')")

if [ "$NEW_TOKEN" != "$CURRENT_TOKEN" ]; then
    log "Token refreshed! New: ${NEW_TOKEN:0:20}... (${NEW_REMAINING}h)"
else
    # Check if still valid
    IS_VALID=$(python3 -c "print('yes' if float('$NEW_REMAINING') > 0.5 else 'no')")
    if [ "$IS_VALID" = "yes" ]; then
        log "Token still valid (${NEW_REMAINING}h remaining), no refresh needed"
    else
        log "ERROR: Token expired (${NEW_REMAINING}h) and auto-refresh failed."
        log "Run manually: claude auth login"
        log "Then re-run this script."
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Step 3: Set persistent environment variable (Windows User scope)
# ---------------------------------------------------------------------------
FINAL_TOKEN=$(python3 -c "import json; print(json.loads(open('$CREDS_FILE',encoding='utf-8').read())['claudeAiOauth']['accessToken'])")

powershell.exe -Command "[Environment]::SetEnvironmentVariable('ANTHROPIC_OAUTH_TOKEN', '$FINAL_TOKEN', 'User')" 2>/dev/null || true
log "Updated ANTHROPIC_OAUTH_TOKEN in Windows User env"

# ---------------------------------------------------------------------------
# Step 4: Restart Gateway
# ---------------------------------------------------------------------------
pkill -f "dist/entry.js" 2>/dev/null || true
sleep 3

if [ -f "$WINCLAW_DIR/dist/entry.js" ]; then
    log "Starting WinClaw Gateway..."
    cd "$WINCLAW_DIR"
    ANTHROPIC_OAUTH_TOKEN="$FINAL_TOKEN" NODE_DISABLE_COMPILE_CACHE=1 \
        node dist/entry.js gateway run --port 18789 > "/tmp/winclaw-gateway-$(date +%Y%m%d_%H%M%S).log" 2>&1 &
    GW_PID=$!
    sleep 10
    if kill -0 $GW_PID 2>/dev/null; then
        log "Gateway running (PID=$GW_PID)"
    else
        log "ERROR: Gateway died"
        exit 1
    fi
fi

log "Done."
