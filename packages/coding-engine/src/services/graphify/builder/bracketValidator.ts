/**
 * Bracket matching validator and repair utility for the graphify builder.
 *
 * Ported to TypeScript from `skills/fix-brackets/index.mjs` (meta-coder defensive
 * utility) so it lives alongside the parsers it protects. Use cases:
 *
 *   1. Library use — parser.ts / openApiParser.ts can optionally call
 *      `validateBrackets(content)` before regex extraction to flag files that
 *      are in a bad state (the parsers themselves are tolerant, but warnings
 *      surface real bugs earlier).
 *
 *   2. Dev CLI — when a regex-heavy edit to parser.ts or a peer builder file
 *      leaves brace counts mismatched (a known failure mode during parallel
 *      agent edits), run directly:
 *
 *        bun src/services/graphify/builder/bracketValidator.ts <file-path>
 *
 *      The duplicate `} }` anti-pattern is auto-fixed; other imbalances are
 *      reported. A `.bak` backup is written before any modification.
 *
 * All mutating functions are opt-in — validation is pure and side-effect free.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BracketCounts {
  '{': number
  '}': number
  '(': number
  ')': number
  '[': number
  ']': number
}

export type BracketIssueType = 'extra_closing' | 'unbalanced' | 'duplicate_closing'

export interface BracketIssue {
  /** 1-based line number (absent for file-level issues). */
  line?: number
  type: BracketIssueType
  message: string
  /** Trimmed line content, when relevant. */
  content?: string
  /** Net brace depth at end of file (for `unbalanced`). */
  finalDepth?: number
}

export interface BracketReport {
  counts: BracketCounts
  issues: BracketIssue[]
  /** True iff every opener has a matching closer (count-level check). */
  balanced: boolean
}

export interface RepairResult {
  report: BracketReport
  fixedContent: string
  /** True iff `repairContent` produced a different string. */
  changed: boolean
}

export interface RepairFileOptions {
  /** Write a sibling `.bak` before modifying. Default: true. */
  backup?: boolean
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/** Count every occurrence of each bracket character in `content`. */
export function countBrackets(content: string): BracketCounts {
  const counts: BracketCounts = { '{': 0, '}': 0, '(': 0, ')': 0, '[': 0, ']': 0 }
  for (const ch of content) {
    if (ch in counts) counts[ch as keyof BracketCounts]++
  }
  return counts
}

/**
 * Line-by-line brace depth analysis plus global count check.
 * Does not honour string literals or comments — the original fix-brackets
 * script worked at the character level and that's good enough for the
 * "regex-edit went wrong" cases this utility exists for.
 */
export function validateBrackets(content: string): BracketReport {
  const counts = countBrackets(content)
  const lines = content.split('\n')
  const issues: BracketIssue[] = []
  let depth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let lineChange = 0
    for (const ch of line) {
      if (ch === '{') lineChange++
      else if (ch === '}') lineChange--
    }
    depth += lineChange

    if (depth < 0) {
      issues.push({
        line: i + 1,
        type: 'extra_closing',
        message: 'More closing than opening braces at this point',
      })
      // Reset so a single spurious `}` doesn't keep firing on every subsequent line.
      depth = 0
    }
  }

  if (depth !== 0) {
    issues.push({
      type: 'unbalanced',
      message: depth > 0 ? `Missing ${depth} closing brace(s)` : `Extra ${-depth} closing brace(s)`,
      finalDepth: depth,
    })
  }

  // Duplicate closing braces on the same line (`}}` or `} }` with only whitespace).
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\}\s*\}\s*$/.test(lines[i])) {
      issues.push({
        line: i + 1,
        type: 'duplicate_closing',
        message: 'Duplicate closing braces on same line',
        content: lines[i].trim(),
      })
    }
  }

  return {
    counts,
    issues,
    balanced:
      counts['{'] === counts['}'] &&
      counts['('] === counts[')'] &&
      counts['['] === counts[']'],
  }
}

/**
 * Produce a repaired copy of `content`, fixing the small set of patterns that
 * are unambiguous to correct mechanically:
 *   - Lines matching `/^\s*\}\s*\}\s*$/` are collapsed to a single `}`.
 *
 * Other imbalances (missing/extra braces not on a duplicate-closing line) are
 * reported but not modified — mechanical fixes there are unsafe.
 */
export function repairContent(content: string): RepairResult {
  const report = validateBrackets(content)
  const lines = content.split('\n')
  let changed = false

  for (const issue of report.issues) {
    if (issue.type !== 'duplicate_closing' || !issue.line) continue
    const idx = issue.line - 1
    const before = lines[idx]
    const after = before.replace(/^\s*\}\s*\}\s*$/, '}')
    if (before !== after) {
      lines[idx] = after
      changed = true
    }
  }

  return {
    report,
    fixedContent: lines.join('\n'),
    changed,
  }
}

// ---------------------------------------------------------------------------
// I/O wrappers
// ---------------------------------------------------------------------------

/** Read a file and run `validateBrackets` on its contents. */
export function validateFile(filePath: string): BracketReport {
  return validateBrackets(readFileSync(filePath, 'utf-8'))
}

/**
 * Read a file, apply the mechanical repairs, and (iff something changed) write
 * the fixed content back. A `.bak` backup of the original is written first
 * unless `{ backup: false }`.
 */
export function repairFile(filePath: string, options: RepairFileOptions = {}): RepairResult {
  const { backup = true } = options
  const original = readFileSync(filePath, 'utf-8')
  const result = repairContent(original)

  if (result.changed) {
    if (backup) writeFileSync(filePath + '.bak', original, 'utf-8')
    writeFileSync(filePath, result.fixedContent, 'utf-8')
  }

  return result
}

// ---------------------------------------------------------------------------
// CLI — invoke directly: `bun src/services/graphify/builder/bracketValidator.ts <path>`
// ---------------------------------------------------------------------------

export function formatReport(filePath: string, report: BracketReport): string {
  const lines: string[] = []
  lines.push(`Analyzing ${path.basename(filePath)}...`)
  lines.push('')
  lines.push('Bracket counts:')
  lines.push(`  {: ${report.counts['{']}  }: ${report.counts['}']}`)
  lines.push(`  (: ${report.counts['(']}  ): ${report.counts[')']}`)
  lines.push(`  [: ${report.counts['[']}  ]: ${report.counts[']']}`)

  if (report.issues.length === 0) {
    lines.push('')
    lines.push('✅ No bracket mismatches found!')
    return lines.join('\n')
  }

  lines.push('')
  lines.push(`⚠️  Found ${report.issues.length} issue(s):`)
  for (const issue of report.issues) {
    if (issue.line) lines.push(`  Line ${issue.line}: ${issue.message}`)
    else lines.push(`  ${issue.type}: ${issue.message}`)
  }
  return lines.join('\n')
}

if (import.meta.main) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: bun src/services/graphify/builder/bracketValidator.ts <file-path>')
    process.exit(1)
  }

  const result = repairFile(filePath)
  console.log(formatReport(filePath, result.report))

  if (result.changed) {
    console.log('')
    console.log(`✅ Fixed! Backup saved to: ${path.basename(filePath)}.bak`)
  }

  // Always exit 0 — this is a helper utility, not a strict validator.
  // The char-level count will false-positive on any TS/JS file with string
  // literals or regexes containing unbalanced braces, so a non-zero exit
  // would be noisy. CI users should grep the output for "⚠️" or issue
  // types if they need a signal.
}
