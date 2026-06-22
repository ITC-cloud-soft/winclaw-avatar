/**
 * Loader and resolver for the Meta Coder Infra Environment Manager.
 *
 * Handles reading, parsing, and validating:
 *   - <workspace>/.metacoder/environments.yaml  (Layer 1)
 *   - ~/.metacoder/projects/<id>/infra.yaml       (Layer 2, with fallback)
 *   - <workspace>/<relPath>  verified-state.yaml  (Layer 1.5, optional)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import YAML from 'yaml'
import {
  type Env,
  type EnvironmentsFile,
  type InfraFile,
  type VerifiedStateFile,
  EnvManagerError,
} from './types.js'
import { computeProjectId } from './projectId.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read a file as UTF-8; return null if missing, throw on other errors. */
function readFileMaybe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Parse YAML text; wrap errors as EnvManagerError. */
function parseYaml<T>(text: string, filePath: string): T {
  try {
    return YAML.parse(text) as T
  } catch (err: unknown) {
    throw new EnvManagerError(
      `Failed to parse YAML at ${filePath}: ${String(err)}`,
      'parse-error',
      err,
    )
  }
}

// ---------------------------------------------------------------------------
// Circular-extends detection
// ---------------------------------------------------------------------------

/** DFS walk to detect cycles in extends chains. Throws circular-extends if found. */
function detectCircular(
  envName: string,
  all: Env[],
  visiting: Set<string> = new Set(),
): void {
  if (visiting.has(envName)) {
    throw new EnvManagerError(
      `Circular extends detected involving env "${envName}"`,
      'circular-extends',
      { chain: [...visiting, envName] },
    )
  }
  const env = all.find(e => e.name === envName)
  if (!env?.extends) return
  visiting.add(envName)
  detectCircular(env.extends, all, visiting)
  visiting.delete(envName)
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/** Validate the parsed EnvironmentsFile; throws EnvManagerError on any violation. */
function validateEnvironmentsFile(file: unknown, filePath: string): EnvironmentsFile {
  if (typeof file !== 'object' || file === null) {
    throw new EnvManagerError(
      `${filePath}: expected a YAML object at the root`,
      'parse-error',
    )
  }
  const raw = file as Record<string, unknown>

  // version check
  if (raw['version'] !== 2) {
    throw new EnvManagerError(
      `${filePath}: "version" must be 2 (got ${String(raw['version'])})`,
      'schema-violation',
    )
  }

  if (typeof raw['default'] !== 'string' || !raw['default']) {
    throw new EnvManagerError(
      `${filePath}: "default" field is required and must be a non-empty string`,
      'schema-violation',
    )
  }

  if (!Array.isArray(raw['environments'])) {
    throw new EnvManagerError(
      `${filePath}: "environments" must be an array`,
      'schema-violation',
    )
  }

  const environments = raw['environments'] as unknown[]
  for (let i = 0; i < environments.length; i++) {
    const e = environments[i] as Record<string, unknown>
    if (typeof e['name'] !== 'string' || !e['name']) {
      throw new EnvManagerError(
        `${filePath}: environments[${i}] missing required "name"`,
        'schema-violation',
      )
    }
    if (typeof e['cloud'] !== 'object' || e['cloud'] === null) {
      throw new EnvManagerError(
        `${filePath}: env "${String(e['name'])}" missing required "cloud"`,
        'schema-violation',
      )
    }
    if (typeof e['safety'] !== 'object' || e['safety'] === null) {
      throw new EnvManagerError(
        `${filePath}: env "${String(e['name'])}" missing required "safety"`,
        'schema-violation',
      )
    }
  }

  const envs = environments as Env[]
  const names = new Set(envs.map(e => e.name))

  // default env must exist
  if (!names.has(raw['default'] as string)) {
    throw new EnvManagerError(
      `${filePath}: "default" env "${raw['default'] as string}" not found in environments[]`,
      'schema-violation',
    )
  }

  // circular extends check
  for (const env of envs) {
    detectCircular(env.name, envs)
  }

  // production + tested=false check
  for (const env of envs) {
    const tags: unknown[] = Array.isArray(env.tags) ? env.tags : []
    if (tags.includes('production') && env.deploy?.tested === false) {
      throw new EnvManagerError(
        `Env "${env.name}" is tagged production but deploy.tested is false`,
        'untested-skill-on-prod',
        { env: env.name },
      )
    }
  }

  return {
    version: 2,
    default: raw['default'] as string,
    environments: envs,
  }
}

// ---------------------------------------------------------------------------
// Public: loadEnvironments
// ---------------------------------------------------------------------------

/**
 * Load and validate <workspace>/.metacoder/environments.yaml.
 * Throws `EnvManagerError` if the file is missing or invalid.
 */
export async function loadEnvironments(workspacePath: string): Promise<EnvironmentsFile> {
  const filePath = path.join(workspacePath, '.metacoder', 'environments.yaml')
  const text = readFileMaybe(filePath)
  if (text === null) {
    throw new EnvManagerError(
      `environments.yaml not found at ${filePath}. ` +
        `Create a .metacoder/environments.yaml with version: 2 to use env operations.`,
      'parse-error',
    )
  }
  const raw = parseYaml<unknown>(text, filePath)
  return validateEnvironmentsFile(raw, filePath)
}

// ---------------------------------------------------------------------------
// Public: resolveEnvByName
// ---------------------------------------------------------------------------

/**
 * Look up an env by name; throws `unknown-env` if not found.
 */
export function resolveEnvByName(env: string, file: EnvironmentsFile): Env {
  const found = file.environments.find(e => e.name === env)
  if (!found) {
    throw new EnvManagerError(
      `Unknown environment "${env}". Available: ${file.environments.map(e => e.name).join(', ')}`,
      'unknown-env',
      { requested: env },
    )
  }
  return found
}

// ---------------------------------------------------------------------------
// Public: resolveExtendsChain
// ---------------------------------------------------------------------------

/** Recursively deep-merge src INTO dst (child overrides parent). Arrays are replaced. */
function deepMerge(dst: Record<string, unknown>, src: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...dst }
  for (const key of Object.keys(src)) {
    const srcVal = src[key]
    const dstVal = result[key]
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      dstVal !== null &&
      typeof dstVal === 'object' &&
      !Array.isArray(dstVal)
    ) {
      result[key] = deepMerge(
        dstVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      )
    } else {
      // arrays and primitives: child replaces
      result[key] = srcVal
    }
  }
  return result
}

