/**
 * Lint engine for harness programmatic rules.
 *
 * Supported kinds:
 *   pattern-forbidden     — regex must NOT appear in target files
 *   pattern-required      — regex must appear at least once in target files
 *   pair-required         — if primary file matches, partner files must also match
 *   function-call-arity   — calls to fnName(...) must include all requiredArgs
 *   extension-restriction — files must use one of the allowed extensions
 *   human                 — skipped (cannot programmatically check)
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ProgrammaticRule, LintResult, LintViolation } from './types.js'
import { HarnessError } from './types.js'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type LintOptions = {
  workspacePath: string
  /** Subset of rules to run (default: all) */
  ruleIds?: string[]
  /** Override file globs (default: use each rule's fileGlob or 'src/**\/*') */
  fileGlobs?: string[]
  /** Warnings count as failures */
  strict?: boolean
  /** Stop after N total violations (default: 100) */
  maxViolations?: number
}

// ---------------------------------------------------------------------------
// Skip dirs (mirrors fileDiscovery.ts SKIP_DIRS + audit dir)
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'target', 'graphify-out',
  '.next', '.nuxt', '.turbo', '.vite',
  '.git', '.idea', '.vscode-server',
  'coverage', '.nyc_output', '__pycache__',
  '.bun', '.npm', '.yarn', '.pnpm-store', '.pyenv', '.cargo', '.gradle', '.m2',
  '.metacoder', '.claude', '.lingmaIDE', '.winclaw', 'Library', '.local',
  'AppData', 'Downloads', 'Temp', 'tmp',
  '.venv', 'venv', 'vendor',
  '.cache', '.systest',
])

// Max file size before switching to streaming (1 MB)
const MAX_EAGER_BYTES = 1_048_576

// ---------------------------------------------------------------------------
// File walking (manual glob matching)
// ---------------------------------------------------------------------------

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports: ** (any path segments), * (any filename chars), ? (single char),
 * and {a,b,c} alternation. Anchored to full path match.
 *
 * Strategy: tokenize the glob into literal/glob segments, convert each to regex,
 * then join. This avoids the ordering problem of naive string-replace chains.
 */
function globToRegex(pattern: string): RegExp {
  // Normalize path separators
  const normalized = pattern.replace(/\\/g, '/')

  // Expand {a,b,c} alternation first (before tokenizing)
  const expanded = normalized.replace(/\{([^}]+)\}/g, (_m, inner: string) => {
    const alts = inner.split(',').map(a => a.trim())
    return `\x00ALT\x00${alts.join('\x00')}\x00ENDALT\x00`
  })

  // Convert character by character
  let re = ''
  let i = 0
  while (i < expanded.length) {
    // Check for ALT marker
    if (expanded.startsWith('\x00ALT\x00', i)) {
      const endIdx = expanded.indexOf('\x00ENDALT\x00', i)
      const inner = expanded.slice(i + 6, endIdx)
      const alts = inner.split('\x00').filter(s => s.length > 0).map(a =>
        a.replace(/[.+^$[\]|()\\]/g, c => `\\${c}`)
      )
      re += `(?:${alts.join('|')})`
      i = endIdx + 9 // skip '\x00ENDALT\x00'
      continue
    }

    const ch = expanded[i]

    if (ch === '*') {
      if (expanded[i + 1] === '*') {
        // ** — match any path segment(s)
        if (expanded[i + 2] === '/') {
          re += '(?:[^/]+/)*' // zero or more "segment/" pieces
          i += 3
        } else {
          re += '.*'
          i += 2
        }
      } else {
        re += '[^/]*'
        i++
      }
    } else if (ch === '?') {
      re += '[^/]'
      i++
    } else if ('.+^$|[]()\\'.includes(ch)) {
      re += `\\${ch}`
      i++
    } else {
      re += ch
      i++
    }
  }

  return new RegExp(`^${re}$`)
}

/**
 * Walk directory tree, yielding files that match any of the glob patterns.
 * Skips directories in SKIP_DIRS.
 */
function* walkFiles(rootDir: string, globs: string[]): Generator<string> {
  const regexps = globs.map(g => {
    // Make patterns relative-path aware: if pattern doesn't start with /, treat
    // it as relative to rootDir
    const normalized = g.startsWith('/') ? g.slice(1) : g
    return globToRegex(normalized)
  })

  function* walk(dir: string): Generator<string> {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          yield* walk(full)
        }
      } else if (entry.isFile()) {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/')
        if (regexps.some(r => r.test(rel))) {
          yield full
        }
      }
    }
  }

  yield* walk(rootDir)
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

/**
 * Read a file as UTF-8. Returns null if the file appears to be binary
 * (contains NUL bytes in first 4 KB) or cannot be read.
 */
