/**
 * Secret Coordinator — computes SecretAction[] from before/after YAML comparison.
 *
 * CRITICAL: This module is purely informational. It NEVER touches actual secret
 * values and NEVER invokes system credential commands. All registration commands
 * returned are strings for the human operator to run manually.
 */

import os from 'node:os'
import YAML from 'yaml'
import type { InfraFile, BackendSpec } from '../types.js'
import type { SecretAction } from './types.js'

// ---------------------------------------------------------------------------
// Pattern extraction
// ---------------------------------------------------------------------------

const SECRET_RE = /\$\{secret:([A-Z0-9_]+)\}/g
const VAR_RE = /\$\{var:([A-Z0-9_]+)\}/g

/** Extract all unique ${secret:KEY} names from a YAML string. */
function extractSecretRefs(yaml: string): Set<string> {
  const keys = new Set<string>()
  for (const m of yaml.matchAll(SECRET_RE)) {
    keys.add(m[1]!)
  }
  return keys
}

/** Extract all unique ${var:KEY} names from a YAML string. */
function extractVarRefs(yaml: string): Set<string> {
  const keys = new Set<string>()
  for (const m of yaml.matchAll(VAR_RE)) {
    keys.add(m[1]!)
  }
  return keys
}

// ---------------------------------------------------------------------------
// Platform default backend detection
// ---------------------------------------------------------------------------

type SecretBackend = 'env' | 'windows-credman' | 'keychain' | 'libsecret'

function detectDefaultSecretBackend(
  override?: 'env' | 'windows-credman' | 'keychain' | 'libsecret',
): SecretBackend {
  if (override) return override
  const platform = os.platform()
  if (platform === 'win32') return 'windows-credman'
  if (platform === 'darwin') return 'keychain'
  return 'libsecret'
}

// ---------------------------------------------------------------------------
// computeSecretActions
// ---------------------------------------------------------------------------

/**
 * Compute the secret/var declaration changes needed when applying a transaction.
 *
 * Compares old vs new environments.yaml to find:
 *   - new ${secret:KEY} references → declare action
 *   - new ${var:KEY} references → declare action (var, literal backend)
 *   - removed references → orphan (warn only, never auto-remove)
 *   - existing references → reuse action (no-op)
 *
 * The AI NEVER receives or returns actual secret values.
 */
