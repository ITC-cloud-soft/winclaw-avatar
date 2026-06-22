// Build-time macros shim for development mode
// In production, these are inlined by Bun's bundler via `define`

declare global {
  const MACRO: {
    VERSION: string
    PACKAGE_URL: string
    NATIVE_PACKAGE_URL: string | null
    BUILD_TIME: string | null
    ISSUES_EXPLAINER: string
    FEEDBACK_CHANNEL: string
    VERSION_CHANGELOG: string | null
  }
}

;(globalThis as any).MACRO = {
  VERSION: '0.1.0-dev',
  PACKAGE_URL: '@anthropic-ai/claude-code',
  NATIVE_PACKAGE_URL: null,
  BUILD_TIME: null,
  ISSUES_EXPLAINER: 'report the issue at https://github.com/anthropics/claude-code/issues',
  FEEDBACK_CHANNEL: '#claude-code-feedback',
  VERSION_CHANGELOG: null,
}

export {}
