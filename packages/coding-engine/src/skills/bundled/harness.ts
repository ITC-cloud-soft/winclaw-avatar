/**
 * harness.ts — /harness slash command
 *
 * Registers the /harness bundled skill. Uses the prompt-driven pattern
 * established by env.ts and deploy.ts.
 *
 * Subcommands:
 *   /harness init [--template TYPE]          Bootstrap harness/
 *   /harness validate                         Check rules/skills/gates integrity
 *   /harness lint                             Run programmatic rule check
 *   /harness gate <gateId>                   Run a single gate
 *   /harness status                           Show current state
 *   /harness phase status                     Show current phase state
 *   /harness phase advance [--reason "..."]  Advance to next phase + auto-assume role
 *   /harness phase rollback [--reason "..."] Rollback to previous phase
 *   /harness phase init [--phase <id>]       Initialize fresh phase state
 *   /harness implement                        Implement next not-done task (impl. phase only; documented exception)
 *   /harness assume <role> [--reason "..."]  Manually set active role (Agent C — Standard)
 *   /harness role                            Show current role info (Agent C — Standard)
 *   /harness drill [--skip-gates] [--from <phase>] [--to <phase>]
 *                                            Virtual dry-run of the entire pipeline
 *   /harness ai-rate [--since <days>]        Measure AI adoption rate from git history
 */

import { registerBundledSkill } from '../bundledSkills.js'

// ---------------------------------------------------------------------------
// Verbs that are still hard-guarded (not yet implemented)
// 'drill' and 'ai-rate' are now implemented (Advanced scope §10.3).
// Keep the machinery for future use; the array is now empty.
// ---------------------------------------------------------------------------

const HARD_GUARDED_VERBS = [] as const
type HardGuardedVerb = (typeof HARD_GUARDED_VERBS)[number]

function isHardGuardedVerb(word: string): word is HardGuardedVerb {
  return (HARD_GUARDED_VERBS as readonly string[]).includes(word)
}

// Legacy alias so existing code that calls isPhase15Verb still compiles
const PHASE_15_VERBS = HARD_GUARDED_VERBS
type Phase15Verb = HardGuardedVerb
function isPhase15Verb(word: string): word is Phase15Verb {
  return isHardGuardedVerb(word)
}

// ---------------------------------------------------------------------------
// Skill prompt
// ---------------------------------------------------------------------------

