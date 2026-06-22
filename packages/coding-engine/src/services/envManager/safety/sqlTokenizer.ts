/**
 * SQL tokenizer — Phase 4 production safety (§1.5.1).
 *
 * Critical design: string literals are tokenized as opaque `string` tokens so
 * that keywords embedded inside quoted values (e.g. 'DROP TABLE') are NEVER
 * mistaken for SQL keywords. Comments are discarded entirely.
 *
 * Supports: single-quoted strings with '' escape, double-quoted identifiers,
 * backtick identifiers (MySQL), line comments (--), block comments (/* *\/),
 * operators, punctuation, numbers, and keywords from a fixed uppercase set.
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type SqlToken =
  | { type: 'keyword';    value: string }   // SELECT, FROM, etc. (uppercased)
  | { type: 'identifier'; value: string }   // table_name, column, quoted ident
  | { type: 'string';     value: string }   // 'literal' content (decoded)
  | { type: 'number';     value: string }   // 42, 3.14
  | { type: 'punct';      value: string }   // ( ) , ; .
  | { type: 'operator';   value: string }   // = < > <> <= >= != || && etc.

// ---------------------------------------------------------------------------
// Keyword set — used for case-insensitive keyword recognition
// ---------------------------------------------------------------------------

const KEYWORDS = new Set<string>([
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT',
  'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'RENAME',
  'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'WITH', 'FROM', 'JOIN', 'INTO', 'VALUES', 'SET', 'WHERE', 'ON', 'AS',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN', 'EXISTS',
  'ASC', 'DESC', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'TABLE', 'VIEW', 'INDEX', 'COLUMN', 'CONSTRAINT', 'FOREIGN', 'PRIMARY', 'KEY',
  'SHOW', 'DESCRIBE', 'EXPLAIN', 'USE', 'IF', 'ELSE', 'REPLACE',
  'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'NATURAL',
  'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
  'CASE', 'WHEN', 'THEN', 'END', 'OVER', 'PARTITION',
  'DATABASE', 'SCHEMA', 'FUNCTION', 'PROCEDURE', 'TRIGGER', 'SEQUENCE',
  'ADD', 'MODIFY', 'CHANGE', 'FIRST', 'AFTER',
  'CASCADE', 'RESTRICT', 'DEFERRABLE', 'DEFERRED', 'IMMEDIATE',
  'UNIQUE', 'DEFAULT', 'REFERENCES', 'CHECK', 'AUTO_INCREMENT',
  'RETURNING', 'CONFLICT', 'NOTHING', 'DO',
  // Transaction-control keywords (used by sqlClassifier for BEGIN/START TRANSACTION)
  'START', 'TRANSACTION', 'WORK',
])

// ---------------------------------------------------------------------------
// Operator characters (multi-char operators handled by greed)
// ---------------------------------------------------------------------------

const OPERATOR_CHARS = new Set([
  '=', '<', '>', '!', '~', '|', '&', '+', '-', '*', '/', '%', '^', '?', '@', '#',
])

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenizes a SQL string into a flat list of typed tokens.
 * Comments are consumed and discarded. Quoted strings (single-quote) produce
 * `string` tokens; double-quoted / backtick-quoted words produce `identifier`
 * tokens. All keywords are compared case-insensitively and stored uppercase.
 */
