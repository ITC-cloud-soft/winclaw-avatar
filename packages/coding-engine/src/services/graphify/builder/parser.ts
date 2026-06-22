/**
 * Regex-based AST parser and symbol extractor for the pure TypeScript graph builder.
 *
 * Intentionally avoids the TypeScript compiler API to keep startup time and
 * dependency weight minimal. All patterns are line-oriented so they compose
 * predictably across large codebases.
 *
 * Produces {@link ParseResult} — a flat list of symbols and their relationships
 * that the graph assembler can fold into graph.json nodes/links.
 */

import path from 'node:path'
import { parseDocument as parseDocumentFile } from './documentParser.js'
import { convertDocumentToGraph } from './documentAdapter.js'
import { analyzeDocumentSemantics, convertSemanticToGraph } from './semanticAnalyzer.js'
import { validateBrackets, type BracketReport } from './bracketValidator.js'

// ---------------------------------------------------------------------------
// Bracket sanity check (best-effort warning, never throws)
// ---------------------------------------------------------------------------

/**
 * Optional sanity check: flag bracket-count imbalances so malformed files
 * (often caused by aggressive regex edits in agent sessions) surface early.
 *
 * The validator is character-level and does not honour string literals or
 * comments, so false positives from `{` / `}` inside strings are expected.
 * To suppress noise we only warn for obviously broken files:
 *
 *   - duplicate_closing  → `}}` on its own line, almost always a real bug.
 *   - unbalanced > 5     → off-by-many counts, well outside string-literal noise.
 *
 * Never throws — wrapped in try/catch so a validator bug cannot break parsing.
 */
function runBracketSanityCheck(normPath: string, content: string): void {
  try {
    const report: BracketReport = validateBrackets(content || '')
    if (!report.balanced && report.issues.length > 0) {
      const criticalIssues = report.issues.filter(
        i =>
          i.type === 'duplicate_closing' ||
          (i.type === 'unbalanced' && Math.abs(i.finalDepth ?? 0) > 5)
      )
      if (criticalIssues.length > 0) {
        console.warn(
          `[graphify:parser] Bracket imbalance in ${normPath}: ` +
            criticalIssues.map(i => i.message).join('; ') +
            ` (char-level check — may be false positive from string literals)`
        )
      }
    }
  } catch {
    /* best-effort — never fail parse due to validator issues */
  }
}
// Public types
// ---------------------------------------------------------------------------

/** A single named entity extracted from a source file. */
export interface ParsedSymbol {
  /** Stable lowercase identifier, e.g. "commands_getskills". */
  id: string
  /** Human-readable display label, e.g. "getSkills()". */
  label: string
  /** Project-relative path, e.g. "src/commands.ts". */
  sourceFile: string
  /** 1-based line reference, e.g. "L353". */
  sourceLocation: string
  /** Structural kind of this symbol. */
  kind: 'file' | 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'route' | 'field' | 'schema' | 'column' | 'document' | 'section' | 'api_spec' | 'entity_spec' | 'ui_spec' | 'requirement' | 'react_route' | 'navigate_call' | 'form_input' | 'css_variable' | 'hardcoded_color' | 'fastapi_route' | 'pydantic_field' | 'openapi_endpoint' | 'openapi_schema' | 'openapi_field' | 'designed_route'
  /** Function/method parameter list and return type (Level 2). */
  signature?: string
  /** Field or column type (Level 2). */
  fieldType?: string
  /** HTTP method for route nodes (Level 2). */
  httpMethod?: string
  /** URL path for route nodes (Level 2). */
  urlPath?: string
  /** Whether the field is optional (Level 2). */
  optional?: boolean
  /** Column constraints, e.g. "notNull, length:50" (Level 2). */
  constraints?: string
  /** ORM/framework type for schema nodes, e.g. "drizzle", "prisma" (Level 2). */
  schemaType?: string
  /** Database table name for schema nodes (Level 2). */
  tableName?: string

  // GATE-consumable fields (B-2 fix) — form_input, pydantic_field, openapi_field
  // -------------------------------------------------------------------------
  /** Field name extracted from JSX `<input name="X">` (form_input). */
  inputName?: string
  /** Required flag. Opposite of `optional`. Set explicitly so GATE prompts
   *  can match `required: true` directly without inverting `optional`. */
  required?: boolean
  /** Parent class / schema name for pydantic_field / openapi_field
   *  (e.g. "PassengerCreate"). */
  schemaClass?: string
  /** Page / component file path for form_input — used by GATE G' to tie
   *  an <input> back to the JSX file that renders it. */
  pageFile?: string
}

/** A directed relationship between two symbols. */
export interface ParsedRelation {
  sourceId: string
  targetId: string
  relation: 'contains' | 'imports_from' | 'calls' | 'method' | 'has_field' | 'handles_route' | 'validates_with' | 'specifies' | 'describes' | 'IMPLEMENTS' | 'SATISFIES' | 'DEPENDS_ON' | 'EXTENDS' | 'CONFLICTS_WITH' | 'VALIDATES' | 'CREATES' | 'UPDATES' | 'DELETES' | 'READS' | 'renders' | 'calls_navigate' | 'contains_input' | 'uses_variable' | 'uses_hardcoded_color' | 'has_required_field' | 'has_optional_field' | 'expects_schema' | 'returns_schema'
  /** Confidence level: EXTRACTED (static), INFERRED (AI), or HIGH/MEDIUM/LOW (semantic) */
  confidence: 'EXTRACTED' | 'INFERRED' | 'HIGH' | 'MEDIUM' | 'LOW'
  sourceFile: string
  sourceLocation: string
}

/** A single import statement, kept raw so the builder can resolve module paths. */
export interface ParsedImport {
  /** Module specifier exactly as written, e.g. "'./auth.js'" or "'node:path'". */
  from: string
  /** Named bindings, including default import if present. */
  names: string[]
  sourceLocation: string
}

