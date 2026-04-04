# =============================================================================
# refresh-claude-token.ps1
#
# Refreshes the Claude Code OAuth token and restarts WinClaw Gateway.
#
# The Claude Code subscription token expires every ~7 hours.
# This script reads the refresh token from .credentials.json,
# calls the Anthropic OAuth endpoint to get a new access token,
# updates .credentials.json, and restarts the gateway.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File C:\work\winclaw-avatar\docs\refresh-claude-token.ps1
#
# Scheduled Task (every 6 hours):
#   schtasks /Create /TN "Claude Token Refresh" /TR "powershell -ExecutionPolicy Bypass -File C:\work\winclaw-avatar\docs\refresh-claude-token.ps1" /SC HOURLY /MO 6 /F
#
# =============================================================================

$ErrorActionPreference = "Stop"
$CredsFile = "$env:USERPROFILE\.claude\.credentials.json"
$LogFile = "$env:TEMP\claude-token-refresh.log"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ---------------------------------------------------------------------------
# Step 1: Read current credentials
# ---------------------------------------------------------------------------
if (-not (Test-Path $CredsFile)) {
    Log "ERROR: $CredsFile not found. Run 'claude auth login' first."
    exit 1
}

$creds = Get-Content $CredsFile -Raw | ConvertFrom-Json
$oauth = $creds.claudeAiOauth
$refreshToken = $oauth.refreshToken
$currentToken = $oauth.accessToken
$expiresAt = [DateTimeOffset]::FromUnixTimeMilliseconds($oauth.expiresAt).LocalDateTime

Log "Current token prefix: $($currentToken.Substring(0, 20))..."
Log "Expires at: $expiresAt"

$remaining = ($expiresAt - (Get-Date)).TotalHours
Log "Remaining: $([math]::Round($remaining, 1)) hours"

# ---------------------------------------------------------------------------
# Step 2: Refresh token via Claude CLI (most reliable method)
# ---------------------------------------------------------------------------
Log "Refreshing token via 'claude auth login'..."

# Method 1: Try using claude CLI to trigger a token refresh
try {
    # Running any claude command with valid refresh token triggers auto-refresh
    $env:CLAUDE_CODE_SKIP_UPDATE_CHECK = "1"
    $result = & claude auth status 2>&1 | Out-String
    Log "Claude auth status: $($result.Trim())"
} catch {
    Log "WARN: claude auth status failed: $_"
}

# Re-read credentials (claude CLI may have refreshed them)
Start-Sleep -Seconds 2
$creds = Get-Content $CredsFile -Raw | ConvertFrom-Json
$oauth = $creds.claudeAiOauth
$newToken = $oauth.accessToken
$newExpiry = [DateTimeOffset]::FromUnixTimeMilliseconds($oauth.expiresAt).LocalDateTime
$newRemaining = ($newExpiry - (Get-Date)).TotalHours

if ($newToken -ne $currentToken) {
    Log "SUCCESS: Token refreshed by CLI!"
    Log "New token prefix: $($newToken.Substring(0, 20))..."
    Log "New expiry: $newExpiry ($([math]::Round($newRemaining, 1)) hours)"
} elseif ($newRemaining -gt 1) {
    Log "Token still valid ($([math]::Round($newRemaining, 1)) hours remaining), no refresh needed."
} else {
    # Method 2: Try manual OAuth refresh via API
    Log "CLI refresh didn't work. Trying OAuth API refresh..."

    try {
        $body = @{
            grant_type    = "refresh_token"
            refresh_token = $refreshToken
        }

        # Try multiple endpoints
        $endpoints = @(
            "https://console.anthropic.com/v1/oauth/token"
        )

        $refreshed = $false
        foreach ($endpoint in $endpoints) {
            try {
                $headers = @{
                    "Content-Type" = "application/json"
                    "User-Agent"   = "claude-code/2.1.77"
                }
                $response = Invoke-RestMethod -Uri $endpoint -Method POST -Body ($body | ConvertTo-Json) -Headers $headers -TimeoutSec 10

                if ($response.access_token) {
                    $oauth.accessToken = $response.access_token
                    if ($response.refresh_token) {
                        $oauth.refreshToken = $response.refresh_token
                    }
                    $expiresIn = if ($response.expires_in) { $response.expires_in } else { 25200 }
                    $oauth.expiresAt = [long]((Get-Date).ToUniversalTime() - [datetime]"1970-01-01").TotalMilliseconds + ($expiresIn * 1000)

                    $creds.claudeAiOauth = $oauth
                    $creds | ConvertTo-Json -Depth 10 | Set-Content $CredsFile -Encoding UTF8

                    Log "SUCCESS: Token refreshed via API ($endpoint)"
                    $refreshed = $true
                    break
                }
            } catch {
                Log "WARN: $endpoint failed: $_"
            }
        }

        if (-not $refreshed) {
            Log "ERROR: All refresh methods failed!"
            Log "Please run 'claude auth login' manually to re-authenticate."
            exit 1
        }
    } catch {
        Log "ERROR: OAuth refresh failed: $_"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Step 3: Update system environment variable (persistent)
# ---------------------------------------------------------------------------
$finalCreds = Get-Content $CredsFile -Raw | ConvertFrom-Json
$finalToken = $finalCreds.claudeAiOauth.accessToken

# Set for current process
$env:ANTHROPIC_OAUTH_TOKEN = $finalToken

# Set persistent user environment variable
[Environment]::SetEnvironmentVariable("ANTHROPIC_OAUTH_TOKEN", $finalToken, "User")
Log "Updated ANTHROPIC_OAUTH_TOKEN in User environment variables"

# ---------------------------------------------------------------------------
# Step 4: Restart WinClaw Gateway (if running)
# ---------------------------------------------------------------------------
$gwProcess = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue
if ($gwProcess) {
    Log "Restarting WinClaw Gateway..."
    $pid = $gwProcess[0].OwningProcess
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Check if winclaw-avatar gateway should be started
$winclawDir = "C:\work\winclaw-avatar"
if (Test-Path "$winclawDir\dist\entry.js") {
    Log "Starting WinClaw Gateway from $winclawDir..."

    $logTs = Get-Date -Format "yyyyMMdd_HHmmss"
    $gwLog = "$env:TEMP\winclaw-gateway_$logTs.log"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node"
    $psi.Arguments = "--disable-warning=ExperimentalWarning dist/entry.js gateway run --port 18789"
    $psi.WorkingDirectory = $winclawDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.EnvironmentVariables["ANTHROPIC_OAUTH_TOKEN"] = $finalToken
    $psi.EnvironmentVariables["NODE_DISABLE_COMPILE_CACHE"] = "1"

    $proc = [System.Diagnostics.Process]::Start($psi)
    Log "Gateway started (PID=$($proc.Id), log=$gwLog)"

    Start-Sleep -Seconds 10
    if (-not $proc.HasExited) {
        Log "Gateway running OK"
    } else {
        Log "ERROR: Gateway exited with code $($proc.ExitCode)"
    }
} else {
    Log "SKIP: winclaw-avatar not found at $winclawDir"
}

Log "Done."
