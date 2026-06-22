/**
 * Phase 4 anti-fraud guards.
 *
 * Guard 1 (verifyCompletionContent): content-based verification that a
 * completion.json's claims match reality on disk — endpoints exist as
 * route decorators in claimed source files, files aren't stubs, tests
 * cover claimed endpoints.
 *
 * Guard 3 (auditFileOwnership): cross-PRP audit that each source file is
 * claimed by at most one PRP (shared infrastructure files excepted).
 *
 * Both functions are pure read-only and never throw — failures surface
 * as issues/conflicts in the returned structure.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename, extname, isAbsolute } from 'node:path'

// ---------------------------------------------------------------------------
// Guard 1 — Content verification
// ---------------------------------------------------------------------------

export interface CompletionContentCheck {
  valid: boolean
  issues: string[]
  stats?: {
    endpointsClaimed: number
    endpointsFound: number
    stubLinesFound: number
    totalSourceLines: number
    testsFound: number
  }
}

/**
 * Normalize a file path claimed inside completion.json.
 * Supports absolute paths (already resolved) and workspace-relative paths.
 */
function resolveClaimedPath(workspace: string, rel: string): string {
  if (!rel) return rel
  if (isAbsolute(rel)) return rel
  if (/^[A-Za-z]:[\\/]/.test(rel)) return rel
  return join(workspace, rel.replace(/^\//, '').replace(/\\/g, '/'))
}

/**
 * Extract endpoint descriptors from a completion.json, supporting both
 * the expected schema and the AI-drifted schema.
 *
 * Returns array of { method, path } with method uppercased.
 */
function extractEndpoints(data: any): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = []
  const push = (method: any, path: any) => {
    if (typeof method !== 'string' || typeof path !== 'string') return
    const m = method.toUpperCase().trim()
    if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(m)) return
    out.push({ method: m, path: path.trim() })
  }

  const candidates: any[] = [
    data?.artifacts?.endpoints,
    data?.endpoints_implemented,
    data?.endpoints,
    data?.artifacts?.backend?.endpoints,
  ]
  for (const c of candidates) {
    if (!Array.isArray(c)) continue
    for (const ep of c) {
      if (!ep) continue
      if (typeof ep === 'string') {
        // e.g. "GET /api/foo"
        const m = ep.match(/^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i)
        if (m) push(m[1], m[2])
      } else if (typeof ep === 'object') {
        push(ep.method || ep.verb || ep.httpMethod, ep.path || ep.route || ep.url)
      }
    }
  }
  return out
}

/**
 * Collect source file paths from either schema.
 */
function extractSourceFiles(data: any): string[] {
  const out: string[] = []
  const add = (v: any) => {
    if (Array.isArray(v)) {
      for (const f of v) if (typeof f === 'string' && f.length > 0) out.push(f)
    }
  }
  add(data?.artifacts?.sourceFiles)
  add(data?.files_created)
  add(data?.files)
  // nested shapes
  const art = data?.artifacts
  if (art && typeof art === 'object') {
    for (const v of Object.values(art)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        add((v as any).sourceFiles)
        add((v as any).files)
      }
    }
  }
  return Array.from(new Set(out))
}

function extractTestFiles(data: any): string[] {
  const out: string[] = []
  const add = (v: any) => {
    if (Array.isArray(v)) {
      for (const f of v) if (typeof f === 'string' && f.length > 0) out.push(f)
    }
  }
  add(data?.artifacts?.testFiles)
  add(data?.tests_created)
  add(data?.testFiles)
  const art = data?.artifacts
  if (art && typeof art === 'object') {
    for (const v of Object.values(art)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        add((v as any).testFiles)
      }
    }
  }
  // also catch source files named test_* or *.test.*
  return Array.from(new Set(out))
}

/**
 * Escape a route path (with {id}, :id, *) into a regex body that matches
 * the literal string form used in a route decorator.
 */
