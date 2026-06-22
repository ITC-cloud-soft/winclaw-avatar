import type { Buffer } from 'buffer'
import { isInBundledMode } from '../../utils/bundledMode.js'
import { logError } from '../../utils/log.js'

export type SharpInstance = {
  metadata(): Promise<{ width: number; height: number; format: string }>
  resize(
    width: number,
    height: number,
    options?: { fit?: string; withoutEnlargement?: boolean },
  ): SharpInstance
  jpeg(options?: { quality?: number }): SharpInstance
  png(options?: {
    compressionLevel?: number
    palette?: boolean
    colors?: number
  }): SharpInstance
  webp(options?: { quality?: number }): SharpInstance
  toBuffer(): Promise<Buffer>
}

export type SharpFunction = (input: Buffer) => SharpInstance

type SharpCreatorOptions = {
  create: {
    width: number
    height: number
    channels: 3 | 4
    background: { r: number; g: number; b: number }
  }
}

type SharpCreator = (options: SharpCreatorOptions) => SharpInstance

/**
 * Sentinel error thrown when sharp/native image processor cannot be loaded
 * or invoked. Kept deliberately short so callers can surface a one-line
 * message to the AI without bloating conversation context with a stack trace.
 *
 * Session-scoped failure counter + block gate prevent repeated retries that
 * would otherwise emit many full stack traces and risk triggering context
 * overflow / orphan tool_use cascades.
 */
export class SharpUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SharpUnavailableError'
  }
}

// Session-scoped counter + gate. Resets only on process restart (by design).
let sharpFailureCount = 0
let sharpBlocked = false
const MAX_SHARP_FAILURES = 2
let firstFailureLogged = false

/**
 * Record a sharp failure. Exported so post-load runtime TypeErrors from
 * imageResizer.ts can route through the same counter/block machinery.
 * Idempotent: full stack logged only on first failure; subsequent failures
 * get a one-line console.warn (no AI-context pollution).
 */
export function recordSharpFailure(err: unknown): void {
  sharpFailureCount++
  // Full stack to diagnostic log on first failure ONLY (for triage).
  // Subsequent failures get a short one-line warn via console to avoid log bloat.
  if (!firstFailureLogged) {
    firstFailureLogged = true
    try {
      logError(err as Error)
    } catch {
      // ignore — diagnostic logging must never itself cascade
    }
  }
  const firstLine = (err as Error)?.message?.split('\n')[0] ?? 'unknown'
  // biome-ignore lint/suspicious/noConsole: intentional short warn
  console.warn(
    `image processor unavailable (${sharpFailureCount}/${MAX_SHARP_FAILURES}): ${firstLine}`,
  )
  if (sharpFailureCount >= MAX_SHARP_FAILURES) {
    sharpBlocked = true
    // biome-ignore lint/suspicious/noConsole: intentional short warn
    console.warn(
      'image processor blocked for session — image processing disabled until restart',
    )
  }
}

/** Exposed for callers that want to short-circuit without calling getImageProcessor(). */
export function isSharpBlocked(): boolean {
  return sharpBlocked
}

/** Test/dev helper — resets session state. Not used at runtime. */
export function resetSharpBlockForTesting(): void {
  sharpFailureCount = 0
  sharpBlocked = false
  firstFailureLogged = false
  imageProcessorModule = null
  imageCreatorModule = null
}

let imageProcessorModule: { default: SharpFunction } | null = null
let imageCreatorModule: { default: SharpCreator } | null = null

export async function getImageProcessor(): Promise<SharpFunction> {
  if (imageProcessorModule) {
    return imageProcessorModule.default
  }

  if (sharpBlocked) {
    throw new SharpUnavailableError(
      'image processing unavailable on this platform (blocked after repeated native load failures)',
    )
  }

  if (isInBundledMode()) {
    // Try to load the native image processor first
    try {
      // Use the native image processor module
      const imageProcessor = await import('image-processor-napi')
      const sharp = imageProcessor.sharp || imageProcessor.default
      if (typeof sharp !== 'function') {
        throw new Error('image-processor-napi did not export a function')
      }
      imageProcessorModule = { default: sharp }
      return sharp
    } catch {
      // Fall back to sharp if native module is not available
      // biome-ignore lint/suspicious/noConsole: intentional warning
      console.warn(
        'Native image processor not available, falling back to sharp',
      )
    }
  }

  // Use sharp for non-bundled builds or as fallback.
  // Single structural cast: our SharpFunction is a subset of sharp's actual type surface.
  try {
    const imported = (await import(
      'sharp'
    )) as unknown as MaybeDefault<SharpFunction>
    const sharp = unwrapDefault(imported)
    if (typeof sharp !== 'function') {
      // sharp's JS wrapper loaded but the native binding is missing — this is
      // the exact production failure mode (DLOPEN_FAILED on win32-x64 where the
      // runtime message is "sharp is not a function").
      throw new SharpUnavailableError(
        'sharp native binding not loaded (module exported non-function)',
      )
    }
    imageProcessorModule = { default: sharp }
    return sharp
  } catch (err) {
    recordSharpFailure(err)
    throw new SharpUnavailableError(
      'image processing unavailable on this platform (sharp/native failed to load)',
    )
  }
}

/**
 * Get image creator for generating new images from scratch.
 * Note: image-processor-napi doesn't support image creation,
 * so this always uses sharp directly.
 */
export async function getImageCreator(): Promise<SharpCreator> {
  if (imageCreatorModule) {
    return imageCreatorModule.default
  }

  if (sharpBlocked) {
    throw new SharpUnavailableError(
      'image creation unavailable (sharp blocked for this session)',
    )
  }

  try {
    const imported = (await import(
      'sharp'
    )) as unknown as MaybeDefault<SharpCreator>
    const sharp = unwrapDefault(imported)
    if (typeof sharp !== 'function') {
      throw new SharpUnavailableError(
        'sharp native binding not loaded (module exported non-function)',
      )
    }
    imageCreatorModule = { default: sharp }
    return sharp
  } catch (err) {
    recordSharpFailure(err)
    throw new SharpUnavailableError(
      'image creation unavailable on this platform (sharp failed to load)',
    )
  }
}

// Dynamic import shape varies by module interop mode — ESM yields { default: fn }, CJS yields fn directly.
type MaybeDefault<T> = T | { default: T }

function unwrapDefault<T extends (...args: never[]) => unknown>(
  mod: MaybeDefault<T>,
): T {
  return typeof mod === 'function' ? mod : mod.default
}
