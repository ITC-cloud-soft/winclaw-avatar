/**
 * OpenAPI / Swagger spec parser for the graph builder.
 *
 * Reads openapi.yaml / openapi.json / swagger.yaml files, extracts paths and
 * component schemas as graph nodes, and fields / schema-references as graph
 * edges. Enables semantic queries such as:
 *
 *   graph_query("required fields of PassengerCreate")
 *   graph_query("POST /api/passengers request schema")
 *
 * IMPORTANT — type-union extensions required in parser.ts (applied later by
 * the parser.ts merge agent; see INTEGRATION NOTES at the bottom of this file):
 *
 *   ParsedSymbol.kind   must accept:
 *     'openapi_endpoint' | 'openapi_schema' | 'openapi_field'
 *
 *   ParsedRelation.relation must accept:
 *     'expects_schema' | 'returns_schema'
 *     | 'has_required_field' | 'has_optional_field'
 *
 * Until those unions are merged, the implementation casts new kinds / relations
 * via `as any`. Runtime behaviour is unaffected.
 */

import path from 'node:path'
import yaml, { parseDocument as parseYamlDocument } from 'yaml'
import type { ParsedSymbol, ParsedRelation, ParseResult } from './parser.js'
import { generateId } from './parser.js'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when `filePath` looks like an OpenAPI / Swagger spec.
 *
 * Recognised patterns (case-insensitive):
 *   - openapi.yaml | openapi.yml | openapi.json
 *   - swagger.yaml | swagger.yml | swagger.json
 *   - *.openapi.yaml | *.openapi.yml | *.openapi.json
 */
export function isOpenApiFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase()
  return (
    base === 'openapi.yaml' ||
    base === 'openapi.yml' ||
    base === 'openapi.json' ||
    base === 'swagger.yaml' ||
    base === 'swagger.yml' ||
    base === 'swagger.json' ||
    base.endsWith('.openapi.yaml') ||
    base.endsWith('.openapi.yml') ||
    base.endsWith('.openapi.json')
  )
}

/**
 * Parses a single OpenAPI / Swagger file and extracts graph nodes + edges.
 *
 * Format is detected from the file extension:
 *   - `.json` → `JSON.parse`
 *   - `.yaml` / `.yml` → `yaml.parse` (the `yaml` npm package, already a dep)
 *
 * @param filePath Project-relative path, used for ID/label generation.
 * @param content  Raw file text.
 * @returns ParseResult containing file-level, schema, field, and endpoint nodes
 *          plus the edges that connect them.
 *
 * @throws If the extension is unrecognised, if parsing fails, or if the spec
 *         is missing the required `openapi`/`swagger` version field.
 */
export async function parseOpenApiFile(
  filePath: string,
  content: string,
): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase()
  let spec: any
  // Map from "schema:<Name>" or "path:</foo>" → 1-based line number.
  // `null` means the line-tracking path failed; callers should fall back to 'L?'.
  let lineMap: Map<string, number> | null = null

  if (ext === '.json') {
    spec = JSON.parse(content)
    try {
      lineMap = buildLineMapFromContent(content, spec)
    } catch {
      lineMap = null
    }
  } else if (ext === '.yaml' || ext === '.yml') {
    // parseDocument preserves AST + node `range` byte offsets; keepSourceTokens
    // is not strictly required for ranges but is cheap insurance against
    // future yaml-package changes.
    try {
      const doc = parseYamlDocument(content, { keepSourceTokens: true })
      spec = doc.toJS()
      lineMap = buildLineMapFromYamlDoc(doc, content)
    } catch {
      // Fallback to plain parse; line information will be best-effort.
      spec = yaml.parse(content)
      lineMap = null
    }
  } else {
    throw new Error(`Unsupported OpenAPI file extension: ${ext}`)
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('OpenAPI parse produced a non-object result')
  }

  // OpenAPI 3.x uses `openapi`; Swagger 2.x uses `swagger`.
  if (!spec.openapi && !spec.swagger) {
    throw new Error('Not an OpenAPI spec (missing `openapi`/`swagger` field)')
  }

  return extractFromSpec(spec, filePath, lineMap)
}

