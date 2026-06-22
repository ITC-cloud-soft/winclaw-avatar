/**
 * orchestrator.ts — Phase 1.5 §15.5
 *
 * Thin routing layer that:
 *   1. Picks the right builder based on OperationInput.kind
 *   2. Wraps applyTransaction with caller-supplied context options
 *   3. Renders a Transaction's preview as Markdown for the AI to show the user
 */

import type { OperationInput, Transaction, ApplyResult } from './types.js'
import { buildAddTransaction } from './add.js'
import { buildEditTransaction } from './edit.js'
import { buildRemoveTransaction } from './remove.js'
import { buildCloneTransaction } from './clone.js'
import { buildSetTransaction } from './set.js'
import { applyTransaction } from './transaction.js'
import { computeSecretActions, buildInfraPatch } from './secretCoordinator.js'
import { loadInfraFile } from '../loader.js'
import { computeProjectId } from '../projectId.js'

// ---------------------------------------------------------------------------
// buildTransaction
// ---------------------------------------------------------------------------

/**
 * Build the appropriate Transaction based on the operation kind.
 *
 * Delegates to the per-operation builders in add.ts / edit.ts / remove.ts /
 * clone.ts / set.ts.  All validation, diffing, and snapshot creation happens
 * inside those builders.
 */
export async function buildTransaction(
  input: OperationInput,
  workspacePath: string,
): Promise<Transaction> {
  let txn: Transaction
  switch (input.kind) {
    case 'add':
      txn = await buildAddTransaction(input, workspacePath)
      break
    case 'edit':
      txn = await buildEditTransaction(input, workspacePath)
      break
    case 'remove':
      txn = await buildRemoveTransaction(input, workspacePath)
      break
    case 'clone':
      txn = await buildCloneTransaction(input, workspacePath)
      break
    case 'set':
      txn = await buildSetTransaction(input, workspacePath)
      break
    default: {
      // Exhaustiveness guard — TypeScript ensures this is unreachable, but
      // we provide a runtime guard for safety.
      const exhaustive: never = input
      throw new Error(`Unknown operation kind: ${(exhaustive as OperationInput).kind}`)
    }
  }

  // ── Post-step: compute secret actions (Reviewer D1 fix) ────────────────
  // Per §15.5.4: every mutation that introduces / removes a ${secret:KEY} or
  // ${var:KEY} reference must surface a SecretAction so the user knows what
  // OS-side registration is required. Builders intentionally leave
  // secretActions empty; we attach them here so all 5 ops inherit the flow.
  try {
    const existingInfra = await loadInfraFile(workspacePath)
    const projectSlug = computeProjectId(workspacePath)
    const envName = txn.targets[0] ?? 'unknown'
    const secretActions = computeSecretActions(
      txn.snapshot.environmentsYaml,
      txn.newEnvironmentsYaml,
      existingInfra,
      { projectSlug, envName },
    )
    if (secretActions.length > 0) {
      const infraPatch = buildInfraPatch(secretActions)
      txn = {
        ...txn,
        secretActions,
        ...(infraPatch ? { newInfraPatch: infraPatch } : {}),
      }
    }
  } catch {
    // Non-fatal: if infra/projectId resolution fails, secretActions stays empty.
    // The transaction still applies; user just won't see secret guidance.
  }

  return txn
}

// ---------------------------------------------------------------------------
// commitTransaction
// ---------------------------------------------------------------------------

/**
 * Apply an already-built transaction.
 *
 * Wraps applyTransaction with extra context (actor, gitRef, reason) that the
 * caller knows but the builders do not.
 */
export async function commitTransaction(
  txn: Transaction,
  workspacePath: string,
  options?: { actor?: string; gitRef?: string; reason?: string },
): Promise<ApplyResult> {
  const { actor, gitRef, reason } = options ?? {}

  // Attach reason to the transaction for audit-log purposes
  if (reason !== undefined) {
    // Transaction is readonly from the builder perspective; we create a
    // shallow copy so the original object is not mutated.
    txn = { ...txn, reason }
  }

  return applyTransaction(txn, workspacePath, { actor, gitRef })
}

