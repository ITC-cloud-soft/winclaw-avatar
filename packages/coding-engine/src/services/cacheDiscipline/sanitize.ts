/**
 * sanitize.ts — Final-pass cache_control sanitizer.
 *
 * Runs immediately before an Anthropic API call to guarantee the outgoing
 * request never violates ANY documented `cache_control` invariant, regardless
 * of which upstream code path placed the markers.
 *
 * Anthropic constraints enforced (as of 2026-05):
 *
 *   I1.  Max 4 cache_control blocks per request.
 *        Block processing order: `tools` → `system` → `messages`.
 *   I2.  Within a request, every `ttl='1h'` block must appear BEFORE any
 *        `ttl='5m'` (default) block in processing order. Mixing the other
 *        way → 400.
 *   I3.  `cache_control` MUST NOT appear on a `thinking` or
 *        `redacted_thinking` block. Doing so → 400.
 *   I4.  Empty `text` blocks may not carry `cache_control`.
 *
 * Strategy: tolerant — strip the offending markers rather than throw, so a
 * stray legacy marker can never take a real session offline. Log every
 * removal under `METACODER_CACHE_DISCIPLINE_DEBUG=1`.
 *
 * Counterpart of `applyAnthropicCacheControl`. The two cooperate:
 *
 *   v3.0.1 boundaries placement → cacheDiscipline/boundaries.ts (intent)
 *   v3.0.1 final-pass scrubbing  → cacheDiscipline/sanitize.ts (safety net)
 *
 * Net effect: even with bugs upstream, the request leaving claude.ts is
 * guaranteed to satisfy all four invariants.
 */

import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SanitizerReport = {
  /** Markers removed because they exceeded the 4-per-request budget. */
  excessRemoved: number
  /** 1h markers removed because they appeared after a 5m marker. */
  ttlOrderingFixed: number
  /** Markers removed from thinking / redacted_thinking blocks. */
  thinkingMarkersStripped: number
  /** Markers removed from empty text blocks. */
  emptyTextMarkersStripped: number
  /** Total markers retained in the final request. */
  finalMarkerCount: number
}

type AnyBlock = {
  type?: string
  text?: string
  cache_control?: { type?: string; ttl?: string }
  [k: string]: unknown
}

type AnyToolDef = {
  cache_control?: { type?: string; ttl?: string }
  [k: string]: unknown
}

type SanitizerInput = {
  tools?: AnyToolDef[]
  system?: string | AnyBlock[]
  messages: MessageParam[]
}

const MAX_CACHE_CONTROL_BLOCKS = 4
const DEBUG = process.env.METACODER_CACHE_DISCIPLINE_DEBUG === '1'

