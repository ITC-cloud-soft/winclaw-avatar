/**
 * Initializer for the harness/ directory.
 *
 * Responsibilities:
 *   - Scaffold the harness/ directory structure from a named template
 *   - Write template files to disk (respecting force / minimal flags)
 *   - Idempotently append a harness reference block to CLAUDE.md
 *   - Return a structured InitResult (filesCreated / filesSkipped / warnings)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { HarnessError } from './types.js'
import type { InitOptions, InitResult, HarnessTemplateName } from './types.js'
import { TEMPLATES, listTemplates as _listTemplates } from './templates/index.js'
import type { Template } from './templates/index.js'
import { githubActionsWorkflow } from './templates/_ci/github-actions/index.js'
import { gitlabCiConfig } from './templates/_ci/gitlab/index.js'

// ---------------------------------------------------------------------------
// Public: listTemplates
// ---------------------------------------------------------------------------

/**
 * List available templates with descriptions.
 * Delegates to the templates/index registry.
 */
export function listTemplates(): Array<{ name: HarnessTemplateName; description: string }> {
  return _listTemplates()
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** The subset of template paths written in --minimal mode. */
const MINIMAL_PATHS = new Set([
  'rules/coding.md',
  'rules/architecture.md',
  'skills/review.md',
  'workflow/phases.yaml',
  'workflow/gates.yaml',
])

/**
 * Normalize a template-relative path to use forward slashes.
 * Ensures cross-platform consistency in InitResult paths.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Ensure a directory and all its parents exist (like mkdir -p).
 */
async function mkdirp(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Write a file, creating parent directories as needed.
 * Returns 'created' or 'skipped' (file already existed and force=false).
 */
async function writeFileSafe(
  filePath: string,
  content: string,
  force: boolean,
): Promise<'created' | 'skipped'> {
  if (!force) {
    try {
      await fs.access(filePath)
      // File exists — skip
      return 'skipped'
    } catch {
      // File does not exist — fall through to write
    }
  }
  await mkdirp(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
  return 'created'
}

// ---------------------------------------------------------------------------
// CLAUDE.md integration
// ---------------------------------------------------------------------------

const HARNESS_MARKER_START = '<!-- harness-ref:start -->'
const HARNESS_MARKER_END = '<!-- harness-ref:end -->'

const HARNESS_CLAUDE_BLOCK = `
${HARNESS_MARKER_START}
## Harness Engineering

This project uses a \`harness/\` directory for structured AI development.

- **Rules**: \`harness/rules/\` — architecture, workflow, and coding conventions
- **Skills**: \`harness/skills/\` — SOPs for plan, implement, review, and test phases
- **Agents**: \`harness/agents/\` — role-specific personas (pm, developer, reviewer, tester)
- **Workflow**: \`harness/workflow/phases.yaml\` + \`gates.yaml\` — 10-phase pipeline
- **Context**: \`harness/context/\` — session-resident and on-demand context

**Before coding**: read \`harness/rules/architecture.md\` and \`harness/rules/coding.md\`.
**Before reviewing**: follow the \`harness/skills/review.md\` checklist.
${HARNESS_MARKER_END}
`

/**
 * Idempotently append the harness reference block to CLAUDE.md.
 * If the file already contains the marker, it is left unchanged.
 */
async function updateClaudeMd(workspacePath: string): Promise<void> {
  const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')

  let existing = ''
  try {
    existing = await fs.readFile(claudeMdPath, 'utf8')
  } catch {
    // CLAUDE.md does not exist — will create
  }

  // Already contains harness reference
  if (existing.includes(HARNESS_MARKER_START)) {
    return
  }

  const updated = existing + HARNESS_CLAUDE_BLOCK
  await fs.writeFile(claudeMdPath, updated, 'utf8')
}

// ---------------------------------------------------------------------------
// Public: initHarness
// ---------------------------------------------------------------------------

/**
 * Scaffold the harness/ directory from the chosen template.
 *
 * Workflow:
 *   1. Verify workspace path exists
 *   2. Check for existing harness/ — return conflict warning if force=false
 *   3. Create directory skeleton
 *   4. Write template files (respecting minimal flag)
 *   5. Update CLAUDE.md with harness reference block (idempotent)
 *   6. Return InitResult
 */
export async function initHarness(options: InitOptions): Promise<InitResult> {
  const { workspacePath, template, force = false, minimal = false, ciTarget = 'none' } = options

  const filesCreated: string[] = []
  const filesSkipped: string[] = []
  const warnings: string[] = []

  // 1. Verify workspace exists
  try {
    const stat = await fs.stat(workspacePath)
    if (!stat.isDirectory()) {
      return {
        ok: false,
        filesCreated,
        filesSkipped,
        warnings: [`workspacePath is not a directory: ${workspacePath}`],
        templateUsed: template,
      }
    }
  } catch {
    return {
      ok: false,
      filesCreated,
      filesSkipped,
      warnings: [`workspacePath does not exist: ${workspacePath}`],
      templateUsed: template,
    }
  }

  const harnessRoot = path.join(workspacePath, 'harness')

  // 2. Check for existing harness/
  let harnessExists = false
  try {
    await fs.access(harnessRoot)
    harnessExists = true
  } catch {
    harnessExists = false
  }

  if (harnessExists && !force) {
    warnings.push(
      `harness/ already exists at ${harnessRoot}. ` +
        `Use force: true to overwrite existing files.`,
    )
    return {
      ok: false,
      filesCreated,
      filesSkipped,
      warnings,
      templateUsed: template,
    }
  }

  // 3. Look up template
  const templateMap: Template | undefined = TEMPLATES[template]
  if (!templateMap) {
    const available = Object.keys(TEMPLATES).join(', ')
    throw new HarnessError(
      `Unknown template "${template}". Available: ${available}`,
      'unknown-template',
      { requested: template },
    )
  }

  // 4. Create directory skeleton
  const subdirs = ['rules', 'skills', 'agents', 'workflow', 'context']
  await Promise.all(subdirs.map(d => mkdirp(path.join(harnessRoot, d))))

  // 5. Write template files
  const entries = Object.entries(templateMap)
  for (const [relPath, content] of entries) {
    // In minimal mode, skip paths not in the MINIMAL_PATHS set
    if (minimal && !MINIMAL_PATHS.has(normalizePath(relPath))) {
      continue
    }

    const absPath = path.join(harnessRoot, relPath)
    const result = await writeFileSafe(absPath, content, force)
    const normalized = `harness/${normalizePath(relPath)}`

    if (result === 'created') {
      filesCreated.push(normalized)
    } else {
      filesSkipped.push(normalized)
    }
  }

  // 6. Update CLAUDE.md
  await updateClaudeMd(workspacePath)

  // 7. Emit CI scaffold files (optional — default 'none' avoids surprising existing users)
  if (ciTarget !== 'none') {
    const ciFiles: Array<{ relPath: string; content: string }> = []

    if (ciTarget === 'github' || ciTarget === 'both') {
      ciFiles.push({
        relPath: path.join('.github', 'workflows', 'harness.yml'),
        content: githubActionsWorkflow(),
      })
    }

    if (ciTarget === 'gitlab' || ciTarget === 'both') {
      ciFiles.push({
        relPath: '.gitlab-ci.yml',
        content: gitlabCiConfig(),
      })
    }

    for (const { relPath, content } of ciFiles) {
      const absPath = path.join(workspacePath, relPath)
      const result = await writeFileSafe(absPath, content, force)
      if (result === 'created') {
        filesCreated.push(relPath.replace(/\\/g, '/'))
      } else {
        filesSkipped.push(relPath.replace(/\\/g, '/'))
      }
    }
  }

  return {
    ok: true,
    filesCreated,
    filesSkipped,
    warnings,
    templateUsed: template,
  }
}
