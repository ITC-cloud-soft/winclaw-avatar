/**
 * Meta-coder feature flag system.
 *
 * Only essential features are enabled by default to keep tool count low
 * and ensure stable performance with third-party APIs.
 *
 * Set META_CODER_ENABLED_FEATURES env var to enable additional features.
 */
const ENABLED = new Set([
  // Core functionality — always on
  'COORDINATOR_MODE',          // multi-agent coordination
  'MCP_SKILLS',                // MCP skill system
  'EXPERIMENTAL_SKILL_SEARCH', // skill search
  'HISTORY_SNIP',              // history trimming
  'AGENT_TRIGGERS',            // cron/scheduled tasks
  'AGENT_TRIGGERS_REMOTE',     // remote triggers
  'TRANSCRIPT_CLASSIFIER',     // auto mode
  'TOKEN_BUDGET',              // token budget control
  // Add user-specified features
  ...(process.env.META_CODER_ENABLED_FEATURES || '').split(',').filter(Boolean),
])

export function feature(name: string): boolean {
  return ENABLED.has(name)
}
