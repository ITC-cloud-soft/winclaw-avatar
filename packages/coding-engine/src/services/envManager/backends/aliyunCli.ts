import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { BackendSpec, ResolveResult } from '../types.js'
import { getCached, setCached, parseTtl } from '../cache.js'

// ---------------------------------------------------------------------------
// Aliyun CLI config file resolver
// Reads ~/.aliyun/config.json directly — no shell call needed.
// ---------------------------------------------------------------------------

/**
 * Schema for a single profile entry inside ~/.aliyun/config.json.
 */
interface AliyunProfile {
  name: string
  mode: string
  access_key_id: string
  access_key_secret: string
  [key: string]: unknown
}

/**
 * Top-level schema for ~/.aliyun/config.json.
 */
interface AliyunConfig {
  current?: string
  profiles?: AliyunProfile[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILE_MISSING_HINT =
  "~/.aliyun/config.json not found; run 'aliyun configure' to set up a profile"

/**
 * Resolves the Aliyun access_key_id from the local Aliyun CLI config file
 * (~/.aliyun/config.json).
 *
 * Spec fields:
 *   - `profile` — profile name to look up (default: value of `"current"` key)
 *
 * The resolved value is always `access_key_id` from the matching profile.
 * If you need `access_key_secret`, use a different backend (keyvault, 1password,
 * or literal) for that field.
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 *
 * HOME / USERPROFILE can be overridden in tests to point to a temp directory.
 */
export async function resolveAliyunCli(
  spec: BackendSpec & { backend: 'aliyun-cli' },
): Promise<ResolveResult> {
  // Use the profile name as both cache key discriminator and lookup key.
  // The actual profile name is resolved after reading the file; we defer
  // cache key construction to after we know the resolved profile name.

  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? homedir()
  const configPath = join(home, '.aliyun', 'config.json')

  let raw: string
  try {
    raw = readFileSync(configPath, 'utf8')
  } catch {
    return {
      ok: false,
      key: spec.profile ?? 'current',
      kind: 'secret',
      reason: 'backend-failed',
      detail: FILE_MISSING_HINT,
    }
  }

  let config: AliyunConfig
  try {
    config = JSON.parse(raw) as AliyunConfig
  } catch {
    return {
      ok: false,
      key: spec.profile ?? 'current',
      kind: 'secret',
      reason: 'backend-failed',
      detail: `~/.aliyun/config.json is not valid JSON`,
    }
  }

  // Determine which profile name to use.
  const profileName = spec.profile ?? config.current ?? 'default'

  const cacheKey = `aliyun-cli:${profileName}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  const profiles = config.profiles ?? []
  const profile = profiles.find((p) => p.name === profileName)

  if (profile === undefined) {
    return {
      ok: false,
      key: profileName,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Aliyun CLI profile "${profileName}" not found in ~/.aliyun/config.json`,
    }
  }

  const value = profile.access_key_id
  if (!value || value.trim() === '') {
    return {
      ok: false,
      key: profileName,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Profile "${profileName}" has no access_key_id`,
    }
  }

  setCached(cacheKey, value.trim(), ttlMs)
  return { ok: true, value: value.trim() }
}
