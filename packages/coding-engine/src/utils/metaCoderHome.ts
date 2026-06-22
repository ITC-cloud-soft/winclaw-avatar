/**
 * Meta Coder user home directory utilities.
 */

import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function getMetaCoderHome(): string {
  return process.env.META_CODER_HOME ?? join(homedir(), '.meta-coder')
}

export function getSystestResourceDir(): string {
  return join(getMetaCoderHome(), 'systest')
}

export function ensureMetaCoderHome(): string {
  const home = getMetaCoderHome()
  try { mkdirSync(home, { recursive: true }) } catch {}
  return home
}

export function ensureSystestDirectories(): string {
  const base = ensureMetaCoderHome()
  const dirs = [
    join(base, 'systest'),
    join(base, 'systest', 'bestpractices'),
    join(base, 'systest', 'config'),
    join(base, 'systest', 'prompts'),
    join(base, 'systest', 'templates'),
    join(base, 'systest', 'bestpractices', '_custom'),
  ]
  for (const dir of dirs) {
    try { mkdirSync(dir, { recursive: true }) } catch {}
  }
  return join(base, 'systest')
}