// ---------------------------------------------------------------------------
// Internal extraction
// ---------------------------------------------------------------------------

/**
 * Walks a parsed OpenAPI object and emits graph symbols + relations.
 *
 * Extraction rules:
 *   1. One `document` node per file (label = spec.info.title or filename).
 *   2. For each entry under `components.schemas` (OAS 3) or `definitions`
 *      (Swagger 2), emit an `openapi_schema` node and one `openapi_field`
 *      node per property, connected via `has_required_field` /
 *      `has_optional_field` edges driven by the schema's `required` array.
 *   3. For each `paths.<path>.<method>` entry, emit an `openapi_endpoint`
 *      node. Connect it to referenced request / response schemas via
 *      `expects_schema` / `returns_schema` edges (only when the schema
 *      uses a `$ref` — inline schemas are not split out).
 */
function extractFromSpec(
  spec: any,
  filePath: string,
  lineMap?: Map<string, number> | null,
): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []

  const normPath = filePath.replace(/\\/g, '/')

  // Helper: look up a line number from the map or return the `L?` fallback
  // sentinel when the map is absent / the key is unknown.
  const locOf = (key: string): string => {
    if (!lineMap) return 'L?'
    const line = lineMap.get(key)
    return typeof line === 'number' ? `L${line}` : 'L?'
  }

  // -------------------------------------------------------------------------
  // 1. File-level document node
  // -------------------------------------------------------------------------
  const fileId = generateId(normPath)
  const fileLabel: string =
    (spec.info && typeof spec.info.title === 'string' && spec.info.title) ||
    path.basename(normPath)

  symbols.push({
    id: fileId,
    label: fileLabel,
    sourceFile: normPath,
    sourceLocation: 'L1',
    kind: 'document',
  })

  // -------------------------------------------------------------------------
  // 2. Component schemas → nodes + field edges
  // -------------------------------------------------------------------------
  const schemas: Record<string, any> =
    (spec.components && spec.components.schemas) || spec.definitions || {}

  for (const [name, schema] of Object.entries(schemas)) {
    if (!schema || typeof schema !== 'object') continue

    const schemaId = openApiSchemaId(name)
    const schemaLoc = locOf(`schema:${name}`)
    symbols.push({
      id: schemaId,
      label: name,
      sourceFile: normPath,
      sourceLocation: schemaLoc,
      kind: 'openapi_schema',
    })
    relations.push({
      sourceId: fileId,
      targetId: schemaId,
      relation: 'contains',
      confidence: 'EXTRACTED',
      sourceFile: normPath,
      sourceLocation: schemaLoc,
    })

    const required = new Set<string>(
      Array.isArray((schema as any).required) ? (schema as any).required : [],
    )
    const props: Record<string, any> = (schema as any).properties || {}

    for (const [field, fieldDef] of Object.entries(props)) {
      const fieldId = `${schemaId}_${sanitizeId(field)}`
      const isRequired = required.has(field)
      const fieldType = describeFieldType(fieldDef)

      // Prefer a field-specific line if we resolved one (YAML AST case).
      // Otherwise fall back to the enclosing schema's line — still more useful
      // than 'L?' for jumping into the spec.
      const fieldLoc =
        lineMap?.get(`field:${name}.${field}`) !== undefined
          ? `L${lineMap.get(`field:${name}.${field}`)}`
          : schemaLoc

      symbols.push({
        id: fieldId,
        label: `${name}.${field}`,
        sourceFile: normPath,
        sourceLocation: fieldLoc,
        kind: 'openapi_field',
        fieldType,
        optional: !isRequired,
        required: isRequired,
        schemaClass: name,
      })

      relations.push({
        sourceId: schemaId,
        targetId: fieldId,
        relation: isRequired
          ? 'has_required_field'
          : 'has_optional_field',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: fieldLoc,
      })
    }
  }

  // -------------------------------------------------------------------------
  // 3. Paths → endpoint nodes + request/response schema edges
  // -------------------------------------------------------------------------
  const paths: Record<string, any> = spec.paths || {}
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    const pathLoc = locOf(`path:${pathStr}`)

    for (const method of httpMethods) {
      const op = (pathItem as any)[method]
      if (!op || typeof op !== 'object') continue

      // Prefer a method-specific line (YAML AST can resolve it); else fall
      // back to the path-level line.
      const methodLoc =
        lineMap?.get(`method:${pathStr}:${method}`) !== undefined
          ? `L${lineMap.get(`method:${pathStr}:${method}`)}`
          : pathLoc

      const endpointId = `openapi_endpoint_${method}_${sanitizeId(pathStr)}`
      symbols.push({
        id: endpointId,
        label: `${method.toUpperCase()} ${pathStr}`,
        sourceFile: normPath,
        sourceLocation: methodLoc,
        kind: 'openapi_endpoint',
        httpMethod: method.toUpperCase(),
        urlPath: pathStr,
      })
      relations.push({
        sourceId: fileId,
        targetId: endpointId,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: methodLoc,
      })

      // --- Request body schema (OAS 3: requestBody.content.<media>.schema) ---
      const requestSchema =
        op.requestBody?.content?.['application/json']?.schema ??
        // Swagger 2 uses `parameters: [{ in: 'body', schema: {...} }]`
        extractSwaggerBodySchema(op.parameters)

      const requestSchemaName = resolveSchemaRef(requestSchema)
      if (requestSchemaName) {
        relations.push({
          sourceId: endpointId,
          targetId: openApiSchemaId(requestSchemaName),
          relation: 'expects_schema',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: methodLoc,
        })
      }

      // --- Response schemas for success statuses ---
      const successStatuses = ['200', '201', '202', '204']
      const responses: Record<string, any> = op.responses || {}
      for (const status of successStatuses) {
        const resp = responses[status]
        if (!resp || typeof resp !== 'object') continue

        const respSchema =
          // OAS 3
          resp.content?.['application/json']?.schema ??
          // Swagger 2
          resp.schema

        const respSchemaName = resolveSchemaRef(respSchema)
        if (respSchemaName) {
          relations.push({
            sourceId: endpointId,
            targetId: openApiSchemaId(respSchemaName),
            relation: 'returns_schema',
            confidence: 'EXTRACTED',
            sourceFile: normPath,
            sourceLocation: methodLoc,
          })
        }
      }
    }
  }

  return { symbols, relations, imports: [] }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable id for a `components.schemas.<Name>` node. */
