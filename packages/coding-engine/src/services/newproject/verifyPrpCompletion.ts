/**
 * verifyPrpCompletion.ts
 *
 * CLI verifier for PRP completion markers.
 *
 * Usage:
 *   bun src/services/newproject/verifyPrpCompletion.ts <workspace> [--prp PRP-NNN]
 *
 * Exit code 0 — all checked PRPs have valid completion markers.
 * Exit code 1 — one or more PRPs are missing or have invalid markers.
 *
 * "Source of truth" for which PRPs exist: <workspace>/.project/prps/PRP-NNN-*.md
 * Completion markers live at:            <workspace>/.project/prps/done/PRP-NNN-*.completion.json
 *
 * Matching is done by PRP-NNN prefix so that slug variance (ModuleName differences)
 * between the .md and the .completion.json is tolerated.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single PRP's completion marker. */
type PrpStatus =
  | { kind: 'ok';      prpId: string; slug: string; detail: string }
  | { kind: 'missing'; prpId: string; slug: string; expectedPath: string }
  | { kind: 'invalid'; prpId: string; slug: string; path: string; reason: string }

/** A gates_verified entry (value can be anything that has a `status` or `pass`/`advisory` field). */
interface GateEntry {
  status?: string
  pass?: boolean
  advisory?: boolean
  skipped?: boolean
  [key: string]: unknown
}

/** gates_verified block shape (keys are the gate names). */
type GatesVerified = Record<string, GateEntry>

/**
 * NEW schema: acceptanceCriteria-driven.
 * At least one entry where verified === true.
 */
interface NewSchemaCompletion {
  acceptanceCriteria: Array<{ verified?: boolean; [key: string]: unknown }>
  gates_verified?: GatesVerified
  [key: string]: unknown
}

/**
 * OLD schema: verification block.
 */
interface OldSchemaCompletion {
  verification: {
    reviewVerdict?: string
    testsPass?: boolean
    [key: string]: unknown
  }
  gates_verified?: GatesVerified
  [key: string]: unknown
}

type CompletionJson = NewSchemaCompletion | OldSchemaCompletion | Record<string, unknown>

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Required gate keys.  Values must carry either { pass | advisory | skipped }.
 */
const REQUIRED_GATE_KEYS = ['G', 'H', 'I', 'J', 'Contract', 'K'] as const
type GateKey = (typeof REQUIRED_GATE_KEYS)[number]

/**
 * Validates gates_verified block.
 * Returns null if valid, or a human-readable error string if invalid.
 */
function validateGatesVerified(gates: GatesVerified | undefined): string | null {
  if (!gates) return 'gates_verified block is absent'

  const missingKeys: GateKey[] = []
  const invalidKeys: string[] = []

  for (const key of REQUIRED_GATE_KEYS) {
    if (!(key in gates)) {
      missingKeys.push(key)
      continue
    }
    const entry = gates[key]
    if (typeof entry !== 'object' || entry === null) {
      invalidKeys.push(`${key} (not an object)`)
      continue
    }
    // Each entry must carry at least one of: pass, advisory, skipped, status
    const hasStatus =
      'pass' in entry || 'advisory' in entry || 'skipped' in entry || 'status' in entry
    if (!hasStatus) {
      invalidKeys.push(`${key} (missing pass/advisory/skipped/status field)`)
    }
  }

  const problems: string[] = []
  if (missingKeys.length) problems.push(`missing keys: ${missingKeys.join(', ')}`)
  if (invalidKeys.length) problems.push(`invalid entries: ${invalidKeys.join(', ')}`)
  return problems.length ? problems.join('; ') : null
}

/**
 * Validates a parsed completion.json object against either accepted schema.
 * Returns null if valid, or an error string describing what's wrong.
 */
