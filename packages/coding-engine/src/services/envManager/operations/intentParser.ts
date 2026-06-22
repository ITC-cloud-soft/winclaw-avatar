/**
 * intentParser.ts — Phase 1.5 §15.5.5
 *
 * Converts raw /env command args (or NL prose) into a structured OperationInput.
 * Uses ONLY regex — no LLM involvement. The runtime AI handles ambiguous NL;
 * this module handles the deterministic structured path.
 */

import type {
  OperationInput,
  IntentParseResult,
  AddInput,
  EditInput,
  RemoveInput,
  CloneInput,
  SetInput,
} from './types.js'
import type { Env } from '../types.js'
import { parseBulkIntent } from './bulk.js'

// ---------------------------------------------------------------------------
// Required fields for each operation kind
// ---------------------------------------------------------------------------

const ADD_REQUIRED_FIELDS = [
  'cloud.provider',
  'cloud.region',
  'safety.destructive_ops',
  'deploy.tested',
] as const

// ---------------------------------------------------------------------------
// Type coercion
// ---------------------------------------------------------------------------

/**
 * Coerce a raw string value to its most appropriate JS type:
 * - numeric → number
 * - "true"/"false" → boolean
 * - "[a,b,c]" → string[]
 * - otherwise → string
 */
function coerceValue(raw: string): unknown {
  const trimmed = raw.trim()

  // Boolean
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Array  [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1)
    if (inner.trim() === '') return []
    return inner.split(',').map(s => s.trim()).filter(s => s.length > 0)
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

  return trimmed
}

// ---------------------------------------------------------------------------
// Patch builder helpers
// ---------------------------------------------------------------------------

function setNestedPath(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const segs = dotPath.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!
    if (typeof cur[seg] !== 'object' || cur[seg] === null) {
      cur[seg] = {}
    }
    cur = cur[seg] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]!] = value
}

// ---------------------------------------------------------------------------
// Verb detection
// ---------------------------------------------------------------------------

type VerbMatch =
  | { kind: 'add'; rest: string }
  | { kind: 'edit'; rest: string }
  | { kind: 'remove'; rest: string }
  | { kind: 'clone'; rest: string }
  | { kind: 'set'; rest: string }
  | null

