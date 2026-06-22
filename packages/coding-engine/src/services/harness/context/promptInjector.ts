/**
 * promptInjector.ts — Render a ContextSnapshot to a markdown block and inject
 * it into CLAUDE.md via idempotent marker-bracketed insertion.
 *
 * Markers used (distinct from Agent C's persona markers):
 *   <!-- harness-context:start -->
 *   <!-- harness-context:end -->
 *
 * The block is safe to insert/remove multiple times without accumulation.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ContextSnapshot } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

const START_MARKER = '<!-- harness-context:start -->'
const END_MARKER = '<!-- harness-context:end -->'

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render a ContextSnapshot to a single fenced markdown block.
 *
 * The block is wrapped with harness-context markers and contains layer
 * sections for whichever layers have entries.
 *
 * @param snapshot - The context snapshot to render
 * @returns Markdown string including start/end markers
 */
export function renderSnapshotToBlock(snapshot: ContextSnapshot): string {
  const lines: string[] = [START_MARKER, '']

  const sessionEntries = snapshot.entries.filter(e => e.layer === 'session')
  const phaseEntries = snapshot.entries.filter(e => e.layer === 'phase')
  const onDemandEntries = snapshot.entries.filter(e => e.layer === 'on-demand')

  // Header
  lines.push('## Harness Context')
  lines.push('')
  lines.push(
    `_Phase: **${snapshot.phase ?? 'none'}** | Role: **${snapshot.role ?? 'none'}**` +
      ` | Tokens: ${snapshot.totalTokens}_`,
  )
  lines.push('')

  // Session layer
  if (sessionEntries.length > 0) {
    lines.push('## Session Context')
    lines.push('')
    for (const entry of sessionEntries) {
      lines.push(entry.content)
      lines.push('')
    }
  }

  // Phase layer
  if (phaseEntries.length > 0) {
    lines.push('## Phase Context')
    lines.push('')
    for (const entry of phaseEntries) {
      lines.push(`### ${entry.path}${entry.summarized ? ' _(summarized)_' : ''}`)
      lines.push('')
      lines.push(entry.content)
      lines.push('')
    }
  }

  // On-demand layer
  if (onDemandEntries.length > 0) {
    lines.push('## On-Demand Context')
    lines.push('')
    for (const entry of onDemandEntries) {
      lines.push(entry.content)
      lines.push('')
    }
  }

  // Budget summary
  lines.push('---')
  lines.push(
    `_Budget: session ${snapshot.budgetUsed.session}t ` +
      `/ phase ${snapshot.budgetUsed.phase}t ` +
      `/ on-demand ${snapshot.budgetUsed.onDemand}t_`,
  )
  lines.push('')
  lines.push(END_MARKER)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// CLAUDE.md injection
// ---------------------------------------------------------------------------

/**
 * Idempotently insert or replace the harness-context block in CLAUDE.md.
 *
 * - If `block` is a non-empty string: upserts the block (replaces existing or
 *   appends at the end of the file).
 * - If `block` is null or empty string: removes any existing block.
 * - If CLAUDE.md does not exist and block is non-null, the file is created.
 *
 * Never touches content outside the harness-context markers.
 * Never collides with Agent C's persona markers (which use different marker text).
 *
 * @param workspacePath - Absolute workspace root path
 * @param block - Rendered block string (from renderSnapshotToBlock) or null to remove
 */
export async function writeContextBlockToCLAUDEMD(
  workspacePath: string,
  block: string | null,
): Promise<void> {
  const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')

  let existing: string
  try {
    existing = await fs.readFile(claudeMdPath, 'utf8')
  } catch {
    existing = ''
  }

  const startIdx = existing.indexOf(START_MARKER)
  const endIdx = existing.indexOf(END_MARKER)

  let updated: string

  if (block === null || block.trim() === '') {
    // Remove mode
    if (startIdx === -1) {
      // Nothing to remove
      return
    }
    if (endIdx === -1 || endIdx < startIdx) {
      // Malformed — remove from start marker to end of file
      updated = existing.slice(0, startIdx).trimEnd()
    } else {
      const before = existing.slice(0, startIdx).trimEnd()
      const after = existing.slice(endIdx + END_MARKER.length).trimStart()
      updated = before + (after.length > 0 ? '\n\n' + after : '')
    }
  } else {
    // Upsert mode
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // Replace existing block
      const before = existing.slice(0, startIdx)
      const after = existing.slice(endIdx + END_MARKER.length)
      updated = before + block + after
    } else {
      // Append: ensure exactly one blank line before the block
      const base = existing.trimEnd()
      updated = base.length > 0 ? base + '\n\n' + block : block
    }
  }

  await fs.mkdir(path.dirname(claudeMdPath), { recursive: true })
  await fs.writeFile(claudeMdPath, updated, 'utf8')
}
