// Stub file for SDK tool types
export type ToolInput = Record<string, unknown>

export type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export type ToolResult = {
  content: ToolResultContent[]
  isError?: boolean
}