function detectVerb(input: string): VerbMatch {
  const s = input.trim()

  // Explicit English verbs at start of input
  if (/^add\b/i.test(s)) return { kind: 'add', rest: s.replace(/^add\s*/i, '') }
  if (/^edit\b/i.test(s)) return { kind: 'edit', rest: s.replace(/^edit\s*/i, '') }
  if (/^(remove|delete)\b/i.test(s)) return { kind: 'remove', rest: s.replace(/^(remove|delete)\s*/i, '') }
  if (/^(clone|copy)\b/i.test(s)) return { kind: 'clone', rest: s.replace(/^(clone|copy)\s*/i, '') }
  if (/^set\b/i.test(s)) return { kind: 'set', rest: s.replace(/^set\s*/i, '') }

  // Japanese / NL patterns
  if (/追加|新規|新しく|create|new/.test(s)) return { kind: 'add', rest: s }
  if (/変更|修正|change|update/.test(s)) return { kind: 'edit', rest: s }
  if (/削除|消す|消して|drop/.test(s)) return { kind: 'remove', rest: s }
  if (/複製|コピー/.test(s)) return { kind: 'clone', rest: s }
  if (/^設定\s+([\w.]+)/.test(s)) return { kind: 'set', rest: s.replace(/^設定\s*/, '') }

  return null
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

interface ExtractedFields {
  name?: string
  extends?: string
  patch: Partial<Env>
  tags?: string[]
}

/**
 * Extract known fields from the remaining text after the verb.
 * Supports:
 *   extends <NAME> | extending <NAME> | <NAME> を継承
 *   region <VAL>   | region=<VAL>    | region は <VAL>
 *   provider <VAL> | provider=<VAL>
 *   tag <T>        | tags=[t1,t2]
 *   host <V>       | port <N>        | database <V>
 */
function extractFields(rest: string): ExtractedFields {
  const result: ExtractedFields = { patch: {} }
  let remaining = rest.trim()

  // extends
  let m: RegExpMatchArray | null

  // "extends NAME" or "extending NAME"
  m = remaining.match(/\bext(?:ends?|ending)\s+([\w-]+)/i)
  if (m) {
    result.extends = m[1]!
    remaining = remaining.replace(m[0], '').trim()
  }

  // "NAME を継承" (Japanese)
  m = remaining.match(/([\w-]+)\s*を継承/)
  if (m) {
    result.extends = m[1]!
    remaining = remaining.replace(m[0], '').trim()
  }

  // region= or "region VAL" or "region は VAL"
  m = remaining.match(/\bregion[=\s]\s*(?:は\s*)?([\w-]+)/i)
  if (m) {
    setNestedPath(result.patch as Record<string, unknown>, 'cloud.region', m[1]!)
    remaining = remaining.replace(m[0], '').trim()
  }

  // provider= or "provider VAL"
  m = remaining.match(/\bprovider[=\s]\s*(azure|aws|aliyun|gcp|on-prem)/i)
  if (m) {
    setNestedPath(result.patch as Record<string, unknown>, 'cloud.provider', m[1]!.toLowerCase())
    remaining = remaining.replace(m[0], '').trim()
  }

  // tags=[t1,t2] or tag T
  m = remaining.match(/\btags?=\[([^\]]*)\]/i)
  if (m) {
    result.tags = m[1]!.split(',').map(t => t.trim()).filter(Boolean)
    setNestedPath(result.patch as Record<string, unknown>, 'tags', result.tags)
    remaining = remaining.replace(m[0], '').trim()
  } else {
    m = remaining.match(/\btag\s+([\w-]+)/i)
    if (m) {
      result.tags = [m[1]!]
      setNestedPath(result.patch as Record<string, unknown>, 'tags', result.tags)
      remaining = remaining.replace(m[0], '').trim()
    }
  }

  // host VAL or host=VAL
  m = remaining.match(/\bhost[=\s]\s*([\w.-]+)/i)
  if (m) {
    setNestedPath(result.patch as Record<string, unknown>, 'database.primary.host', m[1]!)
    remaining = remaining.replace(m[0], '').trim()
  }

  // port VAL or port=VAL
  m = remaining.match(/\bport[=\s]\s*(\d+)/i)
  if (m) {
    setNestedPath(result.patch as Record<string, unknown>, 'database.primary.port', Number(m[1]!))
    remaining = remaining.replace(m[0], '').trim()
  }

  // database VAL or database=VAL (db name)
  m = remaining.match(/\bdatabase[=\s]\s*([\w-]+)/i)
  if (m) {
    setNestedPath(result.patch as Record<string, unknown>, 'database.primary.database', m[1]!)
    remaining = remaining.replace(m[0], '').trim()
  }

  // KEY=VALUE pairs (generic)
  const kvRe = /\b([\w.]+)=([\S]+)/g
  let kvMatch: RegExpExecArray | null
  while ((kvMatch = kvRe.exec(remaining)) !== null) {
    const key = kvMatch[1]!
    const val = coerceValue(kvMatch[2]!)
    // Skip already-handled top-level keys
    if (/^(region|provider|host|port|database|tags?)$/i.test(key)) continue
    // Map known shorthands
    if (key === 'cloud.region') {
      setNestedPath(result.patch as Record<string, unknown>, 'cloud.region', val)
    } else if (key === 'cloud.provider') {
      setNestedPath(result.patch as Record<string, unknown>, 'cloud.provider', val)
    } else {
      setNestedPath(result.patch as Record<string, unknown>, key, val)
    }
  }
  // Remove consumed k=v tokens
  remaining = remaining.replace(/\b[\w.]+=[^\s]+/g, '').trim()

  // First bare token = name (after all structured fields consumed)
  // Strip Japanese particles and extract env name tokens
  // Remove Japanese prose
  const cleanedForName = remaining
    .replace(/を追加して?/g, '')
    .replace(/を継承/g, '')
    .replace(/追加|新規|新しく|変更|修正|削除|消す|複製|コピー/g, '')
    .replace(/[、。]/g, ' ')
    .trim()

  const tokens = cleanedForName.split(/\s+/).filter(t => t.length > 0 && /^[\w-]/.test(t))
  if (tokens.length > 0 && !result.name) {
    result.name = tokens[0]!
  }

  return result
}

// ---------------------------------------------------------------------------
// Missing fields detection for add
// ---------------------------------------------------------------------------

function findMissingAddFields(patch: Partial<Env>): string[] {
  const missing: string[] = []
  const cloud = patch.cloud as Record<string, unknown> | undefined
  if (!cloud?.provider) missing.push('cloud.provider')
  if (!cloud?.region) missing.push('cloud.region')
  const safety = patch.safety as Record<string, unknown> | undefined
  if (!safety?.destructive_ops) missing.push('safety.destructive_ops')
  const deploy = patch.deploy as Record<string, unknown> | undefined
  if (deploy !== undefined && deploy.tested === undefined) missing.push('deploy.tested')
  return missing
}

