/**
 * MCP Skill discovery: reads skill resources from MCP servers and converts
 * them to SkillCommand objects that can be invoked by the SkillTool.
 *
 * This module is intentionally a dependency-graph leaf — it depends only on
 * mcpSkillBuilders (pure types + registry), memoize, and the MCP types from
 * services/mcp/types.ts.  It must NOT import from client.ts or commands.ts to
 * avoid circular dependencies.
 */
import type { Command } from '../commands.js'
import type { MCPServerConnection } from '../services/mcp/types.js'
import { memoizeWithLRU } from '../utils/memoize.js'
import { getMCPSkillBuilders } from './mcpSkillBuilders.js'

const SKILL_RESOURCE_URI_PREFIX = 'skill://'

/**
 * Fetch skills exposed as MCP resources from a connected server.
 * Returns an empty array if the server exposes no skill resources, the server
 * is not connected, or MCP_SKILLS feature is off (caller guards this).
 */
export const fetchMcpSkillsForClient = memoizeWithLRU(
  async (client: MCPServerConnection): Promise<Command[]> => {
    if (client.type !== 'connected') return []
    if (!client.capabilities?.resources) return []

    try {
      const builders = getMCPSkillBuilders()

      // List all resources and filter to skill:// URIs
      const result = await client.client.listResources()
      const resources = result.resources ?? []

      const skillResources = resources.filter(r =>
        r.uri.startsWith(SKILL_RESOURCE_URI_PREFIX),
      )
      if (skillResources.length === 0) return []

      // Fetch each skill resource and build a SkillCommand from its content
      const commands: Command[] = []
      for (const resource of skillResources) {
        try {
          const content = await client.client.readResource({ uri: resource.uri })
          const text = content.contents
            .filter(c => c.type === 'text')
            .map(c => (c as { type: 'text'; text: string }).text)
            .join('\n')
          if (!text) continue

          const fields = builders.parseSkillFrontmatterFields(text)
          const cmd = builders.createSkillCommand({
            filePath: resource.uri,
            baseDir: `mcp:${client.name}`,
            content: text,
            fields,
            loadedFrom: 'mcp',
          })
          commands.push(cmd)
        } catch {
          // Skip unreadable skill resources
        }
      }
      return commands
    } catch {
      return []
    }
  },
  (client: MCPServerConnection) => client.name,
)
