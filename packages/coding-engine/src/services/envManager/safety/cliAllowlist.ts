/**
 * CLI allowlist engine — Phase 4 §7.2.
 *
 * Provides:
 *   loadAllowlist  — merge built-in + user YAML rules
 *   classifyCli    — check a command+args pair against a rule set
 *   isCliBlocked   — convenience wrapper that applies a safety mode
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { BUILTIN_DESTRUCTIVE_RULES } from './builtinAllowlist.js'
import type { AllowlistRule, CliClassification } from './types.js'

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export type LoadOptions = {
  /** Path to user-provided cli-allowlist.yaml; merged with built-in */
  userAllowlistPath?: string
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Strip a leading directory path and a trailing `.exe` extension so that
 * `/usr/local/bin/az` and `az.exe` both normalise to `az`.
 */
function normalizeCommand(raw: string): string {
  // Strip path prefix (POSIX or Windows separators)
  const base = raw.includes('/') || raw.includes('\\')
    ? path.basename(raw)
    : raw
  // Strip .exe / .EXE suffix
  return base.replace(/\.exe$/i, '')
}

// ---------------------------------------------------------------------------
// Rule matching helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `pattern` matches `arg`.
 *
 * Matching is intentionally permissive so that combined flags like `-rf`
 * satisfy a pattern of `-rf`, and so that a pattern `DROP` matches an arg
 * `"DROP TABLE foo"`.  Two modes:
 *
 *   1. Exact match   — `arg === pattern`
 *   2. Substring     — `arg` contains `pattern` (case-sensitive)
 *
 * This covers:
 *   - exact flag:  args=['-rf']  pattern='-rf'          → exact
 *   - inline SQL:  args=['-e', 'DROP TABLE users'] pattern='DROP' → substring
 *   - combined:    args=['--force'] pattern='--force'   → exact
 */
function patternMatchesArg(pattern: string, arg: string): boolean {
  return arg === pattern || arg.includes(pattern)
}

/**
 * Returns true when every string in `argsMatch` is satisfied by at least one
 * element in `args` via `patternMatchesArg`.
 */
function allPatternsPresent(argsMatch: string[], args: string[]): boolean {
  return argsMatch.every(pattern =>
    args.some(arg => patternMatchesArg(pattern, arg)),
  )
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Check a CLI invocation against a list of destructive rules.
 *
 * Algorithm:
 *   1. Normalise the command (strip path prefix + .exe).
 *   2. Filter rules whose `command` equals the normalised command.
 *   3. For the first rule where every `args_match` pattern is satisfied by
 *      at least one arg (exact or substring), return a positive classification.
 *   4. If no rule matches, return isDestructive: false.
 */
export function classifyCli(
  command: string,
  args: string[],
  rules: AllowlistRule[],
): CliClassification {
  const normalized = normalizeCommand(command)

  for (const rule of rules) {
    if (rule.command !== normalized) continue
    if (allPatternsPresent(rule.args_match, args)) {
      return {
        command: normalized,
        args,
        isDestructive: true,
        matchedRule: rule,
      }
    }
  }

  return {
    command: normalized,
    args,
    isDestructive: false,
  }
}

/**
 * Convenience wrapper: returns whether a CLI call should be blocked, plus a
 * human-readable reason, based on the current `destructiveOps` safety mode.
 *
 *   'deny'    — block all matched destructive commands
 *   'confirm' — do NOT block (caller must ask for confirmation instead)
 *   'allow'   — do NOT block
 */
export function isCliBlocked(
  command: string,
  args: string[],
  rules: AllowlistRule[],
  destructiveOps: 'allow' | 'confirm' | 'deny',
): { blocked: boolean; classification: CliClassification; reason: string } {
  const classification = classifyCli(command, args, rules)

  if (!classification.isDestructive) {
    return { blocked: false, classification, reason: 'Command is not classified as destructive' }
  }

  if (destructiveOps === 'deny') {
    const desc = classification.matchedRule?.description ?? 'matched a destructive pattern'
    return {
      blocked: true,
      classification,
      reason: `Destructive CLI operation blocked (deny mode): ${desc}`,
    }
  }

  // 'confirm' or 'allow' — not blocked at this layer
  const modeLabel = destructiveOps === 'confirm' ? 'confirmation required' : 'allowed'
  return {
    blocked: false,
    classification,
    reason: `Destructive CLI operation detected but not blocked (${modeLabel})`,
  }
}

// ---------------------------------------------------------------------------
// YAML loading + validation
// ---------------------------------------------------------------------------

/**
 * Validate that a parsed YAML value looks like an AllowlistRule.
 * Returns the typed rule or null if it is malformed.
 */
function validateUserRule(raw: unknown, index: number): AllowlistRule | null {
  if (typeof raw !== 'object' || raw === null) {
    console.warn(`[cliAllowlist] user rule at index ${index} is not an object — skipping`)
    return null
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.command !== 'string' || obj.command.trim() === '') {
    console.warn(`[cliAllowlist] user rule at index ${index} missing string 'command' — skipping`)
    return null
  }
  if (
    !Array.isArray(obj.args_match) ||
    obj.args_match.some((v: unknown) => typeof v !== 'string')
  ) {
    console.warn(`[cliAllowlist] user rule at index ${index} missing string[] 'args_match' — skipping`)
    return null
  }

  const rule: AllowlistRule = {
    command: obj.command.trim(),
    args_match: obj.args_match as string[],
  }

  if (typeof obj.description === 'string') {
    rule.description = obj.description
  }
  if (obj.severity === 'destructive' || obj.severity === 'risky' || obj.severity === 'noisy') {
    rule.severity = obj.severity
  }

  return rule
}

/**
 * Load the merged allowlist: built-in rules first, then optional user YAML.
 *
 * User YAML schema (top-level list):
 * ```yaml
 * - command: mytools
 *   args_match: [nuke, --force]
 *   description: Custom nuke command
 *   severity: destructive
 * ```
 *
 * Malformed entries are skipped with a console.warn; no exception is thrown.
 */
export async function loadAllowlist(options?: LoadOptions): Promise<AllowlistRule[]> {
  const rules: AllowlistRule[] = [...BUILTIN_DESTRUCTIVE_RULES]

  const userPath = options?.userAllowlistPath
  if (!userPath) return rules

  if (!existsSync(userPath)) {
    return rules
  }

  let raw: string
  try {
    raw = readFileSync(userPath, 'utf-8')
  } catch (err) {
    console.warn(`[cliAllowlist] could not read user allowlist at ${userPath}:`, err)
    return rules
  }

  let parsed: unknown
  try {
    parsed = YAML.parse(raw)
  } catch (err) {
    console.warn(`[cliAllowlist] could not parse YAML at ${userPath}:`, err)
    return rules
  }

  if (!Array.isArray(parsed)) {
    console.warn(`[cliAllowlist] user allowlist at ${userPath} must be a YAML list — ignoring`)
    return rules
  }

  let added = 0
  for (let i = 0; i < parsed.length; i++) {
    const rule = validateUserRule(parsed[i], i)
    if (rule) {
      rules.push(rule)
      added++
    }
  }

  if (added > 0) {
    console.log(`[cliAllowlist] loaded ${added} user rule(s) from ${userPath}`)
  }

  return rules
}
