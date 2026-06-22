/**
 * YAML AST editor for environments.yaml.
 *
 * Preserves comments, blank lines, and indentation by operating on the
 * yaml@2 Document/Node AST rather than round-tripping through plain JS.
 *
 * §15.5 §15.5.7 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import YAML, { parseDocument, Document, YAMLMap, YAMLSeq, isMap, isSeq, isPair, isScalar } from 'yaml'

// ---------------------------------------------------------------------------
// Parse / Stringify
// ---------------------------------------------------------------------------

/**
 * Parse environments.yaml into an editable Document.
 * Throws a descriptive error on malformed YAML.
 */
export function parseEnvDocument(content: string): Document.Parsed {
  try {
    const doc = parseDocument(content, { keepSourceTokens: true })
    // Surface hard parse errors immediately
    const errors = doc.errors
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join('; '))
    }
    return doc as Document.Parsed
  } catch (err) {
    throw new Error(`Failed to parse YAML document: ${String(err)}`)
  }
}

/**
 * Stringify a Document back to YAML, preserving comments, blank lines, and
 * the original indent style detected from the source.
 */
export function stringifyEnvDocument(doc: Document): string {
  return doc.toString()
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the environments YAMLSeq from the document, or null. */
function getEnvsSeq(doc: Document): YAMLSeq | null {
  const envsNode = doc.get('environments', true)
  if (isSeq(envsNode)) return envsNode as YAMLSeq
  return null
}

// ---------------------------------------------------------------------------
// Find / lookup
// ---------------------------------------------------------------------------

/**
 * Find an env block by name within the parsed document.
 * Returns the YAMLMap node and its index in environments[], or null.
 */
export function findEnvBlock(
  doc: Document,
  envName: string,
): { node: YAMLMap; index: number } | null {
  const seq = getEnvsSeq(doc)
  if (!seq) return null

  for (let i = 0; i < seq.items.length; i++) {
    const item = seq.items[i]
    if (isMap(item)) {
      const nameVal = (item as YAMLMap).get('name')
      if (nameVal === envName) {
        return { node: item as YAMLMap, index: i }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/**
 * Append a new env to the environments[] array, preserving file formatting.
 * Uses doc.createNode() to build an AST node from a plain JS object.
 */
export function appendEnv(doc: Document, env: object): void {
  const seq = getEnvsSeq(doc)
  if (!seq) {
    // environments key doesn't exist — create it
    const newSeq = doc.createNode([env])
    doc.set('environments', newSeq)
    return
  }
  const node = doc.createNode(env)
  seq.add(node)
}

// ---------------------------------------------------------------------------
// Patch (merge)
// ---------------------------------------------------------------------------

/**
 * Update specific fields of an existing env using merge semantics.
 * Comments on unchanged fields are preserved because we mutate the existing
 * YAMLMap in place rather than replacing it.
 */
export function patchEnv(doc: Document, envName: string, patch: object): void {
  const found = findEnvBlock(doc, envName)
  if (!found) return

  const { node } = found
  _deepMergeIntoMap(doc, node, patch)
}

/** Recursively merge a plain JS patch object into an existing YAMLMap in place. */
function _deepMergeIntoMap(doc: Document, map: YAMLMap, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    const existingValue = map.get(key, true) // true = return raw node

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      isMap(existingValue)
    ) {
      // Both sides are objects — recurse to preserve sub-keys and their comments
      _deepMergeIntoMap(doc, existingValue as YAMLMap, value as Record<string, unknown>)
    } else {
      // Scalar, array, or new key — replace / set
      map.set(key, doc.createNode(value))
    }
  }
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

/**
 * Remove an env entirely by name.
 * Returns true if the env was found and removed, false if not found.
 */
export function removeEnv(doc: Document, envName: string): boolean {
  const seq = getEnvsSeq(doc)
  if (!seq) return false

  const found = findEnvBlock(doc, envName)
  if (!found) return false

  seq.items.splice(found.index, 1)
  return true
}

// ---------------------------------------------------------------------------
// Replace
// ---------------------------------------------------------------------------

/**
 * Replace one env's entire block with new content.
 * Returns true if found and replaced.
 */
export function replaceEnv(doc: Document, envName: string, newEnv: object): boolean {
  const seq = getEnvsSeq(doc)
  if (!seq) return false

  const found = findEnvBlock(doc, envName)
  if (!found) return false

  seq.items[found.index] = doc.createNode(newEnv) as YAMLMap
  return true
}

// ---------------------------------------------------------------------------
// setField — deep path
// ---------------------------------------------------------------------------

/**
 * Set a deep field via dot-notation path, e.g. "database.primary.port".
 * Creates intermediate YAMLMap nodes as needed.
 * Returns true if the env was found, false otherwise.
 */
export function setField(
  doc: Document,
  envName: string,
  path: string,
  value: unknown,
): boolean {
  const found = findEnvBlock(doc, envName)
  if (!found) return false

  const segments = path.split('.')
  let current: YAMLMap = found.node

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    let child = current.get(seg, true)

    if (!isMap(child)) {
      // Create a new empty map at this key
      const newMap = doc.createNode({}) as YAMLMap
      current.set(seg, newMap)
      child = newMap
    }
    current = child as YAMLMap
  }

  const leaf = segments[segments.length - 1]!
  current.set(leaf, doc.createNode(value))
  return true
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

/**
 * Clone an env block (deep copy, including comments where possible).
 * The clone is appended to the environments[] array with the new name.
 * Returns true if source was found and clone appended.
 */
export function cloneEnv(doc: Document, sourceName: string, destName: string): boolean {
  const seq = getEnvsSeq(doc)
  if (!seq) return false

  const found = findEnvBlock(doc, sourceName)
  if (!found) return false

  // Stringify the source node and re-parse to get a deep copy
  const srcYaml = YAML.stringify(found.node.toJSON())
  const cloned = doc.createNode(YAML.parse(srcYaml)) as YAMLMap
  // Set the new name
  cloned.set('name', destName)
  seq.add(cloned)
  return true
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * Generate a unified-diff-style string comparing two YAML content strings.
 * Each line is prefixed with ' ' (context), '+' (added), or '-' (removed).
 * No external dependency — pure line-by-line LCS-based diff.
 */
export function diffYaml(beforeContent: string, afterContent: string): string {
  const beforeLines = beforeContent.split('\n')
  const afterLines = afterContent.split('\n')

  // Build LCS table
  const m = beforeLines.length
  const n = afterLines.length
  // Use a flat Uint32Array for speed
  const dp = new Uint32Array((m + 1) * (n + 1))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i * (n + 1) + j] = dp[(i - 1) * (n + 1) + (j - 1)] + 1
      } else {
        const a = dp[(i - 1) * (n + 1) + j]
        const b = dp[i * (n + 1) + (j - 1)]
        dp[i * (n + 1) + j] = a >= b ? a : b
      }
    }
  }

  // Backtrack to build diff hunks
  const parts: string[] = []
  let i = m
  let j = n
  const ops: Array<{ op: ' ' | '+' | '-'; line: string }> = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      ops.push({ op: ' ', line: beforeLines[i - 1]! })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i * (n + 1) + (j - 1)] >= dp[(i - 1) * (n + 1) + j])) {
      ops.push({ op: '+', line: afterLines[j - 1]! })
      j--
    } else {
      ops.push({ op: '-', line: beforeLines[i - 1]! })
      i--
    }
  }

  ops.reverse()
  for (const { op, line } of ops) {
    parts.push(`${op}${line}`)
  }

  return parts.join('\n')
}
