/**
 * reviewChecklist runner — verifies a structured code-review checklist file
 * exists and has all required items marked checked with non-empty evidence.
 *
 * Designed to prevent rubber-stamp reviews: a human cannot pass this gate
 * merely by writing approved: true. They must produce a checklist that
 * documents WHAT was reviewed and HOW each item was verified.
 *
 * Configuration in gates.yaml:
 *
 *   gate-review:
 *     phase: review
 *     checks:
 *       - type: review-checklist
 *         path: docs/CODE_REVIEW.md       # required; markdown / yaml
 *         minEvidenceChars: 40             # optional, default 20
 *         requiredCategories:              # optional, all must appear as headings
 *           - architecture-conformance
 *           - god-class-detection
 *           - action-coverage
 *           - security
 *           - tests
 *
 * The checklist file format (YAML frontmatter or pure YAML):
 *
 *   ---
 *   reviewer: alice
 *   reviewed_at: 2026-05-15T10:00:00Z
 *   subject: CCFlow Engine M1-M5
 *   items:
 *     - id: god-class-detection
 *       category: god-class-detection
 *       checked: true
 *       evidence: |
 *         Scanned 35 service classes. Max public method count 7 (WorkflowDefService).
 *         All under the 30-method threshold. No god class detected.
 *     - id: send-transaction
 *       category: architecture-conformance
 *       checked: true
 *       evidence: ...
 *   ---
 *
 * The check fails if:
 *   - File is missing or unreadable
 *   - YAML parse error
 *   - Any item has checked != true
 *   - Any item has evidence shorter than minEvidenceChars
 *   - Any requiredCategories is not represented by at least one checked item
 */

import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { CheckResult } from '../../types.js'

export type ReviewChecklistCheck = {
  type: 'review-checklist'
  path: string
  minEvidenceChars?: number
  requiredCategories?: string[]
}

type ChecklistItem = {
  id?: string
  category?: string
  checked?: boolean
  evidence?: string
}

type ChecklistDoc = {
  reviewer?: string
  reviewed_at?: string
  subject?: string
  items?: ChecklistItem[]
}

/**
 * Parse the checklist file. Supports:
 *  - Pure YAML (.yaml / .yml)
 *  - Markdown with YAML frontmatter (--- ... ---)
 */
function parseChecklist(raw: string): ChecklistDoc | null {
  // Markdown frontmatter
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const body = m ? m[1] : raw
  try {
    const parsed = YAML.parse(body!) as unknown
    if (typeof parsed === 'object' && parsed !== null) return parsed as ChecklistDoc
  } catch {
    /* fall through */
  }
  return null
}

export async function runReviewChecklist(
  check: ReviewChecklistCheck,
  ctx: { workspacePath: string; timeoutMs: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const minEvidence = check.minEvidenceChars ?? 20
  const required = check.requiredCategories ?? []
  const file = path.isAbsolute(check.path)
    ? check.path
    : path.join(ctx.workspacePath, check.path)

  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return {
      type: 'review-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Review checklist not found at ${file}.\n` +
        `Per the harness review gate, the reviewer must produce a structured ` +
        `checklist documenting which review items were verified with what evidence. ` +
        `Empty / formal reviews are rejected by design.`,
    }
  }

  const doc = parseChecklist(raw)
  if (!doc) {
    return {
      type: 'review-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Review checklist at ${file} could not be parsed (expected YAML or markdown with YAML frontmatter).`,
    }
  }

  const items = Array.isArray(doc.items) ? doc.items : []
  if (items.length === 0) {
    return {
      type: 'review-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Review checklist at ${file} has no items.`,
    }
  }

  const problems: string[] = []
  for (const [i, it] of items.entries()) {
    const tag = it.id ?? `item[${i}]`
    if (it.checked !== true) problems.push(`${tag}: not marked checked`)
    const ev = (it.evidence ?? '').trim()
    if (ev.length < minEvidence) {
      problems.push(`${tag}: evidence too short (${ev.length} chars, min ${minEvidence})`)
    }
  }

  // requiredCategories check
  const coveredCategories = new Set(
    items.filter(it => it.checked === true).map(it => it.category).filter(Boolean) as string[],
  )
  for (const cat of required) {
    if (!coveredCategories.has(cat)) {
      problems.push(`required category "${cat}" not covered by any checked item`)
    }
  }

  if (problems.length > 0) {
    return {
      type: 'review-checklist' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `Review checklist at ${file} has ${problems.length} problem(s):\n` +
        problems.map(p => `  - ${p}`).join('\n'),
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        file,
        reviewer: doc.reviewer,
        reviewed_at: doc.reviewed_at,
        itemCount: items.length,
        problemCount: problems.length,
      },
    }
  }

  return {
    type: 'review-checklist' as never,
    passed: true,
    durationMs: Date.now() - start,
    output: `Review checklist passed: ${items.length} item(s) all checked with adequate evidence ` +
      `(reviewer=${doc.reviewer ?? 'n/a'}, categories covered=${coveredCategories.size}).`,
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      file,
      reviewer: doc.reviewer,
      reviewed_at: doc.reviewed_at,
      itemCount: items.length,
      categories: Array.from(coveredCategories),
    },
  }
}
