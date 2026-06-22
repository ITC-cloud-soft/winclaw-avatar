/**
 * env.ts — /env slash command (Phase 0 + 1 core + Phase 1.5)
 *
 * Registers the /env bundled skill. Uses the prompt-driven pattern from
 * remember.ts: a SKILL_PROMPT instructs the AI on what to do, referencing
 * the workspace-relative .metacoder/environments.yaml file via the Read tool.
 *
 * Phase 0/1 subcommands implemented (prompt-driven):
 *   /env                    list all envs + active
 *   /env list [--tag TAG]   filter by tag
 *   /env use NAME [Reason: TEXT]  switch active env
 *   /env reset              return to default
 *   /env import PATH --as NAME   wraps importDotenv description
 *   /env export NAME [--include-secrets]  wraps exportDotenv description
 *
 * Phase 1.5 subcommands (prompt-driven, AI executes via Read/Edit/Write tools):
 *   /env add NAME [extends PARENT] [field=VALUE ...]
 *   /env edit NAME [field=VALUE ...]
 *   /env remove NAME
 *   /env clone SRC DST [field=VALUE ...]
 *   /env set NAME.PATH VALUE
 *
 * Phase 2 commands: doctor and diff are now implemented (prompt-driven).
 * Phase 2+ commands (elevate) are still not yet implemented.
 *
 * ARCHITECTURE NOTE — Prompt-driven Phase 1.5:
 *   The TypeScript modules in operations/ (intentParser, orchestrator, builders)
 *   exist as testable building blocks for future tool-call integration.  In
 *   Phase 1.5 v1 the AI carries out the equivalent logic itself using Read and
 *   Edit/Write tools rather than calling those modules at runtime.  When the
 *   Meta Coder runtime exposes a custom "env_operation" tool the prompt below
 *   will be updated to delegate to those modules instead.
 */

import { registerBundledSkill } from '../bundledSkills.js'

// ---------------------------------------------------------------------------
// Skill prompt
// ---------------------------------------------------------------------------

