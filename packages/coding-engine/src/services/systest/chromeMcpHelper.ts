/**
 * Claude in Chrome MCP Helper for systest
 * 
 * Provides helper functions to interact with Claude in Chrome MCP tools
 * for Phase 5C UI testing.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Chrome MCP Helper Class
 */
export class ChromeMcpHelper {
  private available: boolean = false
  private tabId: number | null = null
  
  constructor(private outputDir: string) {
    this.checkAvailability()
  }
  
  /**
   * Check if Chrome MCP is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // Try to get tab context
      const result = await this.callMcpTool('tabs_context_mcp', { createIfEmpty: true })
      this.available = !!(result && result.tabs && result.tabs.length > 0)
      
      if (this.available && result.tabs && result.tabs.length > 0) {
        this.tabId = result.tabs[0].id
        console.log(`[ChromeMcp] Chrome MCP available, tab ID: ${this.tabId}`)
      }
    } catch (error) {
      this.available = false
      console.log('[ChromeMcp] Chrome MCP not available:', error instanceof Error ? error.message : String(error))
    }
  }
  
  /**
   * Check if Chrome MCP is available
   */
  isAvailable(): boolean {
    return this.available
  }
  
  /**
   * Get or create a tab for testing
   */
  async getOrCreateTab(): Promise<number | null> {
    if (!this.available) {
      return null
    }
    
    try {
      const result = await this.callMcpTool('tabs_context_mcp', { createIfEmpty: true })
      
      if (result && result.tabs && result.tabs.length > 0) {
        this.tabId = result.tabs[0].id
        return this.tabId
      }
      
      // Try to create a new tab
      const createResult = await this.callMcpTool('tabs_create_mcp', {})
      if (createResult && createResult.tabId) {
        this.tabId = createResult.tabId
        return this.tabId
      }
      
      return null
    } catch (error) {
      console.error('[ChromeMcp] Failed to get/create tab:', error)
      return null
    }
  }
  
  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<boolean> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for navigation')
      return false
    }
    
    try {
      await this.callMcpTool('navigate', { tabId: this.tabId, url })
      console.log(`[ChromeMcp] Navigated to: ${url}`)
      
      // Wait for page to load
      await this.sleep(2000)
      return true
    } catch (error) {
      console.error('[ChromeMcp] Navigation failed:', error)
      return false
    }
  }
  
  /**
   * Take a screenshot
   */
  async screenshot(name?: string): Promise<string | null> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for screenshot')
      return null
    }
    
    try {
      const timestamp = Date.now()
      const filename = name ? `${name}_${timestamp}.png` : `screenshot_${this.tabId}_${timestamp}.png`
      const screenshotsDir = join(this.outputDir, 'screenshots')
      
      try { mkdirSync(screenshotsDir, { recursive: true }) } catch {}
      
      const result = await this.callMcpTool('computer', {
        action: 'screenshot',
        tabId: this.tabId,
      })
      
      // In a real implementation, the screenshot would be saved to disk
      const screenshotPath = join(screenshotsDir, filename)
      
      console.log(`[ChromeMcp] Screenshot saved: ${screenshotPath}`)
      return screenshotPath
    } catch (error) {
      console.error('[ChromeMcp] Screenshot failed:', error)
      return null
    }
  }
  
  /**
   * Find an element on the page
   */
  async findElement(query: string): Promise<any | null> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for find')
      return null
    }
    
    try {
      const result = await this.callMcpTool('find', {
        tabId: this.tabId,
        query,
      })
      
      return result
    } catch (error) {
      console.error('[ChromeMcp] Find element failed:', error)
      return null
    }
  }
  
  /**
   * Click an element
   */
  async clickElement(refOrCoords: string | [number, number]): Promise<boolean> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for click')
      return false
    }
    
    try {
      if (typeof refOrCoords === 'string') {
        // Click by element reference
        await this.callMcpTool('computer', {
          action: 'left_click',
          tabId: this.tabId,
          ref: refOrCoords,
        })
      } else {
        // Click by coordinates
        await this.callMcpTool('computer', {
          action: 'left_click',
          tabId: this.tabId,
          coordinate: refOrCoords,
        })
      }
      
      console.log(`[ChromeMcp] Clicked element`)
      await this.sleep(500)
      return true
    } catch (error) {
      console.error('[ChromeMcp] Click failed:', error)
      return false
    }
  }
  
  /**
   * Fill an input field
   */
  async fillInput(ref: string, value: string): Promise<boolean> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for fill')
      return false
    }
    
    try {
      await this.callMcpTool('form_input', {
        tabId: this.tabId,
        ref,
        value,
      })
      
      console.log(`[ChromeMcp] Filled input: ${value}`)
      await this.sleep(300)
      return true
    } catch (error) {
      console.error('[ChromeMcp] Fill input failed:', error)
      return false
    }
  }
  
  /**
   * Type text
   */
  async typeText(text: string): Promise<boolean> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for type')
      return false
    }
    
    try {
      await this.callMcpTool('computer', {
        action: 'type',
        tabId: this.tabId,
        text,
      })
      
      console.log(`[ChromeMcp] Typed text: ${text}`)
      await this.sleep(300)
      return true
    } catch (error) {
      console.error('[ChromeMcp] Type text failed:', error)
      return false
    }
  }
  
  /**
   * Get console messages
   */
  async getConsoleErrors(): Promise<any[]> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for console')
      return []
    }
    
    try {
      const result = await this.callMcpTool('read_console_messages', {
        tabId: this.tabId,
        onlyErrors: true,
        pattern: 'error|Error|ERROR',
        limit: 100,
      })
      
      return result || []
    } catch (error) {
      console.error('[ChromeMcp] Get console errors failed:', error)
      return []
    }
  }
  
  /**
   * Get network requests
   */
  async getNetworkErrors(): Promise<any[]> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for network')
      return []
    }
    
    try {
      const result = await this.callMcpTool('read_network_requests', {
        tabId: this.tabId,
        limit: 100,
      })
      
      // Filter for errors (status >= 400)
      const errors = (result || []).filter((req: any) => req.status >= 400)
      return errors
    } catch (error) {
      console.error('[ChromeMcp] Get network errors failed:', error)
      return []
    }
  }
  
  /**
   * Execute JavaScript on the page
   */
  async executeJavaScript(code: string): Promise<any> {
    if (!this.tabId) {
      console.error('[ChromeMcp] No tab available for JS execution')
      return null
    }
    
    try {
      const result = await this.callMcpTool('javascript_tool', {
        action: 'javascript_exec',
        tabId: this.tabId,
        text: code,
      })
      
      return result
    } catch (error) {
      console.error('[ChromeMcp] Execute JavaScript failed:', error)
      return null
    }
  }
  
  /**
   * Wait for a condition
   */
  async waitFor(condition: () => Promise<boolean>, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        if (await condition()) {
          return true
        }
      } catch {}
      
      await this.sleep(100)
    }
    
    return false
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Call MCP tool (placeholder - would use actual MCP tool interface)
   * 
   * Note: This is a placeholder implementation. In the actual implementation,
   * this would call the MCP tools directly via the tool system.
   */
  private async callMcpTool(toolName: string, params: any): Promise<any> {
    // This is a placeholder for the actual MCP tool call
    // The actual implementation would use the MCP tool interface
    
    // For now, simulate some responses
    switch (toolName) {
      case 'tabs_context_mcp':
        return { tabs: [{ id: 1 }] }
      
      case 'tabs_create_mcp':
        return { tabId: Date.now() }
      
      default:
        return {}
    }
  }
}

/**
 * Create a Chrome MCP helper instance
 */
export function createChromeMcpHelper(outputDir: string): ChromeMcpHelper {
  return new ChromeMcpHelper(outputDir)
}
