/**
 * Compute a stable project ID from the current workspace.
 *
 * Per v2.2 §4.1: SHA256(git_remote_url)[0:4] + slug.
 * Fallback: workspace path hash if no git remote is available.
 */

import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 hex of the given string, lower-case. */
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Derive a URL-safe slug from a repo name: lowercase, strip .git, keep [a-z0-9-]. */
function slugify(name: string): string {
  return name
    .replace(/\.git$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract the repo leaf name from a remote URL.
 * Handles both HTTPS (`https://github.com/org/repo.git`) and SSH
 * (`git@github.com:org/repo.git`) forms.
 */
function repoNameFromUrl(url: string): string {
  // SSH: git@host:org/repo.git  → take segment after last /
  // HTTPS: https://host/org/repo.git → take segment after last /
  const last = url.split('/').pop() ?? url.split(':').pop() ?? url
  return slugify(last)
}

/** Try to read git remote.origin.url from the given directory. */
function tryGetGitRemote(cwd: string): string | null {
  try {
    const result = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    })
    return result.toString('utf8').trim() || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a stable project ID for the given workspace path.
 *
 * Format: `<SHA256(source)[0:4]>-<slug>`
 * - source = git remote.origin.url (preferred) or normalized workspace path
 * - slug   = repo/dir leaf name, alphanumeric + dashes
 */
export function computeProjectId(workspacePath: string): string {
  const remote = tryGetGitRemote(workspacePath)
  const source = remote ?? workspacePath.replace(/\\/g, '/')
  const hash = sha256Hex(source).slice(0, 4)
  const slug = remote ? repoNameFromUrl(remote) : slugify(path.basename(workspacePath))
  return `${hash}-${slug}`
}

/**
 * Return the per-project infra directory: `~/.metacoder/projects/<id>`.
 */
export function getProjectInfraDir(workspacePath: string): string {
  const id = computeProjectId(workspacePath)
  return path.join(os.homedir(), '.metacoder', 'projects', id)
}