function openApiSchemaId(name: string): string {
  return `openapi_schema_${sanitizeId(name)}`
}

/** Lowercase, alphanumeric+underscore only — safe for node ids. */
function sanitizeId(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '_').toLowerCase()
}

/**
 * Resolves a schema reference of the form "#/components/schemas/Foo" or
 * "#/definitions/Foo" back to the bare name ("Foo").
 *
 * Returns `null` for inline schemas, primitives, or missing input — callers
 * should treat a null result as "no outgoing schema edge".
 */
function resolveSchemaRef(schema: any): string | null {
  if (!schema || typeof schema !== 'object') return null

  if (typeof schema.$ref === 'string') {
    const m = schema.$ref.match(/\/([^/]+)$/)
    return m ? m[1] : null
  }

  // Arrays of refs: { type: 'array', items: { $ref: '...' } }
  if (schema.type === 'array' && schema.items) {
    return resolveSchemaRef(schema.items)
  }

  return null
}

/**
 * Best-effort human-readable field type summary — used to populate
 * `ParsedSymbol.fieldType` so graph_explain has something to show.
 */
function describeFieldType(fieldDef: any): string {
  if (!fieldDef || typeof fieldDef !== 'object') return 'unknown'

  if (typeof fieldDef.$ref === 'string') {
    const ref = resolveSchemaRef(fieldDef)
    return ref ? `ref:${ref}` : 'ref'
  }

  if (fieldDef.type === 'array') {
    const inner = fieldDef.items ? describeFieldType(fieldDef.items) : 'unknown'
    return `array<${inner}>`
  }

  if (typeof fieldDef.type === 'string') {
    if (typeof fieldDef.format === 'string') {
      return `${fieldDef.type}(${fieldDef.format})`
    }
    return fieldDef.type
  }

  // Swagger 2 allows `schema: { $ref }` directly on a parameter
  if (fieldDef.schema) return describeFieldType(fieldDef.schema)

  return 'unknown'
}

