/**
 * SQL classifier — Phase 4 production safety (§1.5.1 / §7).
 *
 * Classifies SQL statements as read-only / write / destructive using the
 * token stream from sqlTokenizer. Because classification is done on tokens,
 * string literals (e.g. 'user ran DROP TABLE') can NEVER trigger a keyword
 * match — the critical requirement from §1.5.1.
 *
 * Multi-statement inputs are split on `;` punctuation tokens. The overall
 * classification of a multi-statement input is the WORST (most destructive)
 * of all individual statements.
 */

import type { SqlClassification, SqlClassifyOptions } from './types.js'
import { tokenize } from './sqlTokenizer.js'
import type { SqlToken } from './sqlTokenizer.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Split a flat token list into per-statement slices on `;` punct tokens. */
function splitStatements(tokens: SqlToken[]): SqlToken[][] {
  const statements: SqlToken[][] = []
  let current: SqlToken[] = []
  for (const tok of tokens) {
    if (tok.type === 'punct' && tok.value === ';') {
      if (current.length > 0) {
        statements.push(current)
        current = []
      }
    } else {
      current.push(tok)
    }
  }
  if (current.length > 0) statements.push(current)
  return statements
}

/** Return the value of a keyword token at index, or undefined. */
function kw(tokens: SqlToken[], idx: number): string | undefined {
  const t = tokens[idx]
  return t?.type === 'keyword' ? t.value : undefined
}

/** Return the value of an identifier (or keyword used as identifier) at index, or undefined. */
function identOrKw(tokens: SqlToken[], idx: number): string | undefined {
  const t = tokens[idx]
  if (!t) return undefined
  return t.type === 'identifier' || t.type === 'keyword' ? t.value : undefined
}

/**
 * Extract table name from tokens starting at `start` (the token AFTER FROM/INTO/etc.).
 * Handles schema-qualified: `schema.table` or `db.schema.table`.
 * Returns the table name (last segment) or undefined.
 */
function extractTableAt(tokens: SqlToken[], start: number): string | undefined {
  // Expect: identifier [. identifier [. identifier]]
  const first = identOrKw(tokens, start)
  if (!first) return undefined

  let name = first
  let idx = start + 1

  // Consume dot-qualified segments: db.schema.table
  while (
    tokens[idx]?.type === 'punct' && tokens[idx]?.value === '.' &&
    identOrKw(tokens, idx + 1) !== undefined
  ) {
    name = identOrKw(tokens, idx + 1)!
    idx += 2
  }
  return name
}

/**
 * Extract all referenced tables from a token list.
 * Looks ahead after FROM, JOIN (various), INTO (for INSERT/UPDATE),
 * UPDATE <table>, DELETE FROM.
 */
function extractTables(tokens: SqlToken[]): string[] {
  const tables: string[] = []
  const seen = new Set<string>()

  const add = (name: string | undefined) => {
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      tables.push(name)
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const k = kw(tokens, i)

    // FROM <table>
    if (k === 'FROM') {
      add(extractTableAt(tokens, i + 1))
      continue
    }

    // INTO <table>  (INSERT INTO, MERGE INTO)
    if (k === 'INTO') {
      add(extractTableAt(tokens, i + 1))
      continue
    }

    // JOIN / LEFT JOIN / INNER JOIN / CROSS JOIN etc.
    if (k === 'JOIN') {
      add(extractTableAt(tokens, i + 1))
      continue
    }

    // UPDATE <table>
    if (k === 'UPDATE') {
      // Next token should be table name (skip optional keyword modifiers)
      const next = tokens[i + 1]
      if (next?.type === 'identifier') {
        add(extractTableAt(tokens, i + 1))
      }
      continue
    }

    // TABLE <table> (for DROP TABLE, TRUNCATE TABLE, ALTER TABLE, RENAME TABLE)
    if (k === 'TABLE') {
      add(extractTableAt(tokens, i + 1))
      continue
    }
  }

  return tables
}

/**
 * Check whether there is a WHERE keyword anywhere in the token list
 * (at the top level — not inside sub-queries, which is acceptable for
 * best-effort safety classification).
 */
function hasWhereClause(tokens: SqlToken[]): boolean {
  return tokens.some(t => t.type === 'keyword' && t.value === 'WHERE')
}

// ---------------------------------------------------------------------------
// Severity ranking for "worst" multi-statement classification
// ---------------------------------------------------------------------------

const SEVERITY: Record<SqlClassification['kind'], number> = {
  UNKNOWN:    0,
  SELECT:     1,
  WITH:       1,
  SHOW:       1,
  DESCRIBE:   1,
  EXPLAIN:    1,
  BEGIN:      2,
  COMMIT:     2,
  ROLLBACK:   2,
  GRANT:      3,
  REVOKE:     3,
  EXEC:       3,
  CALL:       3,
  INSERT:     4,
  UPSERT:     4,
  MERGE:      4,
  UPDATE:     5,
  DELETE:     5,
  CREATE:     6,
  ALTER:      7,
  RENAME:     7,
  TRUNCATE:   8,
  DROP:       9,
}

