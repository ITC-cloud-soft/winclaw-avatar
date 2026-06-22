/**
 * Frontend route path normalization for systest.
 *
 * Why this exists:
 *   - Phase 5A discovers routes statically (graphify `react_route` nodes and
 *     regex fallback over `App.tsx` / `routes/`). These paths look like
 *     `/users/:id`, `/flights/:flightId/edit`, or `${base}/profile`.
 *   - Phase 5C discovers routes at runtime by reading `<a href>` values and
 *     the current URL from a live browser. These paths look like
 *     `http://localhost:3000/users/42` or `/users/42/edit`.
 *
 * Without a shared normalization step, the two sources produced incompatible
 * path shapes — `seed.frontendRoutes = [{ path: '/users/:param' }]` never
 * matched runtime-observed `/users/42`, which made AI-driven E2E test
 * generation treat identical routes as different and produced duplicate or
 * missing tests.
 *
 * Rules (applied in order):
 *   1. Strip URL origin: `http://host:port/foo` → `/foo`.
 *   2. Drop query string and hash: `/foo?bar=1#x` → `/foo`.
 *   3. Collapse template variables: `${id}` → `:param`.
 *   4. Collapse named path params: `:id`, `:userId`, `:slug` → `:param`.
 *   5. Collapse purely numeric segments: `/42` → `/:param`.
 *   6. Collapse UUID segments (8-4-4-4-12 hex): → `/:param`.
 *   7. Normalize trailing slash (except root).
 *   8. Ensure leading slash (empty → `/`).
 *
 * Intentionally NOT collapsed:
 *   - Arbitrary slugs like `/airports/new` — we cannot distinguish a static
 *     route name from a user-slug without the route declaration, and
 *     over-collapsing would ruin matching for truly static routes.
 *   - Anything with dots, dashes, or mixed alphanumerics — too ambiguous.
 *
 * Example:
 *   normalizeRoutePath('http://localhost:3000/users/42/edit?tab=profile')
 *     → '/users/:param/edit'
 *   normalizeRoutePath('/flights/:id')
 *     → '/flights/:param'
 *   normalizeRoutePath('/airports/new')
 *     → '/airports/new'  (unchanged — not a dynamic segment)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeRoutePath(raw: string): string {
  if (!raw || typeof raw !== 'string') return '/'

  let p = raw.trim()

  // 1. Strip URL origin
  p = p.replace(/^https?:\/\/[^/]+/, '')

  // 2. Drop query string + hash
  const qIdx = p.indexOf('?')
  if (qIdx >= 0) p = p.slice(0, qIdx)
  const hIdx = p.indexOf('#')
  if (hIdx >= 0) p = p.slice(0, hIdx)

  // 3. Template variables: `${anything}` → :param
  p = p.replace(/\$\{[^}]*\}/g, ':param')

  // 4. Named path params: `:id`, `:userId`, `:slug` → :param
  p = p.replace(/:[a-zA-Z_][\w-]*/g, ':param')

  // 5 + 6. Per-segment replacement for numeric + UUID segments
  if (p.includes('/')) {
    const segments = p.split('/')
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (!seg) continue
      if (/^\d+$/.test(seg)) {
        segments[i] = ':param'
      } else if (UUID_RE.test(seg)) {
        segments[i] = ':param'
      }
    }
    p = segments.join('/')
  }

  // 7. Trailing slash (keep root `/` as-is)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)

  // 8. Leading slash / empty fallback
  if (!p) return '/'
  if (!p.startsWith('/')) p = '/' + p

  return p
}

/**
 * Deduplicate a list of route descriptors by their normalized path. The
 * first occurrence wins, preserving any `component` / `source` metadata
 * attached to the earlier entry.
 */
export function dedupeByNormalizedPath<T extends { path: string }>(routes: T[]): T[] {
  const seen = new Map<string, T>()
  for (const r of routes) {
    const key = normalizeRoutePath(r.path)
    if (seen.has(key)) continue
    seen.set(key, { ...r, path: key })
  }
  return Array.from(seen.values())
}