/**
 * Resolve the full extends chain for an env, returning a merged Env.
 *
 * Semantics:
 * - Walk `extends:` recursively (max 10 levels).
 * - Deep-merge child INTO parent; child overrides parent.
 * - Arrays (including tags) are replaced, not concatenated.
 */
export function resolveExtendsChain(env: Env, all: Env[]): Env {
  const MAX_DEPTH = 10

  /**
   * Build the ancestor list walking from `node` up to the root.
   * Returns [node, parent, grandparent, ..., root] — leaf first.
   */
  function buildChain(node: Env, seen: Set<string>): Env[] {
    if (seen.has(node.name)) {
      throw new EnvManagerError(
        `Circular extends detected involving env "${node.name}"`,
        'circular-extends',
        { chain: [...seen, node.name] },
      )
    }
    if (seen.size >= MAX_DEPTH) {
      throw new EnvManagerError(
        `extends chain exceeds max depth of ${MAX_DEPTH} for env "${env.name}"`,
        'circular-extends',
      )
    }
    if (!node.extends) return [node]

    const parentName = node.extends
    const parent = all.find(e => e.name === parentName)
    if (!parent) {
      throw new EnvManagerError(
        `Env "${node.name}" extends unknown env "${parentName}"`,
        'unknown-env',
        { requested: parentName },
      )
    }
    seen.add(node.name)
    return [node, ...buildChain(parent, seen)]
  }

  // chain[0] = env (leaf), chain[last] = root ancestor
  const chain = buildChain(env, new Set())

  // Merge root → ... → leaf: start with root, progressively apply each child
  // so the leaf (original env) wins on conflicts.
  let merged: Record<string, unknown> = { ...(chain[chain.length - 1] as Record<string, unknown>) }
  for (let i = chain.length - 2; i >= 0; i--) {
    merged = deepMerge(merged, chain[i] as Record<string, unknown>)
  }

  // strip `extends` from the resolved result
  const { extends: _ext, ...rest } = merged as Env & { extends?: string }
  return rest as Env
}

// ---------------------------------------------------------------------------
// Public: loadInfraFile
// ---------------------------------------------------------------------------

/**
 * Load ~/.metacoder/projects/<projectId>/infra.yaml.
 * Falls back to ~/.metacoder/infra.yaml.
 * Returns empty `{ version: 2 }` if both are missing.
 */
export async function loadInfraFile(workspacePath: string): Promise<InfraFile> {
  const projectDir = path.join(
    os.homedir(),
    '.metacoder',
    'projects',
    computeProjectId(workspacePath),
  )
  const projectPath = path.join(projectDir, 'infra.yaml')
  const userPath = path.join(os.homedir(), '.metacoder', 'infra.yaml')

  const projectText = readFileMaybe(projectPath)
  if (projectText !== null) {
    return parseYaml<InfraFile>(projectText, projectPath)
  }

  const userText = readFileMaybe(userPath)
  if (userText !== null) {
    return parseYaml<InfraFile>(userText, userPath)
  }

  // both missing — return empty valid InfraFile
  return { version: 2 }
}

// ---------------------------------------------------------------------------
// Public: loadVerifiedState
// ---------------------------------------------------------------------------

/**
 * Load a verified-state.yaml at the given path relative to the workspace.
 * Returns null if the file does not exist.
 */
export async function loadVerifiedState(
  workspacePath: string,
  relPath: string,
): Promise<VerifiedStateFile | null> {
  const filePath = path.resolve(workspacePath, relPath)
  const text = readFileMaybe(filePath)
  if (text === null) return null
  return parseYaml<VerifiedStateFile>(text, filePath)
}
