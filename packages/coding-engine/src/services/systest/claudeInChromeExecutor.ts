/**
 * Claude in Chrome Executor
 * 
 * Executes API and UI tests using Claude in Chrome MCP tools.
 * Provides a unified interface for browser automation and network testing.
 * 
 * Enhanced with:
 * - Retry logic with exponential backoff for transient errors
 * - Detailed error categorization and recovery suggestions
 * - Partial success recording
 */
import { connectToServer } from '../mcp/client.js'
import { CLAUDE_IN_CHROME_MCP_SERVER_NAME } from '../../utils/claudeInChrome/common.js'
import { normalizeNameForMCP } from '../mcp/normalization.js'
import type { ConnectedMCPServer } from '../mcp/types.js'

/**
 * Known MCP tool-name prefixes for Claude in Chrome.
 *
 * Two naming conventions coexist in the codebase:
 *   - `mcp__claude-in-chrome__` — used when the in-process MCP client is
 *     registered under CLAUDE_IN_CHROME_MCP_SERVER_NAME ('claude-in-chrome').
 *     This is the name TS runtime code uses (e.g. callMcpTool calls below,
 *     mcpClients.find()).
 *   - `mcp__Claude_in_Chrome__` — emerges when the parent Claude Code harness
 *     registers the server using its self-identified `serverName: 'Claude in
 *     Chrome'` (mcpServer.ts:105) and applies normalizeNameForMCP() which
 *     turns the space into an underscore. Prompt strings and
 *     .claude/settings.local.json permission rules use this form because the
 *     AI-facing tool names go through that path.
 *
 * callMcpTool() must strip either prefix so it works regardless of which
 * caller built the tool name. The dynamic third entry future-proofs against
 * the constant changing.
 */
const CHROME_MCP_TOOL_PREFIXES = [
  'mcp__claude-in-chrome__',
  'mcp__Claude_in_Chrome__',
  `mcp__${normalizeNameForMCP(CLAUDE_IN_CHROME_MCP_SERVER_NAME)}__`,
]
export interface ChromeMcpContext {
  tabId?: number
  backendUrl?: string
  frontendUrl?: string
}
export interface ApiTestExecutionResult {
  endpoint: string
  method: string
  status: 'passed' | 'failed'
  statusCode?: number
  responseTime?: number
  error?: string
  responseBody?: any
  retryAttempts?: number
  recovered?: boolean  // True if failed but succeeded after retry
}
export interface ApiTestRetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  expectUnauthorized?: boolean  // Don't retry auth failures (401/403)
}
export interface UiTestExecutionResult {
  test: string
  status: 'passed' | 'failed'
  screenshots?: string[]
  consoleErrors?: string[]
  failedRequests?: string[]
  error?: string
  retryAttempts?: number
}
/**
 * Error categories for better handling
 */
/**
 * MCP client cache for Chrome tools
 */
let chromeMcpClient: ConnectedMCPServer | null = null
let clientInitPromise: Promise<ConnectedMCPServer | null> | null = null
enum ErrorCategory {
  TRANSIENT_NETWORK = 'TRANSIENT_NETWORK',      // Temporary network issues
  TRANSIENT_TIMEOUT = 'TRANSIENT_TIMEOUT',      // Request timeout
  TRANSIENT_CHROME = 'TRANSIENT_CHROME',        // Chrome MCP temporary issues
  PERMANENT_AUTH = 'PERMANENT_AUTH',            // Authentication failures
  PERMANENT_NOT_FOUND = 'PERMANENT_NOT_FOUND',  // 404 errors
  PERMANENT_VALIDATION = 'PERMANENT_VALIDATION', // 400 validation errors
  UNKNOWN = 'UNKNOWN'
}
/**
 * Categorize an error for retry decision
 */
/**
 * Get or create Chrome MCP client with singleton pattern
 */