/** Full output of parsing one source file. */
export interface ParseResult {
  symbols: ParsedSymbol[]
  relations: ParsedRelation[]
  imports: ParsedImport[]
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Derives a stable node ID from a file path and an optional symbol name.
 *
 * @example
 * generateId('src/utils/auth.ts')           // → 'auth'
 * generateId('src/utils/auth.ts', 'getApiKey') // → 'auth_getapikey'
 */
export function generateId(filePath: string, symbolName?: string): string {
  const stem = path.basename(filePath, path.extname(filePath)).toLowerCase()
  if (!symbolName) return stem
  return `${stem}_${symbolName.toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

// ---------------------------------------------------------------------------
// Regex patterns — Level 1 (topology)
// ---------------------------------------------------------------------------

/** Matches: export function name(, function name(, async function name( */
const RX_FUNCTION = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/

/** Matches: export class Name, class Name */
const RX_CLASS = /^[ \t]*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)[\s{<(]/

/**
 * Matches method declarations inside a class body.
 * Accepts optional access modifiers, optional static/async/override/abstract.
 * Does NOT match constructor (handled separately if needed).
 * Leading whitespace of at least 2 spaces/1 tab is required to distinguish
 * top-level functions from methods.
 */
const RX_METHOD =
  /^(?:[ \t]{2,}|\t)(?:(?:public|private|protected|static|async|override|abstract|readonly)\s+)*(\w+)\s*[<(]/

/** Matches: export interface Name */
const RX_INTERFACE = /^[ \t]*(?:export\s+)?interface\s+(\w+)[\s{<]/

/** Matches: export type Name */
const RX_TYPE = /^[ \t]*(?:export\s+)?type\s+(\w+)\s*[=<{]/

/** Matches: export const Name, export let Name, export var Name */
const RX_VARIABLE = /^[ \t]*export\s+(?:const|let|var)\s+(\w+)\b/

// ---------------------------------------------------------------------------
// Regex patterns — Level 2 (structural semantics)
// ---------------------------------------------------------------------------

/** Interface/type field:   name: string;   age?: number; */
const RX_FIELD = /^(?:[ \t]{2,}|\t)(?:readonly\s+)?(\w+)(\??):\s*([^;=]+)/

/** Class property: public name: string = ''; private _cache?: Map<string, any>; */
const RX_CLASS_FIELD =
  /^(?:[ \t]{2,}|\t)(?:(?:public|private|protected|readonly|static|declare)\s+)+(\w+)(\??):\s*([^;=]+)/

/** Hono/Express chained route: app.get('/users', ...)  router.post('/api/items', ...) */
const RX_ROUTE_CHAIN = /\.(?:get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi

/** NestJS route decorator: @Get('/users')  @Post() */
const RX_ROUTE_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete|All)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/

/** Hono OpenAPI: createRoute({ method: 'post', path: '/api/users', ... }) */
const RX_HONO_ROUTE = /method:\s*['"`](get|post|put|patch|delete)['"`]\s*,\s*path:\s*['"`]([^'"`]+)['"`]/

/** Function signature with params and return type:
 *   function createUser(name: string, age: number): Promise<User> */
const RX_FUNCTION_SIG =
  /^[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\(([^)]*)\)(?:\s*:\s*(.+?))?(?:\s*\{)?$/

/** Arrow function signature:
 *   export const handler = async (req: Request): Promise<Response> => { */
const RX_ARROW_SIG =
  /^[ \t]*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*(.+?))?\s*=>/

/** Drizzle table: export const users = mysqlTable('users', { ... }) */
const RX_DRIZZLE_TABLE =
  /(?:export\s+)?const\s+(\w+)\s*=\s*(?:mysqlTable|pgTable|sqliteTable)\s*\(\s*['"`](\w+)['"`]/

/** Drizzle column: name: varchar('name', { length: 50 }).notNull() */
const RX_DRIZZLE_COL =
  /(\w+):\s*(varchar|int|bigint|boolean|text|timestamp|json|decimal|serial|uuid|integer|char|date|real|float|double|numeric|blob|clob)\s*\(/

/** Zod schema: export const userSchema = z.object({ ... }) */
const RX_ZOD_SCHEMA = /(?:export\s+)?const\s+(\w+)\s*=\s*z\s*\.\s*(object|string|number|array|enum)/

/** Prisma model: model User { ... } */
const RX_PRISMA_MODEL = /^model\s+(\w+)\s*\{/

/** TypeORM entity: @Entity('users') */
const RX_TYPEORM_ENTITY = /^[ \t]*@Entity\s*\(\s*['"`]?(\w+)['"`]?\s*\)/

// ---------------------------------------------------------------------------
// Regex patterns — Level 3 (frontend / React / CSS semantics)
// ---------------------------------------------------------------------------

/**
 * React Router Route element:
 *   <Route path="/passengers" element={<PassengerListPage/>} />
 *   <Route path='/x/:id' element={<EditPage />}>
 */
const RX_REACT_ROUTE =
  /<Route\s+path=["'`]([^"'`]+)["'`](?:\s+[^>]*?element=\{<(\w+)\s*\/?>?\})?[^>]*\/?>/g

/**
 * navigate('/foo'), navigate("/bar"), navigate(`/x/${id}/edit`).
 * Captures the raw path text inside the string literal / template.
 */
const RX_NAVIGATE_CALL = /\bnavigate\s*\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g

/**
 * JSX form inputs — multi-line aware (replaces the old single-line
 * RX_JSX_INPUT). That pattern required the whole opening tag on one
 * line, missing the extremely common React style where attributes wrap
 * onto subsequent lines:
 *
 *   <input
 *     name="email"
 *     type="email"
 *     required
 *   />
 *
 * The `s` (dotall) flag lets `[^>]` cross newlines, so we accumulate
 * the full attribute fragment regardless of formatting.
 */
const RX_JSX_INPUT_TAG = /<(input|select|textarea)\b([^>]*?)\/?>/gis

/**
 * Multi-line JSX tag matcher for custom React form components. We only
 * treat these as form_input when they (a) match a known form-related
 * component name and (b) carry a `name=` attribute.
 */
const RX_JSX_FORM_COMPONENT_TAG = /<([A-Z]\w*)\b([^>]*?)\/?>/gis

/**
 * Whitelist of custom React components treated as form inputs.
 *
 * NOTE (M-3): `Radio`, `Switch`, and `Slider` were previously included but
 * collide too often with non-form UI primitives — React Router v5 `<Switch>`,
 * MUI `<Slider>`, Chakra UI `<Radio>` — producing large numbers of false
 * positives. Form-valued usages of those components usually carry an explicit
 * `name=` attribute; we'll re-admit them behind a stricter heuristic (e.g.
 * ancestor `<form>` scope) in a follow-up change.
 */
const FORM_COMPONENT_ALLOWLIST = new Set<string>([
  'Input',
  'Select',
  'Textarea',
  'TextField',
  'Field',
  'FormControl',
  'Checkbox',
])

/** Tailwind arbitrary hex color: bg-[#ff0000], text-[#abc], ring-[#112233ff] */
const RX_TAILWIND_HARDCODED =
  /(?:bg|text|border|ring|outline|fill|stroke|from|to|via)-\[#([0-9A-Fa-f]{3,8})\]/g

/**
 * Tailwind **named** color class with shade, e.g. `bg-red-600`, `hover:text-gray-900`,
 * `dark:border-slate-800`, `focus:ring-indigo-500`, `placeholder-neutral-400`.
 *
 * These are semantically hardcoded: they bypass design-token CSS variables just like
 * `bg-[#XXX]` arbitrary hex values do. Parser extension 8 reports them so GATE I'
 * (Design Token Usage) sees the full picture.
 *
 * The optional variant prefix `(?:[a-z0-9_-]+:)*` handles chained state/breakpoint
 * modifiers (hover:, focus:, dark:, lg:, group-hover:, data-[state=open]: etc.).
 * The negative lookbehind/lookahead ensure we match whole class tokens only, never
 * fragments of longer identifiers.
 */
const RX_TAILWIND_NAMED_COLOR = new RegExp(
  '(?<![\\w-])' +
    '(?:[a-z0-9_-]+:)*' +
    '(?:bg|text|border|ring|outline|divide|placeholder|from|via|to|fill|stroke|caret|accent|ring-offset|decoration|shadow)' +
    '-' +
    '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)' +
    '-' +
    '(?:50|100|200|300|400|500|600|700|800|900|950)' +
    '(?![\\w-])',
  'g'
)

/**
 * Tailwind named black/white (no shade): `bg-black`, `text-white`, `hover:border-black`.
 * Explicitly excludes semantic utilities like `bg-transparent`, `text-current`,
 * `bg-inherit` by only matching `black` and `white` after the prefix.
 */
const RX_TAILWIND_BW_COLOR = new RegExp(
  '(?<![\\w-])' +
    '(?:[a-z0-9_-]+:)*' +
    '(?:bg|text|border|ring|outline|divide|placeholder|from|via|to|fill|stroke|caret|accent|ring-offset|decoration|shadow)' +
    '-' +
    '(?:black|white)' +
    '(?![\\w-])',
  'g'
)

/** CSS variable definitions: --primary-color: #ff0000; (inside :root or any block) */
const RX_CSS_VAR_DEF = /^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/gim

/** CSS var() usage: var(--primary-color) or var(--spacing-2, 0.5rem) */
const RX_CSS_VAR_USE = /var\(\s*--([a-z0-9-]+)/g

// ---------------------------------------------------------------------------
// Regex patterns — Level 4 (Python / FastAPI / Pydantic)
// ---------------------------------------------------------------------------

/**
 * FastAPI route decorator:
 *   @router.post("/api/passengers")
 *   @app.get('/users/{id}')
 *   @router.delete("/items/{id}", response_model=Item)
 *   @users_router.post("/login")     ← custom router name
 *   @admin_router.get("/stats")      ← any name containing "router"
 *
 * The first capture accepts "app" OR any identifier containing "router"
 * (e.g. "router", "users_router", "admin_router"). We keep "app" as a
 * special case because FastAPI's main instance is conventionally `app`.
 */
const RX_FASTAPI_ROUTE =
  /^[ \t]*@(\w*router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/

/**
 * Python function definition:
 *   def get_passengers():
 *   async def create_passenger(data: PassengerCreate):
 * Used to associate FastAPI route decorators with their handler.
 */
const RX_PYTHON_DEF = /^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/

/**
 * Pydantic model class:
 *   class PassengerCreate(BaseModel):
 *   class UserUpdate(CustomBase, BaseModel):
 */
const RX_PYDANTIC_CLASS =
  /^[ \t]*class\s+(\w+)\s*\(\s*(?:BaseModel|[^)]*BaseModel[^)]*)\s*\)\s*:/

/** Generic Python class (any class declaration). */
const RX_PYTHON_CLASS = /^[ \t]*class\s+(\w+)\s*(?:\([^)]*\))?\s*:/

/**
 * Pydantic field line:
 *   firstname: str
 *   phone: Optional[str] = None
 *   age: int = 0
 *   role: str = Field("user", max_length=20)
 *
 * Captures: 1=name, 2=annotation (greedy up to " = " or end), 3=everything
 * after " = " (default), may be empty.
 */
const RX_PYDANTIC_FIELD =
  /^[ \t]+(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?\s*$/

// ---------------------------------------------------------------------------
// Import patterns
// ---------------------------------------------------------------------------

/**
 * Matches: import { x, y as z } from 'mod'
 * Also: import Default, { x } from 'mod'
 */
const RX_IMPORT_NAMED =
  /^[ \t]*import\s+(?:(?:(\w+)\s*,\s*)?\{([^}]*)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/

/** Matches: import * as ns from 'mod' */
const RX_IMPORT_NAMESPACE = /^[ \t]*import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/

/** Matches: import 'mod' (side-effect only) */
const RX_IMPORT_SIDE_EFFECT = /^[ \t]*import\s+['"]([^'"]+)['"]/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strips inline comments and trailing whitespace to reduce false positives. */
function stripInlineComment(line: string): string {
  return line.replace(/\s*\/\/.*$/, '').trimEnd()
}

/**
 * Returns `true` when a line is entirely a block comment delimiter or
 * content — we skip these to avoid matching symbols inside JSDoc.
 */
function isInsideBlockComment(line: string): boolean {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/')
}

/** Parses the names out of a `{ x, y as z, ... }` import list. */
function parseNamedImports(braceContent: string): string[] {
  return braceContent
    .split(',')
    .map(s => {
      const alias = s.trim().split(/\s+as\s+/)
      return alias[0].trim()
    })
    .filter(Boolean)
}

/** Builds a signature string like "(a: string, b: number): Promise<void>" */
function buildSignature(params: string, returnType?: string): string {
  const p = params.trim()
  const r = returnType?.trim()
  return r ? `(${p}): ${r}` : `(${p})`
}

// ---------------------------------------------------------------------------
// Level 3 helpers — React / CSS / Tailwind extractions
// ---------------------------------------------------------------------------

/** Simple slug suitable for use inside node IDs. */
function slugifyPath(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'root'
}

/**
 * Normalizes a URL path captured from either a navigate() call OR a
 * <Route path="..."> declaration.
 *
 * Two canonicalizations are applied so that navigate and route paths that
 * refer to the same structural URL compare equal:
 *
 *   1. Template-literal interpolations (`${id}` in navigate() calls) →
 *      ":param"
 *   2. Concrete path parameter names (`:id`, `:userId`, `:slug` in Route
 *      declarations) → ":param"
 *
 * Example:
 *   navigate(`/users/${id}/edit`) → "/users/:param/edit"
 *   <Route path="/users/:id/edit"> → "/users/:param/edit"
 *
 * Both now produce identical urlPath values, which lets GATE H'
 * ("Broken Navigation") equality-match navigate targets against route
 * declarations without a special-case comparator.
 */
function normalizeRoutePath(raw: string): string {
  return raw
    .replace(/\$\{[^}]*\}/g, ':param') // template var: `${id}` → :param
    .replace(/:\w+/g, ':param')        // :id, :userId, :slug → :param
}

/**
 * @deprecated Use `normalizeRoutePath` instead. Kept as a thin alias for
 * backwards compatibility with any external caller that may have imported
 * the old symbol name.
 */
function normalizeNavigatePath(raw: string): string {
  return normalizeRoutePath(raw)
}

/**
 * Finds the end `>` of a JSX open tag starting at `startOffset`, tracking
 * JSX expression braces (`{...}`) and string literals so embedded `>`
 * characters inside attribute values don't terminate the tag prematurely.
 *
 * Example bug before this fix:
 *   `<Input value={a > b ? 1 : 2} name="x" />`
 * The lazy `[^>]*?` regex stopped at the first `>` inside `a > b`, losing
 * the `name="x"` attribute and missing the form input.
 *
 * Returns the byte offset of the closing `>` or -1 if no valid terminator
 * is found before end-of-content.
 */
function findJsxTagEnd(content: string, startOffset: number): number {
  let depth = 0
  let inString: string | null = null
  for (let i = startOffset; i < content.length; i++) {
    const c = content[i]
    if (inString) {
      if (c === inString && content[i - 1] !== '\\') inString = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      if (depth > 0) depth--
    } else if (c === '>' && depth === 0) {
      return i
    }
  }
  return -1
}

/**
 * Attempts to parse an attribute value from a JSX open-tag fragment.
 * Returns undefined when the attribute is absent. Supports string literal
 * ("text") and single-quote ('text') forms.
 */
function extractJsxAttribute(fragment: string, attr: string): string | undefined {
  // Match attr="value", attr='value', or attr=`value` anywhere in the fragment.
  // We avoid using \\b / \\s in a RegExp constructor string because JS string
  // escaping requires 4 backslashes (\\\\) to produce a literal \b/\s in the
  // pattern — instead we use a simpler boundary: the attribute must be preceded
  // by a space or the start of the string.
  const re = new RegExp('(?:^|[ \\t])' + attr + '[ \\t]*=[ \\t]*(?:"([^"]*)"' + "|'([^']*)'|`([^`]*)`)", 'i')
  const m = re.exec(fragment)
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined
}

/**
 * Light-weight scan of function declarations within a file. Returns a sorted
 * list of { name, line } entries. Used to attribute line-level events
 * (navigate, form input, hardcoded color) to their enclosing function.
 *
 * This is intentionally coarser than the main parser — we don't track
 * function end lines; we just pick "most recent function declared above".
 */
interface FunctionContext {
  name: string
  id: string
  line: number
}

function buildFunctionContextIndex(lines: string[], normPath: string): FunctionContext[] {
  const out: FunctionContext[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m1 = RX_FUNCTION.exec(line)
    if (m1) {
      out.push({ name: m1[1], id: generateId(normPath, m1[1]), line: i + 1 })
      continue
    }
    const m2 = RX_ARROW_SIG.exec(line)
    if (m2) {
      out.push({ name: m2[1], id: generateId(normPath, m2[1]), line: i + 1 })
      continue
    }
  }
  return out
}

/** Returns the id of the nearest function declared at or before `lineNo`. */
function nearestFunctionId(
  index: FunctionContext[],
  lineNo: number,
  fallbackId: string
): string {
  let best: FunctionContext | null = null
  for (const ctx of index) {
    if (ctx.line <= lineNo) {
      if (!best || ctx.line > best.line) best = ctx
    }
  }
  return best ? best.id : fallbackId
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

/**
 * Parses a single TypeScript/JavaScript file and extracts all symbols and
 * relationships using line-by-line regex matching.
 *
 * @param filePath - Project-relative path (used for ID and label generation).
 * @param content  - Raw file text.
 * @returns Flat collections of symbols, relations, and raw import records.
 */

// Helper functions for file type detection
export function isCodeFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte']
  return codeExtensions.includes(ext)
}

export function isDocumentFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const docExtensions = ['md', 'txt', 'rst', 'adoc', 'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']
  return docExtensions.includes(ext)
}

export async function parseFile(filePath: string, content?: string, absolutePath?: string, detectedExtension?: string): Promise<ParseResult> {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  const normPath = filePath.replace(/\\/g, '/')
  const normLower = normPath.toLowerCase()
  // For extensionless mainframe files, use the detected extension from fileDiscovery
  const ext = detectedExtension?.toLowerCase() || ''

  // Handle COBOL, BMS, and AS/400 DDS files
  const cobolExts = ['.cob', '.cbl', '.cobol', '.cpy', '.copy']
  const bmsExts = ['.bms']
  const as400Exts = ['.dds', '.dspf']

  if (cobolExts.some(e => normLower.endsWith(e) || ext === e)) {
    const { parseCobolFile } = await import('./cobolParser.js')
    return parseCobolFile(content || '', filePath)
  }
  if (bmsExts.some(e => normLower.endsWith(e) || ext === e)) {
    const { parseBmsFile } = await import('./cobolParser.js')
    return parseBmsFile(content || '', filePath)
  }
  if (as400Exts.some(e => normLower.endsWith(e) || ext === e)) {
    const { parseAs400File } = await import('./cobolParser.js')
    return parseAs400File(content || '', filePath)
  }

  // --- CSS / SCSS — extract CSS variable definitions and usage only ---
  const cssExts = ['.css', '.scss', '.sass', '.less']
  if (cssExts.some(e => normLower.endsWith(e) || ext === e)) {
    return parseCssFile(normPath, content || '')
  }

  // --- Python — FastAPI routes + Pydantic fields ---
  const pyExts = ['.py']
  if (pyExts.some(e => normLower.endsWith(e) || ext === e)) {
    return parsePythonFile(normPath, content || '')
  }

  // --- Tailwind config — hardcoded theme colors as design tokens ---
  // Must come before document/code generic branches because tailwind.config.{js,ts}
  // is JS/TS by extension but needs specialised semantic extraction.
  const tailwindCfgRe = /(?:^|\/)tailwind\.config\.(?:js|ts|cjs|mjs)$/
  if (tailwindCfgRe.test(normLower)) {
    return parseTailwindConfigFile(normPath, content || '')
  }

  // Handle document files with semantic analysis (PDF, Word, Excel, Markdown, etc.)
  if (isDocumentFile(normPath)) {
    // Use absolutePath for binary document files (PDF, docx, etc.) so parsers can find them
    const doc = await parseDocumentFile(absolutePath || filePath, content)
    const basicResult = convertDocumentToGraph(doc, normPath)

    // Merged accumulators start from the basic result; we later fold semantic
    // output and PRP "Frontend Routes" table extractions on top.
    let merged: ParseResult = basicResult

    // Perform semantic analysis if content is available
    if (content) {
      try {
        const semanticAnalysis = analyzeDocumentSemantics(content, normPath)
        const fileId = basicResult.symbols[0]?.id || 'document'
        const semanticResult = convertSemanticToGraph(semanticAnalysis, normPath, fileId)

        merged = {
          symbols: [...basicResult.symbols, ...semanticResult.symbols],
          relations: [...basicResult.relations, ...semanticResult.relations],
          imports: basicResult.imports,
        }
      } catch (error) {
        // If semantic analysis fails, fall back to basic result
        console.warn(`[Semantic Analysis] Failed for ${normPath}:`, error)
      }
    }

    // PRP "Frontend Routes" table extraction (Markdown only). G-1 fix.
    if (content && /\.md$/i.test(normLower)) {
      try {
        const fileId = merged.symbols[0]?.id || generateId(normPath)
        const routes = extractDesignedFrontendRoutes(content, normPath, fileId)
        merged = {
          symbols: [...merged.symbols, ...routes.symbols],
          relations: [...merged.relations, ...routes.relations],
          imports: merged.imports,
        }
      } catch (err) {
        console.warn(`[parser PRP routes] extraction failed for ${normPath}:`, err)
      }
    }

    return merged
  }

  // --- File-level node (always present) ---
  const fileId = generateId(normPath)
  const fileLabel = path.basename(normPath)
  symbols.push({
    id: fileId,
    label: fileLabel,
    sourceFile: normPath,
    sourceLocation: 'L1',
    kind: 'file',
  })

  const lines = content ? content.split('\n') : []

  /** Tracks the current class context for method attribution. */
  let currentClassId: string | null = null
  let currentClassIndent = 0

  /** Tracks the current interface/type context for field attribution. */
  let currentInterfaceId: string | null = null
  let currentInterfaceIndent = 0

  /** Tracks whether we are inside a block comment. */
  let inBlockComment = false

  /** Tracks the last schema (drizzle table / prisma model) for column attribution. */
  let currentSchemaId: string | null = null
  let currentSchemaIndent = 0

  /** Tracks Hono OpenAPI createRoute context for multi-line route extraction. */
  let honoRouteMethod: string | null = null
  let honoRoutePath: string | null = null
  let honoRouteBraceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const loc = `L${lineNo}`
    const raw = lines[i]

    // --- Block comment tracking ---
    if (raw.includes('/*')) inBlockComment = true
    if (raw.includes('*/')) {
      inBlockComment = false
      continue
    }
    if (inBlockComment || isInsideBlockComment(raw)) continue

    const line = stripInlineComment(raw)

    const indent = line.length - line.trimStart().length

    // Scope exit detection — clear contexts when indentation drops.
    if (line.trim() !== '') {
      if (currentClassId !== null && indent <= currentClassIndent) {
        currentClassId = null
      }
      if (currentInterfaceId !== null && indent <= currentInterfaceIndent) {
        currentInterfaceId = null
      }
      if (currentSchemaId !== null && indent <= currentSchemaIndent) {
        currentSchemaId = null
      }
    }

    // -----------------------------------------------------------------------
    // Import statements
    // -----------------------------------------------------------------------

    let importMatch = RX_IMPORT_NAMED.exec(line)
    if (importMatch) {
      const defaultName = importMatch[1] ?? importMatch[3]
      const braceContent = importMatch[2] ?? ''
      const moduleSpecifier = importMatch[4]

      const names: string[] = []
      if (defaultName) names.push(defaultName)
      names.push(...parseNamedImports(braceContent))

      imports.push({ from: moduleSpecifier, names, sourceLocation: loc })
      continue
    }

    const nsMatch = RX_IMPORT_NAMESPACE.exec(line)
    if (nsMatch) {
      imports.push({ from: nsMatch[2], names: [nsMatch[1]], sourceLocation: loc })
      continue
    }

    const seMatch = RX_IMPORT_SIDE_EFFECT.exec(line)
    if (seMatch) {
      imports.push({ from: seMatch[1], names: [], sourceLocation: loc })
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: ORM / Schema extraction (Drizzle)
    // -----------------------------------------------------------------------

    const drizzleMatch = RX_DRIZZLE_TABLE.exec(line)
    if (drizzleMatch) {
      const varName = drizzleMatch[1]
      const tblName = drizzleMatch[2]
      const id = generateId(normPath, `${varName}_${tblName}`)
      symbols.push({
        id,
        label: `${varName} → ${tblName}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'schema',
        schemaType: 'drizzle',
        tableName: tblName,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      currentSchemaId = id
      currentSchemaIndent = indent
      continue
    }

    // Drizzle column — only inside a schema context
    if (currentSchemaId !== null && indent > currentSchemaIndent) {
      const colMatch = RX_DRIZZLE_COL.exec(line)
      if (colMatch) {
        const colName = colMatch[1]
        const colType = colMatch[2]
        const colId = generateId(normPath, `${colName}_${colType}`)
        // Derive constraints from remainder of the line
        const afterType = line.slice(line.indexOf(colType) + colType.length)
        const constraints: string[] = []
        if (afterType.includes('.notNull()')) constraints.push('notNull')
        if (afterType.includes('.primaryKey()')) constraints.push('primaryKey')
        if (afterType.includes('.unique()')) constraints.push('unique')
        const lenMatch = afterType.match(/length:\s*(\d+)/)
        if (lenMatch) constraints.push(`length:${lenMatch[1]}`)

        symbols.push({
          id: colId,
          label: colName,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'column',
          fieldType: colType,
          constraints: constraints.length > 0 ? constraints.join(', ') : undefined,
        })
        relations.push({
          sourceId: currentSchemaId,
          targetId: colId,
          relation: 'has_field',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
        continue
      }
    }

    // -----------------------------------------------------------------------
    // Level 2: Zod schema
    // -----------------------------------------------------------------------

    const zodMatch = RX_ZOD_SCHEMA.exec(line)
    if (zodMatch) {
      const name = zodMatch[1]
      const id = generateId(normPath, name)
      symbols.push({
        id,
        label: name,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'schema',
        schemaType: 'zod',
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'validates_with',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: TypeORM entity decorator
    // -----------------------------------------------------------------------

    const typeormMatch = RX_TYPEORM_ENTITY.exec(line)
    if (typeormMatch) {
      const tblName = typeormMatch[1]
      const id = generateId(normPath, `entity_${tblName}`)
      symbols.push({
        id,
        label: `@Entity(${tblName})`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'schema',
        schemaType: 'typeorm',
        tableName: tblName,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: NestJS route decorator
    // -----------------------------------------------------------------------

    const routeDecMatch = RX_ROUTE_DECORATOR.exec(line)
    if (routeDecMatch) {
      const method = routeDecMatch[1].toLowerCase()
      const urlPath = routeDecMatch[2] || '/'
      const id = generateId(normPath, `${method}_${urlPath.replace(/[^a-z0-9]/gi, '')}`)
      symbols.push({
        id,
        label: `${method.toUpperCase()} ${urlPath}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'route',
        httpMethod: method,
        urlPath,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'handles_route',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: Hono OpenAPI route (multi-line aware)
    // -----------------------------------------------------------------------
    if (honoRouteBraceDepth > 0) {
      // Inside a createRoute({ ... }) block — look for method and path
      const methodLine = /^[ \t]*method:\s*['"`](get|post|put|patch|delete)['"`]/.exec(line)
      if (methodLine) honoRouteMethod = methodLine[1].toLowerCase()
      const pathLine = /^[ \t]*path:\s*['"`]([^'"`]+)['"`]/.exec(line)
      if (pathLine) honoRoutePath = pathLine[1]
      // Track braces
      for (const ch of line) {
        if (ch === '{') honoRouteBraceDepth++
        if (ch === '}') honoRouteBraceDepth--
      }
      if (honoRouteBraceDepth <= 0 && honoRouteMethod && honoRoutePath) {
        const id = generateId(normPath, `${honoRouteMethod}_${honoRoutePath.replace(/[^a-z0-9]/gi, '')}`)
        symbols.push({
          id,
          label: `${honoRouteMethod.toUpperCase()} ${honoRoutePath}`,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'route',
          httpMethod: honoRouteMethod,
          urlPath: honoRoutePath,
        })
        relations.push({
          sourceId: fileId,
          targetId: id,
          relation: 'handles_route',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
        honoRouteMethod = null
        honoRoutePath = null
        honoRouteBraceDepth = 0
      }
      if (honoRouteBraceDepth <= 0) {
        honoRouteMethod = null
        honoRoutePath = null
      }
      continue
    }

    // Detect createRoute({ opening
    if (/createRoute\s*\(\s*\{/.test(line)) {
      honoRouteBraceDepth = 1
      // Check if method/path are on the same line
      const methodLine = /method:\s*['"`](get|post|put|patch|delete)['"`]/.exec(line)
      if (methodLine) honoRouteMethod = methodLine[1].toLowerCase()
      const pathLine = /path:\s*['"`]([^'"`]+)['"`]/.exec(line)
      if (pathLine) honoRoutePath = pathLine[1]
      if (honoRouteBraceDepth === 1 && !line.includes('{')) honoRouteBraceDepth = 0
      continue
    }

    // -----------------------------------------------------------------------
    // Class declarations
    // -----------------------------------------------------------------------

    const classMatch = RX_CLASS.exec(line)
    if (classMatch) {
      const name = classMatch[1]
      const id = generateId(normPath, name)
      symbols.push({ id, label: name, sourceFile: normPath, sourceLocation: loc, kind: 'class' })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      currentClassId = id
      currentClassIndent = indent
      continue
    }

    // -----------------------------------------------------------------------
    // Interface declarations
    // -----------------------------------------------------------------------

    const ifaceMatch = RX_INTERFACE.exec(line)
    if (ifaceMatch) {
      const name = ifaceMatch[1]
      const id = generateId(normPath, name)
      symbols.push({
        id,
        label: name,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'interface',
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      currentInterfaceId = id
      currentInterfaceIndent = indent
      continue
    }

    // -----------------------------------------------------------------------
    // Type aliases
    // -----------------------------------------------------------------------

    const typeMatch = RX_TYPE.exec(line)
    if (typeMatch) {
      const name = typeMatch[1]
      const id = generateId(normPath, name)
      symbols.push({ id, label: name, sourceFile: normPath, sourceLocation: loc, kind: 'type' })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      // If it's a type alias for an object literal, enter interface-like context for fields
      if (line.includes('{')) {
        currentInterfaceId = id
        currentInterfaceIndent = indent
      }
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: Field extraction (inside interface / type / class body)
    // -----------------------------------------------------------------------

    if (indent > 0 && currentInterfaceId !== null) {
      const fieldMatch = RX_FIELD.exec(line)
      if (fieldMatch) {
        const fName = fieldMatch[1]
        const optional = fieldMatch[2] === '?'
        const fType = fieldMatch[3].trim()
        // Skip if the name looks like a method or keyword
        if (/^(if|for|while|switch|return|constructor|new|throw|try|catch|else)$/.test(fName)) {
          // Don't skip — fall through to function/method matching
        } else {
          const id = generateId(normPath, fName)
          symbols.push({
            id,
            label: fName,
            sourceFile: normPath,
            sourceLocation: loc,
            kind: 'field',
            fieldType: fType,
            optional,
          })
          relations.push({
            sourceId: currentInterfaceId,
            targetId: id,
            relation: 'has_field',
            confidence: 'EXTRACTED',
            sourceFile: normPath,
            sourceLocation: loc,
          })
          continue
        }
      }
    }

    // Class fields
    if (currentClassId !== null && indent > currentClassIndent) {
      const classFieldMatch = RX_CLASS_FIELD.exec(raw)
      if (classFieldMatch) {
        const fName = classFieldMatch[1]
        const optional = classFieldMatch[2] === '?'
        const fType = classFieldMatch[3].trim()
        const id = generateId(normPath, fName)
        symbols.push({
          id,
          label: fName,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'field',
          fieldType: fType,
          optional,
        })
        relations.push({
          sourceId: currentClassId,
          targetId: id,
          relation: 'has_field',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
        continue
      }
    }

    // -----------------------------------------------------------------------
    // Function declarations (Level 2: enhanced with signature)
    // -----------------------------------------------------------------------

    const fnSigMatch = RX_FUNCTION_SIG.exec(line)
    if (fnSigMatch) {
      const name = fnSigMatch[1]
      const params = fnSigMatch[2]
      const returnType = fnSigMatch[3]
      const id = generateId(normPath, name)
      const label = `${name}()`
      const sig = buildSignature(params, returnType)
      symbols.push({
        id,
        label,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'function',
        signature: sig,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // Fallback to basic function regex if signature regex didn't match
    const fnMatch = RX_FUNCTION.exec(line)
    if (fnMatch) {
      const name = fnMatch[1]
      const id = generateId(normPath, name)
      const label = `${name}()`
      symbols.push({
        id,
        label,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'function',
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Level 2: Arrow function signatures
    // -----------------------------------------------------------------------

    const arrowMatch = RX_ARROW_SIG.exec(line)
    if (arrowMatch) {
      const name = arrowMatch[1]
      const params = arrowMatch[2]
      const returnType = arrowMatch[3]
      const id = generateId(normPath, name)
      const sig = buildSignature(params, returnType)
      symbols.push({
        id,
        label: name,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'variable',
        signature: sig,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Exported variables / constants
    // -----------------------------------------------------------------------

    const varMatch = RX_VARIABLE.exec(line)
    if (varMatch) {
      const name = varMatch[1]
      const id = generateId(normPath, name)
      symbols.push({
        id,
        label: name,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'variable',
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      continue
    }

    // -----------------------------------------------------------------------
    // Method declarations (only when inside a class context)
    // -----------------------------------------------------------------------

    if (currentClassId !== null && indent > currentClassIndent) {
      const methodMatch = RX_METHOD.exec(raw)
      if (methodMatch) {
        const name = methodMatch[1]
        if (
          name === 'if' ||
          name === 'for' ||
          name === 'while' ||
          name === 'switch' ||
          name === 'return' ||
          name === 'constructor'
        ) {
          continue
        }

        const id = generateId(normPath, name)
        const label = `${name}()`
        symbols.push({
          id,
          label,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'method',
        })
        relations.push({
          sourceId: currentClassId,
          targetId: id,
          relation: 'method',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
        relations.push({
          sourceId: fileId,
          targetId: id,
          relation: 'contains',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
        continue
      }
    }

    // -----------------------------------------------------------------------
    // Level 2: Chained route extraction (Hono / Express)
    // Must be last — uses global regex on raw lines.
    // -----------------------------------------------------------------------

    if (RX_ROUTE_CHAIN.test(raw)) {
      RX_ROUTE_CHAIN.lastIndex = 0
      let routeMatch: RegExpExecArray | null
      while ((routeMatch = RX_ROUTE_CHAIN.exec(raw)) !== null) {
        const urlPath = routeMatch[1]
        // Derive HTTP method from the regex match text
        const methodMatch = raw.slice(routeMatch.index).match(/\b(get|post|put|patch|delete|all)\b/i)
        const method = methodMatch ? methodMatch[1].toLowerCase() : 'get'
        const id = generateId(normPath, `${method}_${urlPath.replace(/[^a-z0-9]/gi, '')}`)
        symbols.push({
          id,
          label: `${method.toUpperCase()} ${urlPath}`,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'route',
          httpMethod: method,
          urlPath,
        })
        relations.push({
          sourceId: fileId,
          targetId: id,
          relation: 'handles_route',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
      }
    }
  }

  // -----------------------------------------------------------------------
  // Level 3: React / JSX / Tailwind extractions (only for TSX / JSX files)
  // Runs as a second pass so existing topology (functions, classes, etc.)
  // is already captured before we attribute child nodes to enclosing funcs.
  // -----------------------------------------------------------------------
  const lowerExt = normLower.split('.').pop() || ''
  const isJsxFile = lowerExt === 'tsx' || lowerExt === 'jsx'
  const isJsOrTsFile = isJsxFile || lowerExt === 'ts' || lowerExt === 'js'

  if (isJsOrTsFile && lines.length > 0) {
    const fnIndex = buildFunctionContextIndex(lines, normPath)

    try {
      if (isJsxFile) {
        extractReactRoutes(lines, normPath, fileId, symbols, relations)
        extractJsxInputs(content || lines.join('\n'), normPath, fileId, fnIndex, symbols, relations)
        extractTailwindHardcoded(lines, normPath, fileId, fnIndex, symbols, relations)
      }
      // navigate() calls are valid in both .ts and .tsx (and even .js hooks)
      extractNavigateCalls(lines, normPath, fileId, fnIndex, symbols, relations)
      // CSS variable *usage* can appear in TSX inline styles / template strings
      extractCssVariableUsage(lines, normPath, fileId, symbols, relations)
    } catch (err) {
      console.warn(`[parser Level 3] Extraction failed for ${normPath}:`, err)
    }
  }

  // Bracket-imbalance sanity check (TS/JS/TSX/JSX only — see helper for rationale).
  if (isJsOrTsFile) {
    runBracketSanityCheck(normPath, content || lines.join('\n'))
  }

  return { symbols, relations, imports }
}

// ---------------------------------------------------------------------------
// Level 3 extractors
// ---------------------------------------------------------------------------

/** Extracts <Route path="..." element={<X/>}> declarations from TSX. */
function extractReactRoutes(
  lines: string[],
  normPath: string,
  fileId: string,
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes('<Route')) continue
    const loc = `L${i + 1}`
    RX_REACT_ROUTE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_REACT_ROUTE.exec(raw)) !== null) {
      // Normalize path parameters so that <Route path="/users/:id"> and
      // navigate(`/users/${id}`) both share the same canonical urlPath.
      // See normalizeRoutePath() for the rules.
      const urlPath = normalizeRoutePath(m[1])
      const element = m[2] // may be undefined if element prop is multi-line
      const slug = slugifyPath(urlPath)
      let id = `route_${slug}`
      // Avoid collision if the same path appears on multiple lines in the file.
      if (seen.has(id)) id = `route_${slug}_${i + 1}`
      seen.add(id)

      symbols.push({
        id,
        label: `Route ${urlPath}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'react_route',
        urlPath,
        signature: element,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
      if (element) {
        // The rendered component id is inferred from the component name;
        // the builder's symbol resolver is expected to reconcile this to the
        // actual node when multiple files declare the same component.
        const componentId = element.toLowerCase()
        relations.push({
          sourceId: id,
          targetId: componentId,
          relation: 'renders',
          confidence: 'INFERRED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
      }
    }
  }
}

/** Extracts navigate('/x/y') and navigate(`/x/${id}/edit`) calls. */
function extractNavigateCalls(
  lines: string[],
  normPath: string,
  fileId: string,
  fnIndex: FunctionContext[],
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes('navigate')) continue
    const lineNo = i + 1
    const loc = `L${lineNo}`
    RX_NAVIGATE_CALL.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_NAVIGATE_CALL.exec(raw)) !== null) {
      const rawPath = m[1]
      const urlPath = normalizeRoutePath(rawPath)
      const slug = slugifyPath(urlPath)
      const id = `nav_${slug}_${lineNo}`

      symbols.push({
        id,
        label: `navigate ${urlPath}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'navigate_call',
        urlPath,
      })
      const sourceId = nearestFunctionId(fnIndex, lineNo, fileId)
      relations.push({
        sourceId,
        targetId: id,
        relation: 'calls_navigate',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }
}

/**
 * Extracts JSX form controls, now multi-line aware. Handles:
 *
 *   - Intrinsic HTML form elements (<input> <select> <textarea>)
 *   - Custom React form components (<TextField> <Select> etc., per
 *     FORM_COMPONENT_ALLOWLIST) that carry a `name=` attribute.
 *
 * The old line-by-line regex missed any tag whose attributes wrapped
 * onto subsequent lines (very common in real React code), so GATE G'
 * coverage under-reported required fields. We now scan the file as a
 * single string with a dotall-flag regex, compute each match's line
 * number from its byte offset, and reuse the existing
 * extractJsxAttribute()/fnIndex helpers.
 *
 * Signature change: the first argument is the full file text instead of
 * a pre-split `lines` array. Call sites pass `content || lines.join('\\n')`.
 */
function extractJsxInputs(
  content: string,
  normPath: string,
  fileId: string,
  fnIndex: FunctionContext[],
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  const fileStem = path.basename(normPath, path.extname(normPath)).toLowerCase()
  const seen = new Set<string>()

  // Mn-1: pre-compute the byte offset of every line start so lineAt() becomes
  // a binary search (O(log N)) instead of a linear newline count (O(N)). For
  // large files with many matches this reduces total work from O(N × M) to
  // O(N + M log N).
  const lineOffsets: number[] = [0]
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lineOffsets.push(i + 1)
  }
  const lineAt = (offset: number): number => {
    let lo = 0
    let hi = lineOffsets.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (lineOffsets[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1 // 1-based
  }

  // "required" is considered true when the attribute appears without an
  // explicit falsy value: plain `required`, `required={true}`, `required="true"`.
  // False only when explicitly set to false/0.
  const isRequiredAttr = (attrs: string): boolean => {
    if (!/\brequired\b/i.test(attrs)) return false
    // Explicit negatives: required={false}, required="false", required={0}
    if (/\brequired\s*=\s*\{?\s*(?:false|0)\s*\}?/i.test(attrs)) return false
    if (/\brequired\s*=\s*["']\s*(?:false|0)\s*["']/i.test(attrs)) return false
    return true
  }

  const addInput = (
    tag: string,
    attrs: string,
    offset: number,
    isCustomComponent: boolean,
  ): void => {
    const name = extractJsxAttribute(attrs, 'name')
    if (!name) return

    const lineNo = lineAt(offset)
    const loc = `L${lineNo}`
    const lowerTag = tag.toLowerCase()
    const isRequired = isRequiredAttr(attrs)
    const inputType = isCustomComponent
      ? (extractJsxAttribute(attrs, 'type') || lowerTag)
      : (lowerTag === 'input'
          ? (extractJsxAttribute(attrs, 'type') || 'text')
          : lowerTag)

    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    let id = `input_${fileStem}_${nameSlug}`
    if (seen.has(id)) id = `${id}_${lineNo}`
    seen.add(id)

    symbols.push({
      id,
      label: `${tag}[name=${name}]`,
      sourceFile: normPath,
      sourceLocation: loc,
      kind: 'form_input',
      fieldType: inputType,
      optional: !isRequired,
      required: isRequired,
      inputName: name,
      pageFile: normPath,
    })
    const sourceId = nearestFunctionId(fnIndex, lineNo, fileId)
    relations.push({
      sourceId,
      targetId: id,
      relation: 'contains_input',
      confidence: 'EXTRACTED',
      sourceFile: normPath,
      sourceLocation: loc,
    })
  }

  // M-2: brace-aware tag scanner. We only use the regex to locate the
  // tag *opener* (`<input `, `<Component `), then hand off to
  // findJsxTagEnd() which tracks `{…}` expression depth and string
  // literals. This prevents early termination on `>` characters inside
  // attribute values (e.g. `value={a > b ? 1 : 2}`).

  // Intrinsic elements: <input> / <select> / <textarea>, multi-line OK.
  const RX_INTRINSIC_OPEN = /<(input|select|textarea)\b/gi
  RX_INTRINSIC_OPEN.lastIndex = 0
  let mi: RegExpExecArray | null
  while ((mi = RX_INTRINSIC_OPEN.exec(content)) !== null) {
    const tag = mi[1]
    const tagStart = mi.index
    // attribute scanning starts right after `<tag` (skip the tag name itself)
    const attrsStart = tagStart + 1 + tag.length
    const tagEnd = findJsxTagEnd(content, attrsStart)
    if (tagEnd < 0) continue
    // Strip a trailing `/` from self-closing tags; we only need attribute text.
    let attrs = content.slice(attrsStart, tagEnd)
    if (attrs.endsWith('/')) attrs = attrs.slice(0, -1)
    addInput(tag, attrs, tagStart, false)
    // Advance exec cursor past this tag to avoid rediscovering a nested match.
    RX_INTRINSIC_OPEN.lastIndex = tagEnd + 1
  }

  // Custom components (capitalised tag): only those on the allowlist AND
  // carrying a name= attribute count as form inputs.
  const RX_CUSTOM_OPEN = /<([A-Z]\w*)\b/g
  RX_CUSTOM_OPEN.lastIndex = 0
  let mc: RegExpExecArray | null
  while ((mc = RX_CUSTOM_OPEN.exec(content)) !== null) {
    const compName = mc[1]
    if (!FORM_COMPONENT_ALLOWLIST.has(compName)) continue
    const tagStart = mc.index
    const attrsStart = tagStart + 1 + compName.length
    const tagEnd = findJsxTagEnd(content, attrsStart)
    if (tagEnd < 0) continue
    let attrs = content.slice(attrsStart, tagEnd)
    if (attrs.endsWith('/')) attrs = attrs.slice(0, -1)
    addInput(compName, attrs, tagStart, true)
    RX_CUSTOM_OPEN.lastIndex = tagEnd + 1
  }
}

/**
 * Extracts Tailwind hardcoded color anti-patterns:
 *   • Arbitrary hex values: `bg-[#ff0000]`, `text-[#abc]`, `ring-[#112233ff]`
 *   • Named color + shade: `bg-red-600`, `hover:text-gray-900`, `focus:ring-indigo-500`
 *   • Named black/white: `bg-black`, `text-white`, `hover:border-black`
 *
 * All three produce `kind: 'hardcoded_color'` nodes so GATE I' (Design Token Usage)
 * sees one unified hardcoded-color population. The subtype lives in `constraints`:
 *   • `'arbitrary'` — `bg-[#XXX]`
 *   • `'named'`    — `bg-red-600`
 *   • `'bw'`       — `bg-black` / `bg-white`
 *
 * Semantic utilities like `bg-transparent`, `text-current`, `bg-inherit`,
 * `border-none` are NOT matched — they do not bypass the design-token system.
 */
function extractTailwindHardcoded(
  lines: string[],
  normPath: string,
  fileId: string,
  fnIndex: FunctionContext[],
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  const fileStem = path.basename(normPath, path.extname(normPath)).toLowerCase()
  // Dedupe identical (id) occurrences within the same file (defensive — offsets
  // in line+index should already make them unique, but paranoid is cheap here).
  const seen = new Set<string>()
  const pushHardcoded = (
    id: string,
    label: string,
    loc: string,
    lineNo: number,
    attr: string,
    subtype: 'arbitrary' | 'named' | 'bw'
  ): void => {
    if (seen.has(id)) return
    seen.add(id)
    symbols.push({
      id,
      label,
      sourceFile: normPath,
      sourceLocation: loc,
      kind: 'hardcoded_color',
      fieldType: attr,
      constraints: subtype,
    })
    const sourceId = nearestFunctionId(fnIndex, lineNo, fileId)
    relations.push({
      sourceId,
      targetId: id,
      relation: 'uses_hardcoded_color',
      confidence: 'EXTRACTED',
      sourceFile: normPath,
      sourceLocation: loc,
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    const loc = `L${lineNo}`

    // --- 1. Arbitrary hex: bg-[#xxxxxx] ---------------------------------
    if (raw.includes('-[#')) {
      RX_TAILWIND_HARDCODED.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = RX_TAILWIND_HARDCODED.exec(raw)) !== null) {
        const hex = m[1].toLowerCase()
        const full = m[0]
        const attrMatch = /^([a-z]+)-\[/.exec(full)
        const attr = attrMatch ? attrMatch[1] : 'unknown'
        const id = `hex_${hex}_${fileStem}_${lineNo}_${m.index}`
        pushHardcoded(id, `#${hex}`, loc, lineNo, attr, 'arbitrary')
      }
    }

    // --- 2. Named color + shade: bg-red-600, hover:text-gray-900 --------
    // Quick reject: any Tailwind color class contains a hyphen followed by a
    // recognisable color stem; avoid running the big regex on pure JS lines.
    if (raw.includes('-')) {
      RX_TAILWIND_NAMED_COLOR.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = RX_TAILWIND_NAMED_COLOR.exec(raw)) !== null) {
        const cls = m[0]
        // Extract bare "prefix-color-shade" from any variant chain (hover:focus:bg-red-600 → bg-red-600)
        const colonIdx = cls.lastIndexOf(':')
        const bare = colonIdx >= 0 ? cls.slice(colonIdx + 1) : cls
        const firstDash = bare.indexOf('-')
        const attr = firstDash > 0 ? bare.slice(0, firstDash) : 'unknown'
        const id = `named_${bare.replace(/-/g, '_')}_${fileStem}_${lineNo}_${m.index}`
        pushHardcoded(id, cls, loc, lineNo, attr, 'named')
      }
    }

    // --- 3. Named black/white: bg-black, hover:text-white ---------------
    if (raw.includes('black') || raw.includes('white')) {
      RX_TAILWIND_BW_COLOR.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = RX_TAILWIND_BW_COLOR.exec(raw)) !== null) {
        const cls = m[0]
        const colonIdx = cls.lastIndexOf(':')
        const bare = colonIdx >= 0 ? cls.slice(colonIdx + 1) : cls
        const firstDash = bare.indexOf('-')
        const attr = firstDash > 0 ? bare.slice(0, firstDash) : 'unknown'
        const id = `bw_${bare.replace(/-/g, '_')}_${fileStem}_${lineNo}_${m.index}`
        pushHardcoded(id, cls, loc, lineNo, attr, 'bw')
      }
    }
  }
}

/** Records var(--name) usage inside a TSX/TS file against a shared cssvar_* id. */
function extractCssVariableUsage(
  lines: string[],
  normPath: string,
  fileId: string,
  _symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  const seenPerFile = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes('var(--')) continue
    const lineNo = i + 1
    const loc = `L${lineNo}`
    RX_CSS_VAR_USE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_CSS_VAR_USE.exec(raw)) !== null) {
      const name = m[1].toLowerCase()
      const targetId = `cssvar_${name}`
      const dedupe = `${targetId}:${lineNo}`
      if (seenPerFile.has(dedupe)) continue
      seenPerFile.add(dedupe)
      relations.push({
        sourceId: fileId,
        targetId,
        relation: 'uses_variable',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// CSS / SCSS file parsing (Level 3 — standalone)
// ---------------------------------------------------------------------------

/**
 * Minimal CSS parser: extracts CSS variable definitions (`--name: value;`)
 * and var(--name) usages. Intentionally avoids full CSS parsing — only what
 * the knowledge graph needs for design-token / theming awareness.
 */
function parseCssFile(normPath: string, content: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  const fileId = generateId(normPath)
  symbols.push({
    id: fileId,
    label: path.basename(normPath),
    sourceFile: normPath,
    sourceLocation: 'L1',
    kind: 'file',
  })

  if (!content) return { symbols, relations, imports }

  const lines = content.split('\n')
  const seenDefs = new Set<string>()

  // Definitions
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes('--')) continue
    const loc = `L${i + 1}`
    RX_CSS_VAR_DEF.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_CSS_VAR_DEF.exec(raw)) !== null) {
      const name = m[1].toLowerCase()
      const value = m[2].trim()
      const id = `cssvar_${name}`
      if (seenDefs.has(id)) continue
      seenDefs.add(id)
      symbols.push({
        id,
        label: `--${name}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'css_variable',
        fieldType: value,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }

  // Usages — var(--name)
  const seenUses = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes('var(--')) continue
    const loc = `L${i + 1}`
    RX_CSS_VAR_USE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_CSS_VAR_USE.exec(raw)) !== null) {
      const name = m[1].toLowerCase()
      const targetId = `cssvar_${name}`
      const dedupe = `${targetId}:${i + 1}`
      if (seenUses.has(dedupe)) continue
      seenUses.add(dedupe)
      relations.push({
        sourceId: fileId,
        targetId,
        relation: 'uses_variable',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }

  // Bracket-imbalance sanity check — CSS uses braces for rule blocks.
  runBracketSanityCheck(normPath, content)

  return { symbols, relations, imports }
}

// ---------------------------------------------------------------------------
// Python / FastAPI / Pydantic file parsing
// ---------------------------------------------------------------------------

/**
 * Decides whether a Pydantic field is required based on its annotation and
 * whether the line has a default value assignment.
 *
 *   `foo: str`                      → required
 *   `foo: Optional[str]`            → optional
 *   `foo: str | None`               → optional
 *   `foo: int = 0`                  → optional (has default)
 *   `foo: str = Field("...", ...)`  → optional (Field() default)
 */
function isPythonFieldRequired(annotation: string, hasDefault: boolean): boolean {
  if (hasDefault) return false
  const a = annotation.trim()
  // Optional[...] / typing.Optional[...]
  if (/\bOptional\s*\[/.test(a)) return false
  // PEP 604: X | None  (or None | X)
  if (/\|\s*None\b/.test(a) || /\bNone\s*\|/.test(a)) return false
  return true
}

/**
 * Extracts FastAPI route decorators and links them to their handler functions.
 * Pattern: `@router.post("/api/x")` on line N, followed by `def handler(...)` on
 * a subsequent line (with optional decorator continuation lines between).
 */
function extractFastApiRoutes(
  lines: string[],
  normPath: string,
  fileId: string,
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const m = RX_FASTAPI_ROUTE.exec(raw)
    if (!m) continue
    // m[1] = router name (e.g. "router", "users_router", "app")
    // m[2] = HTTP method
    // m[3] = URL path
    const method = m[2].toUpperCase()
    const urlPath = m[3]
    const loc = `L${i + 1}`
    const slug = slugifyPath(urlPath)
    let id = `fastapi_${method.toLowerCase()}_${slug}`
    if (seen.has(id)) id = `${id}_${i + 1}`
    seen.add(id)

    symbols.push({
      id,
      label: `${method} ${urlPath}`,
      sourceFile: normPath,
      sourceLocation: loc,
      kind: 'fastapi_route',
      httpMethod: method,
      urlPath,
    })
    relations.push({
      sourceId: fileId,
      targetId: id,
      relation: 'contains',
      confidence: 'EXTRACTED',
      sourceFile: normPath,
      sourceLocation: loc,
    })

    // Look ahead for the handler function. Skip over continuation lines
    // (other decorators, blank lines, comments) until we hit `def name(...)`.
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      const next = lines[j]
      const t = next.trim()
      if (t === '' || t.startsWith('#') || t.startsWith('@')) continue
      const defMatch = RX_PYTHON_DEF.exec(next)
      if (defMatch) {
        const fnName = defMatch[1]
        const fnId = generateId(normPath, fnName)
        // Ensure the handler function node exists (may not be added elsewhere).
        if (!symbols.some(s => s.id === fnId)) {
          symbols.push({
            id: fnId,
            label: `${fnName}()`,
            sourceFile: normPath,
            sourceLocation: `L${j + 1}`,
            kind: 'function',
          })
          relations.push({
            sourceId: fileId,
            targetId: fnId,
            relation: 'contains',
            confidence: 'EXTRACTED',
            sourceFile: normPath,
            sourceLocation: `L${j + 1}`,
          })
        }
        relations.push({
          sourceId: fnId,
          targetId: id,
          relation: 'handles_route',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: `L${j + 1}`,
        })
      }
      break
    }
  }
}

/**
 * Measures the leading-indent width of a line in characters (tabs count as 1
 * each — Python's own parser is stricter, but we only need relative ordering).
 */
function pythonIndent(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * Extracts fields from every Pydantic model class (BaseModel subclass) in
 * the file. For each field we record required/optional based on the
 * annotation and whether a default value is present.
 */
function extractPydanticFields(
  lines: string[],
  normPath: string,
  symbols: ParsedSymbol[],
  relations: ParsedRelation[]
): void {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const classMatch = RX_PYDANTIC_CLASS.exec(raw)
    if (!classMatch) continue

    const className = classMatch[1]
    const classIndent = pythonIndent(raw)
    const classId = generateId(normPath, className)

    // Scan the class body until indent drops back to classIndent or less on a
    // non-blank line, or we hit a new top-level `class `/`def ` at that indent.
    for (let j = i + 1; j < lines.length; j++) {
      const bodyRaw = lines[j]
      const bodyTrim = bodyRaw.trim()
      if (bodyTrim === '' || bodyTrim.startsWith('#')) continue

      const bodyIndent = pythonIndent(bodyRaw)
      if (bodyIndent <= classIndent) break

      // Skip nested class and method definitions — we only care about fields.
      if (/^\s*(?:async\s+)?def\s+/.test(bodyRaw)) continue
      if (/^\s*class\s+/.test(bodyRaw)) continue

      const fieldMatch = RX_PYDANTIC_FIELD.exec(bodyRaw)
      if (!fieldMatch) continue
      const fieldName = fieldMatch[1]
      // Skip common Pydantic/Python non-fields.
      if (fieldName === 'Config' || fieldName === 'model_config') continue

      const annotation = fieldMatch[2].trim()
      const defaultPart = fieldMatch[3]
      const hasDefault = defaultPart !== undefined && defaultPart.length > 0
      const required = isPythonFieldRequired(annotation, hasDefault)

      const fieldId = `pydanticfield_${className.toLowerCase()}_${fieldName.toLowerCase()}`
      const loc = `L${j + 1}`

      symbols.push({
        id: fieldId,
        label: `${className}.${fieldName}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'pydantic_field',
        fieldType: annotation,
        optional: !required,
        required,
        schemaClass: className,
      })
      relations.push({
        sourceId: classId,
        targetId: fieldId,
        relation: required ? 'has_required_field' : 'has_optional_field',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }
}

/**
 * Parses a Python source file: top-level classes + functions, FastAPI route
 * decorators, and Pydantic model fields. Keeps topology minimal — this is
 * the knowledge-graph surface, not a full Python AST.
 */
function parsePythonFile(normPath: string, content: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  const fileId = generateId(normPath)
  symbols.push({
    id: fileId,
    label: path.basename(normPath),
    sourceFile: normPath,
    sourceLocation: 'L1',
    kind: 'file',
  })

  if (!content) return { symbols, relations, imports }

  const lines = content.split('\n')

  // Top-level class / def detection (file-level children only — nested are
  // skipped for graph simplicity).
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const indent = pythonIndent(raw)
    if (indent !== 0) continue
    const loc = `L${i + 1}`

    const classMatch = RX_PYTHON_CLASS.exec(raw)
    if (classMatch) {
      const name = classMatch[1]
      const id = generateId(normPath, name)
      if (!symbols.some(s => s.id === id)) {
        symbols.push({
          id,
          label: name,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'class',
        })
        relations.push({
          sourceId: fileId,
          targetId: id,
          relation: 'contains',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
      }
      continue
    }

    const defMatch = RX_PYTHON_DEF.exec(raw)
    if (defMatch) {
      const name = defMatch[1]
      const id = generateId(normPath, name)
      if (!symbols.some(s => s.id === id)) {
        symbols.push({
          id,
          label: `${name}()`,
          sourceFile: normPath,
          sourceLocation: loc,
          kind: 'function',
        })
        relations.push({
          sourceId: fileId,
          targetId: id,
          relation: 'contains',
          confidence: 'EXTRACTED',
          sourceFile: normPath,
          sourceLocation: loc,
        })
      }
    }
  }

  // FastAPI route decorators + handler links
  try {
    extractFastApiRoutes(lines, normPath, fileId, symbols, relations)
  } catch (err) {
    console.warn(`[parser Python] FastAPI extraction failed for ${normPath}:`, err)
  }

  // Pydantic model fields with required/optional classification
  try {
    extractPydanticFields(lines, normPath, symbols, relations)
  } catch (err) {
    console.warn(`[parser Python] Pydantic extraction failed for ${normPath}:`, err)
  }

  // Bracket-imbalance sanity check — Python uses braces for dicts/sets/f-strings.
  runBracketSanityCheck(normPath, content)

  return { symbols, relations, imports }
}

// ---------------------------------------------------------------------------
// PRP Markdown: "Frontend Routes" table extraction (G-1 fix)
// ---------------------------------------------------------------------------

/**
 * Matches a table separator row, e.g. `| --- | :--- | ---: |`.
 * The exact dashes/colons/spaces don't matter — we only need to know
 * that the previous line was a header and the next lines are data.
 */
const RX_MD_TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/

/**
 * Matches any `## Frontend Routes` / `### Frontend Routes` heading. We
 * accept trailing parenthetical annotations ("(CANONICAL — Phase 4 ...)")
 * after the literal phrase.
 */
const RX_MD_FRONTEND_ROUTES_HEADING = /^\s{0,3}#{2,6}\s+Frontend\s+Routes\b/i

/** Any markdown heading (to detect section end). */
const RX_MD_ANY_HEADING = /^\s{0,3}#{1,6}\s+/

/**
 * Splits a markdown pipe-table row into cells. Strips leading/trailing
 * pipes and trims whitespace. Escaped pipes (`\|`) inside a cell are
 * preserved.
 */
function splitMdTableRow(line: string): string[] {
  // Replace escaped pipes with a placeholder, split, then restore.
  const placeholder = '\u0001'
  const safe = line.replace(/\\\|/g, placeholder)
  const trimmed = safe.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed
    .split('|')
    .map(cell => cell.replace(new RegExp(placeholder, 'g'), '|').trim())
}

/**
 * Derives a bare component name from a "Page Component (file)" cell.
 *
 * Examples:
 *   "passengers/PassengerListPage.tsx"      → "PassengerListPage"
 *   "PassengerCreatePage.tsx"               → "PassengerCreatePage"
 *   "`passengers/PassengerEditPage.tsx`"    → "PassengerEditPage"
 *   "PassengerDetailPage"                   → "PassengerDetailPage"
 */
function extractComponentName(cell: string): string {
  // Strip backticks, quotes, and code fences.
  const clean = cell.replace(/[`'"]/g, '').trim()
  // Take the basename without extension.
  const base = clean.split(/[\\/]/).pop() || clean
  return base.replace(/\.(tsx|jsx|ts|js)$/i, '')
}

/**
 * Extracts Phase 4 "Frontend Routes" table rows from a PRP markdown
 * document as `designed_route` nodes. Each row becomes a node whose id
 * is derived from the normalised URL, and the document file is linked
 * to the node via a `specifies` relation.
 *
 * The parser is intentionally forgiving: any `## Frontend Routes` (or
 * `### …`) heading triggers a scan for the first pipe-table beneath it,
 * and scanning stops at the next heading of any level.
 */
function extractDesignedFrontendRoutes(
  content: string,
  normPath: string,
  fileId: string,
): { symbols: ParsedSymbol[]; relations: ParsedRelation[] } {
  // M-1: PRP-* ファイルのみを対象（誤検出防止）
  // README.md / design-docs/*.md / CHANGELOG.md 等に偶発的に
  // 「## Frontend Routes」見出しがあっても designed_route を生成しない。
  const isPrp =
    /(?:^|[\/\\])(prp|prps|spec)[\/\\]PRP-\d{3}/i.test(normPath) ||
    /(?:^|[\/\\])PRP-\d{3}-/i.test(normPath)
  if (!isPrp) {
    return { symbols: [], relations: [] }
  }

  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const lines = content.split('\n')
  const seen = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    if (!RX_MD_FRONTEND_ROUTES_HEADING.test(lines[i])) continue

    // Find a pipe-table separator row, skipping blank lines, paragraphs
    // and the table's own header row.
    let tableStart = -1
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j]
      if (RX_MD_ANY_HEADING.test(t)) break // next section, no table
      if (RX_MD_TABLE_SEPARATOR.test(t)) {
        tableStart = j + 1
        break
      }
    }
    if (tableStart < 0) continue

    // Parse data rows until blank line, non-pipe line, or next heading.
    for (let k = tableStart; k < lines.length; k++) {
      const row = lines[k]
      if (RX_MD_ANY_HEADING.test(row)) break
      const trimmed = row.trim()
      if (trimmed === '') break
      if (!trimmed.startsWith('|')) break

      const cells = splitMdTableRow(row)
      if (cells.length < 4) continue

      // Conventional column order (as specified in PRP spec):
      //   col 0: #  (row number)
      //   col 1: Route
      //   col 2: Page Component (file)
      //   col 3: Pattern
      //   col 4+: Source PRP fields (optional)
      const rawRoute = cells[1]
      const rawComp = cells[2]
      const pattern = cells[3]
      if (!rawRoute || !rawComp) continue
      if (!rawRoute.startsWith('/')) continue // skip non-route rows

      const urlPath = normalizeRoutePath(rawRoute.replace(/[`'"]/g, '').trim())
      const pageComponent = extractComponentName(rawComp)
      const slug = slugifyPath(urlPath)
      let id = `designedroute_${slug}`
      if (seen.has(id)) id = `${id}_${k + 1}`
      seen.add(id)

      const loc = `L${k + 1}`
      symbols.push({
        id,
        label: `Designed Route ${urlPath}`,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'designed_route',
        urlPath,
        signature: pageComponent,
        fieldType: pattern,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'specifies',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }

  return { symbols, relations }
}

// ---------------------------------------------------------------------------
// Tailwind config parsing — theme.colors / theme.extend.colors as tokens
// ---------------------------------------------------------------------------

/**
 * Matches a `colors: {` / `extend: {` / `theme: {` / `<namedColor>: {`
 * block opener.
 *
 * M-4: uses the `g` flag with `matchAll` so a compressed single-line form
 *      like `theme: { extend: { colors: { primary: {` produces four
 *      openers, not just the first.
 *
 * C-3: adds `([a-zA-Z_][\w-]*)` as a 4th opener — any named color block
 *      such as `primary: {` is treated as a nested scope. That lets the
 *      extractor build a full dotted path (colors.primary.DEFAULT,
 *      colors.primary.500, …) and keep each shade's id unique.
 */
const RX_TW_BLOCK_OPEN = /(colors|extend|theme|[a-zA-Z_][\w-]*)\s*:\s*\{/g

/**
 * Matches a single `key: '#hex'` or `key: "#hex"` or `key: \`#hex\`` pair.
 * Accepts 3/4/6/8-digit hex values (`#abc`, `#abcd`, `#abcdef`, `#abcdef01`).
 */
const RX_TW_COLOR_PAIR =
  /(\w+)\s*:\s*['"`]#([0-9A-Fa-f]{3,8})['"`]/g

/**
 * Parses tailwind.config.{js,ts,cjs,mjs} for theme.colors / theme.extend.colors
 * entries. Each named color (e.g. `primary: '#635BFF'`) becomes a
 * `css_variable` node — the same kind used for `--primary-color` CSS
 * variables — so Design Token GATEs can treat both interchangeably.
 *
 * The regex is deliberately loose: we don't try to build a JS AST.
 * Instead we track nested `{` depth and only emit pairs that occur
 * inside a `colors:` block scope.
 */
function parseTailwindConfigFile(normPath: string, content: string): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  const fileId = generateId(normPath)
  symbols.push({
    id: fileId,
    label: path.basename(normPath),
    sourceFile: normPath,
    sourceLocation: 'L1',
    kind: 'file',
  })

  if (!content) return { symbols, relations, imports }

  const lines = content.split('\n')

  // Track currently-open named blocks as a path stack. Each frame stores
  // the *braceDepth at which the block was opened*; when braceDepth
  // drops below that on a `}`, the frame is popped.
  //
  // C-3: We now push a frame for every `key: {` opener, not just the
  // three Tailwind-specific scopes. That gives us a full dotted path
  // (e.g. theme.extend.colors.primary) so shade maps like
  //   primary: { DEFAULT: '#X', 500: '#Y' }
  // don't collide on the outer `primary` key — each becomes
  //   cssvar_colors_primary_default  and  cssvar_colors_primary_500.
  //
  // M-4: RX_TW_BLOCK_OPEN is now `/g`; we scan each line with exec() in
  // a loop and interleave opener detection with brace accounting in
  // left-to-right source order.
  interface BlockFrame { name: string; depth: number }
  const blockStack: BlockFrame[] = []
  let braceDepth = 0
  const seenIds = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const loc = `L${i + 1}`

    // Collect every opener position on this line (M-4 requires /g).
    const openersOnLine: Array<{ idx: number; name: string }> = []
    RX_TW_BLOCK_OPEN.lastIndex = 0
    let om: RegExpExecArray | null
    while ((om = RX_TW_BLOCK_OPEN.exec(raw)) !== null) {
      openersOnLine.push({ idx: om.index, name: om[1] })
    }

    // Walk the line, updating braceDepth and blockStack in lock-step.
    // When we reach an opener's start offset, push its frame at the
    // *current* braceDepth (before the following `{` increments it).
    let nextOpenerIdx = 0
    for (let c = 0; c < raw.length; c++) {
      while (
        nextOpenerIdx < openersOnLine.length &&
        openersOnLine[nextOpenerIdx].idx === c
      ) {
        blockStack.push({
          name: openersOnLine[nextOpenerIdx].name.toLowerCase(),
          depth: braceDepth,
        })
        nextOpenerIdx++
      }
      const ch = raw.charCodeAt(c)
      if (ch === 123 /* { */) braceDepth++
      else if (ch === 125 /* } */) {
        braceDepth--
        while (
          blockStack.length > 0 &&
          blockStack[blockStack.length - 1].depth >= braceDepth
        ) {
          blockStack.pop()
        }
      }
    }

    // We only emit tokens when the stack contains a `colors` frame.
    const colorsIdx = blockStack.findIndex(f => f.name === 'colors')
    if (colorsIdx < 0) continue

    RX_TW_COLOR_PAIR.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RX_TW_COLOR_PAIR.exec(raw)) !== null) {
      const tokenName = m[1].toLowerCase()
      const hex = m[2].toLowerCase()

      // C-3: id path = every frame at/below the `colors` scope + this key.
      // This disambiguates shade-map keys like DEFAULT / 500 / 700 that
      // would otherwise collide across different color families.
      const pathParts: string[] = []
      for (let k = colorsIdx; k < blockStack.length; k++) {
        pathParts.push(blockStack[k].name)
      }
      pathParts.push(tokenName)
      const flatPath = pathParts
        .join('_')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
      const id = `cssvar_${flatPath}`
      if (seenIds.has(id)) continue
      seenIds.add(id)

      const label = `--${pathParts.join('-').replace(/_/g, '-').toLowerCase()}`

      symbols.push({
        id,
        label,
        sourceFile: normPath,
        sourceLocation: loc,
        kind: 'css_variable',
        fieldType: `#${hex}`,
      })
      relations.push({
        sourceId: fileId,
        targetId: id,
        relation: 'contains',
        confidence: 'EXTRACTED',
        sourceFile: normPath,
        sourceLocation: loc,
      })
    }
  }

  return { symbols, relations, imports }
}
