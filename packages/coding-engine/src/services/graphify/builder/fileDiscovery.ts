/**
 * Recursive file discovery for the pure TypeScript graph builder.
 *
 * Walks a directory tree synchronously (readdirSync with withFileTypes) for
 * predictable performance, then exposes an async wrapper so callers can await
 * it without blocking the event loop on very large repos.
 *
 * Directories that must never be indexed are declared in SKIP_DIRS. Callers
 * can narrow or widen the extension set via the options object.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Mainframe file detection (extensionless files)
// ---------------------------------------------------------------------------

/**
 * Detect COBOL/BMS/DDS files that have NO extension.
 * Many mainframe projects use bare filenames (LOGIN-COB, LOGINMAP, employee).
 * We read the first ~500 bytes and pattern-match to determine the file type.
 *
 * Returns a pseudo-extension (.cob, .bms, .dds) or '' if not recognized.
 */
export function detectMainframeFileType(absolutePath: string): string {
  try {
    const fd = fs.openSync(absolutePath, 'r')
    // Read up to 4KB — COBOL files have large comment headers before IDENTIFICATION DIVISION
    const buf = Buffer.alloc(4096)
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0)
    fs.closeSync(fd)
    if (bytesRead === 0) return ''

    const head = buf.toString('utf-8', 0, bytesRead)

    // Binary file guard: NUL bytes indicate binary content, not text
    if (head.includes('\0')) return ''

    // BMS map definition: DFHMSD, DFHMDI, DFHMDF are definitive
    if (/DFHM[SD][DIF]/i.test(head)) return '.bms'

    // COBOL indicators: IDENTIFICATION DIVISION, PROGRAM-ID, WORKING-STORAGE,
    // PROCEDURE DIVISION, EXEC CICS, EXEC SQL, or COBOL-style comment blocks (****)
    if (/IDENTIFICATION\s+DIVISION/i.test(head) ||
        /PROGRAM-ID/i.test(head) ||
        /WORKING-STORAGE\s+SECTION/i.test(head) ||
        /PROCEDURE\s+DIVISION/i.test(head) ||
        /EXEC\s+CICS/i.test(head) ||
        /EXEC\s+SQL/i.test(head) ||
        /^\s{6}\*\s/m.test(head) ||
        /^\*{10,}/m.test(head)) {
      return '.cob'
    }

    // AS-400 DDS: column-based format with A in col 6, R (record), field definitions
    // Pattern: "     A          R <recordname>" or "     A            <fieldname>"
    if (/^\s{5}A\s+R\s+\w+/m.test(head) ||
        /^\s{5}A\s+\w+\s+\d+[ASP]\s/m.test(head)) {
      return '.dds'
    }

    // COBOL COPY book: 01-level data definitions without PROGRAM-ID
    if (/^\s+01\s+\S+\.\s*$/m.test(head) ||
        /^\s+05\s+\S+\s+PIC/i.test(head)) {
      return '.cpy'
    }
  } catch {
    // Binary file, permission error, etc. — not a mainframe file
  }
  return ''
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single indexable source file discovered under rootDir. */
export interface DiscoveredFile {
  /** Path relative to rootDir, using forward slashes. */
  path: string
  /** Absolute path suitable for fs.readFileSync. */
  absolutePath: string
  /** Lower-case extension including the dot, e.g. ".ts". */
  extension: string
}

