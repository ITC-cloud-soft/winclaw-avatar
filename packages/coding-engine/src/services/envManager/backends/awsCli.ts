import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { BackendSpec, ResolveResult } from '../types.js'
import { getCached, setCached, parseTtl } from '../cache.js'

// ---------------------------------------------------------------------------
// Simple INI parser for ~/.aws/credentials
// ---------------------------------------------------------------------------

type IniSection = Record<string, string>
type IniFile = Record<string, IniSection>

/**
 * Parses an AWS credentials INI file into a map of section name → key/value pairs.
 * Handles inline comments (#, ;) and ignores blank lines.
 */
function parseIni(content: string): IniFile {
  const result: IniFile = {}
  let currentSection = ''

  for (const rawLine of content.split(/\r?\n/)) {
    // Strip inline comments
    const line = rawLine.replace(/[#;].*$/, '').trim()
    if (line === '') continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      result[currentSection] = {}
      continue
    }

    if (currentSection === '') continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    result[currentSection][key] = val
  }

  return result
}

// ---------------------------------------------------------------------------
// AWS credentials file resolver
// ---------------------------------------------------------------------------

const FILE_MISSING_HINT = "~/.aws/credentials not found; run 'aws configure'"

/**
 * Resolves a credential from the static `~/.aws/credentials` INI file.
 *
 * Spec fields:
 *   - `profile` — INI section name (default: `"default"`)
 *   - `key`     — INI key within that section (e.g. `"aws_access_key_id"`)
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 */
export async function resolveAwsCli(
  spec: BackendSpec & { backend: 'aws-cli' },
): Promise<ResolveResult> {
  // aws-cli / credentials file is cross-platform; no OS restriction.
  const profile = spec.profile ?? 'default'
  const cacheKey = `aws-cli:${profile}:${spec.key}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  // Resolve credentials file path; respect HOME/USERPROFILE overrides (for tests).
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? homedir()
  const credPath = join(home, '.aws', 'credentials')

  let content: string
  try {
    content = readFileSync(credPath, 'utf8')
  } catch {
    return {
      ok: false,
      key: spec.key,
      kind: 'secret',
      reason: 'backend-failed',
      detail: FILE_MISSING_HINT,
    }
  }

  const ini = parseIni(content)
  const section = ini[profile]

  if (section === undefined) {
    return {
      ok: false,
      key: spec.key,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Profile "[${profile}]" not found in ~/.aws/credentials`,
    }
  }

  const value = section[spec.key]
  if (value === undefined || value === '') {
    return {
      ok: false,
      key: spec.key,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Key "${spec.key}" not found in profile "[${profile}]"`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