export async function getChromeMcpClient(toolUseContext?: any): Promise<ConnectedMCPServer | null> {
  // Use the standard access path: toolUseContext.options.mcpClients
  // This matches the pattern used by all other tools (attachments.ts, compact.ts, AgentTool, etc.)
  const mcpClients = toolUseContext?.options?.mcpClients
                  || toolUseContext?.mcpClients
                  || []

  if (!Array.isArray(mcpClients) || mcpClients.length === 0) {
    console.log('[Chrome MCP] No MCP clients found (checked options.mcpClients and mcpClients)')
    return null
  }

  const chromeServer = mcpClients.find(
    (s: any) => s.name === CLAUDE_IN_CHROME_MCP_SERVER_NAME && (s.status === 'connected' || s.type === 'connected')
  )

  if (chromeServer) {
    console.log('[Chrome MCP] Found chrome client:', chromeServer.name, '- type:', chromeServer.type, '- tools:', chromeServer.tools?.length || 0)
    // Cache for callMcpTool usage
    chromeMcpClient = chromeServer
    return chromeServer
  }

  console.log('[Chrome MCP] Not found among', mcpClients.length, 'clients:', mcpClients.map((c: any) => c.name + '(' + c.status + ')').join(', '))
  return null
}
function categorizeError(error: string, statusCode?: number): ErrorCategory {
  // Network errors
  if (error.includes('ECONNREFUSED') || error.includes('ENOTFOUND') || 
      error.includes('network') || error.includes('ETIMEDOUT')) {
    return ErrorCategory.TRANSIENT_NETWORK
  }
  
  // Timeout errors
  if (error.includes('timeout') || error.includes('timed out')) {
    return ErrorCategory.TRANSIENT_TIMEOUT
  }
  
  // Chrome MCP errors
  if (error.includes('Chrome') || error.includes('tab') || error.includes('MCP')) {
    return ErrorCategory.TRANSIENT_CHROME
  }
  
  // HTTP status codes
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      return ErrorCategory.PERMANENT_AUTH
    }
    if (statusCode === 404) {
      return ErrorCategory.PERMANENT_NOT_FOUND
    }
    if (statusCode === 400) {
      return ErrorCategory.PERMANENT_VALIDATION
    }
    // 5xx errors might be transient
    if (statusCode >= 500) {
      return ErrorCategory.TRANSIENT_NETWORK
    }
  }
  
  return ErrorCategory.UNKNOWN
}
/**
 * Determine if an error is retryable
 */
function isRetryableError(category: ErrorCategory, options: ApiTestRetryOptions): boolean {
  switch (category) {
    case ErrorCategory.TRANSIENT_NETWORK:
    case ErrorCategory.TRANSIENT_TIMEOUT:
    case ErrorCategory.TRANSIENT_CHROME:
      return true
      
    case ErrorCategory.PERMANENT_AUTH:
      return !options.expectUnauthorized
      
    case ErrorCategory.PERMANENT_NOT_FOUND:
    case ErrorCategory.PERMANENT_VALIDATION:
      return false
      
    case ErrorCategory.UNKNOWN:
      // Unknown errors are retryable once
      return true
      
    default:
      return false
  }
}
/**
 * Calculate delay with exponential backoff
 */
function calculateRetryDelay(attempt: number, options: ApiTestRetryOptions): number {
  const initialDelay = options.initialDelay || 100
  const maxDelay = options.maxDelay || 5000
  const multiplier = options.backoffMultiplier || 2
  
  const delay = initialDelay * Math.pow(multiplier, attempt)
  return Math.min(delay, maxDelay)
}
/**
 * Execute API test with retry logic
 * 
 * This is the main entry point for API testing with automatic retry
 * for transient errors. It provides detailed error information and
 * recovery suggestions.
 */
