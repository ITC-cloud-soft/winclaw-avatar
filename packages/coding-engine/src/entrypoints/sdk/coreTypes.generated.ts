// Stub generated types file - auto-generated from coreSchemas.ts
// In the real build, this is produced by scripts/generate-sdk-types.ts

export type ModelUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export type OutputFormatType = 'json_schema'

export type BaseOutputFormat = {
  type: OutputFormatType
  name: string
}

export type JsonSchemaOutputFormat = BaseOutputFormat & {
  schema: Record<string, unknown>
  strict?: boolean
}

export type OutputFormat = JsonSchemaOutputFormat

export type ApiKeySource = 'user' | 'project' | 'org' | 'temporary' | 'oauth'

export type ConfigScope = 'local' | 'user' | 'project'

export type SdkBeta = string

export type ThinkingAdaptive = {
  type: 'auto'
  budget_tokens?: number
}

export type ThinkingEnabled = {
  type: 'enabled'
  budget_tokens: number
}

export type ThinkingDisabled = {
  type: 'disabled'
}

export type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled

export type McpStdioServerConfig = {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type McpSSEServerConfig = {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpHttpServerConfig = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type McpSdkServerConfig = {
  type: 'sdk'
  name: string
}

export type McpServerConfigForProcessTransport = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig

export type McpClaudeAIProxyServerConfig = {
  type: 'claude_ai_proxy'
  url: string
  id: string
}

export type McpServerStatusConfig = McpServerConfigForProcessTransport | McpClaudeAIProxyServerConfig

export type McpServerStatus = {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  tools?: Array<{ name: string; description?: string }>
  version?: { name: string; version: string }
  experimental?: Record<string, unknown>
}

export type McpSetServersResult = {
  added: string[]
  removed: string[]
  errors: Record<string, string>
}

export type PermissionUpdateDestination = 'local' | 'project' | 'user' | 'session'

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

export type PermissionRuleValue = {
  toolName: string
  ruleContent?: string
}

export type PermissionUpdate =
  | { type: 'add_allow'; rule: PermissionRuleValue }
  | { type: 'add_deny'; rule: PermissionRuleValue }
  | { type: 'remove_allow'; rule: PermissionRuleValue }
  | { type: 'remove_deny'; rule: PermissionRuleValue }
  | { type: 'add_allowed_directories'; directories: string[] }
  | { type: 'remove_allowed_directories'; directories: string[] }

export type PermissionDecisionClassification = {
  decision: 'allow' | 'deny'
  permanent: boolean
  scope: PermissionUpdateDestination
}

export type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown>; toolUseID?: string }
  | { behavior: 'deny'; message: string; toolUseID?: string }

export type SDKPermissionDenial = {
  tool_name: string
  tool_use_id: string
  tool_input: Record<string, unknown>
}

export type SDKRateLimitInfo = {
  status: 'allowed' | 'allowed_warning' | 'rejected'
  resetsAt?: number
  rateLimitType?: string
  utilization?: number
  overageStatus?: 'allowed' | 'allowed_warning' | 'rejected'
  overageResetsAt?: number
  isUsingOverage?: boolean
  surpassedThreshold?: number
}

export type FastModeState = 'off' | 'cooldown' | 'on'

export type SDKResultSuccess = {
  type: 'result'
  subtype: 'success'
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
  result: string
  stop_reason: string | null
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  modelUsage: Record<string, ModelUsage>
  permission_denials: SDKPermissionDenial[]
  structured_output?: unknown
  fast_mode_state?: FastModeState
  uuid: string
  session_id: string
}

export type SDKResultError = {
  type: 'result'
  subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries'
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
  stop_reason: string | null
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  modelUsage: Record<string, ModelUsage>
  permission_denials: SDKPermissionDenial[]
  errors: string[]
  fast_mode_state?: FastModeState
  uuid: string
  session_id: string
}

export type SDKResultMessage = SDKResultSuccess | SDKResultError

export type SDKUserMessage = {
  type: 'user'
  message: unknown
  parent_tool_use_id: string | null
  isSynthetic?: boolean
  tool_use_result?: unknown
  priority?: 'now' | 'next' | 'later'
  timestamp?: string
  uuid?: string
  session_id?: string
}

export type SDKUserMessageReplay = SDKUserMessage & {
  uuid: string
  session_id: string
  isReplay: true
}

export type SDKAssistantMessage = {
  type: 'assistant'
  message: unknown
  parent_tool_use_id: string | null
  error?: unknown
  uuid: string
  session_id: string
}

export type SDKSystemMessage = {
  type: 'system'
  subtype: 'init'
  agents?: string[]
  apiKeySource: ApiKeySource
  betas?: string[]
  claude_code_version: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{ name: string }>
  uuid: string
  session_id: string
}

export type SDKStatusMessage = {
  type: 'status'
  status: string
  uuid: string
  session_id: string
}

export type SDKRateLimitEvent = {
  type: 'rate_limit_event'
  rate_limit_info: SDKRateLimitInfo
  uuid: string
  session_id: string
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKStatusMessage
  | SDKRateLimitEvent

export type SDKSessionInfo = {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  createdAt?: number
}
