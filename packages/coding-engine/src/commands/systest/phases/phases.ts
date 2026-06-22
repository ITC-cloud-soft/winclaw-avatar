/**
 * Phase configurations for systest.
 */

import type { PhaseConfig } from './orchestrator.ts'
import { executePhase1 } from './phase1_prompt_driven.ts'
import { executePhase2 } from './phase2_prompt_driven.ts'
import { executePhase3 } from './phase3.ts'
import { executePhase4 } from './phase4_prompt_driven.ts'
import { executePhase5A } from './phase5a.ts'
import { executePhase5B } from './phase5b_prompt_only.ts'
import { executePhase5C } from './phase5c_prompt_only.ts'
import { executePhase6 } from './phase6.ts'

/**
 * Get all phases for systest execution.
 */
export function getAllPhases(): PhaseConfig[] {
  return [
    {
      id: '1',
      name: 'Static Analysis',
      timeout: 1800 * 1000,  // 30 minutes
      modes: ['A', 'B', 'C'],
      execute: executePhase1,
    },
    {
      id: '2',
      name: 'Design Verification',
      timeout: 1800 * 1000,  // 30 minutes
      modes: ['B', 'C'],
      execute: executePhase2,
    },
    {
      id: '3',
      name: 'Dependency Analysis',
      timeout: 2400 * 1000,  // 40 minutes
      modes: ['A', 'B', 'C'],
      execute: executePhase3,
    },
    {
      id: '4',
      name: 'Service Architecture Detection',
      timeout: 3600 * 1000,  // 1 hour
      modes: ['A', 'B', 'C'],
      execute: executePhase4,
    },
    {
      id: '5a',
      name: 'Service Startup & Health Check',
      timeout: 1800 * 1000,  // 30 minutes
      modes: ['A', 'B', 'C'],
      condition: (ctx) => !ctx.servicesReady,
      execute: executePhase5A,
    },
    {
      id: '5b',
      name: 'API Testing',
      timeout: 3600 * 1000,  // 1 hour
      modes: ['A', 'B', 'C'],
      condition: (ctx) => !!ctx.backendUrl,
      skipReason: (ctx) => {
        if (ctx.backendUrl) return 'internal: condition returned false despite backendUrl being set'
        const envHint = ctx.envName
          ? ` Alternatively, run \`/env doctor\` on env=${ctx.envName} to verify the env's deploy config exposes a backend, then re-run /systest (the URL will be inferred automatically).`
          : ''
        return (
          '--backend-url was not provided to /systest. Phase 5B tests API endpoints and requires a live backend URL. ' +
          'Re-run /systest with --backend-url http://localhost:<PORT>.' +
          envHint
        )
      },
      execute: executePhase5B,
    },
    {
      id: '5c',
      name: 'Frontend E2E Testing',
      timeout: 3600 * 1000,  // 1 hour
      modes: ['A', 'B', 'C'],
      condition: (ctx) => !!ctx.frontendUrl,
      skipReason: (ctx) => {
        if (ctx.frontendUrl) return 'internal: condition returned false despite frontendUrl being set (should not happen)'
        const envHint = ctx.envName
          ? ` Phase 5C requires a frontend URL. Either pass --frontend-url, or run \`/env doctor\` on env=${ctx.envName} to verify the env's deploy config exposes a frontend.`
          : ''
        return (
          '--frontend-url was not provided to /systest. Phase 5C tests frontend pages via Chrome MCP, which requires a live frontend URL. ' +
          'To enable: re-run /systest with --frontend-url http://localhost:<PORT>. ' +
          'NOTE: Chrome MCP / Playwright / Cypress installation status is NOT the cause — the orchestrator only checks for the presence of the frontendUrl.' +
          envHint
        )
      },
      execute: executePhase5C,
    },
    {
      id: '6',
      name: 'Report Generation',
      timeout: 1800 * 1000,  // 30 minutes
      modes: ['A', 'B', 'C'],
      execute: executePhase6,
    },
  ]
}