function worstOf(
  a: SqlClassification,
  b: SqlClassification,
  totalCount: number,
): SqlClassification {
  const sa = (SEVERITY[a.kind] ?? 0) + (a.isDestructive ? 100 : 0)
  const sb = (SEVERITY[b.kind] ?? 0) + (b.isDestructive ? 100 : 0)
  const worst = sa >= sb ? a : b
  return { ...worst, statementCount: totalCount }
}

// ---------------------------------------------------------------------------
// Single-statement classifier
// ---------------------------------------------------------------------------

function classifyOne(tokens: SqlToken[], opts: Required<SqlClassifyOptions>): SqlClassification {
  const base: SqlClassification = {
    kind: 'UNKNOWN',
    tables: [],
    isDestructive: false,
    isReadOnly: false,
    isWrite: false,
    hasWhere: false,
    statementCount: 1,
  }

  if (tokens.length === 0) return base

  const tables = extractTables(tokens)
  const hasWhere = hasWhereClause(tokens)

  // Leading keyword determines statement kind
  const lead = kw(tokens, 0)

  // WITH ... SELECT — read-only CTE
  if (lead === 'WITH') {
    return {
      ...base,
      kind: 'WITH',
      tables,
      isReadOnly: true,
      hasWhere,
    }
  }

  // SELECT
  if (lead === 'SELECT') {
    return {
      ...base,
      kind: 'SELECT',
      tables,
      isReadOnly: true,
      hasWhere,
    }
  }

  // INSERT
  if (lead === 'INSERT' || lead === 'REPLACE') {
    return {
      ...base,
      kind: 'INSERT',
      tables,
      isWrite: true,
      hasWhere,
    }
  }

  // UPSERT (non-standard but listed in types)
  if (lead === 'UPSERT') {
    return {
      ...base,
      kind: 'UPSERT',
      tables,
      isWrite: true,
      hasWhere,
    }
  }

  // MERGE
  if (lead === 'MERGE') {
    return {
      ...base,
      kind: 'MERGE',
      tables,
      isWrite: true,
      hasWhere,
    }
  }

  // UPDATE
  if (lead === 'UPDATE') {
    const isDestructive = opts.flagBareWriteAsDestructive && !hasWhere
    return {
      ...base,
      kind: 'UPDATE',
      tables,
      isWrite: true,
      hasWhere,
      isDestructive,
      destructiveReason: isDestructive
        ? 'UPDATE without WHERE clause affects all rows'
        : undefined,
    }
  }

  // DELETE
  if (lead === 'DELETE') {
    const isDestructive = !hasWhere
    return {
      ...base,
      kind: 'DELETE',
      tables,
      isWrite: true,
      hasWhere,
      isDestructive,
      destructiveReason: isDestructive
        ? 'DELETE without WHERE clause deletes all rows'
        : undefined,
    }
  }

  // TRUNCATE
  if (lead === 'TRUNCATE') {
    return {
      ...base,
      kind: 'TRUNCATE',
      tables,
      isDestructive: true,
      isWrite: true,
      hasWhere,
      destructiveReason: 'TRUNCATE removes all rows from the table',
    }
  }

  // DROP
  if (lead === 'DROP') {
    return {
      ...base,
      kind: 'DROP',
      tables,
      isDestructive: true,
      isWrite: true,
      hasWhere,
      destructiveReason: 'DROP permanently removes the database object',
    }
  }

  // RENAME TABLE
  if (lead === 'RENAME') {
    return {
      ...base,
      kind: 'RENAME',
      tables,
      isDestructive: true,
      isWrite: true,
      hasWhere,
      destructiveReason: 'RENAME changes the object path (data access disruption)',
    }
  }

  // CREATE — check for OR REPLACE
  if (lead === 'CREATE') {
    // CREATE OR REPLACE ... → destructive (replaces existing object)
    const isOrReplace =
      kw(tokens, 1) === 'OR' && kw(tokens, 2) === 'REPLACE'

    return {
      ...base,
      kind: 'CREATE',
      tables,
      isDestructive: isOrReplace,
      isWrite: true,
      hasWhere,
      destructiveReason: isOrReplace
        ? 'CREATE OR REPLACE overwrites an existing object'
        : undefined,
    }
  }

  // ALTER TABLE
  if (lead === 'ALTER') {
    // Scan for DROP COLUMN / DROP CONSTRAINT / RENAME COLUMN / RENAME TABLE
    // These are destructive; ADD COLUMN / MODIFY is not.
    let isDestructive = false
    let reason: string | undefined

    for (let i = 1; i < tokens.length; i++) {
      const k = kw(tokens, i)
      if (k === 'DROP') {
        // DROP COLUMN or DROP CONSTRAINT
        const next = kw(tokens, i + 1)
        if (next === 'COLUMN' || next === 'CONSTRAINT' || next === 'INDEX' || next === 'KEY' || next === 'PRIMARY' || next === 'FOREIGN') {
          isDestructive = true
          reason = `ALTER TABLE ... ${k} ${next ?? ''} removes a column or constraint`.trim()
          break
        }
        // Plain DROP (without COLUMN/CONSTRAINT keyword — some dialects omit COLUMN)
        const afterDrop = tokens[i + 1]
        if (afterDrop?.type === 'identifier') {
          isDestructive = true
          reason = 'ALTER TABLE ... DROP removes a column'
          break
        }
      }
      if (k === 'RENAME') {
        isDestructive = true
        reason = 'ALTER TABLE ... RENAME changes object path (data access disruption)'
        break
      }
    }

    return {
      ...base,
      kind: 'ALTER',
      tables,
      isDestructive,
      isWrite: true,
      hasWhere,
      destructiveReason: reason,
    }
  }

  // GRANT / REVOKE
  if (lead === 'GRANT') {
    return { ...base, kind: 'GRANT', tables, hasWhere }
  }
  if (lead === 'REVOKE') {
    return { ...base, kind: 'REVOKE', tables, hasWhere }
  }

  // EXEC / EXECUTE / CALL
  if (lead === 'EXEC' || lead === 'EXECUTE') {
    return { ...base, kind: 'EXEC', tables, hasWhere }
  }
  if (lead === 'CALL') {
    return { ...base, kind: 'CALL', tables, hasWhere }
  }

  // Transaction control
  if (lead === 'BEGIN' || lead === 'START') {
    return { ...base, kind: 'BEGIN', tables, hasWhere }
  }
  if (lead === 'COMMIT') {
    return { ...base, kind: 'COMMIT', tables, hasWhere }
  }
  if (lead === 'ROLLBACK') {
    return { ...base, kind: 'ROLLBACK', tables, hasWhere }
  }

  // Introspection
  if (lead === 'SHOW') {
    return { ...base, kind: 'SHOW', tables, isReadOnly: true, hasWhere }
  }
  if (lead === 'DESCRIBE' || lead === 'DESC') {
    return { ...base, kind: 'DESCRIBE', tables, isReadOnly: true, hasWhere }
  }
  if (lead === 'EXPLAIN') {
    return { ...base, kind: 'EXPLAIN', tables, isReadOnly: true, hasWhere }
  }

  return { ...base, kind: 'UNKNOWN', tables, hasWhere }
}