export interface DiscoverOptions {
  /**
   * Extensions to collect (lower-case, including the dot).
   * Defaults to ['.ts', '.tsx', '.js', '.jsx'].
   */
  include?: string[]
  /**
   * Additional directory names (not full paths) to skip.
   * Merged with the built-in SKIP_DIRS list.
   */
  exclude?: string[]
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Directory names that are unconditionally excluded.
 * These are matched against the bare directory name, not the full path, so
 * a nested `node_modules` inside a workspace package is also skipped.
 */
const SKIP_DIRS = new Set([
  // Build / output dirs
  'node_modules', 'dist', 'build', 'out', 'target', 'graphify-out',
  '.next', '.nuxt', '.turbo', '.vite',
  // VCS + tooling
  '.git', '.idea', '.vscode-server',
  // Test / coverage
  'coverage', '.nyc_output', '__pycache__',
  // Language version managers / caches (HUGE — would balloon the walk if rooted at HOME)
  '.bun', '.npm', '.yarn', '.pnpm-store', '.pyenv', '.cargo', '.gradle', '.m2',
  // Per-user app data (would also balloon the walk if rooted at HOME — airlinesys5 incident)
  '.metacoder', '.claude', '.lingmaIDE', '.winclaw', 'Library', '.local',
  // OS-level junk
  'AppData', 'Downloads', 'Temp', 'tmp',
  // Python / vendor
  '.venv', 'venv', 'vendor',
  // Existing misc
  '.cache', '.systest',
])

const DEFAULT_EXTENSIONS = new Set([
  // Code files
  '.ts', '.tsx', '.js', '.jsx',
  // Documents
  '.md', '.txt', '.rst', '.adoc',
  // Office documents
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  // Config files
  '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
  // Markup
  '.html', '.htm', '.xml', '.svg',
  // Styles
  '.css', '.scss', '.sass', '.less',
  // Data
  '.sql', '.csv', '.tsv',
  // COBOL / Mainframe / AS400
  '.cob', '.cbl', '.cobol', '.cpy', '.copy', '.bms', '.dds', '.dspf',
  // Python — parser already extracts FastAPI routes + Pydantic fields
  '.py', '.pyi',
  // Other major backends — parsing support is partial but file presence still contributes to structure
  '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs', '.swift',
  // Frontend single-file components (Vue / Svelte)
  '.vue', '.svelte',
  // Note: Images (.png/.jpg/.gif/.webp) are intentionally EXCLUDED.
  // They produce file-name-only nodes with zero semantic value, polluting the graph.
  // Legacy screenshots are handled by projectSetup.ts scanScreenshots() instead.
])

// ---------------------------------------------------------------------------
// Core (synchronous) walker
// ---------------------------------------------------------------------------

/**
 * Recursively collects all matching files under `dir`.
 * Mutates `results` in place for performance (avoids intermediate array allocation).
 */
function walkSync(
  dir: string,
  rootDir: string,
  allowedExtensions: Set<string>,
  skipDirs: Set<string>,
  results: DiscoveredFile[],
): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // Permission errors or broken symlinks — skip silently.
    return
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue

    const absolutePath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      walkSync(absolutePath, rootDir, allowedExtensions, skipDirs, results)
      continue
    }

    if (!entry.isFile()) continue

    let ext = path.extname(entry.name).toLowerCase()

    // Mainframe files often have NO extension (e.g., LOGIN-COB, LOGINMAP, employee).
    // Detect COBOL/BMS/DDS by reading the first few lines of extensionless files.
    if (!ext) {
      ext = detectMainframeFileType(absolutePath)
    }

    if (!allowedExtensions.has(ext)) continue

    // Store with forward slashes so IDs are platform-independent.
    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/')

    results.push({ path: relativePath, absolutePath, extension: ext })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discovers all TypeScript/JavaScript source files under `rootDir`.
 *
 * The walk is performed synchronously inside a microtask so the caller can
 * await it without coupling itself to Node's thread pool.
 *
 * @param rootDir - Absolute path to the project root.
 * @param options - Optional include/exclude overrides.
 * @returns Array of discovered files, sorted by relative path for determinism.
 *
 * @example
 * const files = await discoverCodeFiles('/home/user/my-project')
 * // files[0] → { path: 'src/index.ts', absolutePath: '...', extension: '.ts' }
 * // files[1] → { path: 'README.md', absolutePath: '...', extension: '.md' }
 */
export async function discoverCodeFiles(
  rootDir: string,
  options?: DiscoverOptions,
): Promise<DiscoveredFile[]> {
  const allowedExtensions =
    options?.include != null
      ? new Set(options.include.map(e => e.toLowerCase()))
      : DEFAULT_EXTENSIONS

  const skipDirs =
    options?.exclude != null
      ? new Set([...SKIP_DIRS, ...options.exclude])
      : SKIP_DIRS

  const results: DiscoveredFile[] = []
  walkSync(rootDir, rootDir, allowedExtensions, skipDirs, results)

  // Stable sort so graph output is deterministic across runs.
  results.sort((a, b) => a.path.localeCompare(b.path))

  return results
}

/**
 * Synchronous variant for use in contexts where async is not viable
 * (e.g. inside a Jest transform or CLI bootstrap).
 */
export function discoverCodeFilesSync(
  rootDir: string,
  options?: DiscoverOptions,
): DiscoveredFile[] {
  const allowedExtensions =
    options?.include != null
      ? new Set(options.include.map(e => e.toLowerCase()))
      : DEFAULT_EXTENSIONS

  const skipDirs =
    options?.exclude != null
      ? new Set([...SKIP_DIRS, ...options.exclude])
      : SKIP_DIRS

  const results: DiscoveredFile[] = []
  walkSync(rootDir, rootDir, allowedExtensions, skipDirs, results)
  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}