export function tokenize(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let i = 0
  const len = sql.length

  while (i < len) {
    const ch = sql[i]!

    // ------------------------------------------------------------------
    // Whitespace — skip
    // ------------------------------------------------------------------
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // ------------------------------------------------------------------
    // Line comment: -- ... \n
    // ------------------------------------------------------------------
    if (ch === '-' && sql[i + 1] === '-') {
      i += 2
      while (i < len && sql[i] !== '\n') i++
      continue
    }

    // ------------------------------------------------------------------
    // Block comment: /* ... */
    // ------------------------------------------------------------------
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < len) {
        if (sql[i] === '*' && sql[i + 1] === '/') { i += 2; break }
        i++
      }
      continue
    }

    // ------------------------------------------------------------------
    // Single-quoted string: 'value' with '' escape for embedded quote
    // ------------------------------------------------------------------
    if (ch === "'") {
      i++ // consume opening quote
      let value = ''
      while (i < len) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            // Escaped single quote: '' → '
            value += "'"
            i += 2
          } else {
            i++ // consume closing quote
            break
          }
        } else {
          value += sql[i]!
          i++
        }
      }
      tokens.push({ type: 'string', value })
      continue
    }

    // ------------------------------------------------------------------
    // Double-quoted identifier: "my table" — treat as identifier, NOT string
    // ------------------------------------------------------------------
    if (ch === '"') {
      i++ // consume opening quote
      let value = ''
      while (i < len) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            value += '"'
            i += 2
          } else {
            i++
            break
          }
        } else {
          value += sql[i]!
          i++
        }
      }
      tokens.push({ type: 'identifier', value })
      continue
    }

    // ------------------------------------------------------------------
    // Backtick identifier (MySQL): `my_table`
    // ------------------------------------------------------------------
    if (ch === '`') {
      i++
      let value = ''
      while (i < len && sql[i] !== '`') {
        value += sql[i]!
        i++
      }
      if (i < len) i++ // consume closing backtick
      tokens.push({ type: 'identifier', value })
      continue
    }

    // ------------------------------------------------------------------
    // Numeric literal: [0-9] or .[0-9]
    // ------------------------------------------------------------------
    if (ch >= '0' && ch <= '9') {
      let value = ''
      while (i < len && ((sql[i]! >= '0' && sql[i]! <= '9') || sql[i] === '.' || sql[i] === 'e' || sql[i] === 'E' || sql[i] === '_')) {
        value += sql[i]!
        i++
      }
      tokens.push({ type: 'number', value })
      continue
    }

    // Decimal-first number: .42
    if (ch === '.' && i + 1 < len && sql[i + 1]! >= '0' && sql[i + 1]! <= '9') {
      let value = '.'
      i++
      while (i < len && sql[i]! >= '0' && sql[i]! <= '9') {
        value += sql[i]!
        i++
      }
      tokens.push({ type: 'number', value })
      continue
    }

    // ------------------------------------------------------------------
    // Punctuation: ( ) , ; . [ ]
    // ------------------------------------------------------------------
    if (ch === '(' || ch === ')' || ch === ',' || ch === ';' || ch === '[' || ch === ']') {
      tokens.push({ type: 'punct', value: ch })
      i++
      continue
    }

    // Dot (period) — not followed by digit, so it's punctuation (schema.table)
    if (ch === '.') {
      tokens.push({ type: 'punct', value: '.' })
      i++
      continue
    }

    // ------------------------------------------------------------------
    // Operators: greedy multi-char sequences of operator chars
    // Also handle $ (used in Postgres params $1) — emit as punct
    // ------------------------------------------------------------------
    if (OPERATOR_CHARS.has(ch)) {
      // Special case: * alone is often used as wildcard — emit as operator
      let value = ''
      while (i < len && OPERATOR_CHARS.has(sql[i]!)) {
        value += sql[i]!
        i++
      }
      tokens.push({ type: 'operator', value })
      continue
    }

    // Postgres param placeholder: $1 $2 etc.
    if (ch === '$') {
      let value = '$'
      i++
      while (i < len && sql[i]! >= '0' && sql[i]! <= '9') {
        value += sql[i]!
        i++
      }
      if (value === '$') {
        // bare $, treat as operator
        tokens.push({ type: 'operator', value: '$' })
      } else {
        tokens.push({ type: 'identifier', value })
      }
      continue
    }

    // ------------------------------------------------------------------
    // Keyword or identifier: starts with letter or underscore
    // ------------------------------------------------------------------
    if (
      (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
    ) {
      let value = ''
      while (
        i < len &&
        (
          (sql[i]! >= 'a' && sql[i]! <= 'z') ||
          (sql[i]! >= 'A' && sql[i]! <= 'Z') ||
          (sql[i]! >= '0' && sql[i]! <= '9') ||
          sql[i] === '_' || sql[i] === '$'
        )
      ) {
        value += sql[i]!
        i++
      }
      const upper = value.toUpperCase()
      if (KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: upper })
      } else {
        tokens.push({ type: 'identifier', value })
      }
      continue
    }

    // ------------------------------------------------------------------
    // Unknown character — skip silently (handles UTF-8, special chars, etc.)
    // ------------------------------------------------------------------
    i++
  }

  return tokens
}