function debugLog(msg: string): void {
  if (DEBUG) process.stderr.write(`[cacheDiscipline sanitize] ${msg}\n`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isThinkingBlock(block: AnyBlock | undefined): boolean {
  if (!block || typeof block !== 'object') return false
  return block.type === 'thinking' || block.type === 'redacted_thinking'
}

function isEmptyText(block: AnyBlock | undefined): boolean {
  if (!block || typeof block !== 'object') return false
  if (block.type !== 'text') return false
  if (typeof block.text !== 'string') return false
  return block.text.length === 0
}

function ttlOf(cc: { type?: string; ttl?: string } | undefined): '1h' | '5m' {
  if (!cc) return '5m'
  return cc.ttl === '1h' ? '1h' : '5m'
}

function cloneBlockWithoutCC(block: AnyBlock): AnyBlock {
  const { cache_control: _unused, ...rest } = block
  void _unused
  return rest
}

// ---------------------------------------------------------------------------
// Public: sanitizeAnthropicCacheControl
// ---------------------------------------------------------------------------

/**
 * Final-pass scrubber. Returns a NEW request object — input is never mutated.
 *
 * Order of operations (each pass is over the entire request in processing
 * order: tools → system → messages):
 *
 *  1. Strip `cache_control` from thinking / redacted_thinking blocks (I3).
 *  2. Strip `cache_control` from empty-text blocks (I4).
 *  3. Walk in processing order; once a 5m marker is seen, strip every
 *     subsequent 1h marker (I2).
 *  4. If more than 4 markers survive, strip extras from the END of the
 *     sequence — earlier markers protect more of the prefix (I1).
 *
 * @param input  Request fragment about to be sent to Anthropic.
 * @returns      Sanitized fragment + report describing what was changed.
 */
export function sanitizeAnthropicCacheControl<T extends SanitizerInput>(
  input: T,
): { request: T; report: SanitizerReport } {
  const report: SanitizerReport = {
    excessRemoved: 0,
    ttlOrderingFixed: 0,
    thinkingMarkersStripped: 0,
    emptyTextMarkersStripped: 0,
    finalMarkerCount: 0,
  }

  // Deep clone the parts we may mutate. Shallow-clone arrays + the blocks we
  // touch; non-touched blocks stay shared by reference.
  const tools: AnyToolDef[] | undefined = input.tools ? [...input.tools] : undefined
  let system: string | AnyBlock[] | undefined = input.system
  if (Array.isArray(system)) system = [...system]
  const messages: MessageParam[] = input.messages.map(m => {
    if (Array.isArray(m.content)) {
      return { ...m, content: [...(m.content as unknown as AnyBlock[])] } as MessageParam
    }
    return { ...m }
  })

  // -------------------------------------------------------------------------
  // Step 1 + 2: thinking + empty-text
  // -------------------------------------------------------------------------
  const stripIfThinkingOrEmpty = (block: AnyBlock): AnyBlock => {
    if (!block.cache_control) return block
    if (isThinkingBlock(block)) {
      report.thinkingMarkersStripped++
      debugLog(`stripped cache_control on ${block.type} block`)
      return cloneBlockWithoutCC(block)
    }
    if (isEmptyText(block)) {
      report.emptyTextMarkersStripped++
      debugLog('stripped cache_control on empty-text block')
      return cloneBlockWithoutCC(block)
    }
    return block
  }

  if (Array.isArray(system)) {
    system = system.map(stripIfThinkingOrEmpty)
  }
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      const content = m.content as unknown as AnyBlock[]
      for (let i = 0; i < content.length; i++) {
        content[i] = stripIfThinkingOrEmpty(content[i] as AnyBlock)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 + 4: TTL ordering + ≤4 budget — collect markers in processing
  //             order, then mark which ones to strip.
  // -------------------------------------------------------------------------
  type MarkerRef =
    | { kind: 'tool'; index: number }
    | { kind: 'system'; index: number }
    | { kind: 'message'; msgIndex: number; blockIndex: number }

  const markers: Array<{ ref: MarkerRef; ttl: '1h' | '5m' }> = []

  if (tools) {
    for (let i = 0; i < tools.length; i++) {
      const t = tools[i] as AnyToolDef | undefined
      if (t?.cache_control) markers.push({ ref: { kind: 'tool', index: i }, ttl: ttlOf(t.cache_control) })
    }
  }
  if (Array.isArray(system)) {
    for (let i = 0; i < system.length; i++) {
      const b = system[i] as AnyBlock | undefined
      if (b?.cache_control) markers.push({ ref: { kind: 'system', index: i }, ttl: ttlOf(b.cache_control) })
    }
  }
  for (let mi = 0; mi < messages.length; mi++) {
    const m = messages[mi]
    if (m && Array.isArray(m.content)) {
      const content = m.content as unknown as AnyBlock[]
      for (let bi = 0; bi < content.length; bi++) {
        const b = content[bi]
        if (b?.cache_control) markers.push({ ref: { kind: 'message', msgIndex: mi, blockIndex: bi }, ttl: ttlOf(b.cache_control) })
      }
    }
  }

  // Decide which markers to keep.
  const toRemove = new Set<number>()
  let see5m = false
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i]!
    if (cur.ttl === '5m') {
      see5m = true
    } else {
      // 1h: violates ordering iff a 5m has already been seen
      if (see5m) {
        toRemove.add(i)
        report.ttlOrderingFixed++
        debugLog(`stripped 1h marker that came after 5m (ref ${JSON.stringify(cur.ref)})`)
      }
    }
  }

  // Apply 4-block budget — count only the ones we kept; strip extras from the
  // END (latest in processing order — they protect the smallest prefix).
  let kept = 0
  for (let i = 0; i < markers.length; i++) {
    if (toRemove.has(i)) continue
    if (kept >= MAX_CACHE_CONTROL_BLOCKS) {
      toRemove.add(i)
      report.excessRemoved++
      debugLog(`stripped marker beyond 4-per-request budget (ref ${JSON.stringify(markers[i]!.ref)})`)
    } else {
      kept++
    }
  }

  // Apply removals.
  for (const idx of toRemove) {
    const m = markers[idx]
    if (!m) continue
    const ref = m.ref
    if (ref.kind === 'tool' && tools) {
      const t = tools[ref.index]
      if (t) tools[ref.index] = (() => { const { cache_control: _u, ...rest } = t; void _u; return rest as AnyToolDef })()
    } else if (ref.kind === 'system' && Array.isArray(system)) {
      const b = system[ref.index] as AnyBlock | undefined
      if (b) system[ref.index] = cloneBlockWithoutCC(b)
    } else if (ref.kind === 'message') {
      const msg = messages[ref.msgIndex]
      if (msg && Array.isArray(msg.content)) {
        const content = msg.content as unknown as AnyBlock[]
        const b = content[ref.blockIndex]
        if (b) content[ref.blockIndex] = cloneBlockWithoutCC(b)
      }
    }
  }

  report.finalMarkerCount = kept
  if (DEBUG && (report.excessRemoved + report.ttlOrderingFixed + report.thinkingMarkersStripped + report.emptyTextMarkersStripped) > 0) {
    debugLog(`final report: ${JSON.stringify(report)}`)
  }

  const out = {
    ...input,
    ...(tools !== undefined ? { tools } : {}),
    ...(system !== undefined ? { system } : {}),
    messages,
  } as T

  return { request: out, report }
}