export function computeSecretActions(
  beforeYaml: string,
  afterYaml: string,
  existingInfra: InfraFile | null,
  options?: {
    defaultBackend?: 'env' | 'windows-credman' | 'keychain' | 'libsecret'
    projectSlug?: string
    envName?: string
  },
): SecretAction[] {
  const { defaultBackend, projectSlug, envName } = options ?? {}
  const secretBackend = detectDefaultSecretBackend(defaultBackend)

  const beforeSecrets = extractSecretRefs(beforeYaml)
  const afterSecrets = extractSecretRefs(afterYaml)
  const beforeVars = extractVarRefs(beforeYaml)
  const afterVars = extractVarRefs(afterYaml)

  const declaredSecrets = new Set([
    ...Object.keys(existingInfra?.secrets ?? {}),
  ])
  const declaredVars = new Set([
    ...Object.keys(existingInfra?.vars ?? {}),
  ])

  const actions: SecretAction[] = []

  // --- Secrets ---
  for (const key of afterSecrets) {
    if (declaredSecrets.has(key) || beforeSecrets.has(key)) {
      // Already declared in infra.yaml, or carried over from before — reuse
      actions.push({ kind: 'reuse', name: key, backend: secretBackend })
    } else {
      // New reference not previously declared → declare
      const target = buildWindowsCredmanTarget(key, projectSlug, envName)
      const action: SecretAction = {
        kind: 'declare',
        name: key,
        backend: secretBackend,
        registrationCommand: getRegistrationCommand({
          kind: 'declare',
          name: key,
          backend: secretBackend,
        } as SecretAction, { projectSlug, envName, target }),
      }
      actions.push(action)
    }
  }

  // Removed secrets → orphan warning (no auto-remove)
  for (const key of beforeSecrets) {
    if (!afterSecrets.has(key)) {
      console.warn(
        `[secretCoordinator] Secret ref "${key}" removed from environments.yaml. ` +
        `Entry in infra.yaml not auto-removed — review manually.`,
      )
      // "remove" kind = orphan warning only
      actions.push({ kind: 'remove', name: key, backend: secretBackend })
    }
  }

  // --- Vars ---
  for (const key of afterVars) {
    if (declaredVars.has(key) || beforeVars.has(key)) {
      // Already declared in infra.yaml, or carried over from before — reuse
      actions.push({ kind: 'reuse', name: key, backend: 'literal' as unknown as SecretAction['backend'] } as SecretAction)
    } else {
      // New var → declare with literal backend (no credential needed)
      actions.push({
        kind: 'declare',
        name: key,
        backend: 'literal' as unknown as SecretAction['backend'],
      } as SecretAction)
    }
  }

  // Removed vars → orphan warning
  for (const key of beforeVars) {
    if (!afterVars.has(key)) {
      console.warn(
        `[secretCoordinator] Var ref "${key}" removed from environments.yaml. ` +
        `Entry in infra.yaml not auto-removed — review manually.`,
      )
      actions.push({ kind: 'remove', name: key, backend: 'literal' as unknown as SecretAction['backend'] } as SecretAction)
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// getRegistrationCommand
// ---------------------------------------------------------------------------

/**
 * Generate per-OS registration command for a SecretAction.
 * Returns null for var (no registration needed) or literal backends.
 *
 * IMPORTANT: Commands are informational strings for humans only.
 * The runtime NEVER executes these commands.
 */
export function getRegistrationCommand(
  action: SecretAction,
  context?: { projectSlug?: string; envName?: string; target?: string },
): string | null {
  // Vars and literal backend: no command
  if ((action.backend as string) === 'literal') return null

  const key = action.name
  const slug = context?.projectSlug ?? 'myproject'
  const env = context?.envName ?? 'myenv'

  switch (action.backend) {
    case 'windows-credman': {
      const target = context?.target ?? buildWindowsCredmanTarget(key, slug, env)
      return `cmdkey /generic:${target} /user:<placeholder> /pass:<placeholder>`
    }
    case 'keychain': {
      const service = `metacoder/${slug}/${env}`
      return `security add-generic-password -s "${service}" -a "${key.toLowerCase()}" -w`
    }
    case 'libsecret': {
      const service = `metacoder-${slug}-${env}`
      return (
        `secret-tool store --label="metacoder ${slug} ${env} ${key}" ` +
        `service ${service} username ${key.toLowerCase()}`
      )
    }
    case 'env': {
      return `# Add to your environment, e.g. ~/.bashrc:\nexport ${key}=...`
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// buildInfraPatch
// ---------------------------------------------------------------------------

/**
 * Build the patch to merge into ~/.metacoder/projects/<id>/infra.yaml.
 * Returns YAML string of additions only (declare actions only).
 */
export function buildInfraPatch(actions: SecretAction[]): string {
  const declareActions = actions.filter(a => a.kind === 'declare')
  if (declareActions.length === 0) return ''

  const patch: { secrets?: Record<string, BackendSpec>; vars?: Record<string, BackendSpec> } = {}

  for (const action of declareActions) {
    const backend = action.backend as string

    if (backend === 'literal') {
      // Var declaration
      patch.vars ??= {}
      patch.vars[action.name] = { backend: 'literal', value: '' }
    } else if (backend === 'env') {
      patch.secrets ??= {}
      patch.secrets[action.name] = { backend: 'env', name: action.name }
    } else if (backend === 'windows-credman') {
      patch.secrets ??= {}
      const target = buildWindowsCredmanTarget(action.name)
      patch.secrets[action.name] = { backend: 'windows-credman', target }
    } else if (backend === 'keychain') {
      patch.secrets ??= {}
      patch.secrets[action.name] = {
        backend: 'keychain',
        service: `metacoder/${action.name.toLowerCase()}`,
        account: action.name.toLowerCase(),
      }
    } else if (backend === 'libsecret') {
      patch.secrets ??= {}
      patch.secrets[action.name] = {
        backend: 'libsecret',
        attr: `service=metacoder username=${action.name.toLowerCase()}`,
      }
    }
  }

  return YAML.stringify(patch)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Windows Credential Manager target string.
 * Format: metacoder/<projectSlug>/<envName>/<key-lowercased>
 */
function buildWindowsCredmanTarget(
  key: string,
  projectSlug?: string,
  envName?: string,
): string {
  const slug = projectSlug ?? 'default'
  const env = envName ?? 'default'
  return `metacoder/${slug}/${env}/${key.toLowerCase()}`
}