function readTextFile(filePath: string): string | null {
  let fd: number
  try {
    fd = fs.openSync(filePath, 'r')
  } catch {
    return null
  }

  try {
    const stat = fs.fstatSync(fd)
    const size = stat.size

    // Binary detection: read first 4 KB
    const probe = Buffer.alloc(Math.min(4096, size))
    const probeRead = fs.readSync(fd, probe, 0, probe.length, 0)
    if (probeRead === 0) {
      fs.closeSync(fd)
      return ''
    }
    if (probe.slice(0, probeRead).includes(0)) {
      fs.closeSync(fd)
      return null // binary
    }

    // For small files: read all at once
    if (size <= MAX_EAGER_BYTES) {
      const buf = Buffer.alloc(size)
      fs.readSync(fd, buf, 0, size, 0)
      fs.closeSync(fd)
      return buf.toString('utf-8')
    }

    // Large files: read in 256 KB chunks to avoid OOM
    const CHUNK = 262_144
    const chunks: Buffer[] = []
    let offset = 0
    while (offset < size) {
      const toRead = Math.min(CHUNK, size - offset)
      const chunk = Buffer.alloc(toRead)
      const bytesRead = fs.readSync(fd, chunk, 0, toRead, offset)
      if (bytesRead === 0) break
      chunks.push(chunk.slice(0, bytesRead))
      offset += bytesRead
    }
    fs.closeSync(fd)
    return Buffer.concat(chunks).toString('utf-8')
  } catch {
    try { fs.closeSync(fd) } catch { /* ignore */ }
    return null
  }
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calcScore(errors: number, warnings: number): number {
  return Math.max(0, 100 - errors * 10 - warnings * 2)
}

// ---------------------------------------------------------------------------
// Rule checkers
// ---------------------------------------------------------------------------

function checkPatternForbidden(
  rule: ProgrammaticRule,
  filePath: string,
  content: string,
  relPath: string,
): LintViolation[] {
  if (!rule.pattern) return []
  const re = new RegExp(rule.pattern, 'g')
  const violations: LintViolation[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0
    if (re.test(lines[i])) {
      violations.push({
        ruleId: rule.id,
        ruleSource: rule.source,
        severity: rule.severity,
        file: relPath,
        line: i + 1,
        message: `Forbidden pattern matched: ${rule.summary}`,
        fix: rule.fix,
      })
    }
  }
  return violations
}

function checkPatternRequired(
  rule: ProgrammaticRule,
  filePath: string,
  content: string,
  relPath: string,
): LintViolation[] {
  if (!rule.pattern) return []
  const re = new RegExp(rule.pattern)
  if (!re.test(content)) {
    return [
      {
        ruleId: rule.id,
        ruleSource: rule.source,
        severity: rule.severity,
        file: relPath,
        message: `Required pattern not found: ${rule.summary}`,
        fix: rule.fix,
      },
    ]
  }
  return []
}

function checkFunctionCallArity(
  rule: ProgrammaticRule,
  filePath: string,
  content: string,
  relPath: string,
): LintViolation[] {
  if (!rule.pattern || !rule.requiredArgs?.length) return []

  const fnRe = new RegExp(rule.pattern, 'g')
  const violations: LintViolation[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    fnRe.lastIndex = 0
    const lineText = lines[i]
    let callMatch: RegExpExecArray | null
    while ((callMatch = fnRe.exec(lineText)) !== null) {
      // Collect args from this call site — find matching closing paren
      // Gather the rest of the line + a few more lines as context
      const callStart = callMatch.index + callMatch[0].length - 1 // position of '('
      const context = lines.slice(i, Math.min(i + 5, lines.length)).join('\n')
      const fromParen = context.slice(callStart)

      // Check that each required arg appears in the argument text
      const missingArgs = rule.requiredArgs!.filter(arg => !fromParen.includes(arg))
      if (missingArgs.length > 0) {
        violations.push({
          ruleId: rule.id,
          ruleSource: rule.source,
          severity: rule.severity,
          file: relPath,
          line: i + 1,
          message: `Function call missing required arg(s) [${missingArgs.join(', ')}]: ${rule.summary}`,
          fix: rule.fix,
        })
      }
    }
  }
  return violations
}

function checkExtensionRestriction(
  rule: ProgrammaticRule,
  filePath: string,
  relPath: string,
): LintViolation[] {
  if (!rule.allowedExtensions?.length) return []
  const ext = path.extname(filePath).toLowerCase()
  if (!rule.allowedExtensions.includes(ext)) {
    return [
      {
        ruleId: rule.id,
        ruleSource: rule.source,
        severity: rule.severity,
        file: relPath,
        message: `File extension "${ext}" is not in allowed list [${rule.allowedExtensions.join(', ')}]: ${rule.summary}`,
        fix: rule.fix,
      },
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// pair-required checker
// ---------------------------------------------------------------------------

function checkPairRequired(
  rule: ProgrammaticRule,
  workspacePath: string,
  primaryGlob: string,
  violations: LintViolation[],
): void {
  if (!rule.pattern || !rule.partnerGlob) return

  const primaryRe = new RegExp(rule.pattern, 'g')

  // Collect all symbols from all primary files
  const primaryFiles = [...walkFiles(workspacePath, [primaryGlob])]
  const partnerFiles = [...walkFiles(workspacePath, [rule.partnerGlob])]

  if (primaryFiles.length === 0) return

  for (const primaryPath of primaryFiles) {
    const content = readTextFile(primaryPath)
    if (content === null) continue

    // Extract all matches from primary file
    const primaryMatches: string[] = []
    primaryRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = primaryRe.exec(content)) !== null) {
      primaryMatches.push(m[0])
    }

    if (primaryMatches.length === 0) continue

    // For each partner file, verify the same count of matches exists
    const relPrimary = path.relative(workspacePath, primaryPath).replace(/\\/g, '/')

    for (const partnerPath of partnerFiles) {
      const partnerContent = readTextFile(partnerPath)
      if (partnerContent === null) continue

      const partnerRe = new RegExp(rule.pattern, 'g')
      let partnerMatchCount = 0
      while ((partnerRe.exec(partnerContent)) !== null) {
        partnerMatchCount++
      }

      if (partnerMatchCount !== primaryMatches.length) {
        const relPartner = path.relative(workspacePath, partnerPath).replace(/\\/g, '/')
        violations.push({
          ruleId: rule.id,
          ruleSource: rule.source,
          severity: rule.severity,
          file: relPrimary,
          message:
            `pair-required: primary file has ${primaryMatches.length} match(es) but ` +
            `partner "${relPartner}" has ${partnerMatchCount} — ${rule.summary}`,
          fix: rule.fix,
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public: runLint
// ---------------------------------------------------------------------------

export async function runLint(options: LintOptions): Promise<LintResult> {
  const start = Date.now()
  const {
    workspacePath,
    ruleIds,
    fileGlobs: overrideGlobs,
    strict = false,
    maxViolations = 100,
  } = options

  // Dynamic import to avoid circular dependency at module level
  const { loadAllRules } = await import('./ruleParser.js')

  const allRules = await loadAllRules(workspacePath)

  if (allRules.length === 0) {
    throw new HarnessError(
      `No programmatic rules found in ${path.join(workspacePath, 'harness/rules')}`,
      'harness-not-initialized',
    )
  }

  // Filter rules by ruleIds if provided
  const rules = ruleIds
    ? allRules.filter(r => ruleIds.includes(r.id))
    : allRules

  const violations: LintViolation[] = []
  const scannedFiles = new Set<string>()
  let hitLimit = false

  function addViolations(newVios: LintViolation[]): boolean {
    for (const v of newVios) {
      violations.push(v)
      if (violations.length >= maxViolations) {
        hitLimit = true
        return false
      }
    }
    return true
  }

  for (const rule of rules) {
    if (hitLimit) break
    if (rule.kind === 'human') continue

    if (rule.kind === 'pair-required') {
      const primaryGlob = overrideGlobs?.[0] ?? rule.fileGlob ?? 'src/**/*'
      const pairVios: LintViolation[] = []
      checkPairRequired(rule, workspacePath, primaryGlob, pairVios)
      if (!addViolations(pairVios)) break
      continue
    }

    // File-scanning rules
    const globs = overrideGlobs ?? (rule.fileGlob ? [rule.fileGlob] : ['src/**/*'])
    const files = [...walkFiles(workspacePath, globs)]

    for (const filePath of files) {
      if (hitLimit) break
      scannedFiles.add(filePath)

      const relPath = path.relative(workspacePath, filePath).replace(/\\/g, '/')

      if (rule.kind === 'extension-restriction') {
        const extVios = checkExtensionRestriction(rule, filePath, relPath)
        if (!addViolations(extVios)) break
        continue
      }

      const content = readTextFile(filePath)
      if (content === null) continue // binary — skip

      let fileVios: LintViolation[] = []

      switch (rule.kind) {
        case 'pattern-forbidden':
          fileVios = checkPatternForbidden(rule, filePath, content, relPath)
          break
        case 'pattern-required':
          fileVios = checkPatternRequired(rule, filePath, content, relPath)
          break
        case 'function-call-arity':
          fileVios = checkFunctionCallArity(rule, filePath, content, relPath)
          break
      }

      if (!addViolations(fileVios)) break
    }
  }

  // Sort: severity order error > warning > info, then by file path
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 }
  violations.sort((a, b) => {
    const sv = severityOrder[a.severity] - severityOrder[b.severity]
    if (sv !== 0) return sv
    return a.file.localeCompare(b.file)
  })

  const errors = violations.filter(v => v.severity === 'error').length
  const warnings = violations.filter(v => v.severity === 'warning').length
  const score = calcScore(errors, warnings)
  const passed = strict ? errors === 0 && warnings === 0 : errors === 0

  return {
    passed,
    violations,
    score,
    durationMs: Date.now() - start,
    filesScanned: scannedFiles.size,
    rulesEvaluated: rules.filter(r => r.kind !== 'human').length,
  }
}
