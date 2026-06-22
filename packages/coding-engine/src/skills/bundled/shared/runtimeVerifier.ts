/**
 * runtimeVerifier.ts
 *
 * Re-executes evidence attached to acceptance criteria in completion.json.
 *
 * Why: static analysis of completion.json is trivially fooled by AI. Runtime
 * reproduction of evidence cannot be faked — a curl that returned 401 yesterday
 * either still returns 401 today, or the implementation broke (and we catch the lie).
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'

const execAsync = promisify(exec)

// ---------- Types ----------

export interface AcceptanceCriterion {
  criterion: string
  verified: boolean
  method: 'curl' | 'pytest' | 'chrome-mcp' | 'filesystem' | 'static' | string
  evidence: any
}

export interface CriterionResult {
  criterion: string
  method: string
  reproduced: boolean
  reason?: string
  actual?: string
}

export interface RuntimeVerifyResult {
  valid: boolean
  total: number
  reproduced: number
  failed: CriterionResult[]
  skipped: CriterionResult[]
}

export interface RuntimeVerifyConfig {
  workspace: string
  backendUrl?: string
  timeoutMs?: number
  skipNetworkIfDown?: boolean
}

interface NormalizedConfig {
  workspace: string
  backendUrl?: string
  timeoutMs: number
  skipNetworkIfDown: boolean
  startedAt?: Date
}

// ---------- Public API ----------

/**
 * Verify acceptance criteria by re-running their evidence.
 */
export async function verifyAcceptanceCriteria(
  completionPath: string,
  cfg: RuntimeVerifyConfig
): Promise<RuntimeVerifyResult> {
  const normalized: NormalizedConfig = {
    workspace: cfg.workspace,
    backendUrl: cfg.backendUrl,
    timeoutMs: cfg.timeoutMs ?? 30_000,
    skipNetworkIfDown: cfg.skipNetworkIfDown ?? true,
  }

  const failed: CriterionResult[] = []
  const skipped: CriterionResult[] = []
  let reproduced = 0
  let total = 0

  // Parse completion.json
  let data: any
  try {
    if (!existsSync(completionPath)) {
      return {
        valid: false,
        total: 0,
        reproduced: 0,
        failed: [
          {
            criterion: '(completion.json missing)',
            method: 'meta',
            reproduced: false,
            reason: `File not found: ${completionPath}`,
          },
        ],
        skipped: [],
      }
    }
    const raw = readFileSync(completionPath, 'utf8')
    data = JSON.parse(raw)
  } catch (err: any) {
    return {
      valid: false,
      total: 0,
      reproduced: 0,
      failed: [
        {
          criterion: '(completion.json parse)',
          method: 'meta',
          reproduced: false,
          reason: `Parse error: ${err?.message ?? String(err)}`,
        },
      ],
      skipped: [],
    }
  }

  if (data?.startedAt) {
    const d = new Date(data.startedAt)
    if (!isNaN(d.getTime())) normalized.startedAt = d
  }

  const criteria: AcceptanceCriterion[] = Array.isArray(data?.acceptanceCriteria)
    ? data.acceptanceCriteria
    : []

  if (criteria.length === 0) {
    return {
      valid: false,
      total: 0,
      reproduced: 0,
      failed: [
        {
          criterion: '(no acceptance criteria)',
          method: 'meta',
          reproduced: false,
          reason: 'completion.json has no acceptanceCriteria array or it is empty',
        },
      ],
      skipped: [],
    }
  }

  for (const c of criteria) {
    total++
    let result: CriterionResult
    try {
      switch (c.method) {
        case 'curl':
          result = await verifyCurl(c, normalized)
          break
        case 'pytest':
          result = await verifyPytest(c, normalized)
          break
        case 'chrome-mcp':
          result = await verifyChromeMcp(c, normalized)
          break
        case 'filesystem':
          result = verifyFilesystem(c, normalized)
          break
        case 'static':
          result = verifyStatic(c)
          break
        default:
          result = {
            criterion: c.criterion,
            method: c.method || 'unknown',
            reproduced: false,
            reason: `Unknown method: ${c.method}`,
          }
      }
    } catch (err: any) {
      result = {
        criterion: c.criterion,
        method: c.method,
        reproduced: false,
        reason: `Unexpected error during verification: ${err?.message ?? String(err)}`,
      }
    }

    // Classify: skipped (unreachable backend, etc.) vs failed vs reproduced
    if (result.reproduced) {
      reproduced++
    } else if (result.reason && /^SKIP:/.test(result.reason)) {
      result.reason = result.reason.replace(/^SKIP:\s*/, '')
      skipped.push(result)
    } else {
      failed.push(result)
    }
  }

  // Harden SKIP semantics. Two meta-checks guard against rubber-stamping:
  //
  // (1) Skip ratio: if too many non-static criteria were SKIPPED (>50% or ≥3 of a
  //     small set) AND nothing was reproduced, the verification is hollow.
  //     A headless CI run without backend shouldn't pass a curl-heavy PRP.
  //
  // (2) Static abuse: count `static` criteria DIRECTLY from the input (not from
  //     skipped — `static` results are classified as reproduced, not skipped).
  //     If > 30% of criteria are `static`, Meta Coder is dodging real verification.
  const staticCount = criteria.filter(c => c.method === 'static').length
  const nonStaticTotal = total - staticCount
  const pureSkipped = skipped.filter(s => s.method !== 'static').length
  const skipRatioTooHigh = nonStaticTotal > 0 && (pureSkipped / nonStaticTotal > 0.5 || pureSkipped >= 3)
  const fraudRisk = skipRatioTooHigh && reproduced === 0 && failed.length === 0
  if (fraudRisk) {
    failed.push({
      criterion: '(runtime verifier meta-check)',
      method: 'meta',
      reproduced: false,
      reason: `Too many criteria skipped (${pureSkipped}/${nonStaticTotal} non-static) and none reproduced — cannot confirm module works. Run verification with backend reachable.`,
    })
  }
  // Fire static-abuse check for any non-trivial module (total ≥ 2).
  // Also fire if ALL criteria are static regardless of total.
  const allStatic = total > 0 && staticCount === total
  if ((total >= 2 && staticCount / total > 0.3) || allStatic) {
    failed.push({
      criterion: '(runtime verifier meta-check)',
      method: 'meta',
      reproduced: false,
      reason: `${staticCount}/${total} criteria use method="static" (threshold 30% for non-trivial modules; 0% if all criteria static). Use concrete methods (curl/pytest/filesystem) wherever possible.`,
    })
  }

  return {
    valid: failed.length === 0,
    total,
    reproduced,
    failed,
    skipped,
  }
}

