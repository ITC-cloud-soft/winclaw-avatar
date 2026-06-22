/**
 * Lightweight COBOL/BMS/AS400-DDS parser using regex extraction.
 *
 * Extracts program structure, data definitions, CALL/COPY relations,
 * CICS map usage, and SQL table references for the knowledge graph.
 *
 * Handles both fixed-format (columns 1-6 seq, 7 indicator, 8-72 code)
 * and free-format COBOL (>>D, no column constraints).
 */

import { basename } from 'node:path'
import type { ParseResult, ParsedSymbol, ParsedRelation, ParsedImport } from './parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a stable lowercase id from a file path and suffix. */
function makeId(filePath: string, suffix: string): string {
  const base = basename(filePath).replace(/\.[^.]+$/, '').toLowerCase()
  const clean = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
  return clean ? `${base}_${clean}` : base
}

/** Build a human-readable label. */
function makeLabel(name: string, kind: string): string {
  switch (kind) {
    case 'program':  return `${name} (program)`
    case 'schema':   return `${name} (record)`
    case 'field':    return name
    case 'map':      return `${name} (map)`
    case 'mapset':   return `${name} (mapset)`
    case 'ui_field': return `${name} (ui-field)`
    default:         return name
  }
}

type CobolKind = 'program' | 'schema' | 'field' | 'map' | 'mapset' | 'ui_field'

function sym(
  id: string, label: string, kind: CobolKind, sourceFile: string,
  line: number, extra?: Partial<ParsedSymbol>,
): ParsedSymbol {
  return {
    id,
    label,
    sourceFile,
    sourceLocation: `L${line}`,
    kind: kind as ParsedSymbol['kind'],
    ...extra,
  }
}

function rel(
  sourceId: string, targetId: string, relation: ParsedRelation['relation'],
  sourceFile: string, line: number,
): ParsedRelation {
  return { sourceId, targetId, relation, confidence: 'EXTRACTED', sourceFile, sourceLocation: `L${line}` }
}

/**
 * Strip COBOL fixed-format comment lines (col 7 = '*' or '/') and
 * debug lines (col 7 = 'D'). Also strip sequence numbers (cols 1-6)
 * and identification area (cols 73+) for fixed-format sources.
 * Returns an array of { text, lineNo } for non-comment lines.
 */