export async function executeApiTestWithRetry(
  endpoint: string,
  method: string,
  testData: Record<string, any>,
  backendUrl: string,
  options: ApiTestRetryOptions = {},
  customHeaders?: Record<string, string>
): Promise<ApiTestExecutionResult> {
  const maxRetries = options.maxRetries ?? 3
  let lastError: string = ''
  let lastStatusCode: number | undefined
  let lastResult: ApiTestExecutionResult | undefined
  let recovered = false

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now()

    try {
      // First attempt or retry
      const result = await executeApiTestInternal(
        endpoint,
        method,
        testData,
        backendUrl,
        attempt,
        customHeaders
      )
      
      // If successful, return with retry info
      if (result.status === 'passed') {
        if (attempt > 0) {
          recovered = true
        }
        return {
          ...result,
          retryAttempts: attempt,
          recovered
        }
      }
      
      // If failed, check if retryable
      const category = categorizeError(
        result.error || 'Unknown error',
        result.statusCode
      )
      
      if (!isRetryableError(category, options)) {
        // Non-retryable error, return immediately
        return {
          ...result,
          retryAttempts: attempt,
          recovered: false
        }
      }
      
      // Store for potential retry
      lastResult = result
      lastError = result.error || 'Unknown error'
      lastStatusCode = result.statusCode
      
      // If not last attempt, wait and retry
      if (attempt < maxRetries) {
        const delay = calculateRetryDelay(attempt, options)
        await sleep(delay)
        continue
      }
      
      // Last attempt failed, return result
      return {
        ...result,
        retryAttempts: attempt,
        recovered: false
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      
      const category = categorizeError(lastError, lastStatusCode)
      
      if (!isRetryableError(category, options)) {
        return {
          endpoint,
          method,
          status: 'failed',
          error: lastError,
          responseTime: Date.now() - startTime,
          retryAttempts: attempt,
          recovered: false
        }
      }
      
      // If not last attempt, wait and retry
      if (attempt < maxRetries) {
        const delay = calculateRetryDelay(attempt, options)
        await sleep(delay)
        continue
      }
      
      // Last attempt failed
      return {
        endpoint,
        method,
        status: 'failed',
        error: lastError,
        responseTime: Date.now() - startTime,
        retryAttempts: attempt,
        recovered: false
      }
    }
  }
  
  // Should not reach here, but just in case
  return lastResult || {
    endpoint,
    method,
    status: 'failed',
    error: lastError || 'Unknown error after retries',
    retryAttempts: maxRetries,
    recovered: false
  }
}
/**
 * Internal API test execution without retry logic
 */
async function executeApiTestInternal(
  endpoint: string,
  method: string,
  testData: Record<string, any>,
  backendUrl: string,
  attemptNumber: number,
  customHeaders?: Record<string, string>
): Promise<ApiTestExecutionResult> {
  const startTime = Date.now()

  try {
    // Step 1: Get tab
    const tabResult = await callMcpTool('mcp__claude-in-chrome__tabs_context_mcp', {
      createIfEmpty: true
    })
    const tabs = tabResult.data?.tabs || tabResult.data?.availableTabs || []
    const firstTab = tabs[0]
    const tabId = firstTab?.id || firstTab?.tabId
    if (!tabResult.success || !tabId) {
      throw new Error('Failed to get/create Chrome tab')
    }

    // Step 2: Navigate to backend URL (not about:blank — avoids null-origin CORS issues)
    await callMcpTool('mcp__claude-in-chrome__navigate', {
      url: backendUrl + '/docs',
      tabId
    })
    // Brief wait for page load
    await sleep(500)

    // Step 3: Build fetch code with proper escaping and custom headers
    const fullUrl = backendUrl + endpoint
    const bodyJson = JSON.stringify(testData)
    const escapedBody = bodyJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

    // Build headers object including any custom headers (Authorization, etc.)
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (customHeaders) {
      Object.assign(fetchHeaders, customHeaders)
    }
    const headersJson = JSON.stringify(fetchHeaders).replace(/'/g, "\\'")

    const fetchCode = method === 'GET'
      ? `fetch('${fullUrl}',{headers:${headersJson}}).then(r=>r.json().catch(()=>r.text()).then(d=>JSON.stringify({s:r.status,ok:r.ok,d:d}))).catch(e=>'ERR:'+e.message)`
      : `fetch('${fullUrl}',{method:'${method}',headers:${headersJson},body:'${escapedBody}'}).then(r=>r.json().catch(()=>r.text()).then(d=>JSON.stringify({s:r.status,ok:r.ok,d:d}))).catch(e=>'ERR:'+e.message)`

    // Step 4: Execute fetch in browser
    const jsResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
      action: 'javascript_exec',
      text: fetchCode,
      tabId
    })

    const responseTime = Date.now() - startTime

    // Step 5: Parse response
    if (!jsResult.success) {
      return {
        endpoint, method, status: 'failed',
        error: 'javascript_tool failed: ' + (jsResult.error || 'unknown'),
        responseTime
      }
    }

    // jsResult.data can be: parsed JSON object, raw string, or error string
    let raw = jsResult.data
    if (typeof raw === 'object' && raw !== null) {
      // callMcpTool already parsed JSON — check if it's our {s, ok, d} format
      if ('s' in raw) {
        return {
          endpoint, method,
          status: raw.s >= 200 && raw.s < 300 ? 'passed' : 'failed',
          statusCode: raw.s,
          responseTime,
          responseBody: raw.d
        }
      }
      // Or maybe it's already a full response
      if ('status' in raw) {
        return {
          endpoint, method,
          status: raw.status >= 200 && raw.status < 300 ? 'passed' : 'failed',
          statusCode: raw.status,
          responseTime,
          responseBody: raw.data || raw.d
        }
      }
    }

    // Try parsing as string
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw)
    if (str.startsWith('ERR:')) {
      return { endpoint, method, status: 'failed', error: str, responseTime }
    }

    try {
      const parsed = JSON.parse(str)
      const status = parsed.s || parsed.status
      return {
        endpoint, method,
        status: status >= 200 && status < 300 ? 'passed' : 'failed',
        statusCode: status,
        responseTime,
        responseBody: parsed.d || parsed.data
      }
    } catch {
      return { endpoint, method, status: 'failed', error: 'Unparseable response: ' + str?.substring(0, 200), responseTime }
    }
  } catch (error) {
    return {
      endpoint, method, status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      responseTime: Date.now() - startTime
    }
  }
}
/**
 * Execute API test (backward compatible, delegates to retry version)
 */