const SKILL_PROMPT = `# /harness — Harness Engineering Manager

## Overview
Manage the \`harness/\` directory structure that provides structured engineering
discipline (rules, skills, agents, workflow, quality gates) to the workspace.

Reference design: \`docs/meta-coder/all-in-one/HARNESS_ENGINEERING_INTEGRATION.md\`

## Available subcommands

> Note: there are **14 subcommands** (the count grew from 13 → 14 with the
> addition of \`/harness implement\`, which is the **documented exception** to
> the harness rule of "do not add new subcommands" — see the design plan
> §3.0). Every other principle still applies: prefer flags over verbs.

| Command | Description |
|---------|-------------|
| \`/harness init [--template TYPE]\` | Bootstrap harness/ directory from a template |
| \`/harness validate\` | Check harness/ layout integrity (required files, warnings) |
| \`/harness lint\` | Run programmatic rule check against workspace source |
| \`/harness gate <gateId>\` | Run a named quality gate (checks from gates.yaml) |
| \`/harness status\` | Show current harness state and phase |
| \`/harness phase status\` | Print current phase, role, rollback count, last gate result |
| \`/harness phase advance [--reason "..."]\` | Run gate (if defined) then advance to next phase + auto-assume role |
| \`/harness phase rollback [--reason "..."]\` | Roll back to previous phase |
| \`/harness phase init [--phase <id>]\` | Initialize fresh phase state |
| \`/harness implement\` | Implement the next not-done task (or [P] batch) from tasks.md, gated by test-plan.md cases (implementation phase only) |
| \`/harness assume <role> [--reason "..."]\` | Manually set active role (pm/developer/reviewer/tester) |
| \`/harness role\` | Show active role, manual override, and phase-default role |
| \`/harness drill [--skip-gates] [--from <phase>] [--to <phase>]\` | Virtual dry-run of the entire pipeline (Advanced) |
| \`/harness ai-rate [--since <days>]\` | Measure AI adoption rate from git history (Advanced) |

## Steps

### 1. Parse the subcommand

Look at the user's input. Extract:
- Subcommand: \`init\`, \`validate\`, \`lint\`, \`gate\`, \`status\`, \`phase\`
- Arguments: \`--template TYPE\` for init; \`<gateId>\` for gate; sub-verb + flags for phase

If no subcommand, treat as \`/harness status\`.

---

### 2. \`/harness init [--template TYPE]\`

Scaffold a \`harness/\` directory in the current workspace.

**Available templates:**
- \`minimal\` (default) — rules + 1 skill
- \`java-spring-enterprise\`
- \`node-fastapi\`
- \`python-django\`
- \`go-microservice\`
- \`react-nextjs-frontend\`
- \`cobol-modernization\`

**Workflow:**

1. Determine the workspace path (cwd).
2. Check if \`harness/\` already exists by using Bash to test for \`harness/rules/architecture.md\`.
   If it exists, warn the user and confirm before overwriting (unless \`--force\` was passed).
3. Use Bash to run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","template":"'"\${HARNESS_TEMPLATE:-minimal}"'"}' | metacoder _exec harness.init
\`\`\`
with \`HARNESS_TEMPLATE\` set to the requested template name.

4. Show the user:
   - Files created
   - Files skipped (already existed)
   - Warnings
   - Next step: "Run \`/harness validate\` to check the layout"

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

After creating the standard harness/ files, also:

5. Create \`harness/constitution.md\` from the template for the requested template type.
   Use the following template:

\`\`\`markdown
# <project-name> Constitution
Adopted: <ISO timestamp>
Version: 1.0

## Article I — Coding Standards
All code MUST follow the project's established style and linting rules.
Gate: gate-implementation includes harness-lint rule "constitution-conformance".

## Article II — Test Coverage
All new features MUST have corresponding test coverage.
Gate: gate-test-spec requires test-plan.md.

## Article III — Documentation
All public APIs MUST be documented.
Gate: gate-design requires data-model.md.
\`\`\`

6. Create \`harness/specs/.gitkeep\` (empty file to ensure the directory is tracked by git).

7. In the post-init summary, list the constitution articles that were created (e.g., "Constitution: 3 articles created").

---

### 3. \`/harness validate\`

Check that all required and optional harness files are present.

**Workflow:**

1. Use Bash to run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.validate
\`\`\`

2. Format the result:
   - If \`ok: true\`: "Harness layout valid. N warnings."
   - If errors: list each error prefixed with "✗"
   - List warnings prefixed with "⚠"
   - Suggest next step: \`/harness lint\` if layout is valid.

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Also run two additional checks and present their results in separate sections:

**Constitution section** — call \`_exec harness.constitutionValidate\`:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.constitutionValidate
\`\`\`
Format as:
\`\`\`
=== Constitution ===
✓ constitution.md present (v<version>, <N> articles)
⚠ <warning messages>
✗ <error messages>
\`\`\`
If skipped (no constitution.md or feature disabled), show: "Constitution: not configured (run /harness init to add)"

**Cross-artifact section** — first check for active feature, then call \`_exec harness.crossArtifactAnalyze\`:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.crossArtifactAnalyze
\`\`\`
Format as:
\`\`\`
=== Cross-artifact (feature: <featureId>) ===
✓ <ok findings>
⚠ <warning findings>
✗ <error findings>
\`\`\`
If no active feature or feature disabled: "Cross-artifact: no active feature"

---

### 4. \`/harness lint\`

Run programmatic rules from \`harness/rules/*.md\` against workspace source files.

**Workflow:**

1. Use Bash to run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.lint
\`\`\`

2. Format the result:

\`\`\`markdown
## /harness lint

Score: 87/100
Files scanned: 42 | Rules evaluated: 12 | Duration: 340ms

### Violations (5)

| Severity | File | Line | Rule | Message |
|----------|------|------|------|---------|
| ✗ error | src/payments/service.ts | 42 | money-no-double | Use long (cents) not double |
| ⚠ warning | src/users/controller.ts | 18 | i18n-all-locales | Missing i18n key in ja.json |
\`\`\`

3. If \`passed: true\`, show: "All rules passed."

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Two additional built-in rules are always active and run as part of every \`/harness lint\` invocation:

- **\`constitution-conformance\`** — checks that code and artifacts conform to constitution.md articles. Violations are reported in the same violation table with rule name "constitution-conformance".
- **\`no-unresolved-clarification\`** — counts \`[NEEDS CLARIFICATION]\` markers in spec files. Any unresolved marker is reported as a warning with rule name "no-unresolved-clarification".

Format these violations using the same table format as existing lint violations (severity, file, line, rule, message). They are included in the total Score and violation count.

---

### 5. \`/harness gate <gateId>\`

Run a named quality gate defined in \`harness/workflow/gates.yaml\`.

**Workflow:**

1. Confirm gateId was provided. If missing, list gates from gates.yaml:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.loadGates
\`\`\`

2. Run the gate:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","gateId":"'"$GATE_ID"'"}' | metacoder _exec harness.runGate
\`\`\`
with \`GATE_ID\` set to the requested gate id.

3. Format the result:

\`\`\`markdown
## /harness gate <gateId> — PASSED / FAILED

Ran at: <ISO>  |  Duration: <Xms>

| Check | Type | Passed | Duration | Output |
|-------|------|--------|----------|--------|
| file-exists | file-exists | ✓ | 2ms | File found at harness/rules/architecture.md |
| typecheck | typescript-typecheck | ✗ | 1420ms | 3 type errors |
\`\`\`

4. If the gate passed: suggest next steps (e.g., advance to next phase).
5. If the gate failed: show which checks failed and suggest fixes.

---

### 6. \`/harness status\`

Show the current harness state.

**Workflow:**

1. Check if harness/ is initialized:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.status
\`\`\`

2. Show:
   - Harness initialized: yes/no
   - Template detected (if any)
   - Required files: present/missing
   - Optional files: present/missing
   - Errors and warnings
   - Hint: run \`/harness gate <id>\` to verify quality

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

After existing status fields, also display:

- **Constitution version**: call \`_exec harness.constitutionShow\` and display the version and article count. Example: "Constitution: v1.0 (9 articles)". If absent: "Constitution: not configured".
- **Active feature**: call \`_exec harness.activeFeature\` and display it. Example: "Active feature: 002-spec-kit-integration". If none: "Active feature: none".
- **Unresolved clarifications**: call \`_exec harness.clarifyList\` and display the count. Example: "Unresolved clarifications: 3". If zero: "Unresolved clarifications: 0".
- **Last cross-artifact analysis**: call \`_exec harness.crossArtifactAnalyze\` and show a brief status. Example: "Cross-artifact: ok (0 errors, 2 warnings)" or "Cross-artifact: skipped (no active feature)".

---

### 7. \`/harness phase <sub-verb> [flags]\`

Manage the 10-phase workflow state machine.

**Sub-verbs:**

#### 7a. \`/harness phase status\`

Print current phase, role, rollback attempt count, and last gate result.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.loadPhaseState
\`\`\`

Format the output as:

\`\`\`
## Phase Status

Current phase : implementation
Active role   : developer
Rollback count: 1
Last gate     : gate-impl (passed=true, ranAt=2025-01-01T12:00:00Z)
Workspace     : /path/to/workspace
\`\`\`

If state is null (not initialized), print: "harness not initialized — run /harness init"

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

After the standard phase status block, also display:

- **Active feature**: call \`_exec harness.activeFeature\` and show. If none, show: "Active feature: none".
- **Task progress** (if active feature has a tasks.md): call \`_exec harness.tasksStatus\` and display task progress. Format:
  \`\`\`
  Tasks: <done>/<total> done (<progressPercent>%)
    [T-001] done    <description>
    [T-002] in-progress  <description>
    [T-003] [P] todo  <description>
  \`\`\`
  If tasks.md not found, omit the Tasks section.
- **Unresolved clarifications**: if the current phase is "requirements", call \`_exec harness.clarifyList\` and list any unresolved markers.

#### 7b. \`/harness phase advance [--reason "..."]

Extract the optional \`--reason\` flag from the args.

1. Load the phases config and current phase state.
2. Determine if the current phase has a gate field. If so, run the gate first:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","gateId":"'"$GATE_ID"'"}' | metacoder _exec harness.runGate
\`\`\`
with \`GATE_ID\` set to the gate id.

3. Call advancePhase:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","reason":"'"\${REASON:-}"'","gateResultJson":"'"\${GATE_RESULT_JSON:-}"'"}' | metacoder _exec harness.advancePhase
\`\`\`
with \`REASON\` and \`GATE_RESULT_JSON\` env vars set.

4. Show summary: "Advanced from \`<from>\` to \`<to>\`" and list audit entry.

Note: Role assumption via Agent C's personaLoader is a TODO — import from
\`./src/services/harness/agents/personaLoader.js\` when available and gracefully
no-op if the file is missing.

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

**BEFORE the existing gate run**, call \`_exec harness.clarifyList\`:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.clarifyList
\`\`\`

If \`results.unresolved > 0\` AND the current phase is \`requirements\`:
- Show the list of unresolved markers to the user:
  \`\`\`
  ⚠ 3 unresolved [NEEDS CLARIFICATION] markers found:
    harness/specs/<id>/spec.md:42 [NEEDS CLARIFICATION: ...]
    harness/specs/<id>/spec.md:67 [NEEDS CLARIFICATION: ...]
  \`\`\`
- Enter interactive mode: prompt the user to answer each question.
- On user response, update spec.md to replace each marker with the answer.
- Continue the advance after all markers are resolved.
- If \`--no-interactive\` flag was passed in the args, do NOT enter interactive mode; instead fail the advance with: "⛔ Advance blocked: N unresolved clarifications in requirements phase."

**AFTER successful advance from design → test-spec** (i.e., when transitioning to phase "test-spec"), call \`_exec harness.tasksGenerate\`:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.tasksGenerate
\`\`\`
Show: "Auto-generated tasks.md with <N> tasks."

**AFTER successful advance into the \`implementation\` phase**, show the
following guidance verbatim to the user (do not paraphrase):

> 実装フェーズに入りました。まず \`/harness implement\` を実行して未完了タスクを 1 つずつ実装してください。**直接 \`/harness gate gate-implementation\` を実行してはいけません** — テストが落ちる前に何を実装するかが定まらないため、ゲートだけ走らせても無意味です。すべてのタスクが done になったら \`/harness gate gate-implementation\` でゲートを通過させてください。

#### 7c. \`/harness phase rollback [--reason "..."]

Extract the optional \`--reason\` flag.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","reason":"'"\${REASON:-}"'"}' | metacoder _exec harness.rollbackPhase
\`\`\`

Show summary: "Rolled back from \`<from>\` to \`<to>\` (attempt N/maxAttempts)".

If rollback limit exceeded, show the error message with "Human approval required."

#### 7d. \`/harness phase init [--phase <id>]\`

Initialize fresh phase state. Defaults to \`default_phase\` from phases.yaml.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","targetPhase":"'"\${TARGET_PHASE:-}"'"}' | metacoder _exec harness.initPhaseState
\`\`\`
with \`TARGET_PHASE\` set to the requested phase id (or unset to use default).

Show: "Phase state initialized at \`<phase>\`. Run \`/harness phase status\` to confirm."

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Also accept a \`--feature <name>\` flag from the args. When present:

1. Extract the feature name from \`--feature <name>\`.
2. Call:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","featureName":"'"$FEATURE_NAME"'"}' | metacoder _exec harness.specInit
\`\`\`
with \`FEATURE_NAME\` set to the provided name.
3. After phase state init, log the active feature to the user. Example:
   "Active feature set to: \`002-feature-name\`"
4. Show the files created under \`harness/specs/<featureId>/\`.

When \`--feature\` is omitted, behavior is identical to v3.0.2.

---

### 7e. \`/harness implement\`

Implement the next not-done task (or the next consecutive \`[P]\` parallel batch)
from \`harness/specs/<active>/tasks.md\`, using \`test-plan.md\` cases as the
acceptance criteria. This subcommand is the documented exception per the
harness design plan §3.0 — it exists because the implementation phase otherwise
has no kick-off command and users were running \`gate-implementation\` blindly.

**Precondition:** the current phase MUST be \`implementation\`. If it is not,
print the following message verbatim and stop:

\`\`\`
⛔ /harness implement requires the implementation phase. Current phase: <X>.
Use \`/harness phase advance\` first.
\`\`\`

**Workflow:**

1. Verify the precondition by calling:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.loadPhaseState
\`\`\`
   If \`state.current !== 'implementation'\`, stop with the message above.

2. Call \`_exec harness.implementNext\` to aggregate context and emit
   \`docs/IMPLEMENT_PLAN.md\`:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.implementNext
\`\`\`

3. Branch on the result:

   - If \`ok===false\`: show the \`error\` field to the user and stop.
   - If \`ok===true && allDone===true\`: show:
     \`\`\`
     ✅ All tasks are already done. Run \`/harness gate gate-implementation\` to advance.
     \`\`\`
     and stop.
   - Otherwise: continue.

4. Read the produced plan:

\`\`\`bash
cat docs/IMPLEMENT_PLAN.md
\`\`\`

5. Summarize for the user: the target task IDs (from the response's
   \`taskIds\`), and a brief listing of their acceptance criteria
   (Given/When/Then). One sentence per case.

6. **Implement the listed task(s)** as the developer role. Constraints:
   - Touch only files identified in the plan's FILES-TO-TOUCH section, plus
     any clearly necessary supporting files (tests, config). If the
     FILES-TO-TOUCH list is empty, infer from spec.md and announce which
     files you are touching before editing.
   - Implement **one task or one \`[P]\` batch in a single invocation**. Do
     not pre-implement future tasks.
   - Write or update tests alongside the implementation so the
     test-plan.md acceptance criteria are actually checked.

7. After implementation, mark the just-completed task(s) as done:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","taskIds":["T-001","T-002"]}' | metacoder _exec harness.markTasksDone
\`\`\`
   with \`taskIds\` set to the array of completed IDs from step 5.

8. Show the recap to the user:

\`\`\`
Implemented <taskIds>. Run \`/harness implement\` again for the next task,
or \`/harness gate gate-implementation\` once all tasks are done.
\`\`\`

---

### 8. \`/harness assume <role> [--reason "..."]\`

Manually set the active role. Valid roles: \`pm\`, \`developer\`, \`reviewer\`, \`tester\`.

1. Parse \`<role>\` from the args (first positional after "assume"). If missing or invalid, print valid roles and return.
2. Parse optional \`--reason "..."\` flag.
3. Run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","role":"'"$ROLE"'","reason":"'"\${REASON:-}"'"}' | metacoder _exec harness.assumeRole
\`\`\`
with \`ROLE\` and \`REASON\` env vars set.

4. Show: "Active role set to: \`<role>\` (manual override). CLAUDE.md updated."

---

### 9. \`/harness role\`

Show current role state.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.getActiveRole
\`\`\`

Format output:

\`\`\`
## /harness role
Active role    : developer
Manual override: developer  (ACTIVE — auto-assume suppressed)
Phase default  : developer  (for phase "implementation")
\`\`\`

Highlight when manual override is active (manualRole !== null). Highlight when manual override differs from phase default.

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Also display the active feature by calling \`_exec harness.activeFeature\`:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.activeFeature
\`\`\`
Add to the output:
\`\`\`
Active feature : <featureId>  (or "none")
\`\`\`

---

### 10. \`/harness phase advance\` — role auto-assume

After advancing the phase (step 7b), run the role auto-assume step:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.autoAssumeRole
\`\`\`

Show to user: "Auto-assumed role \`developer\` for phase \`implementation\`."
If manualRole active: "Manual role override (\`developer\`) preserved — auto-assume skipped."

---

### 11. \`/harness context <show|refresh|query>\`

Manage the 3-layer context loading system (session / phase / on-demand).

#### 11a. \`/harness context show\`

Print the current context snapshot (session + current-phase + no on-demand query).

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.buildSnapshot
\`\`\`

Show the rendered block to the user with a summary table:

| Layer | Entries | Tokens |
|-------|---------|--------|
| session | N | N |
| phase | N | N |

#### 11b. \`/harness context refresh\`

Rebuild the context snapshot, write it to CLAUDE.md, and append a \`context-load\` audit entry.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.refreshContext
\`\`\`

Show: "Context refreshed and written to CLAUDE.md — \`<N>\` tokens across \`<M>\` entries."

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Before calling \`harness.refreshContext\`, check for an active feature:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.activeFeature
\`\`\`
If an active feature is set, auto-inject the following spec files into the phase layer before persisting:
- \`harness/specs/<active>/spec.md\`
- \`harness/specs/<active>/plan.md\`
- \`harness/specs/<active>/tasks.md\`

These files are appended to the context snapshot so the LLM always has full spec context when the active feature is set.

#### 11c. \`/harness context query <text>\`

Run the on-demand layer for the given query text and print results without persisting.

Extract \`<text>\` as everything after "query " in the subcommand args.

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","query":"'"\${CONTEXT_QUERY:-}"'"}' | metacoder _exec harness.queryContext
\`\`\`
with \`CONTEXT_QUERY\` set to the user's query text.

If entries is empty: "No glossary sections matched query \`<text>\`."
Otherwise, print each matching section with its token count.

---

### 12. \`/harness approve <gateId> [--reason "..."]\`

Record human approval for a pending \`human-approval\` gate check. Writes a YAML
record at \`<workspace>/.metacoder/audit/approvals/<gateId>-<phaseId>.yaml\` that
the \`human-approval\` gate runner reads on its next run.

1. Parse \`<gateId>\` (first positional). If missing, show: "Usage: /harness approve <gateId> [--reason ...]" and stop.
2. Parse optional \`--reason "..."\`.
3. Run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","gateId":"'"$GATE_ID"'","reason":"'"\${REASON:-}"'"}' | metacoder _exec harness.approveGate
\`\`\`

with \`GATE_ID\` and \`REASON\` set from parsed args.

Show: "Approval recorded for gate \`<gateId>\` at \`<file>\`. Re-run the gate to consume the approval."

---

### 13. Error handling

- \`harness/\` not initialized: "Run \`/harness init\` to set up your harness directory."
- Phase state missing: "harness not initialized — run \`/harness phase init\`."
- \`gates.yaml\` not found: "harness/workflow/gates.yaml is missing. Add it or run \`/harness init\`."
- Unknown gate id: list available gate ids from gates.yaml.
- YAML parse error: show the parse error and line number.
- Rollback limit exceeded: show the HarnessError message verbatim.
- Invalid role for /harness assume: "Valid roles: pm, developer, reviewer, tester."
- Persona file missing: show the HarnessError detail and suggest \`/harness init\`.
- Missing query text for \`/harness context query\`: "Usage: /harness context query <keyword>"

---

### 14. \`/harness drill [--skip-gates] [--from <phaseId>] [--to <phaseId>]\`

Perform a **virtual dry-run** of the entire phases.yaml pipeline without persisting
any state. Simulates gate execution end-to-end and shows what would pass or fail.

**Flags:**
- \`--skip-gates\` — walk all phases but skip actual gate execution (structure check only)
- \`--from <phaseId>\` — start walk from this phase (inclusive). Default: \`default_phase\`
- \`--to <phaseId>\` — stop walk at this phase (inclusive). Default: terminal phase

**Workflow:**

1. Parse flags from the args string.
2. Run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","skipGates":'"\${SKIP_GATES:-false}"',"phaseFrom":"'"\${PHASE_FROM:-}"'","phaseTo":"'"\${PHASE_TO:-}"'"}' | metacoder _exec harness.runDrill
\`\`\`
with \`SKIP_GATES\`, \`PHASE_FROM\`, and \`PHASE_TO\` set from parsed flags.

3. Format the output:

\`\`\`markdown
## /harness drill — DRY-RUN

Workspace : /path/to/ws
Ran at    : 2025-05-09T10:00:00Z
Duration  : 1234ms

### Phases walked (N)

| Phase | Gate | Passed | Duration | Errors |
|-------|------|--------|----------|--------|
| requirements | gate-req | ✓ | 120ms | |
| design       | (none)   | ✓ | 0ms   | |
| implementation | gate-impl | ✗ | 430ms | file not found |

### Rules coverage
Evaluated: 12 | Violations: 2 | Score: 83/100

### Summary
All green: NO  |  Passed: 2  |  Failed: 1
\`\`\`

4. If \`allGreen: true\`: "All phases would pass — ready to run the live pipeline."
5. If failures exist: list failed phases and suggest fixes.

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

Also include a **"Cross-artifact analysis"** section in the drill report by calling:
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.crossArtifactAnalyze
\`\`\`
Format it as an additional section in the drill report:
\`\`\`markdown
### Cross-artifact analysis (feature: <featureId>)
✓ spec.md → plan.md: all acceptance criteria referenced
⚠ plan.md → tasks.md: 2 decomposition gaps
\`\`\`
If no active feature or feature disabled: omit this section silently.

---

### 15. \`/harness ci-init [--target github|gitlab|both] [--force]\`

Emit CI scaffold files to the workspace. Idempotent: existing files are skipped unless \`--force\` is passed.

**Supported targets (default: github):**
- \`github\` → \`.github/workflows/harness.yml\` (GitHub Actions)
- \`gitlab\` → \`.gitlab-ci.yml\` (GitLab CI)
- \`both\`   → both files

**Workflow:**

1. Parse \`--target\` flag (default: \`github\`) and \`--force\` flag.
2. Run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","target":"'"\${CI_TARGET:-github}"'","force":'"\${CI_FORCE:-false}"'}' | metacoder _exec harness.writeCiScaffold
\`\`\`
with \`CI_TARGET\` and \`CI_FORCE\` set from parsed args.

3. Show the user:
   - Files created
   - Files skipped (already exist — pass \`--force\` to overwrite)
   - Next step: "Commit these files to trigger the CI pipeline."

---

### 16. \`/harness ai-rate [--since <days>]\`

Measure the **AI adoption rate** — what percentage of code was authored or
accepted by AI — based on git log analysis and harness audit entries.

**Flags:**
- \`--since <days>\` — look back this many days (default 30)

**AI detection criteria:**
- Author name or email matches \`/claude|anthropic/i\`
- Commit message contains a \`Co-Authored-By: Claude\` trailer

**Workflow:**

1. Parse \`--since\` flag (default 30).
2. Run:

\`\`\`bash
echo '{"workspacePath":"'"$PWD"'","sinceDays":'"\${SINCE_DAYS:-30}"'}' | metacoder _exec harness.runAiRate
\`\`\`
with \`SINCE_DAYS\` set from the parsed flag.

3. Format the output:

\`\`\`markdown
## /harness ai-rate

Workspace   : /path/to/ws
Window      : last 30 days
Ran at      : 2025-05-09T10:00:00Z

### Commit-level AI rate
Total commits     : 42
AI-attributed     : 18  (42.9%)

### Line-level AI rate
Total lines changed : 1820
AI-authored lines   : 750  (41.2%)

### Per author

| Author | Commits | Lines changed | AI? |
|--------|---------|---------------|-----|
| Alice  | 24      | 1070          | No  |
| Claude Code | 18 | 750          | Yes |
\`\`\`

4. Provide a brief narrative: "AI contributed approximately 42% of recent code changes."
5. If zero commits found: "No commits found in the last \`<days>\` days."

**v3.1.0 spec-kit behavior (when METACODER_HARNESS_SPEC_MODE is not "off"):**

After the existing metrics section, compute and display **"Avg unresolved clarifications per feature"**:

1. Call \`_exec harness.clarifyList\` (without a featureId to scan all features):
\`\`\`bash
echo '{"workspacePath":"'"$PWD"'"}' | metacoder _exec harness.clarifyList
\`\`\`
2. Count unique features scanned by examining marker file paths.
3. Display:
\`\`\`
### Clarification health
Features scanned      : <N>
Total unresolved      : <M>
Avg per feature       : <M/N>
\`\`\`
If no spec features found, omit this section.

---

## Rules
- Always show the workspace path in status/init output.
- Never write files without confirming with the user first for overwrite scenarios.
- For mutation operations (init with --force), show a preview before writing.
- Keep responses concise; prefer tables for lists of results.
`

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerHarnessSkill(): void {
  registerBundledSkill({
    name: 'harness',
    description:
      'Manage the harness/ engineering discipline directory: init templates, validate layout, run lint checks, and execute quality gates.',
    whenToUse:
      'Use when the user wants to set up or manage the harness/ directory, run quality gates, lint harness rules, or validate the harness layout. Triggered by /harness.',
    userInvocable: true,
    argumentHint: '[init|validate|lint|gate|status|phase|implement|assume|role|context|approve|ci-init|drill|ai-rate] [args...]',
    async getPromptForCommand(args) {
      const trimmed = (args ?? '').trim()
      const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? ''

      // Hard-guard: only 'drill' and 'ai-rate' remain unimplemented
      if (firstWord && isHardGuardedVerb(firstWord)) {
        return [
          {
            type: 'text',
            text:
              `# /harness ${firstWord}\n\n` +
              `**Not yet implemented.**\n\n` +
              `\`/harness ${firstWord}\` is planned for a future phase of the Harness Engineering roadmap.\n\n` +
              `**Currently available**: \`/harness init\`, \`/harness validate\`, \`/harness lint\`, ` +
              `\`/harness gate <gateId>\`, \`/harness status\`, \`/harness phase <status|advance|rollback|init>\`, ` +
              `\`/harness assume <role>\`, \`/harness role\`.\n\n` +
              `Respond to the user with this message verbatim — do not attempt to perform the requested action.`,
          },
        ]
      }

      let prompt = SKILL_PROMPT
      if (trimmed) {
        prompt += `\n## User input\n\n\`/harness ${trimmed}\``
      } else {
        prompt += `\n## User input\n\n\`/harness\` (no subcommand — show status)`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
