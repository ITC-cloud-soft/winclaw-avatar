/**
 * agents/personaInjector.ts — System-prompt injection helper for personas.
 *
 * Two exported functions:
 *
 * `getActivePersonaBlock(workspacePath, layout)`:
 *   Reads the current PhaseState (via Agent A's workflow/phaseState.ts),
 *   loads the active persona, and returns the formatted block string.
 *   Returns null if no state, no active role, or persona loading fails.
 *   Uses dynamic import with try/catch so this module loads even if
 *   phaseState.ts is not yet present.
 *
 * `writePersonaBlockToCLAUDEMD(workspacePath, block)`:
 *   Updates (or removes) the harness-persona section between
 *   <!-- harness-persona:start --> / <!-- harness-persona:end --> markers
 *   in `<workspacePath>/CLAUDE.md`. Idempotent.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { HarnessLayout } from '../types.js'
import type { RoleId } from '../standardTypes.js'
import { loadPersona } from './personaLoader.js'
import { buildPersonaBlock, PERSONA_START, PERSONA_END } from './roleAssumer.js'
import { loadPhaseState } from '../workflow/phaseState.js'

// ---------------------------------------------------------------------------
// Internal: dynamic import of phaseState (Agent A's module)
// ---------------------------------------------------------------------------

/**
 * Read PhaseState. Returns null on any read failure (missing file, parse error)
 * so persona injection degrades gracefully when state is unavailable.
 */
async function tryLoadPhaseState(workspacePath: string) {
  try {
    return await loadPhaseState(workspacePath)
  } catch (err) {
    console.warn(
      '[personaInjector] phaseState read failed — degrading to null:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Public: getActivePersonaBlock
// ---------------------------------------------------------------------------

/**
 * Read the current active role from persisted PhaseState and return the
 * formatted persona block suitable for injection into a system prompt.
 *
 * Returns `null` when:
 * - phaseState.ts is not yet present (Agent A not yet deployed)
 * - No persisted state exists for this workspace
 * - The state has no `activeRole`
 * - The persona file for the active role is missing or unreadable
 */
export async function getActivePersonaBlock(
  workspacePath: string,
  layout: HarnessLayout,
): Promise<string | null> {
  const state = await tryLoadPhaseState(workspacePath)
  if (!state) return null

  const role: RoleId | null = state.activeRole
  if (!role) return null

  try {
    const persona = await loadPersona(layout, role)
    return buildPersonaBlock(role, persona)
  } catch (err) {
    console.warn(
      `[personaInjector] Could not load persona for role "${role}":`,
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Internal: CLAUDE.md path + marker helpers
// ---------------------------------------------------------------------------

function claudeMdPath(workspacePath: string): string {
  return path.join(workspacePath, 'CLAUDE.md')
}

/**
 * Replace or remove the harness-persona section in `content`.
 *
 * - When `block` is non-null: upsert the block between the markers.
 * - When `block` is null: remove the entire marked section.
 *
 * The replacement is idempotent — calling it twice with the same block
 * produces the same output.
 */
function splicePersonaBlock(content: string, block: string | null): string {
  const startMarker = PERSONA_START
  const endMarker = PERSONA_END

  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing section
    const before = content.slice(0, startIdx)
    // `after` is everything after the end marker. We normalise leading newlines
    // so that replacing the block with itself produces identical output.
    const rawAfter = content.slice(endIdx + endMarker.length)
    // Consume at most one trailing newline that belongs to the block itself,
    // then preserve the rest of the content.
    const after = rawAfter.startsWith('\n') ? rawAfter.slice(1) : rawAfter

    if (block === null) {
      // Remove: collapse any multi-blank-line gaps left by removal
      const joined = (before + after).replace(/\n{3,}/g, '\n\n').trimEnd()
      return joined.length > 0 ? joined + '\n' : ''
    }
    // block already ends without a trailing newline (buildPersonaBlock does not add one);
    // we append exactly one newline, then the remaining content.
    return before + block + '\n' + after
  }

  // No existing markers
  if (block === null) return content

  // Append at end (separated by blank line if file is non-empty)
  const trimmed = content.trimEnd()
  const separator = trimmed.length > 0 ? '\n\n' : ''
  return trimmed + separator + block + '\n'
}

// ---------------------------------------------------------------------------
// Public: writePersonaBlockToCLAUDEMD
// ---------------------------------------------------------------------------

/**
 * Idempotently update (or remove) the harness-persona fenced block in
 * `<workspacePath>/CLAUDE.md`.
 *
 * - If CLAUDE.md does not exist and `block` is non-null, it is created with
 *   just the persona block.
 * - If `block` is null, the markers + content between them are removed.
 * - If the file already contains the persona block, it is replaced in-place.
 */
export async function writePersonaBlockToCLAUDEMD(
  workspacePath: string,
  block: string | null,
): Promise<void> {
  const mdPath = claudeMdPath(workspacePath)

  let existing = ''
  try {
    existing = await fs.readFile(mdPath, 'utf8')
  } catch {
    // File does not exist — we'll create it if block is non-null
    if (block === null) return
  }

  const updated = splicePersonaBlock(existing, block)

  // No-op if content is identical (idempotent)
  if (updated === existing) return

  await fs.mkdir(path.dirname(mdPath), { recursive: true })
  await fs.writeFile(mdPath, updated, 'utf8')
}
