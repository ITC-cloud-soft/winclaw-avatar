import { exec, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const execAsync = promisify(exec)

export interface ApiClientGenResult {
  ok: boolean
  outputPath?: string          // generated apiTypes.ts path
  typeCount?: number           // rough count of generated types
  specSize?: number            // bytes of openapi.json
  reason?: string              // on failure
  stdout?: string              // tail for diagnostics
}

export interface BackendLaunchConfig {
  workspace: string
  backendDir?: string          // default: workspace/backend, fallback workspace
  lang: 'python' | 'typescript' | 'java' | 'go' | 'php' | 'unknown'
  port?: number                // default 8999
  healthPath?: string          // default /openapi.json
  startupTimeoutMs?: number    // default 20_000
}

/**
 * Generate a typed TS client from the running backend's OpenAPI spec.
 * Temporary launches the backend, fetches spec, runs openapi-typescript, then kills backend.
 */
export async function generateApiClient(cfg: BackendLaunchConfig): Promise<ApiClientGenResult> {
  const workspace = cfg.workspace.replace(/\\/g, '/')
  const backendDir = (cfg.backendDir || detectBackendDir(workspace)).replace(/\\/g, '/')
  const port = cfg.port || 8999
  const healthPath = cfg.healthPath || '/openapi.json'
  const startupTimeoutMs = cfg.startupTimeoutMs || 20_000

  // Build launch command per lang
  const launchCmd = buildLaunchCommand(cfg.lang, port, backendDir)
  if (!launchCmd) {
    return { ok: false, reason: `No launch command for lang=${cfg.lang}` }
  }

  let proc: ChildProcess | null = null
  try {
    // Launch backend in background
    proc = spawn(launchCmd.shell, launchCmd.args, {
      cwd: backendDir,
      env: { ...process.env, PORT: String(port) },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    // Poll /openapi.json until reachable or timeout
    const spec = await pollForSpec(`http://127.0.0.1:${port}${healthPath}`, startupTimeoutMs)
    if (!spec) {
      return { ok: false, reason: `Backend did not respond at :${port}${healthPath} within ${startupTimeoutMs/1000}s` }
    }

    // Write spec to a tmp file
    const tmpDir = join(workspace, '.meta-coder-tmp')
    try { mkdirSync(tmpDir, { recursive: true }) } catch {}
    const specPath = join(tmpDir, 'openapi.json')
    writeFileSync(specPath, spec)

    // Run openapi-typescript via npx. The frontend/ dir may or may not have it installed;
    // npx will download it on-demand (--yes) if missing.
    const outDir = join(workspace, 'frontend', 'src', 'lib')
    try { mkdirSync(outDir, { recursive: true }) } catch {}
    const outPath = join(outDir, 'apiTypes.ts')

    // Try via existing frontend node_modules first (faster), then fall back to npx
    const frontendDir = join(workspace, 'frontend')
    const cmds: Array<{ cmd: string, cwd: string }> = [
      { cmd: `npx --yes openapi-typescript "${specPath}" -o "${outPath}"`, cwd: frontendDir },
      { cmd: `npx --yes openapi-typescript "${specPath}" -o "${outPath}"`, cwd: workspace },
    ]
    let lastErr = ''
    let generated = false
    for (const c of cmds) {
      if (!existsSync(c.cwd)) continue
      try {
        const r = await execAsync(c.cmd, { cwd: c.cwd, timeout: 120_000, windowsHide: true, maxBuffer: 20_000_000 })
        if (existsSync(outPath)) {
          generated = true
          break
        }
        lastErr = (r.stderr || '').slice(-1000) || 'no output'
      } catch (e) {
        lastErr = e instanceof Error ? (e.message + '\n' + ((e as any).stderr || '')).slice(-1000) : String(e)
      }
    }
    if (!generated) {
      return { ok: false, reason: 'openapi-typescript generation failed: ' + lastErr }
    }

    // Count types (rough: export statements)
    const content = readFileSync(outPath, 'utf-8')
    const typeCount = (content.match(/^export (?:interface|type|namespace)\b/gm) || []).length

    return {
      ok: true,
      outputPath: outPath,
      typeCount,
      specSize: spec.length,
    }
  } catch (e) {
    return { ok: false, reason: 'generator error: ' + (e instanceof Error ? e.message : String(e)) }
  } finally {
    // Kill backend process (best effort). BUG-D FIX: await the kill so the
    // function doesn't resolve while SIGKILL is still pending — caller exit
    // could orphan the child.
    if (proc && !proc.killed) {
      try {
        if (process.platform === 'win32') {
          try { await execAsync(`taskkill /F /PID ${proc.pid} /T`, { timeout: 5000 }) } catch {}
        } else {
          const p = proc
          await new Promise<void>(resolve => {
            let resolved = false
            const done = () => { if (!resolved) { resolved = true; resolve() } }
            p.once('exit', done)
            try { p.kill('SIGTERM') } catch { done(); return }
            // Escalate to SIGKILL after 3s if still alive
            setTimeout(() => {
              try { if (!p.killed) p.kill('SIGKILL') } catch {}
              // Don't wait forever for SIGKILL either
              setTimeout(done, 500)
            }, 3000)
          })
        }
      } catch {}
    }
  }
}

export function detectBackendDir(workspace: string): string {
  const b = join(workspace, 'backend')
  if (existsSync(b)) return b
  return workspace
}

function buildLaunchCommand(
  lang: string,
  port: number,
  backendDir: string
): { shell: string, args: string[] } | null {
  // For TS/JS backends, `npm run dev` is usually the FRONTEND dev server (Vite/Next).
  // Prefer explicit backend scripts when present. Fallback is server.ts / index.ts.
  const tsBackendCmd = detectTsBackendScript(backendDir, port)

  if (process.platform === 'win32') {
    switch (lang) {
      case 'python':
        return { shell: 'cmd.exe', args: ['/c', `python -m uvicorn src.main:app --host 127.0.0.1 --port ${port} --log-level warning`] }
      case 'typescript':
      case 'javascript':
        return { shell: 'cmd.exe', args: ['/c', tsBackendCmd] }
      case 'java':
        return { shell: 'cmd.exe', args: ['/c', `mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=${port}`] }
      case 'go':
        return { shell: 'cmd.exe', args: ['/c', `set PORT=${port}&& go run ./cmd/...`] }
      case 'php':
        return { shell: 'cmd.exe', args: ['/c', `php -S 127.0.0.1:${port} -t public`] }
      default: return null
    }
  } else {
    switch (lang) {
      case 'python':
        return { shell: 'sh', args: ['-c', `python -m uvicorn src.main:app --host 127.0.0.1 --port ${port} --log-level warning`] }
      case 'typescript':
      case 'javascript':
        return { shell: 'sh', args: ['-c', tsBackendCmd] }
      case 'java':
        return { shell: 'sh', args: ['-c', `mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=${port}`] }
      case 'go':
        return { shell: 'sh', args: ['-c', `PORT=${port} go run ./cmd/...`] }
      case 'php':
        return { shell: 'sh', args: ['-c', `php -S 127.0.0.1:${port} -t public`] }
      default: return null
    }
  }
}

/**
 * BUG-B FIX: TS/JS backend detection.
 * `npm run dev` is almost always the frontend. Check package.json for explicit
 * backend scripts OR fall back to running a detected entrypoint directly.
 */
function detectTsBackendScript(backendDir: string, port: number): string {
  const envPrefix = process.platform === 'win32' ? `set PORT=${port}&& ` : `PORT=${port} `
  try {
    const pkgPath = join(backendDir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const scripts = pkg.scripts || {}
      // Priority order — backend-specific scripts first, then generic
      for (const name of ['start:api', 'start:server', 'start:backend', 'server', 'api', 'serve']) {
        if (scripts[name]) return `${envPrefix}npm run ${name}`
      }
      // "start" is ambiguous but usually runs the server in production-style
      if (scripts.start) return `${envPrefix}npm start`
      // Only use dev as last resort — may be frontend
      if (scripts.dev) return `${envPrefix}npm run dev`
    }
  } catch {}
  // Fallback: detect entrypoint files
  for (const entry of ['src/server.ts', 'src/index.ts', 'src/main.ts', 'server.ts', 'index.ts']) {
    if (existsSync(join(backendDir, entry))) {
      return `${envPrefix}npx tsx ${entry}`
    }
  }
  return `${envPrefix}npm start`
}

async function pollForSpec(url: string, timeoutMs: number): Promise<string | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const text = await res.text()
        // Validate it's JSON
        try { JSON.parse(text); return text } catch { /* not ready yet */ }
      }
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 1000))
  }
  return null
}
