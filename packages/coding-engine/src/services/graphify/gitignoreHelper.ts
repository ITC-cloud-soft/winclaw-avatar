import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logForDebugging } from '../../utils/debug.js'

const GITIGNORE_ENTRIES = [
  '',
  '# Knowledge graph (auto-generated)',
  'graphify-out/',
]

/**
 * Ensure `graphify-out/` is present in the project's `.gitignore`.
 *
 * @param projectRoot - Absolute path to the project root (where `.gitignore` lives).
 * @returns `true` if the file was updated, `false` if the entry was already present.
 */
export function ensureGraphifyInGitignore(projectRoot: string): boolean {
  const gitignorePath = join(projectRoot, '.gitignore')

  let content = ''
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf-8')
  }

  if (content.includes('graphify-out/')) {
    return false // already present
  }

  try {
    if (content && !content.endsWith('\n')) {
      content += '\n'
    }
    content += GITIGNORE_ENTRIES.join('\n') + '\n'
    writeFileSync(gitignorePath, content, 'utf-8')
    logForDebugging('[graphify] Added graphify-out/ to .gitignore')
    return true
  } catch (err) {
    logForDebugging(`[graphify] Failed to update .gitignore: ${err}`)
    return false
  }
}