function validateCompletionSchema(data: CompletionJson): string | null {
  // NEW schema: acceptanceCriteria array with at least one verified === true
  if ('acceptanceCriteria' in data && Array.isArray(data.acceptanceCriteria)) {
    const criteria = (data as NewSchemaCompletion).acceptanceCriteria
    if (criteria.length === 0) {
      return 'acceptanceCriteria array is empty'
    }
    const hasVerified = criteria.some((c) => c.verified === true)
    if (!hasVerified) {
      return 'no acceptanceCriteria entry has verified === true'
    }
    return null // schema passes; gates_verified is checked separately
  }

  // OLD schema: verification.reviewVerdict === "PASS" AND verification.testsPass === true
  if ('verification' in data && typeof (data as OldSchemaCompletion).verification === 'object') {
    const v = (data as OldSchemaCompletion).verification
    if (v.reviewVerdict !== 'PASS') {
      return `verification.reviewVerdict is "${v.reviewVerdict}" (expected "PASS")`
    }
    if (v.testsPass !== true) {
      return `verification.testsPass is ${v.testsPass} (expected true)`
    }
    return null // schema passes
  }

  return 'unrecognised schema: neither acceptanceCriteria nor verification block found'
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Extracts the PRP-NNN prefix from a filename, e.g. "PRP-001-Foo.md" → "PRP-001". */
function extractPrpId(filename: string): string | null {
  const match = filename.match(/^(PRP-\d+)/)
  return match ? match[1] : null
}

/** Returns all PRP-NNN-*.md filenames (basename only) from the prps directory. */
async function discoverPrpFiles(prpsDir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(prpsDir)
  } catch {
    throw new Error(`Cannot read prps directory: ${prpsDir}`)
  }
  return entries
    .filter((f) => /^PRP-\d+-.*\.md$/.test(f))
    .sort()
}

/**
 * Returns all completion-marker filenames (basename only) from the done directory.
 *
 * Accepted patterns:
 *   - PRP-NNN-ModuleName.completion.json   (canonical, double-extension)
 *   - PRP-NNN-completion.json              (legacy shorthand — digtalhuman-class bug)
 *   - PRP-NNN.completion.json              (id-only variant)
 */