// ---------------------------------------------------------------------------
// Parsers per kind
// ---------------------------------------------------------------------------

function parseAdd(rest: string, originalInput: string): IntentParseResult {
  const fields = extractFields(rest.length > 0 ? rest : originalInput)

  if (!fields.name) {
    return {
      ok: false,
      reason: 'Missing environment name. Usage: /env add NAME [extends PARENT] [region=VAL] [provider=VAL]',
    }
  }

  const missingFields = findMissingAddFields(fields.patch)

  if (missingFields.length > 0) {
    const partial: Partial<AddInput> = {
      kind: 'add',
      name: fields.name,
      ...(fields.extends ? { extends: fields.extends } : {}),
      ...(Object.keys(fields.patch).length > 0 ? { patch: fields.patch } : {}),
    }
    return {
      ok: true,
      needsDialog: true,
      partial,
      missingFields,
    }
  }

  const input: AddInput = {
    kind: 'add',
    name: fields.name,
    ...(fields.extends ? { extends: fields.extends } : {}),
    patch: fields.patch,
  }
  return { ok: true, input }
}

function parseEdit(rest: string, originalInput: string): IntentParseResult {
  const fields = extractFields(rest.length > 0 ? rest : originalInput)

  if (!fields.name) {
    return {
      ok: false,
      reason: 'Missing environment name. Usage: /env edit NAME [field=VALUE ...]',
    }
  }

  if (Object.keys(fields.patch).length === 0) {
    return {
      ok: true,
      needsDialog: true,
      partial: { kind: 'edit', name: fields.name },
      missingFields: ['patch (what fields to change?)'],
    }
  }

  const input: EditInput = {
    kind: 'edit',
    name: fields.name,
    patch: fields.patch,
  }
  return { ok: true, input }
}

function parseRemove(rest: string, _originalInput: string): IntentParseResult {
  const trimmedRest = rest.trim()

  // If nothing follows the verb, fail immediately — name is mandatory
  if (!trimmedRest) {
    return {
      ok: false,
      reason: 'Missing environment name. Usage: /env remove NAME',
    }
  }

  const fields = extractFields(trimmedRest)

  if (!fields.name) {
    return {
      ok: false,
      reason: 'Missing environment name. Usage: /env remove NAME',
    }
  }

  const input: RemoveInput = { kind: 'remove', name: fields.name }
  return { ok: true, input }
}

function parseClone(rest: string, originalInput: string): IntentParseResult {
  const trimmedRest = rest.trim()

  // If nothing follows the verb, fail immediately
  if (!trimmedRest) {
    return {
      ok: false,
      reason: 'Missing source environment. Usage: /env clone SOURCE DESTINATION [field=VALUE ...]',
    }
  }

  const text = trimmedRest
  // First extract structured fields (overrides like region=)
  const fields = extractFields(text)

  // ★ Tester fix: detect Japanese "DST を SRC からコピー" pattern.
  // Particle 「から」 means "from"; the noun before it is the source, and
  // the noun before 「を」 is the destination. Without this special case,
  // the bare-token order would invert source/destination.
  const jaFromMatch = originalInput.match(/([\w-]+)\s*を\s*([\w-]+)\s*から/)
  let source: string | undefined
  let destination: string | undefined
  if (jaFromMatch) {
    destination = jaFromMatch[1]
    source = jaFromMatch[2]
  } else {
    // For clone: first two bare tokens are source + destination
    const cleanedForTokens = text
      .replace(/\b[\w.]+=[^\s]+/g, '')       // remove k=v pairs
      .replace(/\bregion[=\s]\s*[\w-]+/gi, '')
      .replace(/\bprovider[=\s]\s*[\w-]+/gi, '')
      .replace(/\btag\s+[\w-]+/gi, '')
      .replace(/\btags?=\[[^\]]*\]/gi, '')
      .replace(/\bhost[=\s]\s*[\w.-]+/gi, '')
      .replace(/\bport[=\s]\s*\d+/gi, '')
      .replace(/\bdatabase[=\s]\s*[\w-]+/gi, '')
      .trim()

    const tokens = cleanedForTokens.split(/\s+/).filter(t => t.length > 0 && /^[\w-]/.test(t))
    source = tokens[0]
    destination = tokens[1]
  }

  if (!source) {
    return {
      ok: false,
      reason: 'Missing source environment. Usage: /env clone SOURCE DESTINATION [field=VALUE ...]',
    }
  }
  if (!destination) {
    return {
      ok: true,
      needsDialog: true,
      partial: { kind: 'clone', source, destination: '' },
      missingFields: ['destination'],
    }
  }

  const input: CloneInput = {
    kind: 'clone',
    source,
    destination,
    ...(Object.keys(fields.patch).length > 0 ? { overrides: fields.patch } : {}),
  }
  return { ok: true, input }
}