// ---------- curl ----------

async function verifyCurl(
  criterion: AcceptanceCriterion,
  cfg: NormalizedConfig
): Promise<CriterionResult> {
  const ev = criterion.evidence ?? {}
  const cmd: string | undefined = ev.command

  if (!cmd || typeof cmd !== 'string') {
    return {
      criterion: criterion.criterion,
      method: 'curl',
      reproduced: false,
      reason: 'evidence.command missing or not a string',
    }
  }

  const referencesLocalhost = /localhost|127\.0\.0\.1/.test(cmd)

  // If no backendUrl is provided and the command targets localhost, skip.
  if (referencesLocalhost && !cfg.backendUrl) {
    return {
      criterion: criterion.criterion,
      method: 'curl',
      reproduced: false,
      reason: 'SKIP: no backendUrl configured — cannot verify localhost curl',
    }
  }

  // Run the curl command.
  let stdout = ''
  let stderr = ''
  try {
    const res = await execAsync(cmd, {
      timeout: cfg.timeoutMs,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      cwd: cfg.workspace,
    })
    stdout = res.stdout || ''
    stderr = res.stderr || ''
  } catch (err: any) {
    // curl returns non-zero on network errors; detect unreachable
    const msg = String(err?.stderr || err?.message || err)
    const unreachable =
      /Connection refused|Could not resolve host|Failed to connect|Couldn't connect|timed out/i.test(
        msg
      )
    if (unreachable && cfg.skipNetworkIfDown) {
      return {
        criterion: criterion.criterion,
        method: 'curl',
        reproduced: false,
        reason: `SKIP: backend unreachable (${msg.split('\n')[0].slice(0, 200)})`,
      }
    }
    if (err?.killed && err?.signal === 'SIGTERM') {
      return {
        criterion: criterion.criterion,
        method: 'curl',
        reproduced: false,
        reason: `timed out after ${cfg.timeoutMs}ms`,
      }
    }
    return {
      criterion: criterion.criterion,
      method: 'curl',
      reproduced: false,
      reason: `curl error: ${msg.split('\n')[0].slice(0, 300)}`,
      actual: stdout,
    }
  }

  // Extract status code. Priority order (avoid body-content false matches):
  //   1. Newline-delimited trailer: `\n200\n` or `\n200` at end of stdout —
  //      produced by `curl -w '\n%{http_code}'` or `-w '\n%{http_code}\n'`.
  //      This is the recommended format in prompts and runtimeVerifier docs.
  //   2. HTTP/x.x status header from -I / -i output.
  //   3. Fallback: trailing 3 digits on the LAST line only (not mid-body).
  //      Strict: last line must contain ONLY whitespace + 3 digits (ignores bodies).
  let statusCode: string | undefined
  // 1. Preferred: trailer on its own line (from \n%{http_code})
  const newlineTrailer = stdout.match(/\n(\d{3})\s*$/)
  if (newlineTrailer) {
    statusCode = newlineTrailer[1]
  } else {
    // 2. Header match from -I / -i output
    const headerMatch = stdout.match(/HTTP\/[\d.]+\s+(\d{3})/)
    if (headerMatch) {
      statusCode = headerMatch[1]
    } else {
      // 3. Strict tail match: last non-empty line is EXACTLY 3 digits
      //    (rejects `"count":404`-style body content)
      const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const lastLine = lines[lines.length - 1] || ''
      if (/^\d{3}$/.test(lastLine)) {
        statusCode = lastLine
      }
    }
  }

  // Compare status
  if (ev.expectedStatusMatch !== undefined && ev.expectedStatusMatch !== null) {
    const expect = String(ev.expectedStatusMatch)
    if (!statusCode) {
      return {
        criterion: criterion.criterion,
        method: 'curl',
        reproduced: false,
        reason: `expected status ${expect} but could not extract status from output (evidence should use -w '%{http_code}' or -i)`,
        actual: stdout.slice(0, 500),
      }
    }
    // Try regex match first, then equality
    let statusOk = false
    try {
      statusOk = new RegExp(`^${expect}$`).test(statusCode)
    } catch {
      statusOk = statusCode === expect
    }
    if (!statusOk) statusOk = statusCode === expect
    if (!statusOk) {
      return {
        criterion: criterion.criterion,
        method: 'curl',
        reproduced: false,
        reason: `status mismatch: expected ${expect}, got ${statusCode}`,
        actual: stdout.slice(0, 500),
      }
    }
  }

  // Compare body
  if (ev.expectedBodyContains) {
    const needle = String(ev.expectedBodyContains)
    if (!stdout.includes(needle)) {
      return {
        criterion: criterion.criterion,
        method: 'curl',
        reproduced: false,
        reason: `body did not contain expected substring: ${JSON.stringify(needle)}`,
        actual: stdout.slice(0, 500),
      }
    }
  }

  return {
    criterion: criterion.criterion,
    method: 'curl',
    reproduced: true,
    actual: statusCode ? `status=${statusCode}` : stdout.slice(0, 200),
  }
}

