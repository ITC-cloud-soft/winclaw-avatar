import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

export interface StaticPageCheck {
  file: string
  issues: string[]         // ['template placeholder', 'no JSX return', etc.]
  isLikelyTemplate: boolean
  stats: {
    totalLines: number
    jsxElementCount: number       // rough count of < Capital
    hookCallCount: number         // rough count of useSomething(
    fetchCallCount: number        // fetch( / axios / useQuery
    templateMarkerCount: number   // Welcome to|Lorem ipsum|TODO|Click me|Hello World|Your app|Replace this
  }
}

const TEMPLATE_MARKERS = [
  /Welcome to (?:Vite|React|Next\.?js|your app)/i,
  /Lorem ipsum/i,
  /TODO:\s*implement/i,
  /Click me!?/i,
  /Hello,? World/i,
  /Replace this (?:page|component|content)/i,
  /You clicked \d+ times/i,
  /Edit `?src\/\w+`? and save/i,
  /Get started by editing/i,
  /Your first (?:app|page|component)/i,
  /placeholder[-\s]?content/i,
  /coming soon/i,
  /under construction/i,
]

const JSX_ELEMENT_RX = /<[A-Z][A-Za-z0-9]*(\s|\/|>)/g
const HOOK_CALL_RX = /\buse[A-Z][A-Za-z0-9]*\s*\(/g
const FETCH_CALL_RX = /\b(fetch|axios|useQuery|useMutation|useSWR)\s*[\.(]/g

/**
 * Static analysis: does this .tsx/.jsx file look like a real page, or a template stub?
 * Checks for template placeholder strings, minimum JSX complexity, hook usage.
 */
export function analyzePageStatically(filePath: string): StaticPageCheck {
  const result: StaticPageCheck = {
    file: filePath,
    issues: [],
    isLikelyTemplate: false,
    stats: {
      totalLines: 0,
      jsxElementCount: 0,
      hookCallCount: 0,
      fetchCallCount: 0,
      templateMarkerCount: 0,
    },
  }
  if (!existsSync(filePath)) {
    result.issues.push('file does not exist')
    result.isLikelyTemplate = true
    return result
  }
  let content = ''
  try { content = readFileSync(filePath, 'utf-8') } catch (e) {
    result.issues.push('unreadable: ' + (e instanceof Error ? e.message : String(e)))
    result.isLikelyTemplate = true
    return result
  }
  result.stats.totalLines = content.split('\n').length
  result.stats.jsxElementCount = (content.match(JSX_ELEMENT_RX) || []).length
  result.stats.hookCallCount = (content.match(HOOK_CALL_RX) || []).length
  result.stats.fetchCallCount = (content.match(FETCH_CALL_RX) || []).length
  for (const rx of TEMPLATE_MARKERS) {
    if (rx.test(content)) result.stats.templateMarkerCount++
  }

  // Static-page exemption: legal/privacy/error/404/about/contact pages are legitimately
  // presentation-only and may be short with few hooks. Don't require them to look
  // "data-heavy". Still catch obvious template markers though.
  const baseName = basename(filePath).toLowerCase()
  const STATIC_PAGE_NAMES = /^(legal|privacy|terms|about|contact|404|500|notfound|error|errorpage|errorboundary|home|landing|policies|cookies|tos|license)/i
  const isStaticPage = STATIC_PAGE_NAMES.test(baseName)

  // Heuristics for "is template":
  //  - ≥ 1 template marker → probable (always applies, even for static pages)
  //  - < 5 JSX elements + < 2 hook calls → probable (too simple to be real)
  //  - < 40 lines → probable (a real page is at least ~40 lines with imports/jsx)
  //  - no fetch/useQuery calls on a data-consuming page → suspicious but not fatal
  if (result.stats.templateMarkerCount > 0) {
    result.issues.push(`contains ${result.stats.templateMarkerCount} template placeholder phrase(s)`)
  }
  // Skip weak-signal checks entirely for static pages.
  if (!isStaticPage) {
    if (result.stats.jsxElementCount < 5) {
      result.issues.push(`only ${result.stats.jsxElementCount} JSX elements (threshold: 5)`)
    }
    if (result.stats.hookCallCount < 1) {
      result.issues.push(`no React hooks used (useState/useEffect/useNavigate/etc.)`)
    }
    if (result.stats.totalLines < 40) {
      result.issues.push(`only ${result.stats.totalLines} lines (typical minimum for a real page: 40)`)
    }
  }
  // At least 2 weak signals OR any strong signal (template marker) → flag as template
  result.isLikelyTemplate = result.stats.templateMarkerCount > 0 || result.issues.length >= 2
  return result
}

export interface FrontendPagesAudit {
  valid: boolean
  totalPages: number
  templatePages: number
  realPages: number
  templateFiles: string[]        // paths
  issues: Array<{ file: string, issues: string[] }>
}

/**
 * Audit ALL .tsx/.jsx page files under a frontend directory.
 * Flags modules whose pages are still template stubs.
 */
export function auditFrontendPages(pagesDir: string): FrontendPagesAudit {
  const result: FrontendPagesAudit = {
    valid: true,
    totalPages: 0,
    templatePages: 0,
    realPages: 0,
    templateFiles: [],
    issues: [],
  }
  if (!existsSync(pagesDir)) {
    return result  // no pages dir — nothing to audit
  }
  // BUG-A FIX: Skip build artifacts / third-party trees that could blow the stack
  // or produce noise (e.g., a stray node_modules symlink under pages/).
  const SKIP_DIRS = /^(node_modules|\.next|\.git|\.vscode|dist|build|coverage|\.cache|out|\.turbo|\.parcel-cache|\.vercel|\.svelte-kit)$/
  const walk = (dir: string, depth: number = 0) => {
    if (depth > 12) return  // safety cap against symlink loops
    let entries: string[] = []
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      const full = join(dir, e)
      let s
      try { s = statSync(full) } catch { continue }
      if (s.isDirectory()) {
        if (SKIP_DIRS.test(e)) continue
        walk(full, depth + 1)
      } else if (/\.(tsx|jsx)$/.test(e)) {
        result.totalPages++
        const check = analyzePageStatically(full)
        if (check.isLikelyTemplate) {
          result.templatePages++
          result.templateFiles.push(full)
          result.issues.push({ file: full, issues: check.issues })
        } else {
          result.realPages++
        }
      }
    }
  }
  walk(pagesDir)
  // Threshold: if > 50% of pages are templates, audit fails
  if (result.totalPages > 0 && result.templatePages / result.totalPages > 0.5) {
    result.valid = false
  }
  return result
}

export interface ChromeMcpVerifyPlan {
  steps: Array<{
    description: string
    toolCall: string           // human-readable; AI executes via MCP tool
    assertion: string          // what to check in result
    critical: boolean
  }>
  notes: string[]
}

/**
 * Generate a structured Chrome MCP verification plan the AI should follow.
 * (Code can't directly invoke Chrome MCP — this returns the script for the AI.)
 *
 * The plan covers: navigate, screenshot, console errors, network failures,
 * and page-content verification (must not be blank / must show real content).
 */
export function buildChromeMcpVerifyPlan(
  frontendUrl: string,
  routes: string[]
): ChromeMcpVerifyPlan {
  const plan: ChromeMcpVerifyPlan = { steps: [], notes: [] }
  if (!frontendUrl) {
    plan.notes.push('frontendUrl not provided — visual verification skipped')
    return plan
  }
  if (routes.length === 0) {
    plan.notes.push('no routes to verify')
    return plan
  }
  plan.notes.push(`Verifying ${routes.length} routes against ${frontendUrl}`)
  plan.notes.push('For each route: (1) navigate, (2) wait 2s for React mount, (3) screenshot, (4) read page text, (5) read console errors, (6) read network failures')
  plan.notes.push('A route FAILS if: white/blank page, 5xx network error on main doc, uncaught console error, OR page text is < 50 chars (indicates render failure)')

  for (const route of routes) {
    const url = frontendUrl.replace(/\/$/, '') + route
    plan.steps.push({
      description: `Navigate to ${route}`,
      toolCall: `mcp__Claude_in_Chrome__navigate url="${url}"`,
      assertion: 'page loads, URL changes',
      critical: true,
    })
    plan.steps.push({
      description: `Wait for React mount at ${route}`,
      toolCall: 'sleep 2000',
      assertion: '—',
      critical: false,
    })
    plan.steps.push({
      description: `Read page text at ${route}`,
      toolCall: `mcp__Claude_in_Chrome__get_page_text`,
      assertion: 'text length > 50 chars AND does not contain "Cannot GET" / "404 Not Found" / empty body',
      critical: true,
    })
    plan.steps.push({
      description: `Check console errors at ${route}`,
      toolCall: `mcp__Claude_in_Chrome__read_console_messages onlyErrors=true`,
      assertion: '0 uncaught errors (except known-benign ones)',
      critical: true,
    })
    plan.steps.push({
      description: `Check network errors at ${route}`,
      toolCall: `mcp__Claude_in_Chrome__read_network_requests`,
      assertion: 'no 5xx responses; 4xx only acceptable on intentional error pages',
      critical: true,
    })
  }
  return plan
}
