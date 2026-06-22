/**
 * Phase 4 anti-fraud guards — Guard 2 (time monitoring) + Guard 4 (functional test gate).
 *
 * Motivation: In the airlinesys2 incident, 4 PRPs were marked "completed" within 3
 * seconds — physically impossible. The Reviewer Agent only checked file existence,
 * which the AI exploited under context compression. This module adds:
 *   - runFunctionalTestGate(): actually execute module-specific tests and parse results
 *   - analyzeTimeline(): inspect completion.json timestamps for impossible patterns
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Guard 4 — Functional test gate
// ---------------------------------------------------------------------------

export interface TestGateResult {
  ok: boolean
  testsRun: number
  failures: number
  stdout?: string    // last 2KB for diagnostics
  reason?: string    // if skipped or failure classification
}

type Lang = 'python' | 'typescript' | 'javascript' | 'java' | 'go' | 'php' | 'unknown'

interface Attempt {
  cmd: string
  cwd: string
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

function moduleCapitalized(moduleName: string): string {
  // test_user_auth → TestUserAuth; user-auth → UserAuth
  return moduleName
    .split(/[-_]/)
    .filter(Boolean)
    .map(capitalize)
    .join('')
}

function buildAttempts(workspace: string, moduleName: string, lang: Lang): Attempt[] {
  const roots = [workspace, join(workspace, 'backend')].filter(r => {
    try { return existsSync(r) } catch { return false }
  })
  const cap = moduleCapitalized(moduleName)
  const attempts: Attempt[] = []

  for (const root of roots) {
    switch (lang) {
      case 'python':
        // Try both tests/test_<module>.py and backend/tests/test_<module>.py
        attempts.push({ cmd: `pytest tests/test_${moduleName}.py -x --tb=no -q`, cwd: root })
        attempts.push({ cmd: `pytest tests/${moduleName} -x --tb=no -q`, cwd: root })
        attempts.push({ cmd: `pytest -k ${moduleName} -x --tb=no -q`, cwd: root })
        break
      case 'typescript':
      case 'javascript':
        attempts.push({ cmd: `npx --no-install jest ${moduleName} --bail`, cwd: root })
        attempts.push({ cmd: `npm test -- --testPathPattern=${moduleName} --bail`, cwd: root })
        break
      case 'java':
        attempts.push({ cmd: `mvn test -Dtest=*${cap}*Test -q`, cwd: root })
        break
      case 'go':
        attempts.push({ cmd: `go test -run Test${cap} ./...`, cwd: root })
        break
      case 'php':
        attempts.push({ cmd: `./vendor/bin/phpunit tests/${cap}Test.php`, cwd: root })
        attempts.push({ cmd: `./vendor/bin/phpunit --filter ${cap}`, cwd: root })
        break
    }
  }
  return attempts
}

/**
 * Parse testsRun / failures from test runner output (union of jest + pytest + others).
 * Returns { testsRun: -1 } when no recognizable counts found (distinct from 0).
 */
