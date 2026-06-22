/**
 * Static scanner for hardcoded secrets in committed files.
 *
 * Runs during verifyCompletion to reject PRPs that shipped credentials in code.
 * Fast string-regex only (no AST). Aggressive placeholder skipping to keep
 * false-positives low — we'd rather miss a real one than block a clean PRP.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface SecretFinding {
  file: string
  line: number
  pattern: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  snippet: string
}

export interface SecretsScanResult {
  valid: boolean
  findings: SecretFinding[]
}

/**
 * Substrings that, if found (case-insensitive) in the captured value, mean
 * the match is a placeholder / documentation and should not be reported.
 */
const PLACEHOLDER_SUBSTRINGS = [
  'change-me',
  'changeme',
  'change_me',
  'your-secret',
  'your_secret',
  'your-key',
  'your_key',
  'example',
  'sample',
  'dummy',
  'placeholder',
  'xxxxxxxx',
  '<todo>',
  'tbd',
  'replace-this',
  'replace_this',
  'your-secret-here',
  'fake',
  'yourpassword',
  'your-password',
  'your_password',
]

/**
 * Values that are pure variable interpolation — not literals at all.
 *   ${FOO}   %FOO%   $FOO
 */
const MACRO_ONLY_RE = /^\s*(?:\$\{[A-Z0-9_]+\}|%[A-Z0-9_]+%|\$[A-Z_][A-Z0-9_]*)\s*$/i

/**
 * Patterns on the entire LINE that indicate the RHS is a runtime env read,
 * not a literal. Even if a regex captured something that looks like a value,
 * if the line contains one of these, skip.
 */
