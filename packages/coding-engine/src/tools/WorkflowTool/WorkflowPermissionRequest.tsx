import React from 'react'

/**
 * Stub: Workflow permission request UI component.
 */
export function WorkflowPermissionRequest({
  toolName,
  onAllow,
  onDeny,
}: {
  toolName: string
  onAllow: () => void
  onDeny: () => void
}): React.ReactElement {
  return React.createElement(
    'div',
    null,
    `Allow workflow tool "${toolName}"? `,
    React.createElement('button', { onClick: onAllow }, 'Allow'),
    React.createElement('button', { onClick: onDeny }, 'Deny'),
  )
}
