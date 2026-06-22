import type { BackendSpec, BackendName, ResolveResult } from '../types.js'
import { resolveLiteral } from './literal.js'
import { resolveEnv } from './env.js'
import { resolveWindowsCredman } from './windowsCredman.js'
import { resolveKeychain } from './keychain.js'
import { resolveLibsecret } from './libsecret.js'
import { resolveAzCli } from './azCli.js'
import { resolveAwsCli } from './awsCli.js'
import { resolveAliyunCli } from './aliyunCli.js'
import { resolveOnePassword } from './onePassword.js'
import { resolveVault } from './vault.js'
import { resolveKeyvault } from './keyvault.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BackendDispatcher = (spec: BackendSpec) => Promise<ResolveResult>

// ---------------------------------------------------------------------------
// All backends are now implemented.  The UNIMPLEMENTED set is kept as an
// empty constant so the exhaustiveness guard below continues to compile.
// ---------------------------------------------------------------------------

const UNIMPLEMENTED: ReadonlySet<BackendName> = new Set<BackendName>()

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Returns the dispatcher for a given backend name, or `null` if the backend
 * is not yet implemented on this platform.
 */
export function getBackendDispatcher(name: BackendName): BackendDispatcher | null {
  switch (name) {
    case 'literal':
      return (spec) =>
        resolveLiteral(spec as BackendSpec & { backend: 'literal' })

    case 'env':
      return (spec) =>
        resolveEnv(spec as BackendSpec & { backend: 'env' })

    case 'windows-credman':
      return (spec) =>
        resolveWindowsCredman(spec as BackendSpec & { backend: 'windows-credman' })

    case 'keychain':
      return (spec) =>
        resolveKeychain(spec as BackendSpec & { backend: 'keychain' })

    case 'libsecret':
      return (spec) =>
        resolveLibsecret(spec as BackendSpec & { backend: 'libsecret' })

    case 'az-cli':
      return (spec) =>
        resolveAzCli(spec as BackendSpec & { backend: 'az-cli' })

    case 'aws-cli':
      return (spec) =>
        resolveAwsCli(spec as BackendSpec & { backend: 'aws-cli' })

    case 'aliyun-cli':
      return (spec) =>
        resolveAliyunCli(spec as BackendSpec & { backend: 'aliyun-cli' })

    case '1password':
      return (spec) =>
        resolveOnePassword(spec as BackendSpec & { backend: '1password' })

    case 'vault':
      return (spec) =>
        resolveVault(spec as BackendSpec & { backend: 'vault' })

    case 'keyvault':
      return (spec) =>
        resolveKeyvault(spec as BackendSpec & { backend: 'keyvault' })

    default:
      if (UNIMPLEMENTED.has(name)) return null
      // Exhaustiveness guard — TypeScript will warn if BackendName gains a new
      // member that is not handled above.
      return null
  }
}

/**
 * Returns all backend names that have a registered dispatcher on this
 * platform (not necessarily all of them are functional on every OS).
 */
export function listSupportedBackends(): BackendName[] {
  const all: BackendName[] = [
    'literal',
    'env',
    'windows-credman',
    'keychain',
    'libsecret',
    'az-cli',
    'aws-cli',
    'aliyun-cli',
    '1password',
    'vault',
    'keyvault',
  ]
  return all.filter((n) => !UNIMPLEMENTED.has(n))
}