/**
 * Swagger 2.0 compatibility: body parameters live in `operation.parameters`,
 * tagged with `in: 'body'`. Returns the embedded schema object, or null.
 */
function extractSwaggerBodySchema(parameters: any): any | null {
  if (!Array.isArray(parameters)) return null
  for (const p of parameters) {
    if (p && typeof p === 'object' && p.in === 'body' && p.schema) {
      return p.schema
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Source-location resolution
// ---------------------------------------------------------------------------

/** Convert a byte offset inside `content` into a 1-based line number. */
function offsetToLine(content: string, offset: number): number {
  if (offset <= 0) return 1
  // Count newlines in [0, offset). String.prototype.split is simple and
  // accurate enough for the modest spec sizes we expect (~MB at most).
  let line = 1
  const limit = Math.min(offset, content.length)
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 10 /* '\n' */) line++
  }
  return line
}

/**
 * Best-effort line map for **JSON** specs. We lost AST info going through
 * `JSON.parse`, so we fall back to substring search on the raw text:
 * finding e.g. `"PassengerCreate"` inside the JSON source yields the first
 * line on which the key appears. Not perfect (a string value with the same
 * text would match first), but dramatically better than `L?`.
 *
 * Keys populated:
 *   - `schema:<Name>`   — for each components.schemas / definitions entry
 *   - `path:<PathStr>`  — for each `paths.<PathStr>` entry
 */
function buildLineMapFromContent(
  content: string,
  spec: any,
): Map<string, number> {
  const map = new Map<string, number>()
  const lines = content.split('\n')

  const schemaNames = Object.keys(
    (spec?.components && spec.components.schemas) || spec?.definitions || {},
  )
  for (const name of schemaNames) {
    const needle = `"${name}"`
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(needle)) {
        map.set(`schema:${name}`, i + 1)
        break
      }
    }
  }

  const paths = Object.keys(spec?.paths || {})
  for (const p of paths) {
    const needle = `"${p}"`
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(needle)) {
        map.set(`path:${p}`, i + 1)
        break
      }
    }
  }

  return map
}

/**
 * Accurate line map for **YAML** specs, driven by the `yaml` package's
 * Document AST. Each parsed node exposes `range: [start, value-end, node-end]`
 * as byte offsets into the original source, which we convert to 1-based
 * line numbers.
 *
 * Keys populated:
 *   - `schema:<Name>`
 *   - `field:<SchemaName>.<FieldName>`  (YAML-only; the JSON path cannot
 *     produce these)
 *   - `path:<PathStr>`
 *   - `method:<PathStr>:<method>`       (YAML-only)
 *
 * Defensive: any unexpected AST shape is caught by the outer try/catch in
 * `parseOpenApiFile` and falls back to `'L?'` via an empty/undefined map.
 */
