/**
 * advanced/aiRate.ts — /harness ai-rate (AI adoption rate measurement)
 *
 * Computes the percentage of code authored / accepted by AI based on
 * git log parsing. Uses Co-Authored-By trailer detection and
 * author/email pattern matching against /claude|anthropic/i.
 *
 * Implements Harness Engineering Advanced scope §10.3.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AiRatePerAuthor = {
  author: string
  commits: number
  linesChanged: number
  aiAttributed: boolean
}

export type AiRateReport = {
  ranAt: string
  workspacePath: string
  windowDays: number
  totalCommits: number
  aiAttributedCommits: number
  aiCommitRate: number       // 0..1
  totalLinesChanged: number
  aiLinesChanged: number
  aiLineRate: number         // 0..1
  perAuthor: AiRatePerAuthor[]
}

// ---------------------------------------------------------------------------
// Git executor injection (for testing)
// ---------------------------------------------------------------------------

/**
 * A function that runs a git command in the given working directory and
 * returns its stdout as a string.
 */
export type GitExecutor = (
  args: string[],
  cwd: string,
) => Promise<string>

let _gitExecutor: GitExecutor = async (args, cwd) => {
  const result = await execFileAsync('git', args, { cwd, maxBuffer: 50 * 1024 * 1024 })
  return result.stdout
}

/**
 * Override the git executor. Pass `null` to restore the default (real git).
 * Primarily used in tests via stub injection.
 */
export function setGitExecutor(executor: GitExecutor | null): void {
  if (executor === null) {
    _gitExecutor = async (args, cwd) => {
      const result = await execFileAsync('git', args, { cwd, maxBuffer: 50 * 1024 * 1024 })
      return result.stdout
    }
  } else {
    _gitExecutor = executor
  }
}

// ---------------------------------------------------------------------------
// Internal: AI detection
// ---------------------------------------------------------------------------

const AI_PATTERN = /claude|anthropic/i

/**
 * Returns true if the commit is considered AI-authored based on:
 *   1. Author name or email matches /claude|anthropic/i
 *   2. Commit message body contains a "Co-Authored-By: Claude" trailer
 */
function isAiCommit(authorName: string, authorEmail: string, body: string): boolean {
  if (AI_PATTERN.test(authorName) || AI_PATTERN.test(authorEmail)) return true
  // Check Co-Authored-By trailers
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^co-authored-by:/i.test(trimmed) && AI_PATTERN.test(trimmed)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Internal: git log parser
// ---------------------------------------------------------------------------

/**
 * Raw parsed record from one git commit.
 */
type RawCommit = {
  hash: string
  authorName: string
  authorEmail: string
  body: string
  insertions: number
  deletions: number
}

/**
 * Parse the output of:
 *   git log --since="<N> days ago"
 *     --pretty=format:"%H%x09%an%x09%ae%x09%B%x1e"
 *     --shortstat
 *
 * git interleaves the pretty-format lines with shortstat lines.
 * The structure is:
 *
 *   <hash>\t<authorName>\t<authorEmail>\t<bodyFirstLine>   <- pretty line(s)
 *   [more body lines...]
 *   \x1e                                                   <- record separator
 *   \n                                                     <- blank
 *    N files changed, X insertions(+), Y deletions(-)     <- shortstat (optional)
 *   \n
 *   <next hash>...
 *
 * We split on \x1e first to get per-commit chunks, then for each chunk we
 * look for the shortstat line in the text that follows the separator
 * (i.e., the suffix *after* the commit's own body).
 *
 * Strategy: split the full raw string on \x1e. The first part of each
 * split segment is the pretty-format block; the shortstat for that commit
 * appears at the START of the NEXT segment (before the next pretty-format
 * header line).
 */
export function parseGitLog(raw: string): RawCommit[] {
  if (!raw.trim()) return []

  const STAT_RE =
    /(\d+)\s+files?\s+changed(?:,\s*(\d+)\s+insertions?\(\+\))?(?:,\s*(\d+)\s+deletions?\(-\))?/

  /**
   * Extract insertions/deletions from a text block that may contain a
   * shortstat line anywhere in it.
   */
  function extractStat(text: string): { insertions: number; deletions: number } {
    const m = text.match(STAT_RE)
    if (!m) return { insertions: 0, deletions: 0 }
    return {
      insertions: parseInt(m[2] ?? '0', 10),
      deletions: parseInt(m[3] ?? '0', 10),
    }
  }

  /**
   * Parse the pretty-format header from a segment.
   * The first line contains: <hash>\t<authorName>\t<authorEmail>\t<bodyStart>
   * Subsequent lines are body continuation (up to the shortstat).
   */
  function parseHeader(segment: string): {
    hash: string
    authorName: string
    authorEmail: string
    body: string
  } | null {
    // The segment starts with the pretty-format output for this commit.
    // Find the first non-empty line (skipping leading blank lines that
    // shortstat for the PREVIOUS commit may have left).
    const lines = segment.split('\n')
    let headerIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes('\t')) {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) return null

    const headerLine = lines[headerIdx]!
    const parts = headerLine.split('\t')
    if (parts.length < 3) return null

    const hash = (parts[0] ?? '').trim()
    const authorName = (parts[1] ?? '').trim()
    const authorEmail = (parts[2] ?? '').trim()
    const bodyFromHeader = parts.slice(3).join('\t')

    // Collect remaining lines as body (skip leading blank)
    const bodyLines = lines.slice(headerIdx + 1)
    const body = [bodyFromHeader, ...bodyLines].join('\n').trim()

    return { hash, authorName, authorEmail, body }
  }

  // Split on record separator — each split gives us the pretty block for
  // commit N, and the shortstat for commit N appears at the beginning of
  // segment N+1 (before the next header).
  const segments = raw.split('\x1e')
  const commits: RawCommit[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const header = parseHeader(segment)
    if (!header || !header.hash) continue

    // Shortstat for this commit is at the start of the NEXT segment
    // (the text before the next tab-delimited header line).
    let statText = ''
    const nextSeg = segments[i + 1]
    if (nextSeg !== undefined) {
      // Everything before the first tab-containing line in the next segment
      const nextLines = nextSeg.split('\n')
      const statLines: string[] = []
      for (const line of nextLines) {
        if (line.includes('\t')) break  // reached the next commit's header
        statLines.push(line)
      }
      statText = statLines.join('\n')
    }

    const { insertions, deletions } = extractStat(statText)

    commits.push({
      hash: header.hash,
      authorName: header.authorName,
      authorEmail: header.authorEmail,
      body: header.body,
      insertions,
      deletions,
    })
  }

  return commits
}

