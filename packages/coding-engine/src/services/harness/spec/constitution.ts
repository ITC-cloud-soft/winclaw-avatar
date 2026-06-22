/**
 * constitution.ts — Load and validate harness/constitution.md
 *
 * Public API consumed by Agent D's dispatcher ops.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface ConstitutionArticle {
  number: string
  title: string
  body: string
  gate?: string
}

export interface ParsedConstitution {
  projectName: string
  adoptedAt: string
  version: string
  articles: ConstitutionArticle[]
  raw: string
}

export interface ConstitutionValidationResult {
  ok: boolean
  version: string
  articleCount: number
  errors: string[]
  warnings: string[]
}

/** Path to constitution.md given workspace root */
export function constitutionPath(workspacePath: string): string {
  return path.join(workspacePath, 'harness', 'constitution.md')
}

/**
 * Load constitution.md from disk. Returns null when file is absent.
 */
export async function loadConstitution(
  workspacePath: string,
): Promise<ParsedConstitution | null> {
  const filePath = constitutionPath(workspacePath)
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }

  const lines = raw.split('\n')
  let projectName = ''
  let adoptedAt = ''
  let version = '1.0'
  let versionFound = false
  const articles: ConstitutionArticle[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.startsWith('# ')) {
      projectName = line.slice(2).replace('Constitution', '').trim()
    } else if (line.startsWith('Adopted:')) {
      adoptedAt = line.replace('Adopted:', '').trim()
    } else if (line.startsWith('Version:')) {
      version = line.replace('Version:', '').trim()
      versionFound = true
    } else if (/^## Article [IVX]+/.test(line)) {
      const match = line.match(/^## Article ([IVX]+)\s*[—-]\s*(.+)/)
      if (match) {
        const bodyLines: string[] = []
        let gate: string | undefined
        let j = i + 1
        while (j < lines.length && !(lines[j] ?? '').startsWith('## Article')) {
          const bodyLine = lines[j] ?? ''
          if (bodyLine.startsWith('Gate:')) {
            gate = bodyLine.replace('Gate:', '').trim()
          } else {
            bodyLines.push(bodyLine)
          }
          j++
        }
        articles.push({
          number: match[1] ?? '',
          title: match[2] ?? '',
          body: bodyLines.join('\n').trim(),
          gate,
        })
      }
    }
  }

  if (!versionFound) {
    // eslint-disable-next-line no-console
    console.warn("constitution.md is missing 'Version:' line, defaulting to 1.0")
  }

  return { projectName, adoptedAt, version, articles, raw }
}

/**
 * Validate a parsed constitution for structural completeness.
 */
export function validateConstitution(
  c: ParsedConstitution,
): ConstitutionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!c.adoptedAt) warnings.push('Missing "Adopted:" date line')

  for (const article of c.articles) {
    if (!article.body) {
      warnings.push(`Article ${article.number} "${article.title}" has no body`)
    }
    // gate is optional per spec — absence is a warning, not an error
    if (!article.gate) {
      warnings.push(`Article ${article.number} "${article.title}" has no Gate: line`)
    }
  }

  if (c.articles.length === 0) {
    errors.push('constitution.md has no articles')
  }

  return {
    ok: errors.length === 0,
    version: c.version,
    articleCount: c.articles.length,
    errors,
    warnings,
  }
}