const ENV_READ_PATTERNS = [
  /os\.environ(?:\.get)?\s*[\(\[]/,
  /os\.getenv\s*\(/,
  /process\.env\b/,
  /System\.getenv\s*\(/,
  /Deno\.env\b/,
  /dotenv/i,
  /config\.get\s*\(/,
  /Config\.get\s*\(/,
  /ConfigParser/,
]

/**
 * Regex-based rules. Each pattern captures the "value" in group 1 (or 2 for
 * a few where we also capture the key). `valueExtractor` normalizes that.
 */
export const SECRET_RULES: Array<{
  id: string
  pattern: RegExp
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  valueExtractor?: (match: RegExpExecArray) => string
  description: string
}> = [
  {
    id: 'python-secret-key-literal',
    pattern: /^\s*(?:SECRET_KEY|secret_key)\s*[:=]\s*['"]([^'"]+)['"]/,
    severity: 'HIGH',
    description: 'SECRET_KEY assigned a string literal (use os.environ.get)',
  },
  {
    id: 'jwt-secret-literal',
    pattern: /\b(?:JWT_SECRET|jwt_secret|jwtSecret|JWT_SECRET_KEY)\b\s*[:=]\s*['"]([^'"]+)['"]/,
    severity: 'HIGH',
    description: 'JWT secret is hardcoded',
  },
  {
    id: 'api-key-literal',
    pattern: /\b(?:API_KEY|api_key|apiKey|APIKEY)\b\s*[:=]\s*['"]([^'"]+)['"]/,
    severity: 'HIGH',
    description: 'API_KEY assigned a string literal',
  },
  {
    id: 'password-literal',
    pattern: /\b(?:PASSWORD|password|DB_PASSWORD|db_password|DB_PASS)\b\s*[:=]\s*['"]([^'"]+)['"]/,
    severity: 'HIGH',
    description: 'password assigned a string literal',
  },
  {
    id: 'db-url-with-password',
    pattern:
      /\b(?:DATABASE_URL|database_url|MYSQL_URL|POSTGRES_URL|POSTGRESQL_URL|MONGODB_URI|REDIS_URL)\b\s*[:=]\s*['"]([a-z]+(?:\+[a-z]+)?:\/\/[^:@'"\s]+:[^@'"\s]+@[^'"]+)['"]/i,
    severity: 'HIGH',
    description: 'database URL contains inline password',
  },
  {
    id: 'aws-access-key-id',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: 'HIGH',
    description: 'AWS access key ID exposed',
  },
  {
    id: 'aws-secret-access-key',
    pattern: /\b(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\b\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]/,
    severity: 'HIGH',
    description: 'AWS secret access key exposed',
  },
  {
    id: 'private-key-block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
    severity: 'HIGH',
    description: 'Private key committed',
    valueExtractor: () => '(private key block)',
  },
  {
    id: 'jwt-token-literal',
    pattern: /['"](ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})['"]/,
    severity: 'HIGH',
    description: 'JWT token literal committed',
  },
  {
    id: 'bearer-token',
    pattern: /['"]Bearer\s+([A-Za-z0-9_\-.=]{20,})['"]/,
    severity: 'HIGH',
    description: 'Bearer token literal',
  },
  {
    id: 'generic-yaml-password',
    pattern: /^\s*password\s*:\s*['"]?([^'"#\s]+)['"]?\s*$/,
    severity: 'MEDIUM',
    description: 'generic password= value in yaml/properties',
  },
  {
    id: 'api-token-literal',
    pattern: /\b(?:api_token|access_token|ACCESS_TOKEN)\b\s*[:=]\s*['"]([^'"]+)['"]/,
    severity: 'MEDIUM',
    description: 'api_token / access_token with literal',
  },
]

/**
 * Directories whose contents we treat as test fixtures — downgrade HIGH to MEDIUM.
 */
const TEST_PATH_RE = /(?:^|[\\/])(?:tests?|__tests__|spec|fixtures?|mocks?)[\\/]/i

/**
 * File extensions we don't want to scan at all (binary / generated / huge).
 */
const SKIP_EXT_RE = /\.(?:png|jpg|jpeg|gif|bmp|webp|ico|svg|pdf|zip|tar|gz|tgz|bz2|7z|rar|exe|dll|so|dylib|class|jar|war|o|a|bin|wasm|ttf|woff|woff2|eot|mp3|mp4|mov|avi|webm|lock)$/i

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase()
  if (MACRO_ONLY_RE.test(value)) return true
  for (const sub of PLACEHOLDER_SUBSTRINGS) {
    if (lower.includes(sub)) return true
  }
  // Very short values (<6 chars) are almost certainly not real secrets — flag defaults like "pass", "123".
  // But "mypass" in a db URL still matters; we keep this threshold tight to 4.
  if (value.length < 4) return true
  // All-same char (xxxxxx, 000000)
  if (/^(.)\1+$/.test(value)) return true
  return false
}

function lineIsEnvRead(line: string): boolean {
  for (const re of ENV_READ_PATTERNS) {
    if (re.test(line)) return true
  }
  return false
}

function lineIsComment(line: string): boolean {
  const trimmed = line.trimStart()
  if (!trimmed) return false
  if (trimmed.startsWith('#')) return true
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('*') && !trimmed.startsWith('**')) return true
  if (trimmed.startsWith('/*')) return true
  if (trimmed.startsWith(';')) return true // ini-style
  return false
}

function mask(value: string): string {
  if (value.length <= 4) return '***'
  const head = value.slice(0, 4)
  return `${head}***`
}

function looksTesty(value: string, file: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes('test') ||
    lower.includes('testing') ||
    lower === 'foo' ||
    lower === 'bar' ||
    TEST_PATH_RE.test(file)
  )
}

/**
 * Scan a single file's content. Exported for tooling / tests.
 */
export function scanFileContent(file: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = []
  const lines = content.split(/\r?\n/)
  const inTestPath = TEST_PATH_RE.test(file)
  const isEnvExample = /\.env\.(?:example|sample|template)$/i.test(file) || /\.example$/i.test(file)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    if (line.length > 4000) continue // skip pathological lines
    if (lineIsComment(line)) continue
    if (lineIsEnvRead(line)) continue

    for (const rule of SECRET_RULES) {
      // Reset lastIndex for safety on global-ish regexes
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''))
      const m = re.exec(line)
      if (!m) continue

      const value = rule.valueExtractor ? rule.valueExtractor(m) : (m[1] ?? m[0])
      if (!value) continue
      if (isPlaceholder(value)) continue

      let severity = rule.severity
      // env.example files: everything is illustrative — demote to LOW.
      if (isEnvExample) {
        severity = 'LOW'
      } else if (inTestPath) {
        // Tests: downgrade HIGH → MEDIUM
        if (severity === 'HIGH') severity = 'MEDIUM'
      } else if (looksTesty(value, file) && severity === 'HIGH') {
        severity = 'LOW'
      }

      findings.push({
        file,
        line: i + 1,
        pattern: rule.id,
        severity,
        snippet: `${line.trim().slice(0, 80).replace(value, mask(value))}`,
      })
      // Don't break — multiple rules may legitimately fire on the same line
      // (e.g., SECRET_KEY = "abc" also matches generic password rules if labeled).
      // But to avoid duplicate noise for the same key, break once we have a HIGH.
      if (severity === 'HIGH') break
    }
  }

  return findings
}

/**
 * Scan all given files (workspace-relative) for secrets.
 */
export function scanForSecrets(workspace: string, relativeFiles: string[]): SecretsScanResult {
  const findings: SecretFinding[] = []

  for (const rel of relativeFiles) {
    if (!rel) continue
    if (SKIP_EXT_RE.test(rel)) continue

    const abs = join(workspace, rel)
    if (!existsSync(abs)) continue

    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue // unreadable — skip silently
    }
    // Skip obvious binaries by NUL-byte sniff
    if (content.indexOf('\u0000') !== -1) continue
    // Skip absurdly large files (> 2 MB)
    if (content.length > 2 * 1024 * 1024) continue

    try {
      const fileFindings = scanFileContent(rel, content)
      findings.push(...fileFindings)
    } catch {
      continue
    }
  }

  const valid = !findings.some((f) => f.severity === 'HIGH')
  return { valid, findings }
}