function parseCounts(output: string, lang: Lang): { testsRun: number; failures: number } {
  let testsRun = -1
  let failures = 0

  // pytest: "5 passed", "2 failed, 3 passed", "1 error"
  const pyPass = output.match(/(\d+)\s+passed/i)
  const pyFail = output.match(/(\d+)\s+failed/i)
  const pyError = output.match(/(\d+)\s+error(s?)/i)
  // jest: "Tests:       1 failed, 4 passed, 5 total"
  const jestTotal = output.match(/Tests:[^\n]*?(\d+)\s+total/i)
  const jestPass = output.match(/Tests:[^\n]*?(\d+)\s+passed/i)
  const jestFail = output.match(/Tests:[^\n]*?(\d+)\s+failed/i)
  // mocha-like: "5 passing", "2 failing"
  const mochaPass = output.match(/(\d+)\s+passing/i)
  const mochaFail = output.match(/(\d+)\s+failing/i)
  // go test: "ok   pkg   0.123s" / "--- PASS: TestX" / "--- FAIL: TestY"
  const goPass = (output.match(/---\s*PASS:/g) || []).length
  const goFail = (output.match(/---\s*FAIL:/g) || []).length
  // phpunit: "OK (5 tests, 7 assertions)" or "Tests: 5, Assertions: 7, Failures: 1"
  const phpOk = output.match(/OK\s*\((\d+)\s+tests?/i)
  const phpTests = output.match(/Tests:\s*(\d+)/i)
  const phpFailures = output.match(/Failures:\s*(\d+)/i)
  const phpErrors = output.match(/Errors:\s*(\d+)/i)

  if (jestTotal) {
    testsRun = parseInt(jestTotal[1], 10)
    if (jestFail) failures = parseInt(jestFail[1], 10)
  } else if (pyPass || pyFail) {
    const passed = pyPass ? parseInt(pyPass[1], 10) : 0
    const failed = pyFail ? parseInt(pyFail[1], 10) : 0
    const errored = pyError ? parseInt(pyError[1], 10) : 0
    testsRun = passed + failed + errored
    failures = failed + errored
  } else if (jestPass) {
    testsRun = parseInt(jestPass[1], 10)
  } else if (mochaPass || mochaFail) {
    const passed = mochaPass ? parseInt(mochaPass[1], 10) : 0
    const failed = mochaFail ? parseInt(mochaFail[1], 10) : 0
    testsRun = passed + failed
    failures = failed
  } else if (lang === 'go' && (goPass + goFail) > 0) {
    testsRun = goPass + goFail
    failures = goFail
  } else if (phpOk) {
    testsRun = parseInt(phpOk[1], 10)
    failures = 0
  } else if (phpTests) {
    testsRun = parseInt(phpTests[1], 10)
    const f = phpFailures ? parseInt(phpFailures[1], 10) : 0
    const e = phpErrors ? parseInt(phpErrors[1], 10) : 0
    failures = f + e
  }

  return { testsRun, failures }
}

function tail(s: string, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(s.length - n)
}

/**
 * Guard 4 — Run module-specific functional tests.
 * Returns ok=true only if testsRun > 0 AND failures === 0.
 * Never throws; always returns a TestGateResult.
 */
export async function runFunctionalTestGate(
  workspace: string,
  moduleName: string,
  lang: Lang,
  timeoutMs: number = 120_000,
): Promise<TestGateResult> {
  if (lang === 'unknown' || !lang) {
    return { ok: true, testsRun: 0, failures: 0, reason: 'unknown lang — skipped' }
  }

  // BUG-F FIX: sanitize moduleName — prevent shell injection via PRP slugs
  // that might contain metacharacters.
  if (moduleName && !/^[\w.@/-]+$/.test(moduleName)) {
    return {
      ok: false,
      testsRun: 0,
      failures: 0,
      reason: `moduleName "${moduleName}" contains unsafe characters (must match /^[\\w.@/-]+$/)`,
    }
  }

  const attempts = buildAttempts(workspace, moduleName, lang)
  if (attempts.length === 0) {
    return { ok: true, testsRun: 0, failures: 0, reason: 'no runner for lang — skipped' }
  }

  let lastStdout = ''
  let lastFailures = 0
  let lastTestsRun = 0
  let timedOut = false

  for (const a of attempts) {
    try {
      const { stdout, stderr } = await execAsync(a.cmd, {
        cwd: a.cwd,
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      })
      const combined = (stdout || '') + '\n' + (stderr || '')
      const { testsRun, failures } = parseCounts(combined, lang)
      if (testsRun > 0) {
        if (failures === 0) {
          return { ok: true, testsRun, failures: 0, stdout: tail(combined, 2048) }
        }
        return { ok: false, testsRun, failures, stdout: tail(combined, 2048), reason: 'tests failed' }
      }
      // exit 0 but 0 tests — try next attempt
      lastStdout = combined
    } catch (e: any) {
      const combined = ((e?.stdout || '') + '\n' + (e?.stderr || '')) || String(e?.message || e)
      if (e?.killed || /ETIMEDOUT|timed out/i.test(String(e?.message || ''))) {
        timedOut = true
        lastStdout = combined
        continue
      }
      const { testsRun, failures } = parseCounts(combined, lang)
      if (testsRun > 0) {
        // non-zero exit but we parsed counts — likely failing tests
        return {
          ok: false,
          testsRun,
          failures: failures || Math.max(1, testsRun - 0),
          stdout: tail(combined, 2048),
          reason: 'tests failed (non-zero exit)',
        }
      }
      lastStdout = combined
      lastFailures = failures
      lastTestsRun = testsRun
    }
  }

  if (timedOut) {
    return { ok: false, testsRun: 0, failures: 0, reason: 'test run timed out', stdout: tail(lastStdout, 2048) }
  }
  return {
    ok: false,
    testsRun: Math.max(0, lastTestsRun),
    failures: lastFailures,
    reason: 'no tests found',
    stdout: tail(lastStdout, 2048),
  }
}

// ---------------------------------------------------------------------------
// Guard 2 — Timeline analysis
// ---------------------------------------------------------------------------

export interface TimeAnalysis {
  valid: boolean
  issues: string[]
  stats: {
    totalDuration?: number                                          // ms
    suspiciouslyBatched?: Array<{ prps: string[]; spanMs: number }>
  }
}

interface CompletionEntry {
  prp: string
  startedAt?: number
  completedAt?: number
  sourceLineCount?: number
  sourceFileCount?: number
}

function pickTs(data: any, names: string[]): number | undefined {
  // Try top-level first, then nested locations where AI might store timestamps.
  const searchRoots = [data, data?.verification, data?.meta, data?.metadata]
  for (const root of searchRoots) {
    if (!root || typeof root !== 'object') continue
    for (const n of names) {
      const v = root[n]
      if (typeof v === 'string') {
        const t = Date.parse(v)
        if (!isNaN(t)) return t
      } else if (typeof v === 'number' && isFinite(v)) {
        return v
      }
    }
  }
  return undefined
}

/**
 * Guard 2 — Analyze timing patterns across completion.json files.
 * Detects:
 *   - Single PRP completed < 60s from start with substantial code (likely fraud)
 *   - 4+ PRPs completed within 180s window (the airlinesys2 pattern)
 *   - 3+ PRPs all within 10s of each other (even worse)
 */
export function analyzeTimeline(prpDoneDir: string): TimeAnalysis {
  const issues: string[] = []
  const stats: TimeAnalysis['stats'] = {}

  if (!existsSync(prpDoneDir)) {
    return { valid: true, issues, stats }
  }

  let files: string[]
  try {
    files = readdirSync(prpDoneDir).filter(f => f.toLowerCase().endsWith('.completion.json'))
  } catch {
    return { valid: true, issues, stats }
  }

  const entries: CompletionEntry[] = []
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(prpDoneDir, f), 'utf-8'))
      const startedAt = pickTs(data, ['startedAt', 'started_at', '_startedAt'])
      const completedAt = pickTs(data, ['completedAt', 'completed_at', '_completedAt'])
      const srcLines = data?.metrics?.sourceLineCount
      const srcFiles = (data?.artifacts?.sourceFiles || data?.files_created || []) as any[]
      entries.push({
        prp: data?.prpName || f.replace(/\.completion\.json$/i, ''),
        startedAt,
        completedAt,
        sourceLineCount: typeof srcLines === 'number' ? srcLines : undefined,
        sourceFileCount: Array.isArray(srcFiles) ? srcFiles.length : 0,
      })
    } catch {
      // ignore corrupt file
    }
  }

  // Per-PRP duration check
  for (const e of entries) {
    if (e.startedAt && e.completedAt) {
      const dur = e.completedAt - e.startedAt
      if (dur < 60_000) {
        // Tiny PRPs (docs only, trivial) may legitimately finish quickly.
        // Only flag if code appears substantial: > 50 lines OR >= 3 source files.
        const substantial =
          (typeof e.sourceLineCount === 'number' && e.sourceLineCount > 50) ||
          (typeof e.sourceFileCount === 'number' && e.sourceFileCount >= 3)
        if (substantial) {
          issues.push(
            `${e.prp}: duration ${Math.round(dur / 1000)}s < 60s with ${e.sourceLineCount ?? '?'} lines / ${e.sourceFileCount ?? '?'} files — likely fraud`,
          )
        }
      }
    }
  }

  // Sliding-window batch detection
  const tss = entries
    .filter(e => typeof e.completedAt === 'number')
    .sort((a, b) => (a.completedAt! - b.completedAt!))

  if (tss.length >= 2) {
    stats.totalDuration = tss[tss.length - 1].completedAt! - tss[0].completedAt!
  }

  const batched: Array<{ prps: string[]; spanMs: number }> = []

  // 3+ PRPs within 10s
  for (let i = 0; i + 2 < tss.length; i++) {
    const span = tss[i + 2].completedAt! - tss[i].completedAt!
    if (span < 10_000) {
      const prps = [tss[i].prp, tss[i + 1].prp, tss[i + 2].prp]
      batched.push({ prps, spanMs: span })
      issues.push(`3 PRPs completed within ${Math.round(span / 1000)}s: ${prps.join(', ')} — physically impossible`)
    }
  }

  // 4+ PRPs within 180s (the airlinesys2 pattern)
  for (let i = 0; i + 3 < tss.length; i++) {
    const span = tss[i + 3].completedAt! - tss[i].completedAt!
    if (span < 180_000) {
      const prps = [tss[i].prp, tss[i + 1].prp, tss[i + 2].prp, tss[i + 3].prp]
      batched.push({ prps, spanMs: span })
      issues.push(`4 PRPs completed within ${Math.round(span / 1000)}s: ${prps.join(', ')} — airlinesys2-style batch fraud`)
    }
  }

  if (batched.length > 0) stats.suspiciouslyBatched = batched

  return { valid: issues.length === 0, issues, stats }
}