// ---------- pytest ----------

async function verifyPytest(
  criterion: AcceptanceCriterion,
  cfg: NormalizedConfig
): Promise<CriterionResult> {
  const ev = criterion.evidence ?? {}
  const cmd: string | undefined = ev.command

  if (!cmd || typeof cmd !== 'string') {
    return {
      criterion: criterion.criterion,
      method: 'pytest',
      reproduced: false,
      reason: 'evidence.command missing or not a string',
    }
  }

  const cwd = ev.workspaceRelative === false ? undefined : cfg.workspace
  const expectedExit = typeof ev.expectedExitCode === 'number' ? ev.expectedExitCode : 0

  try {
    const res = await execAsync(cmd, {
      timeout: cfg.timeoutMs,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
      cwd,
    })
    // success => exit code 0
    if (expectedExit !== 0) {
      return {
        criterion: criterion.criterion,
        method: 'pytest',
        reproduced: false,
        reason: `expected exit ${expectedExit}, got 0`,
        actual: (res.stdout || '').slice(0, 500),
      }
    }
    // Guard: pytest exits 0 with "no tests ran" — this must NOT pass as
    // reproduced. Reject unless the caller explicitly opted in via
    // expectedStdoutContains (e.g., "no tests ran" if that's genuinely desired).
    const stdoutStr = (res.stdout || '') + '\n' + ((res as any).stderr || '')
    const noTestsPattern = /no tests ran|collected 0 items|passed 0 tests/i
    const optedIn = ev.expectedStdoutContains && noTestsPattern.test(String(ev.expectedStdoutContains))
    if (!optedIn && noTestsPattern.test(stdoutStr)) {
      return {
        criterion: criterion.criterion,
        method: 'pytest',
        reproduced: false,
        reason: 'pytest ran but found 0 tests — empty suite cannot prove anything',
        actual: stdoutStr.slice(0, 500),
      }
    }
    if (ev.expectedStdoutContains) {
      const needle = String(ev.expectedStdoutContains)
      if (!(res.stdout || '').includes(needle)) {
        return {
          criterion: criterion.criterion,
          method: 'pytest',
          reproduced: false,
          reason: `stdout did not contain: ${JSON.stringify(needle)}`,
          actual: (res.stdout || '').slice(0, 500),
        }
      }
    }
    return {
      criterion: criterion.criterion,
      method: 'pytest',
      reproduced: true,
      actual: 'exit=0',
    }
  } catch (err: any) {
    if (err?.killed && err?.signal === 'SIGTERM') {
      return {
        criterion: criterion.criterion,
        method: 'pytest',
        reproduced: false,
        reason: `timed out after ${cfg.timeoutMs}ms`,
      }
    }
    const code = typeof err?.code === 'number' ? err.code : -1
    const stdout = err?.stdout || ''
    if (code === expectedExit) {
      // Non-zero exit code matched expectation.
      if (ev.expectedStdoutContains) {
        const needle = String(ev.expectedStdoutContains)
        if (!stdout.includes(needle)) {
          return {
            criterion: criterion.criterion,
            method: 'pytest',
            reproduced: false,
            reason: `stdout did not contain: ${JSON.stringify(needle)}`,
            actual: stdout.slice(0, 500),
          }
        }
      }
      return {
        criterion: criterion.criterion,
        method: 'pytest',
        reproduced: true,
        actual: `exit=${code}`,
      }
    }
    return {
      criterion: criterion.criterion,
      method: 'pytest',
      reproduced: false,
      reason: `exit ${code} (expected ${expectedExit})`,
      actual: stdout.slice(0, 500),
    }
  }
}

