/**
 * humanApproval runner — checks for a human approval file and prompts if absent.
 *
 * ExtendedGateCheck type: 'human-approval'
 *
 * Emits a clear approval prompt to stdout, then checks
 * <workspace>/.metacoder/audit/approvals/<gateId>-<phaseId>.yaml
 * for an `approved: true` entry signed within the timeout window.
 *
 * TODO(Agent A): implement `/harness approve <gateId>` command that writes
 * the approval YAML file checked here.
 */

import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { CheckResult } from '../../types.js'
import type { ExtendedGateCheck } from '../../standardTypes.js'

// ---------------------------------------------------------------------------
// Timeout parser: "24h", "1h", "30m", "5m" → ms
// ---------------------------------------------------------------------------

function parseTimeoutMs(expr: string | undefined): number {
  if (!expr) return 24 * 60 * 60 * 1000 // default 24h
  const m = expr.trim().match(/^(\d+(?:\.\d+)?)\s*(h|m|s)?$/)
  if (!m) return 24 * 60 * 60 * 1000
  const n = parseFloat(m[1]!)
  switch (m[2]) {
    case 'h': return Math.round(n * 60 * 60 * 1000)
    case 'm': return Math.round(n * 60 * 1000)
    case 's': return Math.round(n * 1000)
    default:  return Math.round(n * 1000)
  }
}

// ---------------------------------------------------------------------------
// Approval file shape
// ---------------------------------------------------------------------------

type ApprovalRecord = {
  approved?: boolean
  approvedAt?: string   // ISO timestamp
  approvedBy?: string
  role?: string
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runHumanApproval(
  check: ExtendedGateCheck & { type: 'human-approval' },
  ctx: { workspacePath: string; timeoutMs: number },
  // Passed by registry: gateId + phaseId used to construct the file name.
  // Defaults remain as safety net for old call sites but should be supplied.
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const { workspacePath } = ctx
  const gateId = meta?.gateId ?? 'unknown-gate'
  const phaseId = meta?.phaseId ?? 'unknown-phase'
  const timeoutWindowMs = parseTimeoutMs(check.timeout)

  // Emit approval prompt to stdout
  const promptLines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║  HUMAN APPROVAL REQUIRED                                     ║',
    `║  Gate:    ${gateId.padEnd(51)}║`,
    `║  Phase:   ${phaseId.padEnd(51)}║`,
    `║  Role:    ${(check.role ?? 'any').padEnd(51)}║`,
    `║  Timeout: ${(check.timeout ?? '24h').padEnd(51)}║`,
    '║                                                              ║',
    `║  Prompt: ${check.prompt.slice(0, 54).padEnd(54)}║`,
    '║                                                              ║',
    `║  To approve, run:                                            ║`,
    `║    /harness approve ${gateId.padEnd(42)}║`,
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ]
  // IMPORTANT: emit the banner to stderr so it does not pollute stdout —
  // metacoder _exec writes JSON to stdout, and any caller that captures
  // `metacoder _exec harness.runGate` must be able to JSON.parse it cleanly.
  // (Fixed in v2.0.3 — earlier versions printed to stdout and broke parsing.)
  process.stderr.write(promptLines.join('\n') + '\n')

  // Check approval file
  const approvalDir = path.join(workspacePath, '.metacoder', 'audit', 'approvals')
  const approvalFile = path.join(approvalDir, `${gateId}-${phaseId}.yaml`)

  let record: ApprovalRecord | null = null
  try {
    const raw = fs.readFileSync(approvalFile, 'utf8')
    record = YAML.parse(raw) as ApprovalRecord
  } catch {
    // File doesn't exist or can't be parsed — approval pending
  }

  if (!record?.approved) {
    return {
      type: 'human-approval' as never,
      passed: false,
      durationMs: Date.now() - start,
      output:
        `Human approval pending for gate "${gateId}" (phase "${phaseId}").\n` +
        `Run: /harness approve ${gateId}\n` +
        `Approval file expected at: ${approvalFile}`,
    }
  }

  // Validate approval is within timeout window
  if (record.approvedAt) {
    const approvedAtMs = new Date(record.approvedAt).getTime()
    const ageMs = Date.now() - approvedAtMs
    if (ageMs > timeoutWindowMs) {
      return {
        type: 'human-approval' as never,
        passed: false,
        durationMs: Date.now() - start,
        output:
          `Approval for gate "${gateId}" expired ` +
          `(approved ${Math.round(ageMs / 60000)}m ago, timeout ${check.timeout ?? '24h'}).\n` +
          `Run: /harness approve ${gateId}`,
      }
    }
  }

  return {
    type: 'human-approval' as never,
    passed: true,
    durationMs: Date.now() - start,
    output: `Approval confirmed for gate "${gateId}" by ${record.approvedBy ?? 'unknown'}`,
    detail: {
      approvedAt: record.approvedAt,
      approvedBy: record.approvedBy,
      role: record.role ?? check.role,
    },
  }
}
