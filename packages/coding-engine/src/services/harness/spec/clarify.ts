/**
 * clarify.ts — Scan for [NEEDS CLARIFICATION] markers in spec files.
 *
 * Public API consumed by Agent D's dispatcher ops.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface ClarificationMarker {
  file: string
  line: number
  text: string
}

export interface ClarifyListResult {
  unresolved: number
  markers: ClarificationMarker[]
}

export const CLARIFICATION_PATTERN = /\[NEEDS CLARIFICATION(?::\s*([^\]]*))?\]/g

/**
 * Scan a raw text body for [NEEDS CLARIFICATION] markers.
 * Exported so single-file gate runners (e.g. spec-requirements)
 * can reuse the same detection without going through the
 * directory-walking scanClarifications().
 */
export function scanClarificationsInText(
  text: string,
  relPath: string,
): ClarificationMarker[] {
  const markers: ClarificationMarker[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    CLARIFICATION_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = CLARIFICATION_PATTERN.exec(line)) !== null) {
      markers.push({
        file: relPath,
        line: i + 1,
        text: match[0] ?? '',
      })
    }
  }
  return markers
}

/**
 * Scan a single file on disk for [NEEDS CLARIFICATION] markers.
 */
async function scanFile(
  filePath: string,
  relPath: string,
): Promise<ClarificationMarker[]> {
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf8')
  } catch {
    return []
  }
  return scanClarificationsInText(content, relPath)
}

/**
 * Scan the active feature spec directory (or entire harness/specs/ tree)
 * for unresolved [NEEDS CLARIFICATION] markers.
 */
export async function scanClarifications(
  workspacePath: string,
  featureId?: string,
): Promise<ClarifyListResult> {
  const markers: ClarificationMarker[] = []

  const searchDirs: string[] = []
  if (featureId) {
    searchDirs.push(path.join(workspacePath, 'harness', 'specs', featureId))
  } else {
    // scan all specs
    const specsDir = path.join(workspacePath, 'harness', 'specs')
    try {
      const entries = await fs.readdir(specsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          searchDirs.push(path.join(specsDir, entry.name))
        }
      }
    } catch {
      // no specs dir
    }
  }

  const mdExtensions = ['.md']

  for (const dir of searchDirs) {
    // Use recursive readdir to catch files in subdirectories (e.g. feat-x/sub/spec.md)
    let rawEntries: string[]
    try {
      // readdir without withFileTypes returns string[] even with recursive:true
      rawEntries = (await fs.readdir(dir, { recursive: true })) as unknown as string[]
    } catch {
      continue
    }
    for (const name of rawEntries) {
      const nameStr = String(name)
      if (mdExtensions.some((ext) => nameStr.endsWith(ext))) {
        const fullPath = path.join(dir, nameStr)
        // verify it's a file
        try {
          const stat = await fs.stat(fullPath)
          if (!stat.isFile()) continue
        } catch {
          continue
        }
        const relPath = path.relative(workspacePath, fullPath)
        const found = await scanFile(fullPath, relPath)
        markers.push(...found)
      }
    }
  }

  return { unresolved: markers.length, markers }
}