export async function executeApiTest(
  endpoint: string,
  method: string,
  testData: Record<string, any>,
  backendUrl: string
): Promise<ApiTestExecutionResult> {
  return executeApiTestWithRetry(endpoint, method, testData, backendUrl, { maxRetries: 0 })
}
/**
 * Execute UI navigation test with progress indication
 */
export async function executeUiNavigationTest(
  url: string,
  frontendUrl: string
): Promise<UiTestExecutionResult> {
  try {
    // Get or create tab
    const tabResult = await callMcpTool('mcp__claude-in-chrome__tabs_context_mcp', {
      createIfEmpty: true
    })
    
    const uiTabs = tabResult.data?.tabs || tabResult.data?.availableTabs || []
    const uiFirstTab = uiTabs[0]
    const tabId = uiFirstTab?.id || uiFirstTab?.tabId
    if (!tabResult.success || !tabId) {
      throw new Error('Failed to get/create Chrome tab')
    }

    // Navigate to the page
    await callMcpTool('mcp__claude-in-chrome__navigate', {
      url: frontendUrl + url,
      tabId
    })
    
    // Wait for page load
    await sleep(1000)
    
    // Take screenshot
    const screenshotResult = await callMcpTool('mcp__claude-in-chrome__computer', {
      action: 'screenshot',
      tabId
    })
    
    // Check for console errors
    const consoleResult = await callMcpTool('mcp__claude-in-chrome__read_console_messages', {
      tabId,
      onlyErrors: true,
      clear: true
    })
    
    const consoleErrors = consoleResult.data?.messages || []
    
    // Check for failed network requests
    const networkResult = await callMcpTool('mcp__claude-in-chrome__read_network_requests', {
      tabId,
      clear: true
    })
    
    const failedRequests = (networkResult.data?.requests || [])
      .filter((r: any) => r.status >= 400 || r.error)
      .map((r: any) => r.url)
    
    return {
      test: 'Navigate to ' + url,
      status: consoleErrors.length === 0 && failedRequests.length === 0 ? 'passed' : 'failed',
      screenshots: [screenshotResult.data?.screenshotPath || ''],
      consoleErrors: consoleErrors.map((e: any) => e.message || e.text),
      failedRequests
    }
  } catch (error) {
    return {
      test: 'Navigate to ' + url,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
/**
 * Execute UI form interaction test
 */
export async function executeUiFormTest(
  formFields: Array<{ name: string; value: string; selector?: string }>,
  submitSelector: string,
  tabId: number
): Promise<UiTestExecutionResult> {
  try {
    // Fill form fields
    for (const field of formFields) {
      const target = field.selector || `${field.name} input, ${field.name} textarea, [name="${field.name}"]`
      
      // Find the element
      const findResult = await callMcpTool('mcp__claude-in-chrome__find', {
        query: target,
        tabId
      })
      
      if (!findResult.success || !findResult.data?.[0]?.ref) {
        continue
      }
      
      // Input value
      await callMcpTool('mcp__claude-in-chrome__form_input', {
        ref: findResult.data[0].ref,
        value: field.value,
        tabId
      })
    }
    
    // Find and click submit button
    const submitResult = await callMcpTool('mcp__claude-in-chrome__find', {
      query: submitSelector,
      tabId
    })
    
    if (submitResult.success && submitResult.data?.[0]?.ref) {
      await callMcpTool('mcp__claude-in-chrome__computer', {
        action: 'left_click',
        ref: submitResult.data[0].ref,
        tabId
      })
    }
    
    // Wait for submission
    await sleep(1000)
    
    return {
      test: 'Form submission',
      status: 'passed'
    }
  } catch (error) {
    return {
      test: 'Form submission',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
/**
 * Execute UI click action
 */
export async function executeUiClick(
  target: string,
  tabId: number
): Promise<UiTestExecutionResult> {
  try {
    // Find element
    const findResult = await callMcpTool('mcp__claude-in-chrome__find', {
      query: target,
      tabId
    })
    
    if (!findResult.success || !findResult.data?.[0]?.ref) {
      return {
        test: 'Click ' + target,
        status: 'failed',
        error: 'Element not found'
      }
    }
    
    // Click element
    await callMcpTool('mcp__claude-in-chrome__computer', {
      action: 'left_click',
      ref: findResult.data[0].ref,
      tabId
    })
    
    return {
      test: 'Click ' + target,
      status: 'passed'
    }
  } catch (error) {
    return {
      test: 'Click ' + target,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
/**
 * Check if Chrome MCP is available with retry
 */
export async function isChromeMcpAvailable(toolUseContext?: any): Promise<boolean> {
  const client = await getChromeMcpClient(toolUseContext)
  return client !== null
}
/**
 * Helper function to call MCP tools
 */
export async function callMcpTool(toolName: string, params: any, toolUseContext?: any): Promise<any> {
  try {
    // Use cached client first, fall back to lookup
    const client = chromeMcpClient || await getChromeMcpClient(toolUseContext)

    if (!client) {
      return {
        success: false,
        error: 'Chrome MCP client not available. Please ensure:' +
               '\n1. Chrome browser is running' +
               '\n2. Claude in Chrome extension is installed and connected'
      }
    }
    
    // Extract tool name without MCP prefix.
    // Try every known Chrome MCP prefix variant — see CHROME_MCP_TOOL_PREFIXES
    // for why both 'claude-in-chrome' and 'Claude_in_Chrome' must be handled.
    let shortToolName = toolName
    for (const prefix of CHROME_MCP_TOOL_PREFIXES) {
      if (shortToolName.startsWith(prefix)) {
        shortToolName = shortToolName.slice(prefix.length)
        break
      }
    }
    
    // Call the tool using the MCP client
    const result = await client.client.callTool({
      name: shortToolName,
      arguments: params
    })
    
    // Parse the result based on content type
    if (!result.content || !Array.isArray(result.content) || result.content.length === 0) {
      return { success: true, data: null }
    }
    
    const content = result.content[0]
    
    if (content.type === 'text') {
      // Try to parse as JSON first
      try {
        const data = JSON.parse(content.text)
        return { success: true, data }
      } catch {
        // Return as text if not JSON
        return { success: true, data: content.text }
      }
    }
    
    // Return other content types as-is
    return { success: true, data: result.content }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Chrome MCP] Tool call failed: ' + toolName, errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}
/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}







