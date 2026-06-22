/**
 * deploy.ts — /deploy slash command (Phase 5)
 *
 * Registers the /deploy bundled skill. Uses the prompt-driven pattern from
 * env.ts: a SKILL_PROMPT instructs the AI on what to do, referencing the
 * Phase 5 orchestrator (plan/execute/dispatch), 2-phase commit, and audit log.
 *
 * ARCHITECTURE NOTE — Prompt-driven Phase 5:
 *   The TypeScript modules in deployment/ (skillOrchestrator, skillCatalog)
 *   and safety/ (twoPhaseCommit, auditHelper) exist as testable building blocks
 *   for future tool-call integration.  In Phase 5 v1 the AI carries out the
 *   equivalent logic itself using Read/Bash/Skill tools rather than calling
 *   those modules at runtime.  When the Meta Coder runtime exposes a custom
 *   "deploy_dispatch" tool the prompt below will be updated to delegate to
 *   those modules instead.
 */

import { registerBundledSkill } from '../bundledSkills.js'

// ---------------------------------------------------------------------------
// Skill prompt
// ---------------------------------------------------------------------------

const SKILL_PROMPT = `# /deploy — Deploy via active env's deployment skill

## Goal
Deploy the current project to the cloud configured in the active environment.
Routes to the right deployment skill based on env.deploy.skill, enforces
production safety gates, and wraps every destructive action in a 2-phase commit
so the user can review before executing.

## Available subcommands

| Command | Description |
|---------|-------------|
| \`/deploy\` | Deploy using active env's skill (intent: deploy) |
| \`/deploy --intent rollback\` | Roll back the most recent deploy |
| \`/deploy --intent verify\` | Run health checks without deploying |
| \`/deploy --intent destroy\` | Destroy infrastructure (requires elevated + reason) |
| \`/deploy --env NAME\` | Override active env for this deploy only |
| \`/deploy --dry-run\` | Build the plan + show preview, don't execute |
| \`/deploy --reason "TEXT"\` | Required for production deploys |
| \`/deploy list-skills\` | List all skills in the catalog (tested + untested) |
| \`/deploy apply PENDING-ID\` | Execute a previously created pending plan |
| \`/deploy cancel PENDING-ID\` | Discard a pending plan |

## Steps

### 1. Parse the subcommand

Recognize and extract from the user's args:
- Subcommands: \`list-skills\`, \`apply <id>\`, \`cancel <id>\`
- Flags: \`--intent <kind>\`, \`--env <name>\`, \`--reason "<text>"\`, \`--dry-run\`

If no subcommand/flag, default to \`--intent deploy\`.

### 2. For \`/deploy list-skills\`

Use Bash to list all catalog entries via a node inline script:

\`\`\`bash
echo '{}' | metacoder _exec deploy.listSkills
\`\`\`

Format the output as a Markdown table with columns:
Skill | Tested | Providers | Intents | Last Verified

Tip: Use \`/deploy --intent <intent>\` to deploy with a specific intent, or
\`/deploy --env NAME\` to target a specific environment.

### 3. For deploy / rollback / verify / destroy intents

#### 3a. Production safety guards

Before planning, read \`.metacoder/environments.yaml\` to check the active (or
\`--env\`) environment's tags:

- If env has tag **\`production\`** AND \`--reason\` flag is missing → STOP and respond:
  > Production deploy requires a reason. Re-run with \`--reason "TEXT"\` describing
  > the change. Example: \`/deploy --reason "Hotfix: patch null-ref in payments"\`

- If env has tag **\`production\`** AND elevation is not active (check via
  \`isElevated()\` from \`src/services/envManager/safety/elevation.ts\`) → warn:
  > ⚠ Production deploy without elevation. Consider running \`/env elevate\` first
  > for an explicit write-access window. Proceeding will bypass the elevation gate.

- If intent is **\`destroy\`** AND env tag includes \`production\` → STOP and respond:
  > Destroy intent on a production environment requires both \`--reason\` AND an
  > active elevation session. Run \`/env elevate --reason "TEXT"\` first.

#### 3b. Call plan()

Use Bash to invoke the orchestrator:

\`\`\`bash
echo '{"intent":"<INTENT>","reason":"<REASON_OR_UNDEFINED>","dryRun":<DRY_RUN_BOOL>}' | metacoder _exec deploy.plan
\`\`\`

- On **DeploymentError** (non-zero exit or \`{ error, kind }\` in output):
  Report the error message to the user and STOP.

#### 3c. Show warnings

If \`plan.warnings.length > 0\`, list each warning as a bullet under a
**Warnings** heading before continuing.

#### 3d. Show envContext

Print the \`plan.envContext\` Markdown block verbatim so the user can see the
verified env state and known pitfalls.

#### 3e. Build 2-phase commit preview

Use Bash to call \`twoPhaseCommit.preview()\`:

\`\`\`bash
echo '{"command":"<SKILL_NAME>","args":["<INTENT>"],"description":"Deploy <ENV_NAME> via <SKILL_NAME>","envName":"<ENV_NAME>","reason":"<REASON_OR_UNDEFINED>","rollbackPlan":"<SKILL_ROLLBACK_HINT>"}' | metacoder _exec deploy.preview
\`\`\`

#### 3f. Show ready message

After preview succeeds, show:

\`\`\`
✓ Plan ready for <ENV_NAME> (<INTENT> via <SKILL_NAME>).

  Pending ID: <ID>
  Expires at: <EXPIRY_TIME>

Run \`/deploy apply <ID>\` to execute, or \`/deploy cancel <ID>\` to discard.
\`\`\`

If \`--dry-run\` was given: show the plan and message, then STOP (do not proceed
to apply).

### 4. For \`/deploy apply <pending-id>\`

1. Call \`twoPhaseCommit.apply(id, executor)\` where the executor:
   - Invokes the actual SKILL via the Skill tool using the skill name from the
     pending op (e.g., /aliyun-deploy, /azure-cloud-deploy)
   - Reads stdout/stderr from the skill's output
   - Returns \`DeploymentSkillOutput\` shape: \`{ status, phasesCompleted, rollbackPlan, durationSeconds, warnings, errors }\`

2. Write an audit log entry via \`logAudit\` from
   \`src/services/envManager/safety/auditHelper.ts\`:
   - On success: status=success, rollbackPlan=output.rollbackPlan
   - On failure: status=failure, include error message in summary

3. On **success**: report:
   \`\`\`
   ✓ Deploy complete
   Skill: <skill>
   Intent: <intent>
   Phases completed: <phasesCompleted list>
   Duration: <durationSeconds>s
   Rollback plan: <rollbackPlan>
   \`\`\`

4. On **failure**: report the error and suggest:
   > Run \`/deploy --intent rollback --reason "Rollback after failed deploy"\`

5. If the pending id is **not found** (expired or never existed), report:
   > Pending operation <ID> not found or expired (TTL: 5 minutes).
   > Re-run \`/deploy [args]\` to create a new plan.

### 5. For \`/deploy cancel <pending-id>\`

Call \`twoPhaseCommit.cancel(id)\` via Bash:

\`\`\`bash
echo '{"id":"<PENDING_ID>"}' | metacoder _exec deploy.cancel
\`\`\`

- \`{ ok: true }\` → confirm: "Pending operation <ID> discarded."
- \`{ ok: false }\` → "Pending operation <ID> not found (already applied, cancelled, or expired)."

### 6. Output format examples

#### /deploy list-skills (example)

\`\`\`
## Deployment Skill Catalog

| Skill | Tested | Providers | Intents | Last Verified |
|-------|--------|-----------|---------|---------------|
| aliyun-deploy | ✓ tested | aliyun | deploy, rollback, verify | 2026-04-15 |
| azure-cloud-deploy | ✓ tested | azure | deploy, rollback, verify, destroy | 2026-03-10 |
| aws-cloud-deploy | ⚠ untested | aws | deploy, rollback, verify, destroy | never |
\`\`\`

#### /deploy (dry-run example)

\`\`\`
## Deploy Plan (dry-run)

**Environment**: prod-aliyun (production)
**Skill**: aliyun-deploy (✓ tested, last verified 2026-04-15)
**Intent**: deploy

### Env context
[envContext block from orchestrator]

### Warnings
- Skill was last verified 20 days ago.

✓ Plan ready. Re-run without --dry-run to create a pending operation.
\`\`\`

#### /deploy apply pending-20260505-143000-a1b2c3 (example)

\`\`\`
✓ Deploy complete
Skill: aliyun-deploy
Intent: deploy
Phases completed: build, push, apply, verify
Duration: 142s
Rollback plan: kubectl rollout undo deployment/app -n prod
\`\`\`

## Rules

- **Never** directly execute cloud CLI commands (kubectl, az, aliyun, aws)
  without a pending op created via twoPhaseCommit.preview().
- **Always** show the 2-phase commit preview before executing (unless
  \`--dry-run\` was given, in which case stop after showing the plan).
- **Never** skip the production reason-check; if --reason is absent and env
  is production-tagged, refuse with the prompt above.
- Keep responses concise; prefer structured output over prose.
- Secrets (envVars contents) must never appear in AI context or output.
`