// ---------------------------------------------------------------------------
// Resolve options with defaults
// ---------------------------------------------------------------------------

function resolveOpts(options?: SqlClassifyOptions): Required<SqlClassifyOptions> {
  return {
    dialect: options?.dialect ?? 'generic',
    flagBareWriteAsDestructive: options?.flagBareWriteAsDestructive ?? true,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a single SQL statement or multi-statement input.
 * For multi-statement input the WORST (most destructive) classification wins.
 * `statementCount` reflects the actual number of statements found.
 */
export function classifySql(sql: string, options?: SqlClassifyOptions): SqlClassification {
  const opts = resolveOpts(options)
  const tokens = tokenize(sql)
  const statements = splitStatements(tokens)

  if (statements.length === 0) {
    return {
      kind: 'UNKNOWN',
      tables: [],
      isDestructive: false,
      isReadOnly: false,
      isWrite: false,
      hasWhere: false,
      statementCount: 0,
    }
  }

  let result = classifyOne(statements[0]!, opts)
  result = { ...result, statementCount: statements.length }

  for (let i = 1; i < statements.length; i++) {
    const c = classifyOne(statements[i]!, opts)
    result = worstOf(result, c, statements.length)
  }

  return result
}

/**
 * Classify each statement in a multi-statement input separately.
 * Returns one SqlClassification per statement (each with statementCount=1).
 */
export function classifyEachStatement(
  sql: string,
  options?: SqlClassifyOptions,
): SqlClassification[] {
  const opts = resolveOpts(options)
  const tokens = tokenize(sql)
  const statements = splitStatements(tokens)

  return statements.map(stmt => {
    const c = classifyOne(stmt, opts)
    return { ...c, statementCount: 1 }
  })
}

/**
 * Convenience helper: returns whether the SQL is blocked based on the
 * destructiveOps safety mode.
 *
 * - `deny`:    blocked=true  if isDestructive
 * - `confirm`: blocked=false (caller must show confirmation UI)
 * - `allow`:   blocked=false  always
 *
 * The full classification is always returned regardless of block decision.
 */
export function isSqlBlocked(
  sql: string,
  destructiveOps: 'allow' | 'confirm' | 'deny',
  options?: SqlClassifyOptions,
): { blocked: boolean; classification: SqlClassification; reason: string } {
  const classification = classifySql(sql, options)

  if (destructiveOps === 'deny' && classification.isDestructive) {
    return {
      blocked: true,
      classification,
      reason: classification.destructiveReason ?? `${classification.kind} is destructive and denied by policy`,
    }
  }

  if (destructiveOps === 'confirm') {
    return {
      blocked: false,
      classification,
      reason: classification.isDestructive
        ? `${classification.kind} is destructive — caller must confirm before executing`
        : 'no confirmation required',
    }
  }

  // allow (or non-destructive in deny mode)
  return {
    blocked: false,
    classification,
    reason: classification.isDestructive
      ? `${classification.kind} is destructive but allowed by policy`
      : 'statement is allowed',
  }
}