function escapePathForRegex(p: string): string {
  // Escape regex metachars except the placeholders which we convert to
  // permissive matches so "/users/{id}" matches "/users/{id}" or ":id" form.
  let out = ''
  for (let i = 0; i < p.length; i++) {
    const ch = p[i]
    if (/[.+?^$()|[\]\\]/.test(ch)) {
      out += '\\' + ch
    } else if (ch === '{') {
      // consume until }
      const close = p.indexOf('}', i)
      if (close === -1) {
        out += '\\{'
      } else {
        out += '(?:\\{[^}]+\\}|:[A-Za-z0-9_]+|<[^>]+>)'
        i = close
      }
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Build per-language route-detection regexes for a given endpoint.
 * Returns array of regex tried in order; any match = endpoint implemented.
 */
function endpointPatterns(ep: { method: string; path: string }, ext: string): RegExp[] {
  const m = ep.method.toLowerCase()
  const M = ep.method.toUpperCase()
  const p = escapePathForRegex(ep.path)
  const quote = `['"\`]`

  switch (ext) {
    case '.py':
      return [
        // FastAPI / Flask: @router.get("/path")  or @app.route("/path", methods=["GET"])
        new RegExp(`@\\s*(?:router|app|blueprint|bp)\\s*\\.\\s*${m}\\s*\\(\\s*${quote}${p}${quote}`, 'i'),
        new RegExp(`@\\s*(?:router|app|blueprint|bp)\\s*\\.\\s*route\\s*\\(\\s*${quote}${p}${quote}[^)]*methods\\s*=\\s*\\[[^\\]]*${quote}${M}${quote}`, 'i'),
      ]
    case '.ts':
    case '.tsx':
    case '.js':
    case '.mjs':
    case '.cjs':
      return [
        // express/hono/fastify: router.get('/path' / app.get(`/path`
        new RegExp(`(?:router|app|server|fastify|r)\\s*\\.\\s*${m}\\s*\\(\\s*${quote}${p}${quote}`, 'i'),
      ]
    case '.java':
    case '.kt':
      return [
        new RegExp(`@\\s*${M.charAt(0)}${M.slice(1).toLowerCase()}Mapping\\s*\\(\\s*(?:value\\s*=\\s*)?${quote}${p}${quote}`),
        new RegExp(`@\\s*RequestMapping\\s*\\([^)]*${quote}${p}${quote}[^)]*RequestMethod\\s*\\.\\s*${M}`),
      ]
    case '.go':
      return [
        // gin/echo: r.GET("/path"  |  e.POST("/path"
        new RegExp(`\\.\\s*${M}\\s*\\(\\s*${quote}${p}${quote}`),
      ]
    case '.php':
      return [
        // Laravel: Route::get('/path'
        new RegExp(`Route\\s*::\\s*${m}\\s*\\(\\s*${quote}${p}${quote}`, 'i'),
      ]
    case '.rb':
      return [
        // Rails-ish: get '/path'  | post "/path"
        new RegExp(`^\\s*${m}\\s+${quote}${p}${quote}`, 'im'),
      ]
    case '.cs':
      return [
        new RegExp(`\\[\\s*Http${M.charAt(0)}${M.slice(1).toLowerCase()}\\s*(?:\\(\\s*${quote}${p}${quote})?`),
        new RegExp(`\\[\\s*Route\\s*\\(\\s*${quote}${p}${quote}`),
      ]
    default:
      return [new RegExp(`${quote}${p}${quote}`)]
  }
}

const STUB_PATTERNS: RegExp[] = [
  /^\s*pass\s*$/,
  /^\s*\.\.\.\s*$/,
  /^\s*raise\s+NotImplementedError/,
  /^\s*return\s+(None|\{\s*\}|\[\s*\])\s*$/,
  /^\s*throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/i,
  /^\s*\/\/\s*TODO\s*:?\s*implement/i,
  /^\s*#\s*TODO\s*:?\s*implement/i,
]

function countStubsAndLines(content: string): { stubs: number; lines: number } {
  const lines = content.split(/\r?\n/)
  let stubs = 0
  // Only count a stub line if the IMMEDIATELY PRECEDING non-blank line looks like a
  // function/method declaration. Legit `return []` / `return None` in the middle of
  // real logic should not count. Def patterns across languages:
  const defPatterns = [
    /^\s*(async\s+)?def\s+\w+\s*\(/,              // Python
    /^\s*(export\s+)?(async\s+)?function\s+\w+\s*\(/, // JS/TS
    /^\s*\w+\s*\([^)]*\)\s*(:\s*\w[\w\[\]<>|,\s]*)?\s*=>\s*\{?\s*$/, // arrow fn body
    /^\s*(public|private|protected|static|\s)+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{?\s*$/, // Java/C# method
    /^\s*func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/,  // Go
    /^\s*fn\s+\w+\s*\(/,                           // Rust
    /^\s*sub\s+\w+\s*\{?/,                         // Perl
  ]
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    let isStubLine = false
    for (const rx of STUB_PATTERNS) {
      if (rx.test(l)) { isStubLine = true; break }
    }
    if (!isStubLine) continue
    // Look backward for preceding non-blank line
    let j = i - 1
    while (j >= 0 && /^\s*(#|\/\/|\*|$)/.test(lines[j])) j--
    const prev = j >= 0 ? lines[j] : ''
    // Count as stub only if preceded by def-like line (i.e., an empty function body)
    if (defPatterns.some(rx => rx.test(prev))) stubs++
  }
  return { stubs, lines: lines.length }
}

const TEST_PATTERNS: RegExp[] = [
  /^\s*(?:async\s+)?def\s+test_\w+/m,                          // python pytest
  /^\s*(?:export\s+)?function\s+test\w+/m,                     // jsy
  /^\s*(?:it|test)\s*\(\s*['"`]/m,                             // jest/vitest/mocha
  /@Test\b/,                                                   // java junit
  /func\s+Test\w+\s*\(/,                                       // go test
]

function countTestsInFile(content: string): number {
  let n = 0
  for (const rx of TEST_PATTERNS) {
    const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')
    const matches = content.match(g)
    if (matches) n += matches.length
  }
  return n
}

export function verifyCompletionContent(
  completionJsonPath: string,
  workspace: string,
): CompletionContentCheck {
  const issues: string[] = []

  if (!existsSync(completionJsonPath)) {
    return { valid: false, issues: ['completion.json path does not exist: ' + completionJsonPath] }
  }

  let data: any
  try {
    data = JSON.parse(readFileSync(completionJsonPath, 'utf-8'))
  } catch (e) {
    return { valid: false, issues: ['completion.json malformed: ' + (e instanceof Error ? e.message : String(e))] }
  }

  // Fraud signal: status=completed with tests_passing=false
  const statusStr = String(data?.status ?? data?.state ?? '').toLowerCase()
  const testsPassingFlag =
    data?.tests_passing ??
    data?.testsPass ??
    data?.verification?.testsPass ??
    data?.verification?.tests_passing
  if ((statusStr === 'completed' || statusStr === 'done' || statusStr === 'success')
      && testsPassingFlag === false) {
    issues.push('fraud signal: status=' + statusStr + ' but tests_passing=false')
  }

  // Endpoint verification
  const endpoints = extractEndpoints(data)
  const sourceFiles = extractSourceFiles(data)
  const testFiles = extractTestFiles(data)

  // Pre-read source contents (cached)
  const fileCache = new Map<string, { content: string | null; resolved: string }>()
  const readSource = (rel: string): { content: string | null; resolved: string } => {
    const hit = fileCache.get(rel)
    if (hit) return hit
    const resolved = resolveClaimedPath(workspace, rel)
    let content: string | null = null
    try {
      if (!existsSync(resolved)) {
        issues.push('claimed file does not exist: ' + rel)
      } else {
        const st = statSync(resolved)
        if (st.isFile()) content = readFileSync(resolved, 'utf-8')
      }
    } catch (e) {
      issues.push('unreadable file ' + rel + ': ' + (e instanceof Error ? e.message : String(e)))
    }
    const rec = { content, resolved }
    fileCache.set(rel, rec)
    return rec
  }

  // Count stubs across all source files (exclude test files from stub check)
  let totalStubs = 0
  let totalLines = 0
  for (const sf of sourceFiles) {
    const { content } = readSource(sf)
    if (!content) continue
    // heuristic: skip test files for stub counting
    if (/(^|[\\/])tests?[\\/]|test_|\.test\.|\.spec\./.test(sf)) continue
    const { stubs, lines } = countStubsAndLines(content)
    totalStubs += stubs
    totalLines += lines
  }
  if (totalStubs > 2 && totalLines > 0 && totalStubs / totalLines > 0.1) {
    issues.push(
      'source looks like placeholders: ' + totalStubs + ' stub lines out of ' + totalLines +
      ' (ratio ' + (totalStubs / totalLines).toFixed(2) + ')',
    )
  }

  // Endpoint → source regex match
  let endpointsFound = 0
  for (const ep of endpoints) {
    let found = false
    for (const sf of sourceFiles) {
      const { content } = readSource(sf)
      if (!content) continue
      const ext = extname(sf).toLowerCase()
      const patterns = endpointPatterns(ep, ext)
      for (const rx of patterns) {
        if (rx.test(content)) { found = true; break }
      }
      if (found) break
    }
    if (found) endpointsFound++
    else issues.push('endpoint not found in source: ' + ep.method + ' ' + ep.path)
  }

  // Count tests
  let testsFound = 0
  for (const tf of testFiles) {
    const { content } = readSource(tf)
    if (!content) continue
    testsFound += countTestsInFile(content)
  }
  // Also check source files for tests (some projects colocate)
  for (const sf of sourceFiles) {
    if (!/(^|[\\/])tests?[\\/]|test_|\.test\.|\.spec\./.test(sf)) continue
    const { content } = readSource(sf)
    if (!content) continue
    testsFound += countTestsInFile(content)
  }
  if (endpoints.length > 0 && testsFound < endpoints.length) {
    issues.push(
      'insufficient tests: ' + testsFound + ' test(s) found for ' + endpoints.length + ' endpoint(s)',
    )
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      endpointsClaimed: endpoints.length,
      endpointsFound,
      stubLinesFound: totalStubs,
      totalSourceLines: totalLines,
      testsFound,
    },
  }
}

// ---------------------------------------------------------------------------
// Guard 3 — File ownership audit
// ---------------------------------------------------------------------------

export interface FileOwnershipAudit {
  valid: boolean
  conflicts: Array<{ file: string; claimedBy: string[] }>
}

const SHARED_INFRA_BASENAMES = new Set([
  'main.py', 'main.ts', 'main.js', 'main.go',
  'app.py', 'app.ts', 'app.js',
  'index.ts', 'index.js', 'index.tsx', 'index.jsx',
  'database.py', 'database.ts',
  'db.py', 'db.ts',
  'config.py', 'config.ts', 'config.js',
  'settings.py',
  'conftest.py',
  '__init__.py',
  'server.py', 'server.ts', 'server.js',
  'routes.py', 'routes.ts',
  'deps.py', 'dependencies.py',
])

// STRICT shared-dir rule: only exempt when `shared/` / `common/` / `core/` appears
// as the FIRST or SECOND path segment from the workspace root. An attacker cannot
// dodge Guard 3 by placing a fraud file deep in `backend/app/common/operations.py`
// — that path's "common/" is at depth 3, not exempt.
const SHARED_DIR_RX = /^(?:[^\\/]+[\\/])?(shared|common|core|infra|infrastructure)[\\/]/i

function isSharedInfra(filePath: string): boolean {
  const base = basename(filePath).toLowerCase()
  if (SHARED_INFRA_BASENAMES.has(base)) return true
  // Normalize leading ./ and backslashes for consistent matching
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '')
  if (SHARED_DIR_RX.test(normalized)) return true
  return false
}

export function auditFileOwnership(prpDoneDir: string): FileOwnershipAudit {
  const conflicts: Array<{ file: string; claimedBy: string[] }> = []
  if (!existsSync(prpDoneDir)) {
    return { valid: true, conflicts }
  }

  let entries: string[]
  try {
    entries = readdirSync(prpDoneDir).filter(f => f.toLowerCase().endsWith('.completion.json'))
  } catch {
    return { valid: true, conflicts }
  }

  const fileToPrps = new Map<string, Set<string>>()
  for (const entry of entries) {
    const full = join(prpDoneDir, entry)
    let data: any
    try {
      data = JSON.parse(readFileSync(full, 'utf-8'))
    } catch {
      continue
    }
    const files = extractSourceFiles(data)
    for (const f of files) {
      if (isSharedInfra(f)) continue
      const norm = f.replace(/\\/g, '/').toLowerCase()
      if (!fileToPrps.has(norm)) fileToPrps.set(norm, new Set())
      fileToPrps.get(norm)!.add(entry)
    }
  }

  for (const [file, set] of fileToPrps.entries()) {
    if (set.size > 1) {
      conflicts.push({ file, claimedBy: Array.from(set).sort() })
    }
  }

  return { valid: conflicts.length === 0, conflicts }
}
