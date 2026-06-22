/**
 * Rule parser for harness/rules/*.md files.
 *
 * Two extraction modes:
 *   Mode A — Fenced ```rule blocks with YAML front-matter (preferred)
 *   Mode B — Heading + regex fence fallback for simple rules
 *
 * Public API:
 *   parseRulesFromMarkdown(content, sourcePath) → ProgrammaticRule[]
 *   loadAllRules(workspacePath)                 → Promise<ProgrammaticRule[]>
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import type { ProgrammaticRule } from './types.js'
import { HarnessError } from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_KINDS = new Set<string>([
  'pattern-forbidden',
  'pattern-required',
  'pair-required',
  'function-call-arity',
  'extension-restriction',
  'human',
])

// Regex to extract fenced code blocks with info-string "rule" or "rule.yaml"
// Captures the whole block content between the fences.
const FENCED_RULE_RE = /^```(?:rule|rule\.yaml)\r?\n([\s\S]*?)^```/gm

// Regex for Mode B: heading that contains a known kind in backticks
// e.g. ### `pattern-forbidden`: No `double` for money
const HEADING_KIND_RE = /^#{1,6}\s.*`(pattern-forbidden|pattern-required|pair-required|function-call-arity|extension-restriction)`/m

// Regex for Mode B: ```regex fence immediately after the heading
const FENCED_REGEX_RE = /^```regex\r?\n([\s\S]*?)^```/m

// ---------------------------------------------------------------------------
// Mode A parser
// ---------------------------------------------------------------------------

function parseFencedRuleBlock(
  yamlContent: string,
  sourcePath: string,
  index: number,
): ProgrammaticRule {
  let parsed: Record<string, unknown>
  try {
    parsed = YAML.parse(yamlContent) as Record<string, unknown>
  } catch (err) {
    throw new HarnessError(
      `Invalid YAML in rule block #${index + 1} in ${sourcePath}: ${String(err)}`,
      'invalid-rule-block',
      { yamlContent, index },
    )
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new HarnessError(
      `Rule block #${index + 1} in ${sourcePath} did not parse to an object`,
      'invalid-rule-block',
      { yamlContent },
    )
  }

  const id = parsed['id']
  if (typeof id !== 'string' || !id.trim()) {
    throw new HarnessError(
      `Rule block #${index + 1} in ${sourcePath} is missing a valid 'id' field`,
      'invalid-rule-block',
      { parsed },
    )
  }

  const kind = parsed['kind']
  if (typeof kind !== 'string' || !KNOWN_KINDS.has(kind)) {
    throw new HarnessError(
      `Rule block #${index + 1} (id: ${id}) in ${sourcePath} has unknown kind: ${String(kind)}`,
      'invalid-rule-block',
      { id, kind },
    )
  }

  const severity = parsed['severity']
  const validSeverities = new Set(['error', 'warning', 'info'])
  const resolvedSeverity: 'error' | 'warning' | 'info' =
    typeof severity === 'string' && validSeverities.has(severity)
      ? (severity as 'error' | 'warning' | 'info')
      : 'error'

  const rule: ProgrammaticRule = {
    id: id.trim(),
    source: sourcePath,
    summary: typeof parsed['summary'] === 'string' ? parsed['summary'] : id,
    severity: resolvedSeverity,
    kind: kind as ProgrammaticRule['kind'],
  }

  if (typeof parsed['pattern'] === 'string') rule.pattern = parsed['pattern']
  if (typeof parsed['fileGlob'] === 'string') rule.fileGlob = parsed['fileGlob']
  if (typeof parsed['partnerGlob'] === 'string') rule.partnerGlob = parsed['partnerGlob']
  if (Array.isArray(parsed['requiredArgs'])) {
    rule.requiredArgs = parsed['requiredArgs'].filter(a => typeof a === 'string') as string[]
  }
  if (Array.isArray(parsed['allowedExtensions'])) {
    rule.allowedExtensions = parsed['allowedExtensions'].filter(
      a => typeof a === 'string',
    ) as string[]
  }
  if (typeof parsed['fix'] === 'string') rule.fix = parsed['fix']

  return rule
}

// ---------------------------------------------------------------------------
// Mode B parser
// ---------------------------------------------------------------------------

function parseFallbackRules(content: string, sourcePath: string): ProgrammaticRule[] {
  const rules: ProgrammaticRule[] = []

  // Split content into sections by headings
  const sections = content.split(/^(#{1,6}\s.+)$/m)

  for (let i = 0; i < sections.length - 1; i++) {
    const heading = sections[i]
    if (!heading.match(/^#{1,6}\s/)) continue

    const kindMatch = heading.match(
      /`(pattern-forbidden|pattern-required|pair-required|function-call-arity|extension-restriction)`/,
    )
    if (!kindMatch) continue

    const kind = kindMatch[1] as ProgrammaticRule['kind']
    const sectionBody = sections[i + 1] ?? ''

    // Try to extract a regex from the section body
    const regexFenceMatch = sectionBody.match(FENCED_REGEX_RE)
    const pattern = regexFenceMatch ? regexFenceMatch[1].trim() : undefined

    // Derive an id from the heading text: strip hashes, backticks, lowercase, slugify
    const rawTitle = heading.replace(/^#+\s*/, '').trim()
    const id = rawTitle
      .toLowerCase()
      .replace(/`[^`]*`/g, match => match.slice(1, -1))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)

    const rule: ProgrammaticRule = {
      id,
      source: sourcePath,
      summary: rawTitle.replace(/`/g, ''),
      severity: 'error',
      kind,
      ...(pattern ? { pattern } : {}),
    }

    rules.push(rule)
  }

  return rules
}

