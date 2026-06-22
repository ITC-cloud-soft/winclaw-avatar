import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const execAsync = promisify(exec)

export interface FrontendTestResult {
  ok: boolean
  testsRun: number
  testsFailed: number
  framework?: 'vitest' | 'jest' | 'playwright' | 'cypress' | 'unknown'
  coverage?: {
    statements?: number
    branches?: number
    functions?: number
    lines?: number
  }
  stdout?: string              // last 2KB
  reason?: string              // if skipped
}

export interface FrontendTestGateConfig {
  workspace: string
  frontendDir?: string         // default: workspace/frontend
  moduleName?: string          // filter tests to this module
  timeoutMs?: number           // default 180_000
  requireCoverage?: boolean    // default false
}

/**
 * Detect which frontend test framework is configured (reads package.json).
 */
export function detectFrontendTestFramework(frontendDir: string): FrontendTestResult['framework'] {
  const pkg = join(frontendDir, 'package.json')
  if (!existsSync(pkg)) return 'unknown'
  try {
    const data = JSON.parse(readFileSync(pkg, 'utf-8'))
    const deps = { ...(data.dependencies || {}), ...(data.devDependencies || {}) }
    if (deps.vitest) return 'vitest'
    if (deps.jest || deps['@jest/core']) return 'jest'
    if (deps['@playwright/test'] || deps.playwright) return 'playwright'
    if (deps.cypress) return 'cypress'
  } catch {}
  return 'unknown'
}

/**
 * Guard 4 (frontend edition) — Run frontend unit tests.
 */
export async function runFrontendTestGate(cfg: FrontendTestGateConfig): Promise<FrontendTestResult> {
  const frontendDir = (cfg.frontendDir || join(cfg.workspace, 'frontend')).replace(/\\/g, '/')
  if (!existsSync(frontendDir)) {
    return { ok: true, testsRun: 0, testsFailed: 0, reason: `frontend dir not found at ${frontendDir} — skipping` }
  }
  if (!existsSync(join(frontendDir, 'package.json'))) {
    return { ok: true, testsRun: 0, testsFailed: 0, reason: 'no package.json — skipping' }
  }
  const framework = detectFrontendTestFramework(frontendDir)
  const timeoutMs = cfg.timeoutMs || 180_000

  // Sanitize moduleName — BUG-F FIX: prevent shell injection via PRP-derived slugs
  // that might contain metachars. Allow only filesystem/path-safe characters.
  let safeModuleName: string | undefined
  if (cfg.moduleName) {
    if (!/^[\w.@/-]+$/.test(cfg.moduleName)) {
      return {
        ok: false,
        testsRun: 0,
        testsFailed: 0,
        framework,
        reason: `moduleName "${cfg.moduleName}" contains unsafe characters (must match /^[\\w.@/-]+$/)`,
      }
    }
    safeModuleName = cfg.moduleName
  }

  // Build command
  let cmd: string
  switch (framework) {
    case 'vitest':
      cmd = safeModuleName
        ? `npx --no-install vitest run --reporter=default ${safeModuleName}`
        : `npx --no-install vitest run --reporter=default`
      break
    case 'jest':
      cmd = safeModuleName
        ? `npx --no-install jest --bail ${safeModuleName}`
        : `npx --no-install jest --bail`
      break
    case 'playwright':
      cmd = safeModuleName
        ? `npx --no-install playwright test --grep ${safeModuleName}`
        : `npx --no-install playwright test`
      break
    case 'cypress':
      cmd = `npx --no-install cypress run`
      break
    default:
      return { ok: true, testsRun: 0, testsFailed: 0, framework: 'unknown', reason: 'unknown framework — skipping' }
  }

  try {
    const result = await execAsync(cmd, {
      cwd: frontendDir,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 20_000_000,
    })
    const combined = (result.stdout + '\n' + result.stderr).slice(-10_000)
    return parseTestOutput(combined, framework, 0)
  } catch (e: any) {
    // exec throws on non-zero exit (= test failures)
    const combined = ((e.stdout || '') + '\n' + (e.stderr || '')).slice(-10_000)
    if (e.killed || e.code === 'ETIMEDOUT') {
      return { ok: false, testsRun: 0, testsFailed: 0, framework, reason: 'test run timed out', stdout: combined.slice(-2000) }
    }
    return parseTestOutput(combined, framework, e.code || 1)
  }
}

function parseTestOutput(output: string, framework: FrontendTestResult['framework'], exitCode: number): FrontendTestResult {
  const stdout = output.slice(-2000)
  let testsRun = 0
  let testsFailed = 0

  if (framework === 'vitest') {
    // "Test Files  5 passed | 1 failed (6)" / "Tests  42 passed | 2 failed (44)"
    const m = output.match(/Tests?\s+(?:\x1b\[\d+m)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?/i)
    if (m) { const passed = Number(m[1]); const failed = Number(m[2] || 0); testsRun = passed + failed; testsFailed = failed }
  } else if (framework === 'jest') {
    // "Tests:       2 failed, 40 passed, 42 total"
    const passed = output.match(/Tests?:\s*(?:\d+\s+failed,\s*)?(\d+)\s+passed(?:,\s*(\d+)\s+total)?/i)
    const failed = output.match(/Tests?:\s*(\d+)\s+failed/i)
    if (passed) testsRun = Number(passed[2] || passed[1])
    if (failed) testsFailed = Number(failed[1])
    if (!passed && !failed) {
      const t = output.match(/Tests?:\s*(\d+)\s+total/i)
      if (t) testsRun = Number(t[1])
    }
  } else if (framework === 'playwright') {
    // "3 passed (15s)" / "2 failed (15s)"
    const passed = output.match(/(\d+)\s+passed/)
    const failed = output.match(/(\d+)\s+failed/)
    if (passed) testsRun = Number(passed[1])
    if (failed) { testsFailed = Number(failed[1]); testsRun += testsFailed }
  } else if (framework === 'cypress') {
    const m = output.match(/Tests:\s+(\d+)[\s\S]*?Failing:\s+(\d+)/i)
    if (m) { testsRun = Number(m[1]); testsFailed = Number(m[2]) }
  }

  return {
    ok: exitCode === 0 && testsRun > 0 && testsFailed === 0,
    testsRun,
    testsFailed,
    framework,
    stdout,
  }
}

/**
 * Count frontend test files for a given module. Used to validate coverage ratio.
 */
export function countFrontendTestFiles(frontendDir: string, moduleName?: string): number {
  const candidates = [
    join(frontendDir, 'src', '__tests__'),
    join(frontendDir, 'tests'),
    join(frontendDir, 'src'),                 // inline .test.tsx
  ]
  let count = 0
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    let entries: string[] = []
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      const full = join(dir, e)
      let s
      try { s = statSync(full) } catch { continue }
      if (s.isDirectory()) walk(full)
      else if (/\.(test|spec)\.(tsx?|jsx?)$/.test(e)) {
        if (moduleName) {
          if (e.toLowerCase().includes(moduleName.toLowerCase())) count++
        } else {
          count++
        }
      }
    }
  }
  for (const c of candidates) walk(c)
  return count
}