const SKILL_PROMPT = `# /env — Infra Environment Manager

## Goal
Manage Meta Coder infra environments defined in \`.metacoder/environments.yaml\`.

## Available subcommands

| Command | Description |
|---------|-------------|
| \`/env\` | List all environments and show which is currently active |
| \`/env list [--tag TAG]\` | List environments, optionally filtered by tag |
| \`/env use NAME [Reason: TEXT]\` | Switch the active environment |
| \`/env reset\` | Return to the default environment |
| \`/env import PATH --as NAME\` | Import a .env file as a new environment |
| \`/env export NAME [--include-secrets]\` | Export an environment as a .env file |
| \`/env add NAME [extends PARENT] [field=VALUE ...]\` | Add a new environment |
| \`/env edit NAME [field=VALUE ...]\` | Edit fields on an existing environment |
| \`/env remove NAME\` | Remove an environment |
| \`/env clone SRC DST [field=VALUE ...]\` | Clone an environment with optional overrides |
| \`/env set NAME.PATH VALUE\` | Set a single field (dot-notation path) |
| \`/env doctor [--level basic\|standard\|full] [--env NAME]\` | Run health check on env (basic = credential resolution; standard adds TCP reachability; full adds active probes) |
| \`/env diff A B\` | Compare two environments side-by-side |

Commands **not yet available** (Phase 2+):
\`elevate\`
If the user types any of these, respond: "not yet implemented; planned for Phase 2"

## Steps

### 1. Parse the subcommand

Look at the user's input (the args to this skill) and identify:
- Which subcommand was invoked (list, use, reset, import, export, or bare /env)
- The arguments (env name, --tag value, --as value, --include-secrets flag, Reason: text)

If no subcommand is present, treat it as \`/env list\`.

### 2. Read the environments file

Use the Read tool to read \`.metacoder/environments.yaml\` in the current working directory.
If the file does not exist, inform the user: "No .metacoder/environments.yaml found. Create one to use /env commands."

### 3. Execute the subcommand

#### \`/env\` or \`/env list [--tag TAG]\`

Parse the YAML you read:
- \`version\`: must be 2
- \`default\`: the default env name
- \`environments[]\`: array of env objects

For each environment, extract:
- \`name\`
- \`tags\` (array or absent)
- \`description\` (optional)
- \`cloud.provider\`
- \`cloud.region\`
- \`deploy.skill\` (optional)
- \`deploy.tested\` (optional)
- \`safety.destructive_ops\`

If \`--tag TAG\` is given, filter to environments whose \`tags\` array includes TAG.

Output a markdown table with columns: Name | Tags | Provider | Region | Deploy skill | Tested | Destructive ops
Mark the default env with "(default)" after its name.
Mark the active env (from the session's memory / your current context) with "(active)" — if unknown, omit.

#### \`/env use NAME [Reason: TEXT]\`

1. Confirm the env NAME exists in environments.yaml. If not, list available names and stop.
2. Report: "Active environment switched to **NAME**" and include the reason if provided.
3. Note: the actual session-state switch is handled by the runtime; your role is to confirm validity and report clearly.

#### \`/env reset\`

Report: "Active environment reset to default: **<default-name>**"
The runtime handles the actual state reset.

#### \`/env import PATH --as NAME\`

Describe what will happen:
1. Read the .env file at PATH
2. Classify each key as var or secret (keys containing PASSWORD, SECRET, TOKEN, CREDENTIAL, PASS, PWD, KEY → secret; public prefixes NEXT_PUBLIC_, VITE_PUBLIC_, PUBLIC_ → var)
3. Generate a environments.yaml snippet and an infra.yaml patch
4. Show the user the generated YAML and ask them to review before applying

Then use Bash to run:
\`\`\`bash
echo '{"importPath":"'"$IMPORT_PATH"'","asEnvName":"'"$AS_NAME"'"}' | metacoder _exec env.importDotenv
\`\`\`
with IMPORT_PATH and AS_NAME set. If Bash is unavailable, describe the result based on the YAML.

Actually: for Phase 0, just read the .env file using the Read tool and manually classify keys, then show the environments.yaml + infra.yaml patches as code blocks. Ask the user to review before writing.

#### \`/env export NAME [--include-secrets]\`

Read .metacoder/environments.yaml, find the env by name.
Collect all \${var:KEY} and \${secret:KEY} references from the env block.

Output a .env formatted code block:
\`\`\`
# Generated by Meta Coder Infra Environment Manager
# Environment: NAME
KEY=<value or <NEEDS_RESOLUTION>>
SECRET_KEY=<SECRET_NOT_INCLUDED>   (unless --include-secrets)
\`\`\`

Note to user: to get actual resolved values, run \`metacoder env export NAME\` from the CLI.

### 4. Phase 1.5 mutation commands — add / edit / remove / clone / set

These commands modify \`.metacoder/environments.yaml\`. Use this prompt-driven
workflow (the TypeScript operation builders are testable building blocks for
future runtime tool-call integration; for now you perform equivalent logic).

#### General workflow for all mutation commands

1. **Read** \`.metacoder/environments.yaml\` with the Read tool.
2. **Parse intent** — identify name(s), fields, and values from the user's input.
3. **Validate** — check for: duplicate names (add), unknown env names (edit/remove/clone/set),
   missing required fields (cloud.provider, cloud.region, safety.destructive_ops).
4. **Compute diff** — mentally compute the resulting YAML after the operation.
5. **Show preview** in this format:

\`\`\`markdown
## /env <kind> preview

**Targets**: <name(s)>

### YAML diff
\`\`\`diff
+ added lines
- removed lines
\`\`\`

### Validation
- ✓ no errors
OR
- ✗ \`path\` — <error message>
- ⚠ <warning message>

### Apply
Type \`/apply\` to commit, \`/cancel\` to discard.
\`\`\`

6. **Wait** for the user to type \`/apply\` or \`/cancel\`.
   - On \`/apply\`: write the updated YAML using the Edit or Write tool.
   - On \`/cancel\`: discard and confirm cancellation.

#### \`/env add NAME [extends PARENT] [field=VALUE ...]\`

Supported field shorthands:
- \`extends NAME\` or \`extending NAME\` → sets \`extends:\` key
- \`region=VAL\` → \`cloud.region\`
- \`provider=VAL\` → \`cloud.provider\` (azure | aws | aliyun | gcp | on-prem)
- \`tag T\` or \`tags=[t1,t2]\` → \`tags\`
- \`host VAL\`, \`port N\`, \`database VAL\` → \`database.primary.*\`

Required fields (ask via dialog if missing):
\`cloud.provider\`, \`cloud.region\`, \`safety.destructive_ops\`

Defaults applied automatically:
- \`safety.destructive_ops: confirm\` (if not specified)
- \`deploy.tested: false\` (if \`deploy:\` block is provided without \`tested\`)

#### \`/env edit NAME [field=VALUE ...]\`

Apply a shallow merge of provided key=value pairs onto the named environment.
Field shorthands are the same as add. Show what changed.

#### \`/env remove NAME\`

Remove the named environment. Warn if other environments use \`extends: NAME\`.

#### \`/env clone SRC DST [field=VALUE ...]\`

Copy SRC to DST (new name). Apply any override field=value pairs to the copy.
Warn if DST already exists.

#### \`/env set NAME.PATH VALUE\`

Set a single field using dot-notation path.
Examples:
- \`dev.database.primary.port 13306\` → sets port to number 13306
- \`dev.deploy.tested true\` → sets boolean true
- \`dev.cloud.region eu-central-1\` → sets string

Type coercion: numeric strings → number, true/false → boolean, [a,b,c] → array.
Protected fields (cannot be set): \`name\`, \`extends\`, \`tags\` — use the appropriate
operation for those.

### 5. /env doctor — health check

\`/env doctor [--level basic|standard|full] [--env NAME]\`

**Level semantics:**
- \`basic\` (default): resolve every \`\${var:KEY}\` and \`\${secret:KEY}\` reference in the env. Report each as pass/fail/skip.
- \`standard\`: basic + TCP reachability for all db.host, storage.endpoint, and deploy.registry endpoints.
- \`full\`: standard + active cloud CLI identity check (\`az account show\`, \`aws sts get-caller-identity\`, etc.) and storage HEAD probe. **Blocked on production-tagged envs** unless the user explicitly confirms.

**Workflow:**
1. Read \`.metacoder/environments.yaml\` and \`~/.metacoder/projects/<id>/infra.yaml\`.
2. Identify the env (from \`--env NAME\` or the active/default env).
3. Parse the \`--level\` flag (default: \`basic\`).
4. **Production guard**: if the env has tag \`production\` and \`--level full\` was requested, warn:
   > ⚠️ Running \`full\` doctor on a production environment is potentially disruptive (active probes may affect running services). Add \`--force\` to proceed.
   Stop unless \`--force\` was given.
5. For **basic**: walk the env YAML, collect all \`\${var:KEY}\` and \`\${secret:KEY}\` tokens.
   For each token, check if the corresponding entry exists in infra.yaml (vars or secrets map).
   Report each as:
   - **pass**: entry exists in infra.yaml
   - **fail**: not declared in any infra file
   - **skip**: backend is a network backend (\`az-cli\`, \`aws-cli\`, \`vault\`, etc.) and we cannot verify without executing it
6. For **standard**: additionally list all resolved endpoints (db host:port, storage endpoint, deploy registry).
   For each endpoint, report reachability as pass/fail/timeout based on whether a TCP connection can be established.
7. For **full**: additionally run cloud CLI identity checks and HTTP HEAD on storage endpoints.
8. Output a formatted report table:

\`\`\`
## /env doctor — <env-name> (<level>)
Ran at: <ISO timestamp>

| Check | Category | Status | Detail |
|-------|----------|--------|--------|
| var:AZURE_SUB | credential | ✓ pass | resolved via literal |
| secret:DB_PASS | credential | ✓ pass | declared (env backend) |
| db:postgres:db.example.com:5432 | database | ✓ pass | TCP ok (12ms) |
| cloud:azure | cloud | ✗ fail | az CLI not authenticated |

Summary: X passed, Y failed, Z skipped
\`\`\`

**Rules:**
- Never reveal secret values, only pass/fail/skip status.
- In offline mode (\`--offline\`): skip all network backends and TCP probes; report them as \`skip\`.
- Keep the report concise — suppress passed checks with \`--quiet\` if requested.

### 6. /env diff A B

\`/env diff <envA> <envB>\`

Compare two environments side-by-side (after resolving their extends chains).

**Steps:**
1. Read \`.metacoder/environments.yaml\`.
2. Find both \`envA\` and \`envB\` by name. If either is missing, list available env names and stop.
3. Resolve each env's \`extends:\` chain (apply ancestor merges so the comparison is on the final effective config, not just local fields).
4. Walk both resolved env objects and build a flat list of differences:
   - For each dot-notation path present in either env, compare the values.
   - Omit \`name\` and \`extends\` from comparison (they differ by definition).
   - Arrays: compare as JSON strings (index-based, no deep equality).
5. Format the result as a Markdown table:

\`\`\`markdown
## /env diff A vs B

| Path | A | B |
|------|---|---|
| \`cloud.region\` | japaneast | westeurope |
| ⚠ \`safety.destructive_ops\` | allow | confirm |
| ⚠ \`deploy.tested\` | true | false |

**Differences**: 3 (2 notable)
\`\`\`

6. Mark **notable** differences (prefix the path cell with ⚠) for any of these paths:
   - \`safety.destructive_ops\`
   - \`safety.writes_two_phase_commit\`
   - \`deploy.skill\`
   - \`deploy.tested\`
   - \`cloud.provider\`
   - \`cloud.region\`

7. If the environments are identical after extends resolution, output:
   > No differences found — environments are identical (after extends resolution).

### 7. Bulk operations

Bulk operations fan out a single \`set\` or \`edit\` across all environments that share a given tag.

**Trigger patterns (regex-detected, no dialog needed if pattern is complete):**
- English: \`set tag=<TAG> <path> <value>\` or \`for all <TAG> envs, set <path> = <value>\`
- Japanese: \`全(ての)?<TAG>の <path> を <value> に\` or \`<TAG> タグの全環境で <path>=<value>\`

**Example:** \`/env set tag=staging database.primary.ssl require\`

**Workflow:**
1. Identify the tag filter and operation from the pattern.
2. Find all environments whose \`tags\` array includes the given tag.
3. For each matching env, generate an individual \`set\` (or \`edit\`) preview.
4. Show a combined preview listing all affected envs and the change.
5. Wait for \`/apply\` before writing.

**Preview format:**
\`\`\`markdown
## Bulk /env set — tag: staging

Affects 3 environments: staging-jp, staging-eu, staging-us

| Env | Path | Before | After |
|-----|------|--------|-------|
| staging-jp | \`database.primary.ssl\` | prefer | require |
| staging-eu | \`database.primary.ssl\` | prefer | require |
| staging-us | \`database.primary.ssl\` | disable | require |

Type \`/apply\` to commit all 3 changes, \`/cancel\` to discard.
\`\`\`

### 8. Error handling

- YAML parse failure: show the parse error and the line number if visible.
- Unknown env name: list the available env names.
- Missing --as flag on import: remind the user the syntax is \`/env import PATH --as NAME\`.
- Missing PATH on import: show usage.
- Validation errors for mutation commands: show the ✗ prefixed error in the preview and
  refuse to apply until resolved.

## Rules
- Never show secret VALUES — only show that a secret key exists.
- Always show the default env name from the YAML.
- Keep responses concise; prefer tables over prose for lists.
- For mutation commands: always show the preview diff before writing anything.
- Never write to environments.yaml without an explicit \`/apply\` from the user.
`

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerEnvSkill(): void {
  registerBundledSkill({
    name: 'env',
    description:
      'Manage infra environments defined in .metacoder/environments.yaml. List, switch, import, and export environments.',
    whenToUse:
      'Use when the user wants to list, switch, import, or export infra environments. Triggered by /env.',
    userInvocable: true,
    argumentHint: '[list|use|reset|import|export] [args...]',
    async getPromptForCommand(args) {
      const trimmed = (args ?? '').trim()

      // Hard-guard Phase 2+ subcommands (not yet implemented).
      // Phase 1.5 verbs (add, edit, remove, clone, set) are now handled by the
      // prompt-driven workflow below — do NOT guard them here.
      const PHASE_2_VERBS = ['elevate']
      const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase()
      if (firstWord && PHASE_2_VERBS.includes(firstWord)) {
        return [
          {
            type: 'text',
            text:
              `# /env ${firstWord}\n\n` +
              `**Not yet implemented.**\n\n` +
              `\`/env ${firstWord}\` is planned for a future phase of the Infra Environment Manager roadmap ` +
              `(see \`docs/meta-coder/all-in-one/INFRA_ENVIRONMENT_DESIGN.v2.2.md\` §15.5 for the design).\n\n` +
              `**Currently available**: \`/env\`, \`/env list\`, \`/env use NAME\`, \`/env reset\`, ` +
              `\`/env import PATH --as NAME\`, \`/env export NAME\`, ` +
              `\`/env add\`, \`/env edit\`, \`/env remove\`, \`/env clone\`, \`/env set\`.\n\n` +
              `Respond to the user with this message verbatim — do not attempt to perform the requested action.`,
          },
        ]
      }

      let prompt = SKILL_PROMPT
      if (trimmed) {
        prompt += `\n## User input\n\n\`/env ${trimmed}\``
      } else {
        prompt += `\n## User input\n\n\`/env\` (no subcommand — show env list)`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
