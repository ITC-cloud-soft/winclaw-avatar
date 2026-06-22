/**
 * agents/personaLoader.ts — Load and cache persona markdown files.
 *
 * Reads `harness/agents/<role>.md` from the workspace layout.
 * Computes an approximate token count using the 4-chars-per-token heuristic.
 *
 * Error strategy: throws HarnessError('lint-failed', { kind: 'persona-missing', role })
 * when the persona file is absent (the real kind is encoded in `detail` because
 * HarnessError's union does not yet include 'persona-missing' as a first-class kind).
 */

import fs from 'node:fs/promises'
import type { HarnessLayout } from '../types.js'
import { HarnessError } from '../types.js'
import type { RoleId, PersonaSpec } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Module-level cache: workspacePath + role → PersonaSpec
// Keyed as `${rootDir}:${role}` so multiple workspaces coexist safely.
// ---------------------------------------------------------------------------

const PERSONA_CACHE = new Map<string, PersonaSpec>()

function cacheKey(rootDir: string, role: RoleId): string {
  return `${rootDir}:${role}`
}

/**
 * Evict all cache entries for a given harness root directory.
 * Call this after a file write so the next load picks up fresh content.
 */
export function evictPersonaCache(rootDir: string): void {
  for (const key of PERSONA_CACHE.keys()) {
    if (key.startsWith(`${rootDir}:`)) {
      PERSONA_CACHE.delete(key)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: resolve file path for a role from the layout
// ---------------------------------------------------------------------------

function resolvePersonaPath(layout: HarnessLayout, role: RoleId): string | undefined {
  switch (role) {
    case 'pm':
      return layout.agents.pm
    case 'developer':
      return layout.agents.developer
    case 'reviewer':
      return layout.agents.reviewer
    case 'tester':
      return layout.agents.tester
    default: {
      // Exhaustive check — TypeScript should flag this at compile time
      const _never: never = role
      return undefined
    }
  }
}

// ---------------------------------------------------------------------------
// Public: loadPersona
// ---------------------------------------------------------------------------

/**
 * Load the persona markdown file for the given role.
 *
 * Reads from the path in `layout.agents.<role>`. Returns a cached result if
 * the file was already loaded during this process lifetime.
 *
 * Throws `HarnessError('lint-failed', { kind: 'persona-missing', role })` if
 * the persona file is not registered in the layout or does not exist on disk.
 */
export async function loadPersona(layout: HarnessLayout, role: RoleId): Promise<PersonaSpec> {
  const key = cacheKey(layout.rootDir, role)
  const cached = PERSONA_CACHE.get(key)
  if (cached) return cached

  const filePath = resolvePersonaPath(layout, role)

  if (!filePath) {
    throw new HarnessError(
      `Persona file for role "${role}" is not registered in the harness layout`,
      'lint-failed',
      { kind: 'persona-missing', role },
    )
  }

  let content: string
  try {
    content = await fs.readFile(filePath, 'utf8')
  } catch {
    throw new HarnessError(
      `Persona file for role "${role}" not found at: ${filePath}`,
      'lint-failed',
      { kind: 'persona-missing', role, path: filePath },
    )
  }

  const approxTokens = Math.ceil(content.length / 4)

  const spec: PersonaSpec = {
    role,
    content,
    path: filePath,
    approxTokens,
  }

  PERSONA_CACHE.set(key, spec)
  return spec
}

// ---------------------------------------------------------------------------
// Public: loadAllPersonas
// ---------------------------------------------------------------------------

/**
 * Attempt to load all four personas for the layout.
 *
 * Returns a `Record<RoleId, PersonaSpec | null>` where missing personas are
 * `null` rather than thrown. Useful for status reporting.
 */
export async function loadAllPersonas(
  layout: HarnessLayout,
): Promise<Record<RoleId, PersonaSpec | null>> {
  const roles: RoleId[] = ['pm', 'developer', 'reviewer', 'tester']

  const results = await Promise.all(
    roles.map(async role => {
      try {
        const spec = await loadPersona(layout, role)
        return [role, spec] as const
      } catch {
        return [role, null] as const
      }
    }),
  )

  return Object.fromEntries(results) as Record<RoleId, PersonaSpec | null>
}