// ---------------------------------------------------------------------------
// renderPreview
// ---------------------------------------------------------------------------

/**
 * Render a Transaction's preview as Markdown, suitable for display to the user
 * before they type `/apply` or `/cancel`.
 *
 * Sections:
 *   ## /env <kind> preview
 *   **Targets**: ...
 *   ### YAML diff
 *   ### Validation
 *   ### Secret actions
 *   ### Cascade impact
 *   ### Apply
 */
export function renderPreview(txn: Transaction): string {
  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`## /env ${txn.operation} preview`)
  lines.push('')
  lines.push(`**Targets**: ${txn.targets.join(', ')}`)
  lines.push('')

  // ── YAML diff ───────────────────────────────────────────────────────────
  lines.push('### YAML diff')
  lines.push('')
  if (txn.yamlDiff.trim()) {
    lines.push('```diff')
    lines.push(txn.yamlDiff)
    lines.push('```')
  } else {
    lines.push('_No YAML changes._')
  }
  lines.push('')

  // ── Validation ──────────────────────────────────────────────────────────
  lines.push('### Validation')
  lines.push('')
  if (txn.validation.ok) {
    const warnings = txn.validation.warnings ?? []
    if (warnings.length === 0) {
      lines.push('- ✓ no errors')
    } else {
      lines.push('- ✓ no errors')
      for (const w of warnings) {
        lines.push(`- ⚠ ${w.path ? `\`${w.path}\` — ` : ''}${w.message}`)
      }
    }
  } else {
    for (const e of txn.validation.errors) {
      lines.push(`- ✗ ${e.path ? `\`${e.path}\` — ` : ''}${e.message}`)
    }
    for (const w of txn.validation.warnings ?? []) {
      lines.push(`- ⚠ ${w.path ? `\`${w.path}\` — ` : ''}${w.message}`)
    }
  }
  lines.push('')

  // ── Secret actions ──────────────────────────────────────────────────────
  if (txn.secretActions.length > 0) {
    lines.push('### Secret actions')
    lines.push('')
    for (const sa of txn.secretActions) {
      if (sa.kind === 'declare') {
        const cmd = sa.registrationCommand ? ` Run: \`${sa.registrationCommand}\`` : ''
        lines.push(`- **declare**: \`${sa.name}\` → backend \`${sa.backend}\`.${cmd}`)
      } else if (sa.kind === 'reuse') {
        lines.push(`- **reuse**: \`${sa.name}\` (already declared)`)
      } else if (sa.kind === 'remove') {
        lines.push(`- **remove** (orphan warning): \`${sa.name}\``)
      }
    }
    lines.push('')
  }

  // ── Cascade impact ──────────────────────────────────────────────────────
  if (txn.dependencyImpact && txn.dependencyImpact.dependents.length > 0) {
    lines.push('### Cascade impact')
    lines.push('')
    lines.push(`Environments that extend \`${txn.dependencyImpact.envName}\`:`)
    for (const dep of txn.dependencyImpact.dependents) {
      lines.push(`- \`${dep}\``)
    }
    if (txn.dependencyImpact.recursiveDependents.length > txn.dependencyImpact.dependents.length) {
      lines.push('')
      lines.push('Recursive dependents (full chain):')
      for (const dep of txn.dependencyImpact.recursiveDependents) {
        lines.push(`- \`${dep}\``)
      }
    }
    lines.push('')
  }

  // ── Apply footer ────────────────────────────────────────────────────────
  lines.push('### Apply')
  lines.push('')
  if (txn.validation.ok) {
    lines.push('Type `/apply` to commit, `/cancel` to discard.')
  } else {
    lines.push('**Cannot apply** — fix validation errors above before proceeding.')
  }

  return lines.join('\n')
}
