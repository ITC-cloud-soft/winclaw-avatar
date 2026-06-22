// Stub runtime types file (non-serializable types: callbacks, interfaces)
import type { z } from 'zod/v4'
import type { SDKMessage, SDKResultMessage, SDKSessionInfo, SDKUserMessage } from './coreTypes.generated.js'

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type AnyZodRawShape = Record<string, z.ZodTypeAny>

export type InferShape<T extends AnyZodRawShape> = {
  [K in keyof T]: z.infer<T[K]>
}

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
}

export type McpSdkServerConfigWithInstance = {
  type: 'sdk'
  name: string
  instance?: unknown
}

export type Options = {
  model?: string
  maxTurns?: number
  cwd?: string
  systemPrompt?: string
  appendSystemPrompt?: string
  tools?: unknown[]
  mcpServers?: Record<string, unknown>
  permissionMode?: string
  maxTokens?: number
  thinking?: unknown
  outputFormat?: 'text' | 'json' | 'stream-json'
  verbose?: boolean
  abortSignal?: AbortSignal
}

export type InternalOptions = Options & {
  _internal?: unknown
}

export type Query = AsyncIterable<SDKMessage> & {
  abort?: () => void
}

export type InternalQuery = Query

export type SDKSessionOptions = Options & {
  sessionId?: string
}

export type SDKSession = {
  sessionId: string
  prompt(message: string | SDKUserMessage): Query
  abort(): void
}

export type SessionMessage = {
  role: 'user' | 'assistant'
  content: unknown
  uuid: string
  parentUuid?: string
  timestamp?: string
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type SessionMutationOptions = {
  dir?: string
}

export type ForkSessionOptions = {
  dir?: string
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}
