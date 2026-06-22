// Stub: systemThemeWatcher — watches terminal theme changes for 'auto' theme

import type { SystemTheme } from './systemTheme.js'

export function watchSystemTheme(
  _querier: unknown,
  _setSystemTheme: (theme: SystemTheme) => void,
): () => void {
  // Return no-op cleanup
  return () => {}
}
