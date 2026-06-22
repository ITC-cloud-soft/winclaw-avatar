/**
 * ciInit.ts — CI scaffold emitter for /harness ci-init.
 *
 * Writes GitHub Actions and/or GitLab CI configuration files to the workspace.
 * Idempotent: existing files are skipped unless force=true.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.3
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { CiTarget } from './types.js'
import { githubActionsWorkflow } from './templates/_ci/github-actions/index.js'
import { gitlabCiConfig } from './templates/_ci/gitlab/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CiScaffoldOptions = {
  /** Workspace root path */
  workspacePath: string
  /** CI target(s) to emit */
  target: CiTarget
  /** Overwrite existing files */
  force?: boolean
}

export type CiScaffoldResult = {
  ok: boolean
  filesCreated: string[]
  filesSkipped: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function writeFileSafe(
  filePath: string,
  content: string,
  force: boolean,
): Promise<'created' | 'skipped'> {
  if (!force) {
    try {
      await fs.access(filePath)
      return 'skipped'
    } catch {
      // File does not exist — fall through to write
    }
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
  return 'created'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write CI scaffold files to the workspace.
 *
 * Supported targets:
 *   - 'github' → .github/workflows/harness.yml
 *   - 'gitlab' → .gitlab-ci.yml
 *   - 'both'   → both files
 *   - 'none'   → no-op (returns empty result)
 *
 * @param opts - Options including workspacePath, target, and force flag
 * @returns CiScaffoldResult with files created, skipped, and warnings
 */
export async function writeCiScaffold(opts: CiScaffoldOptions): Promise<CiScaffoldResult> {
  const { workspacePath, target, force = false } = opts

  const filesCreated: string[] = []
  const filesSkipped: string[] = []
  const warnings: string[] = []

  if (target === 'none') {
    return { ok: true, filesCreated, filesSkipped, warnings }
  }

  // Verify workspace exists
  try {
    const stat = await fs.stat(workspacePath)
    if (!stat.isDirectory()) {
      warnings.push(`workspacePath is not a directory: ${workspacePath}`)
      return { ok: false, filesCreated, filesSkipped, warnings }
    }
  } catch {
    warnings.push(`workspacePath does not exist: ${workspacePath}`)
    return { ok: false, filesCreated, filesSkipped, warnings }
  }

  const ciFiles: Array<{ relPath: string; content: string }> = []

  if (target === 'github' || target === 'both') {
    ciFiles.push({
      relPath: path.join('.github', 'workflows', 'harness.yml'),
      content: githubActionsWorkflow(),
    })
  }

  if (target === 'gitlab' || target === 'both') {
    ciFiles.push({
      relPath: '.gitlab-ci.yml',
      content: gitlabCiConfig(),
    })
  }

  for (const { relPath, content } of ciFiles) {
    const absPath = path.join(workspacePath, relPath)
    const result = await writeFileSafe(absPath, content, force)
    const normalized = relPath.replace(/\\/g, '/')
    if (result === 'created') {
      filesCreated.push(normalized)
    } else {
      filesSkipped.push(normalized)
    }
  }

  return { ok: true, filesCreated, filesSkipped, warnings }
}