function preprocessCobol(content: string): Array<{ text: string; lineNo: number }> {
  const lines = content.split(/\r?\n/)
  const result: Array<{ text: string; lineNo: number }> = []

  // Heuristic: if most lines are >= 7 chars and col 7 is often ' ' or '-',
  // treat as fixed-format.
  let fixedCount = 0
  let freeCount = 0
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const ln = lines[i]
    if (ln.length >= 7) {
      const c7 = ln[6]
      if (c7 === ' ' || c7 === '-' || c7 === '*' || c7 === '/') fixedCount++
      else freeCount++
    } else {
      freeCount++
    }
  }
  const isFixed = fixedCount > freeCount

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (isFixed) {
      if (raw.length < 7) { result.push({ text: raw, lineNo: i + 1 }); continue }
      const indicator = raw[6]
      if (indicator === '*' || indicator === '/' || indicator === 'D' || indicator === 'd') continue
      // Extract cols 8-72 (0-indexed 7..71)
      const code = raw.substring(7, 72).trimEnd()
      result.push({ text: code, lineNo: i + 1 })
    } else {
      // Free-format: skip lines starting with *> (inline comment)
      const trimmed = raw.trim()
      if (trimmed.startsWith('*>')) continue
      if (trimmed === '' || trimmed.startsWith('>>D')) continue
      result.push({ text: trimmed, lineNo: i + 1 })
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// COBOL file parser
// ---------------------------------------------------------------------------

export function parseCobolFile(content: string, filePath: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  if (!content.trim()) return { symbols, relations, imports }

  const normPath = filePath.replace(/\\/g, '/')
  const lines = preprocessCobol(content)

  // Join all lines for multi-line regex matching (EXEC SQL can span lines)
  const joined = lines.map(l => l.text).join('\n')

  // --- File-level node ---
  const fileId = makeId(normPath, '')
  symbols.push(sym(fileId, basename(normPath), 'program', normPath, 1))

  // --- PROGRAM-ID ---
  const progIdRe = /PROGRAM-ID\.\s+([A-Za-z0-9_-]+)/i
  for (const { text, lineNo } of lines) {
    const m = text.match(progIdRe)
    if (m) {
      const name = m[1]
      const id = makeId(normPath, name)
      symbols.push(sym(id, makeLabel(name, 'program'), 'program', normPath, lineNo))
      relations.push(rel(fileId, id, 'contains', normPath, lineNo))
      break // Only one PROGRAM-ID per source
    }
  }

  // --- Data items: 01-level records ---
  let currentRecord: { id: string; name: string; lineNo: number } | null = null
  const levelRe = /^\s*(\d{2})\s+([A-Za-z0-9_-]+)/i

  for (const { text, lineNo } of lines) {
    const m = text.match(levelRe)
    if (!m) continue
    const level = parseInt(m[1], 10)
    const name = m[2]
    if (name === 'FILLER' || name === 'filler') continue

    if (level === 1) {
      const id = makeId(normPath, name)
      symbols.push(sym(id, makeLabel(name, 'schema'), 'schema', normPath, lineNo))
      relations.push(rel(fileId, id, 'contains', normPath, lineNo))
      currentRecord = { id, name, lineNo }
    } else if (level >= 5 && level <= 49 && currentRecord) {
      // Extract PIC clause
      const picMatch = text.match(/PIC(?:TURE)?\s+IS\s+(\S+)|PIC(?:TURE)?\s+(\S+)/i)
      const picType = picMatch ? (picMatch[1] || picMatch[2]) : undefined
      const fieldId = makeId(normPath, `${currentRecord.name}_${name}`)
      symbols.push(sym(fieldId, makeLabel(name, 'field'), 'field', normPath, lineNo,
        picType ? { fieldType: picType } : undefined))
      relations.push(rel(currentRecord.id, fieldId, 'has_field', normPath, lineNo))
    }
  }

  // --- CALL 'program-name' ---
  const callRe = /CALL\s+['"]([A-Za-z0-9_-]+)['"]/gi
  for (const { text, lineNo } of lines) {
    let cm: RegExpExecArray | null
    callRe.lastIndex = 0
    while ((cm = callRe.exec(text)) !== null) {
      const target = cm[1]
      const targetId = target.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      relations.push(rel(fileId, targetId, 'calls', normPath, lineNo))
    }
  }

  // --- COPY copybook ---
  const copyRe = /COPY\s+([A-Za-z0-9_-]+)/gi
  for (const { text, lineNo } of lines) {
    let cm: RegExpExecArray | null
    copyRe.lastIndex = 0
    while ((cm = copyRe.exec(text)) !== null) {
      const target = cm[1]
      const targetId = target.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      relations.push(rel(fileId, targetId, 'imports_from', normPath, lineNo))
      imports.push({ from: target, names: [target], sourceLocation: `L${lineNo}` })
    }
  }

  // --- EXEC CICS SEND/RECEIVE MAP('name') ---
  const cicsMapRe = /EXEC\s+CICS\s+(?:SEND|RECEIVE)\s+MAP\s*\(\s*'([A-Za-z0-9_-]+)'\s*\)/gi
  for (const { text, lineNo } of lines) {
    let cm: RegExpExecArray | null
    cicsMapRe.lastIndex = 0
    while ((cm = cicsMapRe.exec(text)) !== null) {
      const mapName = cm[1]
      const mapId = mapName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      relations.push(rel(fileId, mapId, 'READS', normPath, lineNo))
    }
  }

  // --- EXEC SQL: SELECT FROM / INSERT INTO / UPDATE table ---
  // These can span multiple source lines; use the joined text.
  const sqlSelectRe = /EXEC\s+SQL[\s\S]*?FROM\s+([A-Za-z0-9_]+)[\s\S]*?END-EXEC/gi
  let sm: RegExpExecArray | null
  while ((sm = sqlSelectRe.exec(joined)) !== null) {
    const table = sm[1]
    const tableId = `table_${table.toLowerCase()}`
    relations.push(rel(fileId, tableId, 'READS', normPath, 1))
  }

  const sqlInsertRe = /EXEC\s+SQL[\s\S]*?INSERT\s+INTO\s+([A-Za-z0-9_]+)[\s\S]*?END-EXEC/gi
  while ((sm = sqlInsertRe.exec(joined)) !== null) {
    const table = sm[1]
    const tableId = `table_${table.toLowerCase()}`
    relations.push(rel(fileId, tableId, 'CREATES', normPath, 1))
  }

  const sqlUpdateRe = /EXEC\s+SQL[\s\S]*?UPDATE\s+([A-Za-z0-9_]+)[\s\S]*?END-EXEC/gi
  while ((sm = sqlUpdateRe.exec(joined)) !== null) {
    const table = sm[1]
    const tableId = `table_${table.toLowerCase()}`
    relations.push(rel(fileId, tableId, 'UPDATES', normPath, 1))
  }

  const sqlDeleteRe = /EXEC\s+SQL[\s\S]*?DELETE\s+FROM\s+([A-Za-z0-9_]+)[\s\S]*?END-EXEC/gi
  while ((sm = sqlDeleteRe.exec(joined)) !== null) {
    const table = sm[1]
    const tableId = `table_${table.toLowerCase()}`
    relations.push(rel(fileId, tableId, 'DELETES', normPath, 1))
  }

  return { symbols, relations, imports }
}

// ---------------------------------------------------------------------------
// BMS file parser (CICS screen maps)
// ---------------------------------------------------------------------------

export function parseBmsFile(content: string, filePath: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  if (!content.trim()) return { symbols, relations, imports }

  const normPath = filePath.replace(/\\/g, '/')
  const rawLines = content.split(/\r?\n/)

  // File-level node
  const fileId = makeId(normPath, '')
  symbols.push(sym(fileId, basename(normPath), 'mapset', normPath, 1))

  let currentMapsetId = fileId
  let currentMapId: string | null = null

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const lineNo = i + 1

    // Skip comment lines (col 1 = '*')
    if (raw.startsWith('*')) continue

    // DFHMSD — mapset definition: NAME DFHMSD TYPE=...
    const msdMatch = raw.match(/^([A-Za-z0-9_]+)\s+DFHMSD\b/i)
    if (msdMatch) {
      const name = msdMatch[1]
      const id = makeId(normPath, name)
      if (id !== fileId) {
        symbols.push(sym(id, makeLabel(name, 'mapset'), 'mapset', normPath, lineNo))
        relations.push(rel(fileId, id, 'contains', normPath, lineNo))
      }
      currentMapsetId = id
      continue
    }

    // DFHMDI — map definition: NAME DFHMDI SIZE=...
    const mdiMatch = raw.match(/^([A-Za-z0-9_]+)\s+DFHMDI\b/i)
    if (mdiMatch) {
      const name = mdiMatch[1]
      const id = makeId(normPath, name)
      symbols.push(sym(id, makeLabel(name, 'map'), 'map', normPath, lineNo))
      relations.push(rel(currentMapsetId, id, 'contains', normPath, lineNo))
      currentMapId = id
      continue
    }

    // DFHMDF — field definition: NAME DFHMDF POS=(...),LENGTH=n,...
    const mdfMatch = raw.match(/^([A-Za-z0-9_]+)\s+DFHMDF\b/i)
    if (mdfMatch && currentMapId) {
      const name = mdfMatch[1]
      const id = makeId(normPath, `${currentMapId}_${name}`)
      // Try to extract LENGTH
      const lenMatch = raw.match(/LENGTH\s*=\s*(\d+)/i)
      const lenType = lenMatch ? `LENGTH=${lenMatch[1]}` : undefined
      symbols.push(sym(id, makeLabel(name, 'ui_field'), 'field', normPath, lineNo,
        lenType ? { fieldType: lenType } : undefined))
      relations.push(rel(currentMapId, id, 'has_field', normPath, lineNo))
    }
  }

  return { symbols, relations, imports }
}

// ---------------------------------------------------------------------------
// AS/400 DDS file parser (Display/Physical/Logical files)
// ---------------------------------------------------------------------------

export function parseAs400File(content: string, filePath: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  if (!content.trim()) return { symbols, relations, imports }

  const normPath = filePath.replace(/\\/g, '/')
  const rawLines = content.split(/\r?\n/)

  // File-level node
  const fileId = makeId(normPath, '')
  symbols.push(sym(fileId, basename(normPath), 'schema', normPath, 1))

  let currentRecordId: string | null = null

  // DDS format: cols 1-5 seq, col 6 form-type (A), cols 7-16 conditioning,
  // col 17 name-type (R=record, K=key, blank=field), cols 19-28 name, etc.
  // Simplified regex approach for common patterns.

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const lineNo = i + 1

    // Skip comment lines (col 7 = '*')
    if (raw.length >= 7 && raw[6] === '*') continue

    // Record format: A R RECORDNAME
    const recMatch = raw.match(/^\s*A\s+R\s+([A-Za-z0-9_]+)/i)
    if (recMatch) {
      const name = recMatch[1]
      const id = makeId(normPath, name)
      symbols.push(sym(id, makeLabel(name, 'schema'), 'schema', normPath, lineNo))
      relations.push(rel(fileId, id, 'contains', normPath, lineNo))
      currentRecordId = id
      continue
    }

    // Field definition: A FIELDNAME TYPE LENGTH DECIMAL
    // Common pattern: A            FIELDNAME     10A   or   A            FIELDNAME     7S 2
    if (currentRecordId) {
      const fieldMatch = raw.match(/^\s*A\s{2,}([A-Za-z0-9_]+)\s+(\d+[ASP]|\d+\s+\d+)/i)
      if (fieldMatch) {
        const name = fieldMatch[1]
        const typeStr = fieldMatch[2].trim()
        const fieldId = makeId(normPath, `${currentRecordId}_${name}`)
        symbols.push(sym(fieldId, makeLabel(name, 'field'), 'field', normPath, lineNo,
          { fieldType: typeStr }))
        relations.push(rel(currentRecordId, fieldId, 'has_field', normPath, lineNo))
      }
    }

    // Reference to another file: REF(FILENAME)
    const refMatch = raw.match(/REF\s*\(\s*([A-Za-z0-9_/]+)\s*\)/i)
    if (refMatch) {
      const refName = refMatch[1]
      const refId = refName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      relations.push(rel(fileId, refId, 'imports_from', normPath, lineNo))
      imports.push({ from: refName, names: [refName], sourceLocation: `L${lineNo}` })
    }
  }

  return { symbols, relations, imports }
}