function parseSet(rest: string, originalInput: string): IntentParseResult {
  const text = (rest.length > 0 ? rest : originalInput).trim()

  // Pattern 1: NAME.PATH VALUE  (e.g. "dev.database.primary.port 13306")
  let m = text.match(/^([\w-]+)\.([\w.]+)\s+(.+)$/)
  if (m) {
    return {
      ok: true,
      input: {
        kind: 'set',
        name: m[1]!,
        path: m[2]!,
        value: coerceValue(m[3]!),
      } satisfies SetInput,
    }
  }

  // Pattern 2: NAME.PATH=VALUE  (e.g. "dev.database.primary.port=13306")
  m = text.match(/^([\w-]+)\.([\w.]+)=(.+)$/)
  if (m) {
    return {
      ok: true,
      input: {
        kind: 'set',
        name: m[1]!,
        path: m[2]!,
        value: coerceValue(m[3]!),
      } satisfies SetInput,
    }
  }

  // Pattern 3: Japanese "NAME の PATH を VALUE に"
  m = text.match(/([\w-]+)\s+の\s+([\w.]+)\s+を\s+(.+?)\s*[にへ]?$/)
  if (m) {
    return {
      ok: true,
      input: {
        kind: 'set',
        name: m[1]!,
        path: m[2]!,
        value: coerceValue(m[3]!),
      } satisfies SetInput,
    }
  }

  // Pattern 4: "NAME PATH VALUE" (three tokens, path contains a dot)
  const tokens = text.split(/\s+/)
  if (tokens.length >= 3 && tokens[1]!.includes('.')) {
    return {
      ok: true,
      input: {
        kind: 'set',
        name: tokens[0]!,
        path: tokens[1]!,
        value: coerceValue(tokens.slice(2).join(' ')),
      } satisfies SetInput,
    }
  }

  if (tokens.length < 3) {
    return {
      ok: true,
      needsDialog: true,
      partial: { kind: 'set' },
      missingFields: ['name.path', 'value'],
    }
  }

  return {
    ok: false,
    reason: 'Cannot parse set arguments. Usage: /env set NAME.PATH VALUE  (e.g. /env set dev.database.primary.port 13306)',
  }
}

// ---------------------------------------------------------------------------
// parseIntent (main export)
// ---------------------------------------------------------------------------

/**
 * Parse the args portion of a /env command into a structured OperationInput.
 *
 * Input is whatever text follows `/env` — e.g.:
 *   "add staging-jp extends staging-eu region=japaneast"
 *   "staging-jp を追加して、staging-eu を継承"
 *
 * Returns:
 *   { ok: true; input }              — fully-parsed, ready for buildTransaction
 *   { ok: true; needsDialog; partial; missingFields }  — dialog needed
 *   { ok: false; reason }            — unparseable
 */
export function parseIntent(rawInput: string): IntentParseResult {
  const trimmed = rawInput.trim()

  if (!trimmed) {
    return {
      ok: false,
      reason: 'No input provided. Try: /env add NAME, /env edit NAME, /env remove NAME, /env clone SRC DST, /env set NAME.PATH VALUE',
    }
  }

  // Try bulk intent BEFORE per-verb parsers — bulk patterns are unambiguous
  const bulkResult = parseBulkIntent(trimmed)
  if (bulkResult !== null) {
    return bulkResult
  }

  const verbMatch = detectVerb(trimmed)

  if (!verbMatch) {
    return {
      ok: false,
      reason: 'Could not parse subcommand. Try: /env add NAME, /env edit NAME, /env remove NAME, /env clone SRC DST, /env set NAME.PATH VALUE',
    }
  }

  switch (verbMatch.kind) {
    case 'add':    return parseAdd(verbMatch.rest, trimmed)
    case 'edit':   return parseEdit(verbMatch.rest, trimmed)
    case 'remove': return parseRemove(verbMatch.rest, trimmed)
    case 'clone':  return parseClone(verbMatch.rest, trimmed)
    case 'set':    return parseSet(verbMatch.rest, trimmed)
  }
}

// ---------------------------------------------------------------------------
// mergeDialogReply
// ---------------------------------------------------------------------------