// ---------------------------------------------------------------------------
// Public: parseRulesFromMarkdown
// ---------------------------------------------------------------------------

/**
 * Parse a markdown string and extract all ProgrammaticRule objects.
 *
 * Mode A (preferred): extracts ```rule or ```rule.yaml fenced blocks.
 * Mode B (fallback): extracts heading+regex patterns for simple rules,
 *   only applied when Mode A yields zero rules.
 */
export function parseRulesFromMarkdown(
  content: string,
  sourcePath: string,
): ProgrammaticRule[] {
  const rules: ProgrammaticRule[] = []

  // Mode A: scan for all ```rule / ```rule.yaml fences
  const fenceRe = new RegExp(FENCED_RULE_RE.source, FENCED_RULE_RE.flags)
  let match: RegExpExecArray | null
  let blockIndex = 0
  while ((match = fenceRe.exec(content)) !== null) {
    const yamlContent = match[1]
    const rule = parseFencedRuleBlock(yamlContent, sourcePath, blockIndex)
    rules.push(rule)
    blockIndex++
  }

  if (rules.length > 0) {
    return rules
  }

  // Mode B: fallback — check if there are any kind-annotated headings
  if (HEADING_KIND_RE.test(content)) {
    return parseFallbackRules(content, sourcePath)
  }

  return []
}

// ---------------------------------------------------------------------------
// Public: loadAllRules
// ---------------------------------------------------------------------------

/**
 * Walk harness/rules/*.md and merge all ProgrammaticRule objects.
 * Duplicate rule ids: first occurrence wins; subsequent are logged as warnings.
 */
export async function loadAllRules(workspacePath: string): Promise<ProgrammaticRule[]> {
  const rulesDir = path.join(workspacePath, 'harness', 'rules')

  let entries: string[]
  try {
    entries = await fs.readdir(rulesDir)
  } catch {
    // harness/rules/ doesn't exist → no rules
    return []
  }

  const mdFiles = entries
    .filter(e => e.endsWith('.md'))
    .map(e => path.join(rulesDir, e))
    .sort()

  const seenIds = new Map<string, string>() // id → source file
  const merged: ProgrammaticRule[] = []

  for (const filePath of mdFiles) {
    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      continue
    }

    const fileRules = parseRulesFromMarkdown(content, filePath)
    for (const rule of fileRules) {
      const existing = seenIds.get(rule.id)
      if (existing) {
        console.warn(
          `[harness/ruleParser] Duplicate rule id "${rule.id}" in ${filePath} ` +
          `(first seen in ${existing}) — skipping duplicate`,
        )
        continue
      }
      seenIds.set(rule.id, filePath)
      merged.push(rule)
    }
  }

  return merged
}
