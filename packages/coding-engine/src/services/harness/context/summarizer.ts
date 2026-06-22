/**
 * summarizer.ts — Deterministic heuristic content summarizer.
 *
 * Shrinks markdown/text content to fit within a target token budget without
 * making any LLM calls. Strategy:
 *   1. Keep all headings (##, ###, etc.)
 *   2. Keep first paragraph of each section (up to first blank line)
 *   3. Keep all bullet-point lines (- / * / numbered)
 *   4. If still over budget, truncate remaining prose with a marker
 *
 * The function is idempotent: calling it on already-summarized content
 * produces content with a single `<!-- harness-summarized -->` header.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import { approxTokens } from './tokenizer.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUMMARIZED_MARKER = '<!-- harness-summarized -->'
const TRUNCATED_MARKER = '<!-- harness-truncated -->'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line)
}

function isBullet(line: string): boolean {
  return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

/**
 * Strip the harness-summarized marker from the top of a string, if present.
 * Also strips the harness-truncated marker anywhere in the text.
 */
function stripMarkers(text: string): string {
  return text
    .replace(new RegExp(`^${escapeRegex(SUMMARIZED_MARKER)}\\s*\\n?`), '')
    .replace(new RegExp(escapeRegex(TRUNCATED_MARKER) + '\\s*\\n?[\\s\\S]*$'), '')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Core summarization
// ---------------------------------------------------------------------------

/**
 * Summarize `text` to approximately `targetTokens` tokens.
 *
 * If the text already fits within the target, it is returned unchanged
 * (without the summarized marker — no point adding it if nothing was cut).
 *
 * If the text exceeds the target, the heuristic extraction runs, followed
 * by hard truncation as a last resort. The result is prefixed with
 * `<!-- harness-summarized -->`.
 *
 * The function is idempotent: if the input already starts with the marker,
 * the marker is stripped before processing so the result never has duplicates.
 *
 * @param text - Input content (markdown/YAML/plaintext)
 * @param targetTokens - Desired maximum token count
 * @returns Summarized string (same as input if it already fits)
 */
export function summarize(text: string, targetTokens: number): string {
  if (targetTokens <= 0) return ''

  // Strip any prior summarization markers so we work on clean text.
  const clean = stripMarkers(text)

  if (approxTokens(clean) <= targetTokens) {
    // Fits as-is — no marker needed.
    return clean
  }

  // ------------------------------------------------------------------
  // Phase 1: Heuristic extraction
  // ------------------------------------------------------------------
  const lines = clean.split('\n')
  const kept: string[] = []

  let inFirstParaOfSection = false
  let passedFirstBlankInSection = false

  for (const line of lines) {
    if (isHeading(line)) {
      kept.push(line)
      inFirstParaOfSection = true
      passedFirstBlankInSection = false
      continue
    }

    if (isBullet(line)) {
      kept.push(line)
      inFirstParaOfSection = false
      continue
    }

    if (isBlank(line)) {
      if (inFirstParaOfSection && !passedFirstBlankInSection) {
        // First blank after section start — keep the blank, mark end of first para
        kept.push(line)
        passedFirstBlankInSection = true
      } else if (kept.length > 0 && !isBlank(kept[kept.length - 1])) {
        // Preserve at most one blank between kept sections
        kept.push(line)
      }
      continue
    }

    // Prose line
    if (inFirstParaOfSection && !passedFirstBlankInSection) {
      // We are inside the first paragraph of a section — keep it
      kept.push(line)
    }
    // Skip prose outside first paragraph
  }

  let summarized = kept.join('\n').trim()

  // ------------------------------------------------------------------
  // Phase 2: Hard truncation if still over budget
  // ------------------------------------------------------------------
  if (approxTokens(summarized) > targetTokens) {
    const chars = targetTokens * 4
    summarized = summarized.slice(0, chars).trimEnd() + '\n' + TRUNCATED_MARKER
  }

  return SUMMARIZED_MARKER + '\n' + summarized
}