function buildLineMapFromYamlDoc(doc: any, content: string): Map<string, number> {
  const map = new Map<string, number>()
  const root = doc?.contents
  if (!root || !Array.isArray(root.items)) return map

  // Helper: find a top-level key inside a YAMLMap-like node.
  const findItem = (node: any, keyName: string): any => {
    if (!node || !Array.isArray(node.items)) return undefined
    return node.items.find((it: any) => it?.key?.value === keyName)
  }

  const lineOfKey = (pair: any): number | null => {
    const range = pair?.key?.range
    if (!range || typeof range[0] !== 'number') return null
    return offsetToLine(content, range[0])
  }

  // --- components.schemas (OAS 3) -------------------------------------------
  const componentsItem = findItem(root, 'components')
  const schemasItem = findItem(componentsItem?.value, 'schemas')
  if (schemasItem?.value?.items) {
    for (const schemaEntry of schemasItem.value.items) {
      const schemaName = schemaEntry?.key?.value
      const line = lineOfKey(schemaEntry)
      if (typeof schemaName === 'string' && line !== null) {
        map.set(`schema:${schemaName}`, line)
        // Drill into properties for per-field lines.
        const propsItem = findItem(schemaEntry.value, 'properties')
        if (propsItem?.value?.items) {
          for (const fieldEntry of propsItem.value.items) {
            const fieldName = fieldEntry?.key?.value
            const fieldLine = lineOfKey(fieldEntry)
            if (typeof fieldName === 'string' && fieldLine !== null) {
              map.set(`field:${schemaName}.${fieldName}`, fieldLine)
            }
          }
        }
      }
    }
  }

  // --- definitions (Swagger 2.0 compatibility) ------------------------------
  const definitionsItem = findItem(root, 'definitions')
  if (definitionsItem?.value?.items) {
    for (const defEntry of definitionsItem.value.items) {
      const defName = defEntry?.key?.value
      const line = lineOfKey(defEntry)
      if (typeof defName === 'string' && line !== null) {
        map.set(`schema:${defName}`, line)
        const propsItem = findItem(defEntry.value, 'properties')
        if (propsItem?.value?.items) {
          for (const fieldEntry of propsItem.value.items) {
            const fieldName = fieldEntry?.key?.value
            const fieldLine = lineOfKey(fieldEntry)
            if (typeof fieldName === 'string' && fieldLine !== null) {
              map.set(`field:${defName}.${fieldName}`, fieldLine)
            }
          }
        }
      }
    }
  }

  // --- paths & methods ------------------------------------------------------
  const pathsItem = findItem(root, 'paths')
  if (pathsItem?.value?.items) {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete']
    for (const pathEntry of pathsItem.value.items) {
      const pathName = pathEntry?.key?.value
      const pathLine = lineOfKey(pathEntry)
      if (typeof pathName === 'string' && pathLine !== null) {
        map.set(`path:${pathName}`, pathLine)
        // Per-method lines — each HTTP verb under the path item.
        const pathValue = pathEntry.value
        if (pathValue?.items) {
          for (const methodEntry of pathValue.items) {
            const methodName = methodEntry?.key?.value
            if (
              typeof methodName === 'string' &&
              httpMethods.includes(methodName)
            ) {
              const methodLine = lineOfKey(methodEntry)
              if (methodLine !== null) {
                map.set(`method:${pathName}:${methodName}`, methodLine)
              }
            }
          }
        }
      }
    }
  }

  return map
}

// ---------------------------------------------------------------------------
// INTEGRATION NOTES — to be applied by parser.ts / index.ts merge agents:
//
// 1. Extend `ParsedSymbol.kind` union in parser.ts:
//       | 'openapi_endpoint' | 'openapi_schema' | 'openapi_field'
//
// 2. Extend `ParsedRelation.relation` union in parser.ts:
//       | 'expects_schema' | 'returns_schema'
//       | 'has_required_field' | 'has_optional_field'
//
// 3. In builder/index.ts, inside the `for (const file of files)` loop, add a
//    dispatch before calling `parseFile`:
//
//       import { isOpenApiFile, parseOpenApiFile } from './openApiParser.js'
//       ...
//       let result
//       if (isOpenApiFile(file.path)) {
//         result = await parseOpenApiFile(file.path, content ?? '')
//       } else {
//         result = await parseFile(file.path, content, ...)
//       }
//
// 4. `fileDiscovery.ts` already scans `.yaml` / `.yml` / `.json` — no change
//    needed there. If you want to restrict discovery to just OpenAPI files
//    (e.g. to avoid indexing package.json), gate on `isOpenApiFile` inside
//    the index.ts loop rather than filtering discovery.
// ---------------------------------------------------------------------------