// ---------------------------------------------------------------------------
// Public: computeAiRate
// ---------------------------------------------------------------------------

/**
 * Compute AI adoption rate for the workspace git repo.
 *
 * @param opts.workspacePath  Absolute path to the git repo root.
 * @param opts.sinceDays      Number of days to look back (default 30).
 * @param opts.gitLogCommand  Ignored — use setGitExecutor() for injection.
 */
export async function computeAiRate(opts: {
  workspacePath: string
  sinceDays?: number
  gitLogCommand?: string
}): Promise<AiRateReport> {
  const { workspacePath, sinceDays = 30 } = opts
  const ranAt = new Date().toISOString()

  // -------------------------------------------------------------------------
  // 1. Fetch git log
  // -------------------------------------------------------------------------
  const args = [
    'log',
    `--since=${sinceDays} days ago`,
    '--pretty=format:%H\t%an\t%ae\t%B\x1e',
    '--shortstat',
  ]

  let raw = ''
  try {
    raw = await _gitExecutor(args, workspacePath)
  } catch {
    // git not available or not a repo — return zeroed report
    return {
      ranAt,
      workspacePath,
      windowDays: sinceDays,
      totalCommits: 0,
      aiAttributedCommits: 0,
      aiCommitRate: 0,
      totalLinesChanged: 0,
      aiLinesChanged: 0,
      aiLineRate: 0,
      perAuthor: [],
    }
  }

  // -------------------------------------------------------------------------
  // 2. Parse commits
  // -------------------------------------------------------------------------
  const commits = parseGitLog(raw)

  // -------------------------------------------------------------------------
  // 3. Aggregate per author + global
  // -------------------------------------------------------------------------
  type AuthorAccum = {
    commits: number
    linesChanged: number
    aiAttributed: boolean
  }
  const authorMap = new Map<string, AuthorAccum>()

  let totalCommits = 0
  let aiAttributedCommits = 0
  let totalLinesChanged = 0
  let aiLinesChanged = 0

  for (const commit of commits) {
    const linesChanged = commit.insertions + commit.deletions
    const isAi = isAiCommit(commit.authorName, commit.authorEmail, commit.body)

    totalCommits++
    totalLinesChanged += linesChanged
    if (isAi) {
      aiAttributedCommits++
      aiLinesChanged += linesChanged
    }

    const key = `${commit.authorName}\x00${commit.authorEmail}`
    const existing = authorMap.get(key)
    if (existing) {
      existing.commits++
      existing.linesChanged += linesChanged
      // Once an author is flagged AI, keep it (any commit from them was AI)
      if (isAi) existing.aiAttributed = true
    } else {
      authorMap.set(key, {
        commits: 1,
        linesChanged,
        aiAttributed: isAi,
      })
    }
  }

  // -------------------------------------------------------------------------
  // 4. Build perAuthor array
  // -------------------------------------------------------------------------
  const perAuthor: AiRatePerAuthor[] = []
  for (const [key, accum] of authorMap) {
    const [author] = key.split('\x00')
    perAuthor.push({
      author: author ?? '',
      commits: accum.commits,
      linesChanged: accum.linesChanged,
      aiAttributed: accum.aiAttributed,
    })
  }

  // Sort by commits descending
  perAuthor.sort((a, b) => b.commits - a.commits)

  // -------------------------------------------------------------------------
  // 5. Compute rates (guard division by zero)
  // -------------------------------------------------------------------------
  const aiCommitRate = totalCommits > 0 ? aiAttributedCommits / totalCommits : 0
  const aiLineRate = totalLinesChanged > 0 ? aiLinesChanged / totalLinesChanged : 0

  return {
    ranAt,
    workspacePath,
    windowDays: sinceDays,
    totalCommits,
    aiAttributedCommits,
    aiCommitRate,
    totalLinesChanged,
    aiLinesChanged,
    aiLineRate,
    perAuthor,
  }
}