// ---------------------------------------------------------------------------
// Hard-guard helpers
// ---------------------------------------------------------------------------

const VALID_INTENTS = new Set(['deploy', 'rollback', 'verify', 'destroy'])

/**
 * Parse a raw args string into recognized tokens.
 * Returns structured info for guard checks.
 */
function parseArgs(args: string): {
  subcommand: 'list-skills' | 'apply' | 'cancel' | 'deploy' | null
  applyOrCancelId: string | null
  intent: string | null
  hasEnv: boolean
  isDryRun: boolean
  raw: string
} {
  const trimmed = args.trim()
  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]?.toLowerCase() ?? ''

  if (first === 'list-skills') {
    return { subcommand: 'list-skills', applyOrCancelId: null, intent: null, hasEnv: false, isDryRun: false, raw: trimmed }
  }

  if (first === 'apply' || first === 'cancel') {
    const id = tokens[1] ?? null
    return { subcommand: first, applyOrCancelId: id, intent: null, hasEnv: false, isDryRun: false, raw: trimmed }
  }

  // Flag parsing
  let intent: string | null = null
  let hasEnv = false
  let isDryRun = false

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    if (tok === '--intent' && tokens[i + 1]) {
      intent = tokens[i + 1]!
      i++
    } else if (tok === '--env' && tokens[i + 1]) {
      hasEnv = true
      i++
    } else if (tok === '--dry-run') {
      isDryRun = true
    }
  }

  return { subcommand: 'deploy', applyOrCancelId: null, intent, hasEnv, isDryRun, raw: trimmed }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDeploySkill(): void {
  registerBundledSkill({
    name: 'deploy',
    description:
      "Deploy the project using the active env's deployment skill (Phase 5 orchestrator).",
    whenToUse:
      "Use when the user wants to deploy code to the cloud configured in the active env. Triggered by /deploy.",
    userInvocable: true,
    argumentHint:
      '[--intent deploy|rollback|verify|destroy] [--env NAME] [--reason "TEXT"] [--dry-run] | apply ID | cancel ID | list-skills',
    async getPromptForCommand(args) {
      const parsed = parseArgs(args ?? '')

      // Hard guard: apply / cancel with no id
      if ((parsed.subcommand === 'apply' || parsed.subcommand === 'cancel') && !parsed.applyOrCancelId) {
        const verb = parsed.subcommand
        return [
          {
            type: 'text',
            text:
              `# /deploy ${verb}\n\n` +
              `**Error**: \`/deploy ${verb}\` requires a pending operation ID.\n\n` +
              `Usage: \`/deploy ${verb} <pending-id>\`\n\n` +
              `Example: \`/deploy ${verb} pending-20260505-143000-a1b2c3\`\n\n` +
              `To see pending operations, review recent \`/deploy\` output. ` +
              `Pending IDs expire after 5 minutes.`,
          },
        ]
      }

      // Hard guard: unrecognized --intent
      if (parsed.intent !== null && !VALID_INTENTS.has(parsed.intent)) {
        return [
          {
            type: 'text',
            text:
              `# /deploy\n\n` +
              `**Error**: Unrecognized intent \`${parsed.intent}\`.\n\n` +
              `Valid intents: \`deploy\`, \`rollback\`, \`verify\`, \`destroy\`.\n\n` +
              `Usage: \`/deploy --intent <deploy|rollback|verify|destroy>\``,
          },
        ]
      }

      // Build contextual prompt with user input appended
      let prompt = SKILL_PROMPT
      const rawArgs = (args ?? '').trim()
      if (rawArgs) {
        prompt += `\n## User input\n\n\`/deploy ${rawArgs}\``
      } else {
        prompt += `\n## User input\n\n\`/deploy\` (no args — default to --intent deploy)`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
