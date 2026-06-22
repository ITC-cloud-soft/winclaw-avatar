/**
 * Import resolver for the pure TypeScript graph builder.
 *
 * Resolves import specifiers collected by parser.ts to actual file IDs
 * stored in the file map. Supports:
 *   - Relative imports (`./foo`, `../bar/baz`)
 *   - Project-root-relative imports (`src/utils/helper`)
 *   - Extension-less specifiers → tries .ts, .tsx, /index.ts, /index.tsx
 *
 * External package imports (no `.` prefix and no `src/` prefix) are
 * silently skipped — they are not part of the project graph.
 */

import path from 'node:path'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A fully resolved edge between two files in the project graph.
 *
 * Both `sourceId` and `targetId` correspond to values stored in the file map
 * that was passed to {@link resolveImports}.
 */
export interface ResolvedImport {
  /** File ID of the importing module. */
  sourceId: string
  /** File ID of the module being imported. */
  targetId: string
  /** Semantic relation label consumed by the graph serializer. */
  relation: 'imports_from'
  /** Provenance tag – all statically extracted edges use this value. */
  confidence: 'EXTRACTED'
  /** Original source file path (for debugging / graph metadata). */
  sourceFile: string
  /**
   * Source location string as emitted by parser.ts (e.g. `"line:5:col:0"`).
   * Propagated verbatim into the final graph edge.
   */
  sourceLocation: string
}

/**
 * Minimal shape of one import record produced by `parser.ts`.
 * Only the fields consumed by the resolver are declared here so that
 * the resolver does not need to import the full `ParseResult` type.
 */
export interface ParsedImport {
  /** The raw module specifier as written in the source (e.g. `./utils/foo`). */
  from: string
  /** Named/default/namespace symbols that are imported (informational only). */
  names: string[]
  /** Source location string for the import statement. */
  sourceLocation: string
}

/**
 * Minimal shape of a parsed file entry produced by `parser.ts`.
 * The resolver only cares about the `imports` field.
 */
export interface ParsedFileEntry {
  symbols: unknown[]
  imports: ParsedImport[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a file-system path to a forward-slash, no-extension lookup key
 * that matches the keys in `fileMap`.
 *
 * Steps:
 *  1. Convert all backslashes to forward slashes.
 *  2. Strip a trailing `.ts` or `.tsx` extension (the map stores keys without
 *     extensions so extension-less imports can be resolved).
 */
function normalizeKey(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/\.(tsx?)$/, '')
}

/**
 * Attempt to find `candidateKey` in `fileMap`, trying the bare key first,
 * then `/index` suffixed forms.
 *
 * Returns the matched file ID or `null` when no entry is found.
 *
 * @param candidateKey - Forward-slash, extension-stripped key to look up.
 * @param fileMap      - Map of normalized path keys to file IDs.
 */
function lookupInFileMap(
  candidateKey: string,
  fileMap: Map<string, string>,
): string | null {
  // 1. Exact match (already extension-stripped by caller)
  if (fileMap.has(candidateKey)) return fileMap.get(candidateKey)!

  // 2. With /index suffix (barrel imports: `import from './foo'` where
  //    `foo/index.ts` exists)
  const withIndex = `${candidateKey}/index`
  if (fileMap.has(withIndex)) return fileMap.get(withIndex)!

  return null
}

/**
 * Determine whether a module specifier refers to an external package that
 * should not be included in the project dependency graph.
 *
 * A specifier is treated as **internal** (project-owned) when it:
 *   - Starts with `.` (relative import), OR
 *   - Starts with `src/` (project-root-relative with explicit `src` prefix)
 *
 * Everything else (e.g. `react`, `lodash`, `node:fs`) is external.
 */
function isInternalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('src/')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all import statements collected by `parser.ts` to concrete file IDs.
 *
 * The algorithm for each import specifier `from` inside file `sourceFilePath`:
 *
 * 1. Skip external packages (no `.` or `src/` prefix).
 * 2. If relative (`./` or `../`): join the directory of `sourceFilePath`
 *    with the specifier, then normalize (backslash → slash, strip extension).
 * 3. If `src/`-prefixed (tsconfig `paths`-style): strip the leading `src/`
 *    and resolve relative to the project root inferred from `fileMap` keys,
 *    or fall back to using `process.cwd()`.
 * 4. Look up the resulting key in `fileMap` (bare, then `/index`).
 * 5. If a match is found, emit a {@link ResolvedImport} record.
 *
 * @param parsedFiles - Map of `filePath → ParsedFileEntry` from parser.ts.
 * @param fileMap     - Map of `normalizedPath (no ext) → fileId` for lookup.
 * @returns           - Array of resolved import edges deduplicated per
 *                      `(sourceId, targetId)` pair.
 */
export function resolveImports(
  parsedFiles: Map<string, ParsedFileEntry>,
  fileMap: Map<string, string>,
): ResolvedImport[] {
  // Build a reverse lookup: fileId → normalized key (for sourceId resolution)
  // We also need to map raw source file paths → their IDs.
  const pathToId = new Map<string, string>()
  for (const [normalizedKey, fileId] of fileMap) {
    pathToId.set(normalizedKey, fileId)
  }

  // Infer a common root prefix from fileMap keys to anchor `src/` imports.
  // Strategy: find the longest common prefix across all keys up to the last
  // `/src` segment, then strip it so `src/utils/foo` → `src/utils/foo`.
  // In practice we just use `src/` prefix directly since fileMap keys are
  // already stored as project-relative paths starting with `src/`.
  const resolved: ResolvedImport[] = []
  // Deduplicate (sourceId, targetId) pairs — multiple named imports from the
  // same module should produce only one graph edge.
  const seen = new Set<string>()

  for (const [sourceFilePath, entry] of parsedFiles) {
    // Resolve the source file's own ID from the fileMap.
    const sourceKey = normalizeKey(sourceFilePath)
    const sourceId = lookupInFileMap(sourceKey, fileMap)
    if (sourceId === null) {
      // This file was not registered in the file map — skip it.
      continue
    }

    // Directory of the source file (forward-slash form) for relative lookups.
    const sourceDir = sourceKey.replace(/\/[^/]+$/, '')

    for (const imp of entry.imports) {
      const specifier = imp.from

      // Skip anything that is not a project-internal module.
      if (!isInternalSpecifier(specifier)) continue

      let candidateKey: string

      if (specifier.startsWith('.')) {
        // --- Relative import ---
        // Join the source directory with the relative specifier and normalize.
        const joined = path.posix.join(sourceDir, specifier)
        candidateKey = normalizeKey(joined)
      } else {
        // --- src/-prefixed import (tsconfig paths) ---
        // The specifier is already relative to the project root, so we can
        // use it directly after normalizing slashes and stripping the extension.
        candidateKey = normalizeKey(specifier)
      }

      const targetId = lookupInFileMap(candidateKey, fileMap)
      if (targetId === null) continue

      // Self-imports are meaningless graph edges — skip them.
      if (sourceId === targetId) continue

      const edgeKey = `${sourceId}||${targetId}`
      if (seen.has(edgeKey)) continue
      seen.add(edgeKey)

      resolved.push({
        sourceId,
        targetId,
        relation: 'imports_from',
        confidence: 'EXTRACTED',
        sourceFile: sourceFilePath,
        sourceLocation: imp.sourceLocation,
      })
    }
  }

  return resolved
}