// ---------- chrome-mcp (evidence file only) ----------

async function verifyChromeMcp(
  criterion: AcceptanceCriterion,
  cfg: NormalizedConfig
): Promise<CriterionResult> {
  const ev = criterion.evidence ?? {}
  const summaryPath: string | undefined = ev.summaryPath
  if (!summaryPath) {
    return {
      criterion: criterion.criterion,
      method: 'chrome-mcp',
      reproduced: false,
      reason: 'evidence.summaryPath missing',
    }
  }
  const abs = isAbsolute(summaryPath) ? summaryPath : join(cfg.workspace, summaryPath)
  if (!existsSync(abs)) {
    return {
      criterion: criterion.criterion,
      method: 'chrome-mcp',
      reproduced: false,
      reason: `summary.json not found at ${abs}`,
    }
  }
  let summary: any
  try {
    summary = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (err: any) {
    return {
      criterion: criterion.criterion,
      method: 'chrome-mcp',
      reproduced: false,
      reason: `summary.json parse error: ${err?.message ?? String(err)}`,
    }
  }

  const expectPass = ev.expectedPass !== false
  if (expectPass && summary.pass !== true) {
    return {
      criterion: criterion.criterion,
      method: 'chrome-mcp',
      reproduced: false,
      reason: `summary.pass !== true (got ${JSON.stringify(summary.pass)})`,
      actual: JSON.stringify(summary).slice(0, 500),
    }
  }

  // Freshness: must be at least as new as startedAt.
  // If stat fails (file vanished / permission denied), treat as STALE — a
  // chrome-mcp criterion we can't verify freshness for should NOT pass silently.
  if (cfg.startedAt) {
    try {
      const mtime = statSync(abs).mtime
      if (mtime < cfg.startedAt) {
        return {
          criterion: criterion.criterion,
          method: 'chrome-mcp',
          reproduced: false,
          reason: `summary.json stale: mtime ${mtime.toISOString()} < startedAt ${cfg.startedAt.toISOString()}`,
        }
      }
    } catch (e) {
      return {
        criterion: criterion.criterion,
        method: 'chrome-mcp',
        reproduced: false,
        reason: `summary.json stat failed: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  return {
    criterion: criterion.criterion,
    method: 'chrome-mcp',
    reproduced: true,
    actual: `pass=${summary.pass}`,
  }
}

// ---------- filesystem ----------

export function verifyFilesystem(
  criterion: AcceptanceCriterion,
  cfg: NormalizedConfig | RuntimeVerifyConfig
): CriterionResult {
  const ev = criterion.evidence ?? {}
  const workspace = cfg.workspace
  const file: string | undefined = ev.file
  if (!file) {
    return {
      criterion: criterion.criterion,
      method: 'filesystem',
      reproduced: false,
      reason: 'evidence.file missing',
    }
  }
  const abs = isAbsolute(file) ? file : join(workspace, file)
  if (!existsSync(abs)) {
    return {
      criterion: criterion.criterion,
      method: 'filesystem',
      reproduced: false,
      reason: `file not found: ${abs}`,
    }
  }

  let content = ''
  try {
    content = readFileSync(abs, 'utf8')
  } catch (err: any) {
    return {
      criterion: criterion.criterion,
      method: 'filesystem',
      reproduced: false,
      reason: `read error: ${err?.message ?? String(err)}`,
    }
  }

  if (Array.isArray(ev.contains)) {
    for (const needle of ev.contains) {
      if (!content.includes(String(needle))) {
        return {
          criterion: criterion.criterion,
          method: 'filesystem',
          reproduced: false,
          reason: `file missing required substring: ${JSON.stringify(needle)}`,
        }
      }
    }
  }
  if (Array.isArray(ev.notContains)) {
    for (const needle of ev.notContains) {
      if (content.includes(String(needle))) {
        return {
          criterion: criterion.criterion,
          method: 'filesystem',
          reproduced: false,
          reason: `file contains forbidden substring: ${JSON.stringify(needle)}`,
        }
      }
    }
  }
  if (ev.regex) {
    try {
      const re = new RegExp(ev.regex)
      if (!re.test(content)) {
        return {
          criterion: criterion.criterion,
          method: 'filesystem',
          reproduced: false,
          reason: `file did not match regex: ${ev.regex}`,
        }
      }
    } catch (err: any) {
      return {
        criterion: criterion.criterion,
        method: 'filesystem',
        reproduced: false,
        reason: `invalid regex: ${err?.message ?? String(err)}`,
      }
    }
  }

  return {
    criterion: criterion.criterion,
    method: 'filesystem',
    reproduced: true,
    actual: `ok: ${abs}`,
  }
}

// ---------- static ----------

export function verifyStatic(criterion: AcceptanceCriterion): CriterionResult {
  if (criterion.verified === true) {
    return {
      criterion: criterion.criterion,
      method: 'static',
      reproduced: true,
      reason: 'WARNING: static method — cannot be re-executed. Too many of these is a smell.',
      actual: 'trusted',
    }
  }
  return {
    criterion: criterion.criterion,
    method: 'static',
    reproduced: false,
    reason: 'static criterion with verified !== true',
  }
}

// ---------- summary ----------

export function summarizeResult(result: RuntimeVerifyResult): string {
  const lines: string[] = []
  lines.push(
    `Runtime verification: ${result.valid ? 'PASS' : 'FAIL'} — ${result.reproduced}/${result.total} reproduced, ${result.failed.length} failed, ${result.skipped.length} skipped`
  )
  if (result.failed.length > 0) {
    lines.push('')
    lines.push('Failed criteria:')
    for (const f of result.failed) {
      lines.push(`  [${f.method}] ${f.criterion}`)
      if (f.reason) lines.push(`    reason: ${f.reason}`)
      if (f.actual) lines.push(`    actual: ${f.actual.toString().slice(0, 200)}`)
    }
  }
  if (result.skipped.length > 0) {
    lines.push('')
    lines.push('Skipped criteria (could not be re-run):')
    for (const s of result.skipped) {
      lines.push(`  [${s.method}] ${s.criterion}`)
      if (s.reason) lines.push(`    reason: ${s.reason}`)
    }
  }
  return lines.join('\n')
}