/**
 * Given a partial OperationInput being built via dialog and the user's reply
 * to a missing-field prompt, fill the next missing field and check completeness.
 *
 * The reply is matched against the first item in missingFields.
 * If the result is now complete, returns { ok: true; input }.
 * If more fields remain, returns { ok: true; needsDialog; partial; missingFields }.
 */
export function mergeDialogReply(
  partial: Partial<OperationInput>,
  missingFields: string[],
  reply: string,
): IntentParseResult {
  if (missingFields.length === 0) {
    // Nothing missing — try to finalize
    return finalizePartial(partial)
  }

  const field = missingFields[0]!
  const value = coerceValue(reply.trim())
  const updated = { ...partial } as Record<string, unknown>

  // Route the reply value to the correct field path
  if (field === 'cloud.provider') {
    const cloud = (updated.patch as Record<string, unknown> | undefined) ?? {}
    const cloudObj = (cloud.cloud as Record<string, unknown> | undefined) ?? {}
    cloudObj.provider = value
    cloud.cloud = cloudObj
    updated.patch = cloud
  } else if (field === 'cloud.region') {
    const cloud = (updated.patch as Record<string, unknown> | undefined) ?? {}
    const cloudObj = (cloud.cloud as Record<string, unknown> | undefined) ?? {}
    cloudObj.region = value
    cloud.cloud = cloudObj
    updated.patch = cloud
  } else if (field === 'safety.destructive_ops') {
    const patch = (updated.patch as Record<string, unknown> | undefined) ?? {}
    const safety = (patch.safety as Record<string, unknown> | undefined) ?? {}
    safety.destructive_ops = value
    patch.safety = safety
    updated.patch = patch
  } else if (field === 'deploy.tested') {
    const patch = (updated.patch as Record<string, unknown> | undefined) ?? {}
    const deploy = (patch.deploy as Record<string, unknown> | undefined) ?? {}
    deploy.tested = value
    patch.deploy = deploy
    updated.patch = patch
  } else if (field === 'destination') {
    updated.destination = String(value)
  } else {
    // Generic: set as top-level field name matching the missing field label
    updated[field] = value
  }

  const remaining = missingFields.slice(1)

  if (remaining.length > 0) {
    return {
      ok: true,
      needsDialog: true,
      partial: updated as Partial<OperationInput>,
      missingFields: remaining,
    }
  }

  return finalizePartial(updated as Partial<OperationInput>)
}

// ---------------------------------------------------------------------------
// finalizePartial — internal
// ---------------------------------------------------------------------------

function finalizePartial(partial: Partial<OperationInput>): IntentParseResult {
  const kind = partial.kind

  if (kind === 'add') {
    const p = partial as Partial<AddInput>
    if (!p.name) return { ok: false, reason: 'Missing name for add operation.' }
    if (!p.patch?.cloud) return { ok: false, reason: 'Missing cloud spec for add operation.' }
    const input: AddInput = {
      kind: 'add',
      name: p.name,
      ...(p.extends ? { extends: p.extends } : {}),
      patch: p.patch,
    }
    return { ok: true, input }
  }

  if (kind === 'edit') {
    const p = partial as Partial<EditInput>
    if (!p.name) return { ok: false, reason: 'Missing name for edit operation.' }
    if (!p.patch || Object.keys(p.patch).length === 0) {
      return { ok: false, reason: 'Missing patch fields for edit operation.' }
    }
    return { ok: true, input: { kind: 'edit', name: p.name, patch: p.patch } }
  }

  if (kind === 'remove') {
    const p = partial as Partial<RemoveInput>
    if (!p.name) return { ok: false, reason: 'Missing name for remove operation.' }
    return { ok: true, input: { kind: 'remove', name: p.name } }
  }

  if (kind === 'clone') {
    const p = partial as Partial<CloneInput>
    if (!p.source) return { ok: false, reason: 'Missing source for clone operation.' }
    if (!p.destination) return { ok: false, reason: 'Missing destination for clone operation.' }
    return {
      ok: true,
      input: {
        kind: 'clone',
        source: p.source,
        destination: p.destination,
        ...(p.overrides ? { overrides: p.overrides } : {}),
      },
    }
  }

  if (kind === 'set') {
    const p = partial as Partial<SetInput>
    if (!p.name) return { ok: false, reason: 'Missing name for set operation.' }
    if (!p.path) return { ok: false, reason: 'Missing path for set operation.' }
    if (p.value === undefined) return { ok: false, reason: 'Missing value for set operation.' }
    return { ok: true, input: { kind: 'set', name: p.name, path: p.path, value: p.value } }
  }

  return { ok: false, reason: 'Cannot finalize partial input: unknown kind.' }
}