async function discoverCompletionFiles(doneDir: string): Promise<string[]> {
  try {
    const entries = await readdir(doneDir)
    return entries
      .filter((f) => {
        // Canonical: ends with .completion.json
        if (f.endsWith('.completion.json')) return true
        // Legacy shorthand: PRP-NNN-completion.json (no module slug, plain .json extension)
        if (/^PRP-\d+(-\w+)?-completion\.json$/.test(f)) return true
        return false
      })
      .sort()
  } catch {
    // done/ may not exist yet
    return []
  }
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

/**
 * Checks a single PRP.
 * @param prpId      e.g. "PRP-001"
 * @param prpSlug    the full PRP md basename without extension, e.g. "PRP-001-Auth-User-Management"
 * @param doneDir    absolute path to the done/ directory
 * @param completionFiles  basenames already read from doneDir
 */
async function checkPrp(
  prpId: string,
  prpSlug: string,
  doneDir: string,
  completionFiles: string[],
): Promise<PrpStatus> {
  // Find a completion file whose prefix matches prpId (PRP-NNN)
  const matched = completionFiles.find((f) => {
    const id = extractPrpId(f)
    return id === prpId
  })

  if (!matched) {
    // Construct expected path for the error message
    const expectedPath = join(doneDir, `${prpSlug}.completion.json`).replace(/\\/g, '/')
    return { kind: 'missing', prpId, slug: prpSlug, expectedPath }
  }

  const filePath = join(doneDir, matched)

  // Parse the JSON
  let data: CompletionJson
  try {
    const raw = await readFile(filePath, 'utf-8')
    data = JSON.parse(raw) as CompletionJson
  } catch (err) {
    return {
      kind: 'invalid',
      prpId,
      slug: prpSlug,
      path: filePath.replace(/\\/g, '/'),
      reason: `JSON parse error: ${(err as Error).message}`,
    }
  }

  // Validate schema
  const schemaError = validateCompletionSchema(data)
  if (schemaError) {
    return {
      kind: 'invalid',
      prpId,
      slug: prpSlug,
      path: filePath.replace(/\\/g, '/'),
      reason: schemaError,
    }
  }

  // Validate gates_verified
  const gates = (data as { gates_verified?: GatesVerified }).gates_verified
  const gatesError = validateGatesVerified(gates)

  if (gatesError) {
    return {
      kind: 'invalid',
      prpId,
      slug: prpSlug,
      path: filePath.replace(/\\/g, '/'),
      reason: `gates_verified issue: ${gatesError}`,
    }
  }

  return {
    kind: 'ok',
    prpId,
    slug: prpSlug,
    detail: `${matched} — schema valid, gates_verified OK`,
  }
}

// ---------------------------------------------------------------------------
// Report printing
// ---------------------------------------------------------------------------

function statusIcon(kind: PrpStatus['kind']): string {
  switch (kind) {
    case 'ok':      return '✅'
    case 'missing': return '❌'
    case 'invalid': return '⚠️ '
  }
}

function printReport(workspace: string, results: PrpStatus[]): void {
  const total = results.length
  const ok      = results.filter((r) => r.kind === 'ok').length
  const missing = results.filter((r) => r.kind === 'missing').length
  const invalid = results.filter((r) => r.kind === 'invalid').length

  console.log(`[verifyPrpCompletion] workspace: ${workspace.replace(/\\/g, '/')}`)
  console.log(`Found ${total} PRP file${total !== 1 ? 's' : ''}:`)

  for (const r of results) {
    const icon = statusIcon(r.kind)
    if (r.kind === 'ok') {
      console.log(`  ${icon} ${r.prpId} (${r.slug}) — ${r.detail}`)
    } else if (r.kind === 'missing') {
      console.log(`  ${icon} ${r.prpId} (${r.slug}) — MISSING ${r.expectedPath}`)
    } else {
      console.log(`  ${icon} ${r.prpId} (${r.slug}) — INVALID: ${r.reason}`)
      console.log(`         path: ${r.path}`)
    }
  }

  console.log('')
  console.log(`Summary: ${ok} OK, ${missing} MISSING, ${invalid} INVALID`)

  const exitCode = ok === total ? 0 : 1
  console.log(`Exit code: ${exitCode}`)
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: bun verifyPrpCompletion.ts <workspace> [--prp PRP-NNN]')
    console.log('')
    console.log('  <workspace>   Root directory of the generated project')
    console.log('  --prp PRP-NNN  Only check a single PRP (e.g. --prp PRP-001)')
    process.exit(0)
  }

  const workspace = args[0]

  // Validate workspace exists
  try {
    await stat(workspace)
  } catch {
    console.error(`[verifyPrpCompletion] ERROR: workspace not found: ${workspace}`)
    process.exit(1)
  }

  // Parse --prp filter
  let singlePrp: string | null = null
  const prpFlagIdx = args.indexOf('--prp')
  if (prpFlagIdx !== -1) {
    const val = args[prpFlagIdx + 1]
    if (!val || !val.startsWith('PRP-')) {
      console.error('[verifyPrpCompletion] ERROR: --prp must be followed by a PRP id like PRP-001')
      process.exit(1)
    }
    singlePrp = val
  }

  const prpsDir  = join(workspace, '.project', 'prps')
  const doneDir  = join(workspace, '.project', 'prps', 'done')

  // Discover PRP source files
  let prpFiles: string[]
  try {
    prpFiles = await discoverPrpFiles(prpsDir)
  } catch (err) {
    console.error(`[verifyPrpCompletion] ERROR: ${(err as Error).message}`)
    process.exit(1)
  }

  if (prpFiles.length === 0) {
    console.log('[verifyPrpCompletion] No PRP-NNN-*.md files found in', prpsDir)
    console.log('Summary: 0 OK, 0 MISSING, 0 INVALID')
    console.log('Exit code: 0')
    process.exit(0)
  }

  // Discover existing completion files
  const completionFiles = await discoverCompletionFiles(doneDir)

  // Filter to single PRP if requested
  const filteredPrpFiles = singlePrp
    ? prpFiles.filter((f) => {
        const id = extractPrpId(f)
        return id === singlePrp
      })
    : prpFiles

  if (singlePrp && filteredPrpFiles.length === 0) {
    console.error(`[verifyPrpCompletion] ERROR: no PRP file found for ${singlePrp} in ${prpsDir}`)
    process.exit(1)
  }

  // Run checks
  const results: PrpStatus[] = await Promise.all(
    filteredPrpFiles.map((filename) => {
      const prpId   = extractPrpId(filename)!
      const prpSlug = basename(filename, '.md')
      return checkPrp(prpId, prpSlug, doneDir, completionFiles)
    }),
  )

  printReport(workspace, results)

  const allOk = results.every((r) => r.kind === 'ok')
  process.exit(allOk ? 0 : 1)
}

main().catch((err: unknown) => {
  console.error('[verifyPrpCompletion] Unhandled error:', (err as Error).message ?? err)
  process.exit(1)
})
