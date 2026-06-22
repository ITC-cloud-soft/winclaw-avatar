// Stub: commands/assistant/assistant — assistant install wizard
import React from 'react'

export function NewInstallWizard(_props: {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
}): React.ReactElement | null {
  return null
}

export async function computeDefaultInstallDir(): Promise<string> {
  return ''
}
