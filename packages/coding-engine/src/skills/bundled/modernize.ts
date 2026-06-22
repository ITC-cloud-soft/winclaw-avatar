import { registerBundledSkill } from '../bundledSkills.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  parseProjectArgs, initializeProject, buildKnowledgeGraph, getGraphEngine,
  analyzeProjectStructure, generateINITIAL, generatePRPs, detectTechStack,
  detectResumeContext, getBestPracticesFiles, resolveTechStack,
  type ProjectArgs, type ProjectStructure, type PRPResult,
} from './shared/projectSetup.js'
import { buildEnvContextForSkill, extractEnvFlag } from '../../services/envManager/skillBridge.js'
// Note: buildSharedTestPrompt is used by /systest, not directly by /modernize

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphStats {
  nodes: number
  edges: number
}

type PRPInfo = PRPResult

// ---------------------------------------------------------------------------
// Prompt builder for Phase 4-6
// ---------------------------------------------------------------------------

function buildModernizePrompt(
  parsed: ProjectArgs,
  structure: ProjectStructure,
  graphStats: GraphStats | null,
  prpInfo: PRPInfo,
): string {
  const designMdPath = join(parsed.output, '.project', 'DESIGN.md').replace(/\\/g, '/')
  const designMdExists = existsSync(join(parsed.output, '.project', 'DESIGN.md'))
  const designStyleName = parsed.designStyle || ''

  const ws = parsed.workspace.replace(/\\/g, '/')
  const out = parsed.output.replace(/\\/g, '/')
  const projectDir = join(parsed.output, '.project').replace(/\\/g, '/')
  const initialPath = join(projectDir, 'INITIAL.md').replace(/\\/g, '/')
  const prpDir = prpInfo.prpDir.replace(/\\/g, '/')
  const moduleIndexPath = prpInfo.indexPath.replace(/\\/g, '/')
  const graphPath = join(parsed.workspace, 'graphify-out', 'graph.json').replace(/\\/g, '/')

  const docsDir = join(parsed.output, 'docs').replace(/\\/g, '/')
  const finalReportPath = join(docsDir, 'MODERNIZATION_REPORT.md').replace(/\\/g, '/')

  // Use RESOLVED stack (user params + DB URL inference) — not raw detection.
  // This ensures best practices match user intent even if detectTechStack returned 'unknown'
  // (common for legacy projects like COBOL where no package.json/requirements.txt exists).
  const techStack = resolveTechStack(parsed, structure, 'legacy')
  const bpFiles = getBestPracticesFiles({
    language: techStack.language,
    backend: techStack.backend,
    frontend: techStack.frontend,
  })
  // Only advertise best practices files when we have a confident match — avoid
  // silent wrong fallbacks (e.g., Rust or C# stacks being told to follow React rules)
  const bpBackendSection = bpFiles.backend
    ? `- Backend (${bpFiles.backendLabel}): ${bpFiles.backend}`
    : ''
  const bpFrontendSection = bpFiles.frontend
    ? `- Frontend (${bpFiles.frontendLabel}): ${bpFiles.frontend}`
    : ''
  const bpHasAny = !!(bpFiles.backend || bpFiles.frontend)
  // Array to record into completion.json — only actually-resolved paths
  // De-duplicate: if backend and frontend resolve to the same file (e.g., TypeScript stack
  // using react-nextjs.md for both), list it once in completion.json.
  const bpCheckedList = Array.from(new Set([bpFiles.backend, bpFiles.frontend].filter(Boolean) as string[]))
    .map(p => '"' + p + '"').join(', ')
  const entityCount = structure.entities?.length || 0
  const routeCount = structure.routes?.length || 0
  const serviceCount = structure.services?.length || 0
  const communityCount = structure.communities?.length || 0

  // Pre-selected screenshots (de-duplicated, max 10) for legacy screen → web page mapping
  const screenshots = structure.screenshots || []
  const screenshotSection = screenshots.length > 0
    ? `
### Legacy UI Screenshots (pre-selected — READ these to understand legacy screens)

${screenshots.map((s, i) => `${i + 1}. **${s.screenName}** → \`${ws}/${s.path}\``).join('\n')}

Read each screenshot above using the Read tool. For each:
1. Identify the screen purpose (login, data entry, search, report, menu)
2. Extract field names and layout structure
3. Map to a modern web page (route, components, form fields)

Do NOT search for additional screenshots. This list is complete.
`
    : ''

  const prompt = `# Legacy Project Modernization — Phase 3 / 3.5 / 4 / 4.5 / 5 / 6

## ⚠️ UNIVERSAL RULES — READ FIRST, VIOLATION = BUILD FAILURE

These rules apply across ALL phases. Phase 4 adds 3 more specific rules
(see "Phase 4 MANDATORY RULES" later) — Phase 4 rules COMPLEMENT these, not replace.

1. **DATABASE**: Use the database specified in Setup Summary. NEVER silently switch to SQLite. If a database URL is provided, USE IT.
2. **All output goes to ${out}** — NEVER modify the legacy codebase in ${ws}
3. **Reference legacy code, do not copy** — modernize patterns, not replicate them
4. **Read ONLY pre-selected screenshots** — do NOT search for additional images
5. **On Windows: use UTF-8 encoding** — never use Out-File or > redirect (produces UTF-16LE). Use Set-Content with -Encoding UTF8, or Edit/Write tools.
6. **CONTINUOUS Phase 4 execution — DO NOT PAUSE BETWEEN MODULES**. Once Phase 3
   is approved, implement ALL pending modules without waiting for additional
   confirmation. Do NOT emit "Progress Update / Next Steps / Continuing with PRP-X"
   style announcements. One-line log per module (\`✓ module (X/N)\`) is fine.

(Former rules "TDD", "knowledge graph", "priority order", "MAX 20 tool calls",
"Swagger UI mandatory" — now enforced by the acceptance-criteria system in Phase 4,
not via separate prose rules.)

Phase 1-2 completed. You MUST now execute Phase 0 (graph init — NEW), then Phase 3 (module decomposition), then Phase 4 (development), then Phase 5/6 (test/docs).

## Setup Summary

Legacy workspace: ${ws}
New project output: ${out}
Backend language: ${parsed.backendLang || techStack.language || 'auto-detect'} (framework: ${techStack.backend || 'auto-detect'})
Frontend language: ${parsed.frontendLang || 'typescript'} (framework: ${techStack.frontend || 'auto-detect'})
Database: ${techStack.database || 'unknown'}
Entities: ${entityCount} | Routes: ${routeCount} | Services: ${serviceCount} | Communities: ${communityCount}
Knowledge graph: ${graphStats ? graphPath + ' (' + graphStats.nodes + ' nodes, ' + graphStats.edges + ' edges)' : 'not available'}
PRP modules: (you will generate these in Phase 3)
${parsed.databaseUrl ? 'Database URL: ' + parsed.databaseUrl : 'Database URL: not provided'}

## Best Practices${bpHasAny ? `

Pre-resolved best practices files (absolute paths — Read them directly):
${bpBackendSection}
${bpFrontendSection}

The Coding and Reviewer Agents will be instructed to READ and ENFORCE these files.
Every Phase 4 module must comply with the MUST-rules from these files.` : `

No bundled best-practices file matches the resolved tech stack exactly.
Apply general secure-coding + clean-architecture principles instead.`}

## ⚠️ CRITICAL: Frontend Web Application is MANDATORY

This project MUST produce BOTH:
1. **Backend** REST API (endpoints, services, database) **with Swagger UI**
2. **Frontend** Web Application (React/Vue SPA with pages, components, routing)

Even if the legacy system is a command-line, terminal, or mainframe application,
the modernized version MUST have a modern web frontend.

The frontend should include:
- **Login page** — authentication with JWT
- **Dashboard** — main page after login with navigation sidebar
- **CRUD pages** — for each entity (list, detail, create, edit, delete)
- **Search/filter** — on list pages
- **Responsive design** — mobile + desktop
- **Consistent styling** — follow DESIGN.md or clean modern SaaS aesthetics

${designMdExists ? `
### UI Design System: ${designStyleName || 'custom'}

A DESIGN.md file is available at: ${designMdPath}

⚠️ READ DESIGN.md BEFORE writing ANY frontend/UI code.
Follow its rules for:
- **Colors**: Use exact hex values from the Color Palette section
- **Typography**: Use specified font families and size hierarchy
- **Components**: Follow button, card, input, navigation styling
- **Layout**: Follow spacing scale and grid system
- **Shadows**: Use the shadow system defined
- **Responsive**: Follow breakpoint rules
` : `
### UI Styling (no DESIGN.md specified)

Use clean, modern SaaS aesthetics:
- Neutral color palette with one accent color
- Inter or system fonts
- Consistent spacing (4px/8px/16px/24px/32px scale)
- Subtle shadows and rounded corners (border-radius: 8px)
- Mobile-first responsive layout
`}

${screenshotSection}
### Legacy Screen → Web Page Mapping

Analyze the legacy system's screens (CICS MAPs, AS-400 DSPFs, terminal screens)
and design modern web equivalents. Each legacy screen should become one or more
web pages:

- Terminal login screen → /login page
- Main menu → /dashboard with sidebar navigation
- Data entry screens → Form pages with validation
- Search/inquiry screens → List pages with filters and pagination
- Report screens → Dashboard pages with charts/tables

Read the INITIAL.md "Frontend Design" section for the mapping table.

## ⚠️ CRITICAL: Swagger UI is MANDATORY

The backend MUST expose Swagger UI for interactive API documentation.
This is NOT optional — every backend MUST have it.

### Setup by framework:

- **FastAPI (Python)**: Built-in. Verify /docs (Swagger UI) and /openapi.json are accessible.
- **Hono / Express (TypeScript)**: Use \`swagger-ui-express\` + \`@hono/swagger-ui\` or \`swagger-jsdoc\`.
  Install: \`npm install swagger-ui-express swagger-jsdoc\` (Express) or \`@hono/swagger-ui\` (Hono)
  Mount at: \`/docs\` or \`/swagger\`
- **Spring Boot (Java)**: Use \`springdoc-openapi-starter-webmvc-ui\`. Endpoint: \`/swagger-ui.html\`
- **Laravel (PHP)**: Use \`darkaonline/l5-swagger\`. Endpoint: \`/api/documentation\`
- **Go-Zero (Go)**: Use \`swaggo/swag\` + \`swaggo/gin-swagger\` or custom handler. Endpoint: \`/swagger/index.html\`

### Requirements:
1. ALL API endpoints MUST be documented with request/response schemas
2. Swagger UI MUST be accessible at a standard path (/docs, /swagger, or /swagger-ui.html)
3. OpenAPI JSON spec MUST be available at /openapi.json or /swagger.json
4. Include authentication (Bearer token) in Swagger UI "Authorize" button
5. Verify Swagger UI loads correctly after backend starts

## Critical Files (YOU MUST READ THESE)

- INITIAL.md (project specification): ${initialPath}
- Module index (all PRP modules): ${moduleIndexPath}
- PRP files directory: ${prpDir}
- Legacy code (read-only reference): ${ws}
- New project output: ${out}

## Performance Guard — PREVENT API TIMEOUT

⚠️ The API will timeout if you make too many consecutive tool calls in one session.

1. **Use knowledge graph FIRST, not file reads** — graph_query / graph_communities
   already contain the project structure. Only Read specific files when needed.
2. **Screenshots are pre-selected** — if legacy screenshots exist, they are listed
   in the "Legacy UI Screenshots" section below. Read ONLY those listed files.
   Do NOT search for additional image files.
3. **Do NOT read every source file** — use graph tools to locate relevant code,
   then Read only the files you need for the current module.
4. **Keep each module implementation under 20 tool calls** — if you're exceeding
   this, you're reading too much. Use the knowledge graph for navigation.

---

## Phase 0: Graph Init (MANDATORY first step — NEW)

⚠️ This phase MUST run before any other Phase. The semantic knowledge graph
is the foundation for all subsequent verification (GATE G'/H'/I'/J',
contract validation, per-module dependency analysis).

### STEP 1: Initialize graphify — TWO graphs are maintained

Modernization has TWO distinct code trees, each with its own graph:

1. **Legacy graph** at \`${graphPath}\` (already built by this skill's TS-side Phase 0)
   - Source: \`${parsed.referenceProject ? parsed.referenceProject.replace(/\\/g, '/') : ws}\`
   - Purpose: Phase 2-3 structural analysis and PRP decomposition
   - Contains: COBOL/BMS/DDS/JCL/RPG/etc. nodes from the legacy system

2. **Output graph** at \`${out}/graphify-out/graph.json\` (also built by TS-side Phase 0, initially empty if \`${out}\` is a fresh directory)
   - Target: \`${out}\` (modernized codebase)
   - Purpose: Phase 4 GATE queries (G'/H'/I'/J'/Contract'/K') check the
     MODERNIZED code, not the legacy reference. Every PRP implementation
     grows this graph via autoUpdate (1.5s debounce after Edit/Write).
   - Initially empty for greenfield modernization — will populate as Phase 4
     generates code into \`${out}\`.

When ${parsed.output !== parsed.workspace ? 'running queries in Phase 4, graph_query resolves against the current working directory (process.cwd()). For modernize with --output, cwd should be the output tree so GATE queries hit the output graph, not the legacy one.' : 'workspace === output (in-place modernization), the two graphs are the same file.'}

### STEP 2: Verify graph readiness

Run \`graph_query("legacy modules")\` to confirm the graph is queryable.
Use \`graph_communities()\` to identify the major modules (sub-systems) of the legacy code.
Expected: query returns response < 100ms. If not ready: STOP and report error before proceeding.

### STEP 3: Confirm auto-update is active

The auto-update layer is built-in:
- Layer 1: Each Edit/Write tool call triggers graph update (1.5s debounce)
- Layer 2: chokidar file watcher catches external changes
- Layer 3: Bootstrap injects repository map at session start

This means: every Todo (acceptance criterion) implementation in the modernized
codebase automatically refreshes the graph. No manual graph update needed.

### STEP 4: Per-Todo graph protocol (applies to all Phase 4 STEP 2)

After EACH acceptance criterion completion in Phase 4:
1. Verify graph reflects recent edits (graph_query for any new file)
2. If graph stale (>5s after Edit but file not reflected): explicit /graphify
3. ⚠️ **PREFER Edit/Write tools over Bash heredoc** for file writes:
   - Edit/Write triggers Layer 1 (1.5s debounce) auto-update directly.
   - Bash heredoc (\`cat > file <<EOF ... EOF\`) bypasses Layer 1 and relies
     on Layer 2 (chokidar), which may lag 5-10s on some filesystems.
   - If you MUST use Bash heredoc (e.g. multi-MB binary, complex templated
     YAML/JSON): after writing, run \`graph_query("<new file path>")\` to
     verify the graph picked it up. If not within 5s, run \`/graphify\` to
     force a refresh before moving on.

### STEP 5: Use graph tools for both legacy and modernized code

- \`graph_query()\`: semantic search across legacy + modernized, 0 token, <10ms
- \`graph_neighbors()\`: dependency analysis (legacy → modern mapping)
- \`graph_path()\`: trace COBOL → React component lineage
- \`graph_communities()\`: identify legacy module clusters
- \`graph_explain()\`: node detail (e.g. COBOL paragraph or React component)

This applies to ALL Phase 1-4 work. Prefer graph_* tools over Grep/Glob
wherever possible — they are 100x faster and consume 0 tokens.

### STEP 5.5: graph_query Result Interpretation Guide (NEW — applies to ALL Phases, legacy AND modernized code)

⚠️ graph_query uses natural language search. Results may include unintended matches,
and a single query can return nodes of many kinds. NEVER consume raw results
blindly — ALWAYS post-process in your reasoning. This applies equally to legacy
code exploration (COBOL / BMS / DDS / JCL) and modernized code verification
(React / FastAPI / OpenAPI).

Standard post-processing pipeline (apply for EVERY graph_query call):

1. **Filter by kind**: result shape is \`{ nodes: [...], edges: [...] }\`. Each
   node has a \`kind\` field (e.g. \`react_route\`, \`designed_route\`, \`css_variable\`,
   \`hardcoded_color\`, \`pydantic_field\`, \`form_input\`, \`openapi_field\`, \`navigate_call\`,
   plus legacy kinds like \`cobol_paragraph\`, \`bms_map\`, \`dds_record\`).
   Always filter to ONLY the kind(s) you actually need:
   \`\`\`typescript
   const reactRoutes = result.nodes.filter(n => n.kind === 'react_route')
   \`\`\`
   Relying on a query's natural-language phrasing alone is non-deterministic —
   kind is the structural ground truth.

2. **Filter by sourceFile when needed**: e.g. to restrict to the modernized
   app routing file (not legacy),
   \`\`\`typescript
   const appRoutes = reactRoutes.filter(n =>
     n.sourceFile.endsWith('/App.tsx') || n.sourceFile.endsWith('/routes.tsx'))
   \`\`\`
   For legacy exploration, filter by \`sourceFile.startsWith(legacyRoot)\`; for
   modernized verification, filter by \`sourceFile.startsWith('\${out}/')\` or
   the modern workspace prefix.

3. **Don't trust label string matching alone**: use structural fields
   (\`kind\`, \`urlPath\`, \`signature\`, \`fieldType\`, \`required\`) for judgment.
   Labels may be truncated or inconsistently cased (especially when mixing
   COBOL uppercase identifiers with camelCase modern code).

4. **Empty result handling**: if filtered result is empty, this may mean any of:
   - No matching nodes exist (real absence — what you wanted to prove)
   - Parser extension didn't capture the pattern yet (false absence — common
     during modernize where a newly-generated React file may not yet be in
     the graph, or a legacy BMS map variant isn't recognized)
   - Query phrasing missed relevant nodes (try \`graph_neighbors\` / \`graph_explain\`
     on a known node and widen)
   When in doubt: cross-check with Grep/Glob for the same pattern, OR run
   \`/graphify\` to force a rebuild, then re-query.

5. **Results may be paginated / capped**: if your bfs or dfs traversal hits the
   depth or limit ceiling, you may be missing nodes. Re-call with higher limit
   (e.g. 500) or narrow the query.

6. **Kind inventory reference** (parser extensions 0-8 — modernized surface):
   - ext 0: \`designed_route\` — rows from PRP Markdown "Frontend Routes" tables
   - ext 1: \`react_route\` — React Router \`<Route>\` declarations
   - ext 2: \`navigate_call\` — \`navigate('/path')\` calls (\`\\\${var}\` → \`:param\`)
   - ext 3: \`form_input\` — \`<input name="X" required>\` in JSX
   - ext 4: \`fastapi_route\` — FastAPI route definition with method, path, request_model
   - ext 5: \`pydantic_field\` — class-level \`field: Type\` with required flag
   - ext 6: \`openapi_field\` — fields from openapi.yaml \`components.schemas\`
   - ext 7: \`css_variable\` — \`--token-name\` in \`:root\` or tailwind.config
   - ext 8: \`hardcoded_color\` — hex / \`bg-[#XXX]\` literals in JSX or CSS
   Legacy parsers produce additional kinds (\`cobol_paragraph\`, \`cobol_copybook\`,
   \`bms_map\`, \`dds_record\`, \`rpg_subroutine\`, \`jcl_step\`) — these are the
   kinds to filter on when exploring \`${parsed.referenceProject ? parsed.referenceProject.replace(/\\/g, '/') : ws}\`.

This guide applies to ALL graph_query usage in Phase 1-6 (both legacy-side
exploration and modernized-side verification). GATE prompts below reference it.

---

## Phase 3: Module Decomposition (YOU must do this FIRST)

Before writing any code, you MUST analyze the legacy system and design the module structure.

### STEP 1: Analyze the legacy system using knowledge graph

1. Run \`graph_communities\` to see the full community/cluster structure
2. Run \`graph_query("program service entity")\` to find key components
3. Read \`${prpDir}/RAW_GRAPH_SUMMARY.md\` for pre-extracted graph data
4. Read the pre-selected legacy screenshots listed above (if any)
5. Read 3-5 key legacy source files to understand business logic

### STEP 2: Design module decomposition

Based on your analysis, decompose the project into **5-15 modules by business function**.

Examples of good module names:
- Authentication (login, logout, session management)
- Employee-Management (CRUD for employees)
- Flight-Search (search, filter, schedule)
- Ticket-Booking (reservation, payment, receipt)
- Reports (statistics, dashboards)

Do NOT name modules after community IDs or file names. Name them after **what they do for the business**.

### STEP 3: Write PRP files

For EACH module, write a PRP file to \`${prpDir}/PRP-{NNN}-{module-name}.md\` containing:

\`\`\`markdown
# PRP-{NNN}: {Module Name}

## Goal
{1-2 sentences: what this module does and why it matters}

## API Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/auth/login | Employee login | none |
| GET | /api/auth/me | Current user profile | bearer |

## Data Models
| Entity | Fields | Source |
|--------|--------|--------|
| Employee | id, name, dept, email, password_hash | {legacy file} |

## Legacy Code References
- {file path}: {why this file matters for this module}

## Frontend Pages
| Route | Page | Components |
|-------|------|-----------|
| /login | Login Page | LoginForm, PasswordInput |

## Success Criteria
- [ ] {testable acceptance criterion 1}
- [ ] {testable acceptance criterion 2}
\`\`\`

#### PRP STRUCTURE — Frontend Routes table (MANDATORY for any module with UI)

For each PRP that defines a UI module, you MUST include a "Frontend Routes"
section with this CANONICAL table:

\`\`\`markdown
## Frontend Routes (CANONICAL — Phase 4 enumerates ALL pages from this table)

| # | Route                  | Page Component (file)              | Pattern | Source PRP fields              |
|---|------------------------|------------------------------------|---------|--------------------------------|
| 1 | /passengers            | passengers/PassengerListPage.tsx   | List    | Passenger.* (read)             |
| 2 | /passengers/new        | passengers/PassengerCreatePage.tsx | Form    | PassengerCreate (write, all required) |
| 3 | /passengers/{id}       | passengers/PassengerDetailPage.tsx | Detail  | Passenger.* (read)             |
| 4 | /passengers/{id}/edit  | passengers/PassengerEditPage.tsx   | Form    | PassengerUpdate (write)        |
\`\`\`

INVARIANTS (Phase 4 GATE G' verifies these):
1. EVERY user-reachable page is a row. If Detail page has Edit button,
   the /resource/{id}/edit row MUST also exist as separate row.
2. Standard CRUD modules MUST include all 4 routes (List, Create, Detail, Edit).
3. File naming convention is FIXED:
   - {Pascal}ListPage.tsx for List
   - {Pascal}CreatePage.tsx for Create
   - {Pascal}DetailPage.tsx for Detail
   - {Pascal}EditPage.tsx for Edit
4. The "Source PRP fields" column references the Pydantic (or equivalent) schema
   name (PassengerCreate / PassengerUpdate) for Form rows.

#### DATA MODEL RULES (MANDATORY)

For EACH entity in Data Model, write a complete field table:

\`\`\`markdown
### Passenger
| Field        | Type         | Required | PK | Default | Notes |
|--------------|--------------|:-:|:-:|---------|-------|
| passengerid  | int          | yes | ✓ | auto    | server-assigned |
| firstname    | varchar(50)  | **yes** | | —       | from legacy FNAME |
| lastname     | varchar(50)  | **yes** | | —       | from legacy LNAME |
| email        | varchar(100) | **yes** | | —       | unique |
| phone        | varchar(20)  | no  | | NULL    |       |
| address      | text         | **yes** | | —       | from legacy ADDR |

### PassengerCreate (Pydantic schema for POST /api/passengers)
required: firstname, lastname, email, address
optional: phone

### PassengerUpdate (Pydantic schema for PUT /api/passengers/{id})
required: firstname, lastname, email, address
optional: phone
\`\`\`

INVARIANTS:
1. Every entity used in a Frontend Form route MUST have explicit
   {Entity}Create and {Entity}Update sections with required/optional lists.
2. Phase 4 STEP 3 contract validation reads these to verify form fields.
3. NEVER omit required fields — defaulting to "yes" if the legacy field was
   non-nullable (COBOL PIC X without NULL allowed, DDS field without ALWNULL),
   "no" only if legacy explicitly allows NULL.

#### Edit Button Convention (MANDATORY)

Whenever a Detail page mentions an "Edit button" / "Update action" / "Modify",
the next row in the Routes table MUST be the corresponding /resource/{id}/edit row.

Do NOT mention "Edit button" in components without listing the Edit route.

Same applies to Delete: if Delete is inline (modal confirm), no Delete route needed;
if it navigates to a confirmation page, list the Delete route.

#### PRP STRUCTURE — Completion Marker Template (MANDATORY — copied verbatim in Phase 4)

Every PRP-NNN-*.md file (business modules AND Frontend Infrastructure) MUST end
with the following section. Phase 4 STEP 3 FINAL will read this section out of
the PRP file and copy the JSON block to \`done/\` — so physical proximity of the
skeleton to the implementation work is the enforcement mechanism for B-1
compliance. DO NOT omit this section from any PRP.

Append this block as the LAST section of every PRP you generate:

## Completion Marker Template (COPY to \`done/{PRP-NNN-slug}.completion.json\` in Phase 4 STEP 3 FINAL)

\`\`\`json
{
  "prpName": "PRP-NNN-ModuleSlug",
  "prp_id": "PRP-NNN",
  "module_name": "Module Slug",
  "completedAt": "<ISO8601 UTC>",
  "completed_at": "<ISO8601 UTC>",
  "status": "completed",
  "acceptanceCriteria": [
    { "id": "ac-1", "text": "<criterion from this PRP>", "verified": true, "evidence": "<source file or test>" }
  ],
  "gates_verified": {
    "G":        { "pass": true, "note": "<coverage — missing pages list if any>" },
    "H":        { "pass": true, "note": "<broken nav — from graph_query>" },
    "I":        { "pass": true, "note": "<design token usage ratio>" },
    "J":        { "pass": true, "note": "<shared component adoption>" },
    "Contract": { "pass": true, "note": "<openapi vs pydantic_field/openapi_field>" },
    "K":        { "advisory": true, "note": "<cohesion — community analysis>" }
  },
  "verification": {
    "reviewVerdict": "PASS",
    "testsPass": true,
    "note": "<short summary>"
  },
  "artifacts": {
    "sourceFiles": ["<file path>"]
  }
}
\`\`\`

> Rule: In Phase 4 STEP 3 FINAL, **COPY this block verbatim** from this PRP file, replace placeholder values (\`<...>\`) with real values, and write to \`done/{PRP-NNN-slug}.completion.json\`. Do NOT reconstruct from scratch.

INVARIANTS:
1. The \`## Completion Marker Template\` heading text MUST be exact — Phase 4 greps for it.
2. The inner JSON fence MUST use \`\`\`json (lowercase, no language alias).
3. Do NOT pre-fill placeholder values in Phase 3 — leave \`<...>\` tokens intact so Phase 4 knows what to replace.
4. Every PRP (business + Frontend Infrastructure) includes this section. No exceptions.

### STEP 3.5: Write a PRP for Frontend Shared Infrastructure (MANDATORY — last PRP)

After writing all business module PRPs, write ONE more PRP covering the shared
frontend infrastructure that all modules depend on. Name it \`PRP-{last+1}-Frontend-Infrastructure.md\`.

This PRP is NOT a business module — it covers cross-cutting frontend concerns
that have no corresponding backend module but still require implementation work
that needs to be tracked with a completion.json record (just like any other module).

\`\`\`markdown
# PRP-{NNN}: Frontend Infrastructure

## Goal
Implement the shared frontend infrastructure that all business modules depend on:
- App shell (Sidebar nav, Header, Footer)
- Authentication context and protected routes
- React Router setup with route guards
- API client with base URL + automatic auth token injection
- Global providers (QueryClient, Auth, Router, Theme)
- Design system application (colors, typography, spacing from DESIGN.md / FRONTEND_DESIGN.md §1)

## Dependencies
MUST be implemented AFTER all business module PRPs are complete (it wires them together).

## Required Deliverables
| File | Purpose |
|------|---------|
| \`frontend/src/App.tsx\` | Root component with all providers (QueryClient, Auth, Router) |
| \`frontend/src/layout/AppLayout.tsx\` | Sidebar + Header + Content shell |
| \`frontend/src/layout/Sidebar.tsx\` | Navigation with links to each business module |
| \`frontend/src/layout/Header.tsx\` | Top bar with user info + logout |
| \`frontend/src/auth/AuthContext.tsx\` | Auth state, login/logout, token storage |
| \`frontend/src/auth/ProtectedRoute.tsx\` | Route guard component |
| \`frontend/src/api/client.ts\` | fetch wrapper with base URL + Authorization header |
| \`frontend/src/routes.tsx\` | React Router config with all module routes |
| \`frontend/src/styles/global.css\` | Design system tokens |

## Success Criteria
- [ ] \`npm run build\` in frontend/ completes without errors
- [ ] App renders without console errors
- [ ] Login flow works end-to-end (form → API → token stored → redirect)
- [ ] All business module routes are registered and navigable from sidebar
- [ ] Logout clears state and redirects to login
- [ ] Protected routes redirect to login when unauthenticated
- [ ] 401 response triggers automatic logout
- [ ] Design system tokens applied (colors, typography match FRONTEND_DESIGN.md §1)
\`\`\`

This PRP goes through the same Phase 4 pipeline (Coding/Reviewer/Tester agents) and
produces a \`done/PRP-{NNN}-Frontend-Infrastructure.completion.json\` file like any
other module — **every PRP must leave a completion record.**

### STEP 4: Write MODULE_INDEX.md

Update \`${prpDir}/MODULE_INDEX.md\` with:
- Execution order (dependencies first)
- Module dependency diagram (mermaid)
- **List ALL PRPs including the Frontend Infrastructure PRP as the LAST entry**
  (it depends on all business modules and wires them together)

### STEP 5: Write FRONTEND_DESIGN.md (MANDATORY — unified design document)

Write \`${prpDir}/FRONTEND_DESIGN.md\` — a single unified design document used by:
- Phase 4 Coding Agents (as design spec, not free-form)
- Phase 4 Reviewer Agent (verify code matches design)
- User review (if -v flag is used)

The document MUST have exactly 5 sections:

**Section 1: Design System (global, applied everywhere)**
- Color palette table (token → value → usage)
  - If DESIGN.md exists at \`${designMdPath}\`: extract tokens from there
  - Otherwise: define primary + neutral + semantic (success/warning/error) colors
- Typography table (token → font → size → weight → usage)
- Spacing scale (e.g., 4/8/12/16/24/32/48/64 px)
- Component styles (Button/Input/Select/Table/Card/Modal):
  - Height, padding, border-radius, variants

**Section 2: Shared UI Patterns**
- List Page Pattern: header actions, filters, columns, pagination, row actions
- Detail Page Pattern: breadcrumb, info sections, related data, actions
- Form Page Pattern: sections, field layout, validation display, submit/cancel
- States: Loading (skeleton), Error (banner/full-page), Empty (illustration+CTA)
- Do NOT use ASCII wireframes — use structured text descriptions

**Section 3: Global Layout**
- App shell: header (logo, search, user menu), sidebar (navigation), content area
- Responsive breakpoints: desktop / tablet / mobile behavior

**Section 4: Per-Module Design (for EACH business PRP)**

For each PRP, write a subsection with this EXACT structure:

\`\`\`markdown
### 4.X {Module Name} (PRP-{NNN})

#### Route: {path}

**Pattern:** List Page / Detail Page / Form Page / Custom

**Fields table:**
| Field | Source (PRP) | Type | Required | Validation |
|-------|--------------|------|----------|-----------|
| ... | data model field | text/number/select | yes/no | from PRP business rules |

**Actions:**
- Action name → API call (from PRP endpoints) → success/error behavior

**Permissions:**
- Who can see this page (from auth rules)
- Who can perform each action

**Legacy reference:** {legacy source file or screenshot if available, else "N/A"}

**States:** (if non-standard)
- Loading/Error/Empty handling specific to this route
\`\`\`

Rules for per-module content:
- Every field row MUST trace to a PRP data model field
- Every action MUST trace to a PRP API endpoint
- Every validation MUST trace to a PRP business rule
- NO invented endpoints or fields
- NO placeholder text / copywriting detail (field labels yes, placeholder text no)
- NO ASCII wireframes

**Section 5: Navigation**
- Sidebar items: Label, Icon hint, Route, Visibility rule (based on auth roles)
- Group items by business area if more than 6 items

#### SECTION 4 (Per-Module Design) ENHANCED RULES

Each module subsection MUST start with a "Routes table" that MIRRORS the
PRP-NNN's Frontend Routes table EXACTLY:

\`\`\`markdown
### 4.3 Passenger Management (PRP-003)

**Routes table** (mirrored from PRP-003 § Frontend Routes):

| # | Route                 | Component           | Pattern |
|---|-----------------------|---------------------|---------|
| 1 | /passengers           | PassengerListPage   | List    |
| 2 | /passengers/new       | PassengerCreatePage | Form    |
| 3 | /passengers/{id}      | PassengerDetailPage | Detail  |
| 4 | /passengers/{id}/edit | PassengerEditPage   | Form    |

(detailed sections per route follow)

#### Route: /passengers/{id}/edit
**Pattern:** Form Page
**Backend contract:** PUT /api/passengers/{id} → PassengerUpdate schema
**Required fields** (from backend Pydantic / equivalent schema):
| Field       | Type  | Validation     | UI Hint    |
|-------------|-------|----------------|------------|
| firstname   | text  | maxLength:50   | TextInput  |
| lastname    | text  | maxLength:50   | TextInput  |
| email       | email | format:email   | EmailInput |
| address     | text  | -              | TextArea   |
\`\`\`

INVARIANTS:
1. Routes table must have IDENTICAL # / Route / Component / Pattern columns as PRP.
2. Each Form Pattern row MUST list ALL required fields from matching
   {Entity}Create / {Entity}Update schema. NEVER omit a required backend field.
3. If schema info unclear, mark fields with "(inferred — verify in Phase 4)".

### STEP 6: PRP-FRONTEND_DESIGN consistency check (NEW)

After generating all PRP-NNN.md and FRONTEND_DESIGN.md, run integrity check:

For each PRP-NNN with Frontend Routes:
1. Read PRP-NNN's "Frontend Routes" table → set A
2. Read FRONTEND_DESIGN.md §4.X "Routes table" → set B
3. A ⊖ B should be empty (every route in PRP has matching DESIGN entry, vice versa)
4. For each Form route in BOTH:
   a. Get required fields from FRONTEND_DESIGN form definition
   b. Get required fields from PRP {Entity}Create schema
   c. Diff: any required field in Pydantic/schema but missing from DESIGN form = error

Write \`${prpDir}/PRP_DESIGN_AUDIT.md\` with all findings.
If errors: STOP and ask user before proceeding to Phase 4.

This catches the airlinesys-class issue where PRP says "Edit button" but
FRONTEND_DESIGN doesn't list /resource/{id}/edit, leading to Phase 4 missing pages.
In modernization context: a legacy Edit screen (e.g. DDS subfile detail with F6=Update)
must map to BOTH a Detail page AND an Edit page — never just one.

### CHECKPOINT: Phase 3 Complete${parsed.verify ? ' → Verify Review Required' : ' → Proceed to Phase 4'}
${parsed.verify ? `
🛑 **VERIFY MODE (-v flag detected) — STOP for user review**

Do NOT proceed to Phase 4 automatically. Follow this exact protocol:

**STEP 1: Display a compact summary to the user:**

- Module count and names (from MODULE_INDEX.md)
- Execution order
- Tech stack (from INITIAL.md)
- Design system highlights (colors/typography from FRONTEND_DESIGN.md §1)
- Key design decisions made
- Gaps or assumptions you made during analysis

**STEP 2: Display the file list:**

- \`${initialPath}\` — overall spec
- \`${prpDir}/MODULE_INDEX.md\` — execution order
- \`${prpDir}/PRP-*.md\` — per-module specs ({N} files)
- \`${prpDir}/FRONTEND_DESIGN.md\` — unified UI design
- \`${prpDir}/RAW_GRAPH_SUMMARY.md\` — analysis data

**STEP 3: Display this EXACT message and STOP:**

---

📋 **Phase 3 Complete — Review Required (-v mode)**

Design artifacts written. Please review the files listed above.

- To proceed to Phase 3.5 (Contract Generation) then Phase 4, reply: **"continue"** or **"proceed"**
- To request changes, describe what you want adjusted (any format, free text)

---

**STEP 4: Wait for user input.** Do NOT spawn agents, do NOT start Phase 3.5 or Phase 4.

**STEP 5: Handle user response:**
- If user says "continue" / "proceed" / "ok" / "go": proceed to Phase 3.5, then Phase 4
- If user describes changes: apply them (edit PRPs / FRONTEND_DESIGN.md / MODULE_INDEX.md
  as needed), then re-display the summary and STOP again for re-confirmation
- Loop until user approves
` : `
After all Phase 3 files are written (PRPs + MODULE_INDEX.md + FRONTEND_DESIGN.md),
log: "Phase 3 complete: {N} modules defined. Starting Phase 4..."
Proceed immediately to Phase 3.5 without waiting for user.
`}

---

## Phase 3.5: Contract Generation (NEW — between Phase 3 and Phase 4)

⚠️ **Contract-first for legacy modernization.**

For modernize, the canonical OpenAPI contract is the bridge between:
- **Legacy structures** (COBOL screens, DDS records, database tables) — analyzed by Phase 1-2
- **Modernized API design** (PRPs from Phase 3)
- **Implementation in Phase 4** (backend + frontend in parallel)

Without a contract, the modernized backend and frontend may drift from each other
AND from the legacy semantics, leading to runtime failures (422 errors on form
submission, missing fields silently dropped, stale enum values, etc.). This is
the airlinesys5-class contract-mismatch bug seen in prior modernization runs.

Phase 3.5 produces a single source of truth — \`${prpDir}/contracts/openapi.yaml\` —
that Phase 4 Backend & Frontend Agents both consume, and Phase 4.5 verifies
both sides conform to.

### STEP 1: Aggregate API endpoints from PRPs

Read every \`${prpDir}/PRP-*.md\` file and extract the API endpoints each module
defines. Endpoints in a modernization derive from **legacy transactions / programs
in the reference project at \`${parsed.referenceProject ? parsed.referenceProject.replace(/\\/g, '/') : ws}\`**
(e.g. one CICS transaction → one POST endpoint, one DDS subfile → one GET list +
GET detail pair).

For each module produce a list of rows like:

| Method | Path | Module (PRP) | Legacy origin | Request body schema | Response schema | Notes |
|--------|------|--------------|---------------|---------------------|-----------------|-------|
| GET | /api/passengers | PRP-002-passenger | PASSLIST CICS txn / SUBFILE PASSGR01 | — | PassengerList | paginated |
| POST | /api/passengers | PRP-002-passenger | PASSENT CICS txn / DDS PASSMSTR | PassengerCreate | Passenger | 201 on success |
| PUT | /api/passengers/{id} | PRP-002-passenger | PASSUPD CICS txn | PassengerUpdate | Passenger | — |

Write this intermediate table to \`${prpDir}/contracts/ENDPOINTS.md\` for audit
purposes. Include a column that cites the legacy program or screen name so the
contract is traceable back to the COBOL source.

### STEP 2: Aggregate Data Models from PRPs

For each entity referenced in STEP 1's endpoints, consolidate its fields by
reading both the modernized PRP definition AND the legacy record layout
(DDS / copybook) from the knowledge graph.

Transformation rules (legacy → OpenAPI):

- **COBOL \`PIC X(N)\`** → \`type: string, maxLength: N\`
- **COBOL \`PIC 9(N)\`** → \`type: integer\` (or \`type: string, pattern: '^[0-9]{N}$'\` if leading zeros matter)
- **COBOL \`PIC S9(M)V9(D)\`** / DDS \`DECIMAL\` → \`type: number\` with documented precision
  (M digits integer, D digits fractional) — note as \`x-decimal-precision: [M, D]\` extension
- **DDS \`ALWNULL\`** → \`nullable: true\` (and field is omitted from \`required\`)
- **DDS \`REFFLD\`** reference fields → resolve to the referenced base field's type
- **Date fields** (COBOL 8-digit numeric, DDS DATE) → \`type: string, format: date\` (ISO 8601)
- **Timestamp fields** → \`type: string, format: date-time\`
- **Legacy flag fields** (PIC X single-char Y/N) → \`type: boolean\` after semantic transform
- **Enumerations** (DDS VALUES clause) → \`type: string, enum: [...]\`

Write \`${prpDir}/contracts/MODELS.md\` listing each entity with fields in a table:

| Field | OpenAPI type | Legacy origin | Required | Notes |
|-------|--------------|---------------|----------|-------|
| id | integer | PASSMSTR.PASSID PIC 9(8) | yes | PK |
| name | string (maxLength 30) | PASSMSTR.PASSNM PIC X(30) | yes | — |
| email | string (nullable, format: email) | PASSMSTR.PASSEM PIC X(60) ALWNULL | no | — |
| status | string enum [A,I,S] | PASSMSTR.PASSST VALUES('A' 'I' 'S') | yes | A=Active I=Inactive S=Suspended |

### STEP 3: Generate canonical OpenAPI YAML

Using the outputs of STEP 1 and STEP 2, write \`${prpDir}/contracts/openapi.yaml\`.

Structure:

\`\`\`yaml
openapi: 3.1.0
info:
  title: ${(parsed.workspace.replace(/\\/g, '/').split('/').pop() || 'Modernized API')} (Modernized)
  version: 0.1.0
  description: |
    Canonical contract for the modernized system.
    Derived from legacy sources in ${parsed.referenceProject ? parsed.referenceProject.replace(/\\/g, '/') : ws}.
servers:
  - url: http://localhost:8000
    description: local dev backend
paths:
  /api/passengers:
    get:
      operationId: listPassengers
      parameters:
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: size
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        '200':
          description: paginated passenger list
          content:
            application/json:
              schema:
                \\$ref: '#/components/schemas/PassengerList'
    post:
      operationId: createPassenger
      requestBody:
        required: true
        content:
          application/json:
            schema:
              \\$ref: '#/components/schemas/PassengerCreate'
      responses:
        '201':
          description: created
          content:
            application/json:
              schema:
                \\$ref: '#/components/schemas/Passenger'
  /api/passengers/{id}:
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: integer }
    get:
      operationId: getPassenger
      responses:
        '200':
          description: passenger detail
          content:
            application/json:
              schema:
                \\$ref: '#/components/schemas/Passenger'
    put:
      operationId: updatePassenger
      requestBody:
        required: true
        content:
          application/json:
            schema:
              \\$ref: '#/components/schemas/PassengerUpdate'
      responses:
        '200':
          description: updated
          content:
            application/json:
              schema:
                \\$ref: '#/components/schemas/Passenger'
components:
  schemas:
    Passenger:
      type: object
      required: [id, name, status]
      properties:
        id: { type: integer, description: 'legacy PASSMSTR.PASSID' }
        name: { type: string, maxLength: 30 }
        email: { type: string, format: email, nullable: true }
        status: { type: string, enum: [A, I, S] }
    PassengerCreate:
      type: object
      required: [name, status]
      properties:
        name: { type: string, maxLength: 30 }
        email: { type: string, format: email, nullable: true }
        status: { type: string, enum: [A, I, S] }
    PassengerUpdate:
      type: object
      properties:
        name: { type: string, maxLength: 30 }
        email: { type: string, format: email, nullable: true }
        status: { type: string, enum: [A, I, S] }
    PassengerList:
      type: object
      required: [items, total, page, size]
      properties:
        items:
          type: array
          items:
            \\$ref: '#/components/schemas/Passenger'
        total: { type: integer }
        page: { type: integer }
        size: { type: integer }
\`\`\`

Rules:

- Every \`POST\`/\`PUT\`/\`PATCH\` with a request body MUST define a named schema
  under \`components/schemas\` — inline schemas break type generation.
- Every path parameter MUST be declared with \`required: true\`.
- Every response MUST declare \`content\` with \`application/json\` for JSON endpoints.
- Use \`operationId\` on every operation — it becomes the TypeScript client method name.
- Preserve legacy field names in \`description\` (e.g. \`'legacy PASSMSTR.PASSID'\`)
  for traceability back to the COBOL source.

### STEP 4: Contract invariants (MUST hold)

Before writing the file, verify the following invariants. If any fails, fix the
PRP-derived data and regenerate:

1. **Every PRP that mentions a form (Create/Edit page)** has a corresponding
   \`{Entity}Create\` and/or \`{Entity}Update\` schema in \`components/schemas\`.
2. **Every required field on a Create form in the PRP / FRONTEND_DESIGN.md**
   appears in the schema's \`required\` array — this is the #1 source of 422 errors.
3. **No orphan schemas** — every schema in \`components/schemas\` is either
   referenced by a path operation, or is a sub-schema of one that is.
4. **No orphan paths** — every path is covered by some PRP (cross-check STEP 1's
   table).
5. **Enum values match the legacy source** — if DDS says \`VALUES('A' 'I' 'S')\`,
   the OpenAPI enum MUST be \`[A, I, S]\`, not a "modernized" rename.

### STEP 5: Validate with \`@redocly/cli\` (optional but recommended)

If the tool is already installed in the project (check with
\`npx --no-install @redocly/cli --version\`), run:

\`\`\`bash
npx --no-install @redocly/cli lint ${prpDir}/contracts/openapi.yaml
\`\`\`

If the tool is not installed, proceed — do NOT auto-install it. Phase 4.5
will re-validate via FastAPI's built-in schema generation.

### STEP 6: Generate frontend TypeScript types

Install \`openapi-typescript\` as a devDependency so type generation is
reproducible and version-pinned (do NOT use on-the-fly \`npx -y\`):

\`\`\`bash
cd ${out}/frontend
npm install --save-dev openapi-typescript
npx --no-install openapi-typescript ${prpDir}/contracts/openapi.yaml -o src/types/api.ts
\`\`\`

Pre-generate types so Frontend Agents in Phase 4 can import them from day one.

If \`${out}/frontend\` does not yet exist (Phase 4 will create it), defer this
step — set a reminder in the first Frontend-Infrastructure PRP agent prompt to
run the install + generate commands before writing any page.

If \`openapi-typescript\` is not installable (offline, etc.), Frontend Agents
will hand-write types from \`openapi.yaml\` — document this fallback in
\`${prpDir}/contracts/README.md\`.

### STEP 7: Verify graph integration

After writing \`${prpDir}/contracts/openapi.yaml\`, the auto-updater
(chokidar-based) will parse it and emit \`openapi_field\` nodes used later by
GATE Contract' in Phase 4. Quick sanity check:

\`\`\`
graph_query("openapi_field", "bfs", 5)
\`\`\`

If no nodes appear after ~5 seconds, log a warning — the contract file was
written but the graph is not indexing it. Phase 4.5 STEP 3 will still catch
drift via direct YAML parsing, so this is non-fatal.

---

### CHECKPOINT: Phase 3.5 Complete → Proceed to Phase 4

Artifacts produced:
- \`${prpDir}/contracts/ENDPOINTS.md\`
- \`${prpDir}/contracts/MODELS.md\`
- \`${prpDir}/contracts/openapi.yaml\` (canonical)
- \`${out}/frontend/src/types/api.ts\` (if frontend dir already exists)

Log: "Phase 3.5 complete: contract with {N} paths / {M} schemas written. Starting Phase 4..."
Proceed immediately to Phase 4 without waiting for user.

---

## Phase 4: Multi-Agent TDD Module Development

You are the **PM (coordinator)**. For EACH PRP module, you delegate work to
specialized agents using the Agent tool. You do NOT write code yourself.

### Your Team

| Role | How to spawn | Responsibility |
|------|-------------|---------------|
| **You (PM)** | — | Read PRP, write spec, coordinate, judge quality |
| **Coding Agent** | \`Agent({ description: "Implement {module}", prompt: "..." })\` | Write production code |
| **Reviewer Agent** | \`Agent({ description: "Review {module}", prompt: "..." })\` | Check code quality, security, PRP compliance |
| **Tester Agent** | \`Agent({ description: "Test {module}", prompt: "..." })\` | Write tests, run tests, fix bugs |

### Parallel Optimization

When Module B has NO dependency on Module A, spawn Coding Agents in parallel:
\`\`\`
Agent({ description: "Implement Module-A", prompt: "...", run_in_background: true })
Agent({ description: "Implement Module-B", prompt: "...", run_in_background: true })
\`\`\`

${parsed.databaseUrl ? `### Database Setup (BEFORE first module)

Database URL: ${parsed.databaseUrl}
Before implementing any module, verify/create the database:
- MySQL: \`mysql -h <host> -P <port> -u <user> -p'<pass>' -e "CREATE DATABASE IF NOT EXISTS <dbname>"\`
- PostgreSQL: \`PGPASSWORD='<pass>' psql -h <host> -p <port> -U <user> -c "CREATE DATABASE <dbname>" 2>/dev/null || true\`
` : ''}

### 🚨 CRITICAL LOOP CONTROL — READ THIS FIRST

Phase 4 has **ONE WORKFLOW that repeats for EVERY PRP module**. You MUST complete
ALL modules before reaching the CHECKPOINT at the end. Common failure mode:
completing 1 module and stopping — **THIS IS A CRITICAL VIOLATION.**

**Progress Tracking (MANDATORY):**

1. Read MODULE_INDEX.md and count the total number of PRP modules: N
2. Create \`${join(parsed.output, '.project', 'PHASE4_PROGRESS.md').replace(/\\/g, '/')}\`:
   \`\`\`markdown
   # Phase 4 Progress
   Total modules: N
   Completed: 0/N

   - [ ] PRP-001-{name}
   - [ ] PRP-002-{name}
   - [ ] PRP-003-{name}
   ... (all modules from MODULE_INDEX.md)
   \`\`\`
3. After EACH module completes STEP 1-4, check off the box and save the file
4. Do NOT pause or emit a user-visible progress announcement between modules.
   A terse single-line log (e.g., \`✓ module-name (3/8)\`) is OK; a multi-line
   "Progress Update / Next Steps / Continuing with..." block is a VIOLATION
   of the continuation rule and will make the run feel like it stopped.

**Loop Exit Condition:**

You may ONLY proceed to the CHECKPOINT section when:
- \`Completed: N/N\` in PHASE4_PROGRESS.md
- EVERY checkbox is checked
- NO PRP file has been skipped

**If you have completed module X < N and are tempted to stop:** YOU ARE WRONG.
Go back to STEP 1 with the next unchecked module. Do NOT announce completion,
do NOT suggest /systest, do NOT write PHASE4_SUMMARY.md until ALL modules are done.

---

### 🔄 STEP 0 — Resume Check (MANDATORY before STEP 1)

Before starting any module work, check for previously completed modules.
**Use cross-platform tools (Glob/Read/Write), NOT bash-specific commands like ls/touch/wc.**

#### STEP 0 PRE-CHECK — Rescue misplaced completion markers (B-4 enforcement)

Before the main Glob, scan for MISPLACED completion markers and progress
files from previous sessions. This rescues the digtalhuman-class failure
where AI wrote to \`.project/prps/completion/\` instead of the canonical
\`.project/prps/done/\` directory, or used \`.json\` instead of
\`.completion.json\` suffix.

1. Known wrong directories (scan each, move any finds to \`${prpDir}/done\`):
   - \`Glob({ pattern: "${prpDir}/completion/*.json" })\` — wrong dir name
   - \`Glob({ pattern: "${prpDir}/completed/*.json" })\` — wrong dir name
   - \`Glob({ pattern: "${prpDir}/finished/*.json" })\` — wrong dir name
   - \`Glob({ pattern: "${prpDir}/done/*.json" })\` — right dir but may be
     missing the \`.completion\` suffix

2. For each file found in a wrong location:
   a. Read the content
   b. Verify it has a valid PRP module structure (\`prpName\` or \`prp_id\`,
      plus \`acceptanceCriteria\` or equivalent \`verification\`)
   c. If valid: MOVE / rename via Write tool to
      \`${prpDir}/done/{PRP-name}.completion.json\` (add \`.completion\`
      before \`.json\` if the suffix is missing)
   d. If invalid: leave in place but log WARNING noting the path

3. Check for misplaced progress files and move them to the canonical
   location \`${join(parsed.output, '.project', 'PHASE4_PROGRESS.md').replace(/\\/g, '/')}\`:
   - \`${prpDir}/progress.md\` → move to canonical
   - \`${prpDir}/PHASE4_PROGRESS.md\` → move to canonical
   - Any \`PHASE4_PROGRESS.md\` outside \`${projectDir}/\` → move it

4. Log WARNING listing every wrong path you encountered and the canonical
   destination you moved it to. This keeps the audit trail for the user.

After rescue, proceed with normal Resume Check below using the canonical paths.

#### STEP 0 MAIN — Classify completion markers

1. Create the done directory if missing: use Write/Bash with cross-platform command
   - Bash tool on Windows uses Git Bash, so \`mkdir -p "${prpDir}/done"\` works
   - Alternative: the directory is created automatically when you Write the first file to it

2. List existing completion markers with the Glob tool:
   \`Glob({ pattern: "${prpDir}/done/*.completion.json" })\`

3. For each completion.json found, Read it and verify (accept BOTH schemas):
   - **NEW schema** (acceptance-criteria-driven): \`acceptanceCriteria\` is a non-empty array AND every item has \`verified === true\`
   - **OLD schema** (legacy completions from prior runs): \`verification.reviewVerdict === "PASS"\` AND \`verification.testsPass === true\` AND at least one file in artifacts.sourceFiles exists

3.5. Verify \`gates_verified\` block (B-1 enforcement — NEW)
   For each completion.json that passed the step-3 acceptanceCriteria check:
   - Read the \`gates_verified\` field.
   - **If absent entirely**: log WARNING and classify as **SEMI-VALID**
     (accept as completed but flag for re-verification in the next Phase 4
     STEP 3 round — do NOT re-implement from scratch, backward compat for
     projects started before this enforcement).
   - **If present but any of \`G\`, \`H\`, \`I\`, \`Contract\` (the 4 hard
     gates) has \`"pass": false\` with no \`"skipped": true\`**: classify
     as **INVALID** (quality failure — re-implement; this catches the
     airlinesys6 / digtalhuman pattern where Edit pages were systematically
     missing).
   - **If all 4 hard gates (\`G\`/\`H\`/\`I\`/\`Contract\`) are pass=true or
     legitimately skipped=true, AND \`J\`/\`K\` keys are present (their
     pass/fail value is advisory and does NOT affect classification)**:
     classify as **VERIFIED COMPLETE**. J is WARN-only (shared component
     adoption), K is purely informational (module cohesion) — both record
     state but never block completion.
   - **If malformed** (missing key, invalid JSON shape): classify as
     **INVALID** — re-implement.

4. List all PRP files: \`Glob({ pattern: "${prpDir}/PRP-*.md" })\`

5. Classify each PRP as:
   - **completed** — has valid completion.json + gates_verified intact + source files exist
   - **semi-valid** — valid acceptanceCriteria but no gates_verified (legacy / pre-B1); accept but flag
   - **pending** — no completion.json, OR verification failed, OR source files missing
   - **invalid** — has .done marker but completion.json is missing/invalid, OR gates_verified reports unskipped failure (AI cheat attempt or quality failure — treat as pending and re-implement)

6. Display to user:
   \`\`\`
   📊 Phase 4 Status (code-verified, not AI self-reported):
   - Verified complete: {count(completed)}/{total}
   - Pending: {count(pending)} — {list}
   - Invalid markers detected: {count(invalid)} (re-implementing)
   \`\`\`

7. Write PHASE4_PROGRESS.md to mirror the PHYSICAL state (use Write tool, overwrite any AI-reported status):
   \`\`\`markdown
   # Phase 4 Progress (auto-synced from verified completion.json files)
   Total: N
   Completed (verified): X
   Pending: N-X

   ## Completed (source files verified on disk)
   - [x] {PRP name} — completed at {timestamp from completion.json}

   ## Pending
   - [ ] {PRP names without valid completion.json}
   \`\`\`

⚠️ **AUTHORITATIVE STATUS:** The \`.completion.json\` files (with real verification data)
are the source of truth. An empty \`.done\` marker file by itself does NOT count —
a valid completion.json with verifiable artifacts is required.

If all modules are verified complete: skip to CHECKPOINT.
Otherwise: proceed to the per-module loop below.

---

### For EACH PRP Module (in MODULE_INDEX.md order):

The legacy per-module workflow was 5 sub-steps with split agents, API-gen helpers, and
14 mandatory rules. That bloat is gone. You now drive each module through 4 steps.
**Meta Coder decides HOW** (one agent, many agents, serial, parallel — your call). What
we DO require: acceptance criteria defined BEFORE coding, every criterion actually
re-executed after coding, and the evidence packaged into completion.json so the
code-side runtime verifier can re-run it independently.

---

#### STEP 1 — Define acceptance criteria

Before writing any implementation code, produce a criteria list for this module.

1. Read the PRP file: \`${prpDir}/PRP-NNN-{name}.md\`
2. Use graph_query / graph_neighbors on the LEGACY code to extract preserved business
   rules (endpoints, entity shapes, validation, workflows).
3. Record the current ISO-8601 timestamp to \`${out}/PHASE4_PROGRESS.md\` under this
   module as \`started: <ISO-8601>\` — this goes into completion.json.startedAt verbatim.
4. Write **4-10 acceptance criteria** to \`${out}/.project/criteria/{PRP-name}.json\`.
   Each criterion must name HOW it is verified — the verifier must be re-runnable by a
   fresh process with no hidden state.

Criterion methods — use ONE of these 5 exactly (matches runtimeVerifier):

| method | evidence shape | example |
|--------|---------------|---------|
| \`curl\` | \`{ command, expectedStatusMatch, expectedBodyContains? }\` | HTTP-level proof the endpoint works |
| \`pytest\` | \`{ command, workspaceRelative, expectedExitCode: 0, expectedStdoutContains: "passed" }\` | Unit-test proof |
| \`filesystem\` | \`{ file, contains?: string[], notContains?: string[], regex? }\` | File-content check (regex OK) |
| \`chrome-mcp\` | \`{ summaryPath, expectedPass: true }\` | Frontend navigation proof (summary.json written by Chrome MCP step) |
| \`static\` | \`{ note }\` | Subjective/non-automatable. Use sparingly — verifier warns if > 30% static |

Write criteria + method + EVIDENCE EXACTLY as shown. The code-side runtimeVerifier
re-executes the evidence — fabricating won't work. DO NOT invent extra method types
(no \`grep\`, \`openapi\`, etc.); they will fail verification with "unsupported method".

Record criteria to \`${out}/.project/criteria/{PRP-name}.json\` for your own tracking:

\`\`\`json
{
  "prpName": "PRP-003-Orders",
  "startedAt": "2026-04-19T10:30:00.000Z",
  "criteria": [
    {
      "criterion": "POST /api/orders (modernized from OD010) returns 201 with orderId",
      "method": "curl",
      "evidence": {
        "command": "curl -s -X POST http://localhost:\${BACKEND_PORT}/api/orders -H 'Content-Type: application/json' -d '{\\"customerId\\":1,\\"items\\":[{\\"sku\\":\\"A\\",\\"qty\\":1}]}' -w '\\n%{http_code}'",
        "expectedStatusMatch": "201",
        "expectedBodyContains": "orderId"
      }
    },
    {
      "criterion": "pytest tests/test_orders.py passes with at least 3 tests",
      "method": "pytest",
      "evidence": {
        "command": "pytest tests/test_orders.py -v --tb=no",
        "workspaceRelative": true,
        "expectedExitCode": 0,
        "expectedStdoutContains": "3 passed"
      }
    },
    {
      "criterion": "Router for orders module wired into main.py",
      "method": "filesystem",
      "evidence": {
        "file": "src/main.py",
        "contains": ["orders"]
      }
    },
    {
      "criterion": "No legacy COBOL idioms leaked into new source",
      "method": "filesystem",
      "evidence": {
        "file": "src/orders/api.py",
        "notContains": ["PIC X", "COMP-3", "PROCEDURE DIVISION"]
      }
    },
    {
      "criterion": "Frontend /orders page renders without console errors (equivalent of legacy OD010)",
      "method": "chrome-mcp",
      "evidence": {
        "summaryPath": ".systest/evidence/phase4/orders/summary.json",
        "expectedPass": true
      }
    }
  ]
}
\`\`\`

🎯 **FRONTEND CRITERIA — MANDATORY for every modernized module that has UI pages.**

COBOL-era screens (BMS maps, CICS panels, green-screen forms) must become WORKING
React pages, not skeletons. For each page P in FRONTEND_DESIGN.md §4.{NNN} add:

- [ ] \`<P>\` renders real API data (NOT "Under construction" / skeleton) [chrome-mcp]
      — chrome-mcp summary must have \`text_length > 200\` AND \`get_page_text\` does not
      contain "Under construction" | "Coming soon" | "TODO" | "WIP".
- [ ] \`<P>.test.tsx\` passes Vitest with loading+error+data assertions [pytest]
      — \`cd frontend && npx vitest run src/pages/<P>.test.tsx\` exits 0.
- [ ] Page source contains \`useEffect\` AND \`useState\` (not a static stub) [filesystem]
      — \`frontend/src/pages/<P>.tsx\` contains "useEffect" AND "useState".

Module-wide (once):
- [ ] Zero \`any\` in frontend/src/api and frontend/src/types [filesystem]
      — notContains: \`": any"\`, \`"as any"\` across those trees (verifier scans file-by-file).
- [ ] Vitest file count ≥ 80% of page count [static, re-verified by your STEP 3 command below]

📋 **REQUIRED CRITERION CHECKLIST — your criteria MUST include these when applicable:**

If this module has BACKEND code:
  [ ] "pytest tests/<module>/ passes with ≥N tests" [pytest]
  [ ] "No datetime.utcnow() in this module's source" [filesystem, notContains: ["datetime.utcnow"]]

If this module has FRONTEND pages (for EACH page P):
  [ ] "<P> renders API data, no skeleton text" [chrome-mcp]
  [ ] "<P>.test.tsx (Vitest) passes" [pytest method wrapping \`npx vitest run src/pages/<P>.test.tsx\`]
  [ ] "<P>.tsx contains useEffect AND useState" [filesystem, contains]

If this module has FRONTEND pages (module-wide, ONCE):
  [ ] "No 'any' types in frontend/src/api & frontend/src/types" [filesystem]
  [ ] "Vitest file count ≥ 80% of page count for this module" [filesystem]
  [ ] "No 'Under construction' placeholders in src/pages" [filesystem]

After writing criteria/{PRP-name}.json, grep your own file and CONFIRM each
applicable checkbox is present. If any required criterion is missing, ADD it —
do not proceed to STEP 2. The CHECKPOINT gate re-enforces these whole-project;
skipping here = failing there.

Guidance:
- Always include at least one \`curl\` criterion (HTTP-level proof) and one \`pytest\` criterion (unit-level).
- If \`--frontend-url\` is NOT provided, omit chrome-mcp criteria. DO NOT fabricate or set \`verified: true\` without running them.
- \`notContains\` must be an ARRAY of substrings (not a single regex string). Each array entry is checked as a substring.
- Every command/file must be fully resolved (no placeholders) — verifier re-runs them verbatim.
- For chrome-mcp, YOU write the summary.json to the stated path during STEP 3.

${bpHasAny ? `Best practices applicable to this module (the Reviewer in STEP 3 will re-read these):
${bpBackendSection}
${bpFrontendSection}

Add a criterion of type \`grep\` or \`filesystem\` that proves a specific MUST-rule from
these files was followed (e.g., "No \`any\` type in new frontend code").` : 'No bundled best practices matched this stack — apply general clean-architecture hygiene.'}

---

#### STEP 1.5 — Per-module Frontend Progress Checklist (NEW — graph-driven)

For modules that include a "Frontend Routes" table in the PRP
(\`${prpDir}/PRP-{NNN}-*.md\` § Frontend Routes — this PRP was generated by
modernize Phase 3 from the legacy screen inventory), generate a per-module
progress file so that GATE G' can cross-check even when the graph parser is stale.

Procedure:

1. Read this module's PRP, locate the "Frontend Routes" table (Markdown table
   with columns: Route | Component | Pattern | ...). If no such table exists,
   skip STEP 1.5 (module has no UI — e.g. pure batch / JCL-derived module).

2. Write \`${prpDir}/done/PRP-{NNN}-frontend-progress.md\` with one row per
   designed route:

\`\`\`markdown
## PRP-{NNN}-{ModuleName} Frontend Progress

| # | Route                  | Component             | Pattern | Implemented | Test | App.tsx Registered | Verified |
|---|------------------------|-----------------------|---------|:-:|:-:|:-:|:-:|
| 1 | /passengers            | PassengerListPage     | List    | [ ] | [ ] | [ ] | [ ] |
| 2 | /passengers/new        | PassengerCreatePage   | Form    | [ ] | [ ] | [ ] | [ ] |
| 3 | /passengers/{id}       | PassengerDetailPage   | Detail  | [ ] | [ ] | [ ] | [ ] |
| 4 | /passengers/{id}/edit  | PassengerEditPage     | Form    | [ ] | [ ] | [ ] | [ ] |

Auto-checked at end of STEP 2 via graph queries:
- **Implemented**: \`graph_query("<ComponentName>", "bfs", 10)\` returns a node
  with \`kind === 'file'\` whose sourceFile ends in \`pages/<ComponentName>.tsx\`.
- **Test**: \`graph_query("file:<ComponentName>.test.tsx")\` returns a node.
- **App.tsx Registered**: \`graph_query("react_route")\` (filter kind='react_route')
  contains a node whose \`urlPath\` matches this row's Route.
- **Verified**: chrome-mcp navigate succeeded + \`get_page_text\` > 50 chars
  (not "Cannot GET").

(Legacy origin for each row — BMS map, CICS transaction, or RPG screen — is
recorded in the PRP itself; this progress file only tracks modernized surface.)
\`\`\`

3. **Update checkboxes at end of STEP 2** — after each implementation cycle,
   re-run the four graph checks above and tick the boxes. Commit the file
   before STEP 3 so GATE G' can use it as fallback.

4. GATE G' in STEP 3 (and the GATE G' aggregated at Phase 4 CHECKPOINT) uses
   this file as a fallback data source when the PRP Markdown table parser
   (parser extension 0 → \`designed_route\` nodes) is temporarily stale.

---

#### STEP 2 — Implement

You now decide HOW to produce code that satisfies the criteria above. The harness
gives you a lot of freedom — use it.

Suggested patterns (pick one; none is mandatory):

- **Single agent, full-stack**: one \`Agent({ description: "Implement {module}", ... })\`
  that writes backend + frontend + tests. Simple modules, small modernizations.
- **Two agents in parallel**: backend-focused + frontend-focused, spawned in ONE
  response. Best for modules with substantial frontend work.
- **Sequential pipeline**: backend first (so OpenAPI spec is available), then
  frontend agent that \`import\`s from generated API types.
- **Solo (you write it yourself)**: for trivial modules (< 100 lines, no frontend),
  using Write/Edit tools directly is fastest.

Whatever you choose, the agent prompt MUST include:

1. The module's PRP path: \`${prpDir}/PRP-NNN-{name}.md\`
2. The acceptance criteria path: \`${out}/.project/criteria/{PRP-name}.json\`
3. Scope boundary: only touch \`${out}/src/{module_path}/**\` and
   \`${out}/frontend/src/pages/{module}/**\` (+ their test siblings). Do NOT touch
   other modules' files. Do NOT modify the legacy workspace in ${ws}.
4. The legacy knowledge-graph hint: "Use graph_query / graph_neighbors to preserve
   business rules from ${ws}. Reference, do NOT copy legacy code."
5. Frontend agents MUST import from \`${out}/frontend/src/components/ui/\`,
   \`${out}/frontend/src/layouts/\`, \`${out}/frontend/src/hooks/useAuth\`. If those
   don't exist yet because this is the Frontend-Infrastructure PRP, that PRP's
   criteria should require creating them.
6. "Your job is not done until every criterion in criteria/{PRP-name}.json passes
   when re-executed — that is the gate."
${bpHasAny ? `7. Read and enforce: ${bpFiles.backend || ''}${bpFiles.frontend ? ' and ' + bpFiles.frontend : ''}` : ''}

🔐 **Contract-aware Implementation (NEW — both Backend and Frontend Agents)**

The canonical contract is \`${prpDir}/contracts/openapi.yaml\` (produced in
Phase 3.5). Every agent prompt spawned in this STEP 2 MUST include the following
block verbatim so backend and frontend implementations cannot drift:

\`\`\`
## Canonical contract (MUST follow)

Before writing ANY endpoint handler or API-calling page component, read:
  ${prpDir}/contracts/openapi.yaml

Rules:
- Backend: the path, request body schema, and response schema you implement MUST
  match \`openapi.yaml\` exactly. For FastAPI, import/mirror the Pydantic models
  from the schema names in \`components/schemas\` — field names, types, required
  flags, nullability, maxLength, enum values. Do NOT invent a field.
- Backend Agent transforms COBOL business logic into FastAPI handlers, but the
  CONTRACT (paths, schemas) is fixed by Phase 3.5. If legacy semantics demand a
  field the contract omits, STOP and surface a contract change request rather
  than silently adding it — otherwise frontend will 422.
- Frontend: fetch/post to the exact paths in \`openapi.yaml\`. Form <input name="…">
  attributes MUST match the schema's property names (case-sensitive). Every field
  listed in the schema's \`required\` array MUST have a corresponding input that
  is marked required and is actually submitted.
- Frontend Agent does NOT need to know the COBOL / DDS origin of any field —
  rely ONLY on the modern OpenAPI contract. The only exception is when the PRP
  explicitly calls out a legacy-compatibility rule (e.g. "preserve leading zeros
  for passenger ID").
- Prefer importing TypeScript types from \`${out}/frontend/src/types/api.ts\`
  (generated by \`openapi-typescript\` in Phase 3.5 STEP 6). If that file does
  not yet exist, install the devDependency and regenerate with:
    cd ${out}/frontend && npm install --save-dev openapi-typescript && npx --no-install openapi-typescript ${prpDir}/contracts/openapi.yaml -o src/types/api.ts
  BEFORE writing any page or API client.
- Do NOT hand-write \`interface PassengerCreate { ... }\` in component files.
  Import from \`src/types/api.ts\`. The Reviewer Agent will flag duplicated types.
\`\`\`

Phase 4.5 (after this module loop finishes) will re-verify backend + frontend
against \`openapi.yaml\`. Any drift caught there is a FAIL and sends the module
back here for rework — cheaper to get it right on the first pass.

Do NOT pre-allocate a fixed number of retries. Loop agent-fix cycles until STEP 3
passes or you've burned 3 attempts on the same criterion — then stop and emit a
visible FAIL for the user.

---

🔁 **PER-TODO GRAPH PROTOCOL — MANDATORY (NEW — STRENGTHENED)**

After EACH acceptance criterion completion in this STEP 2, follow the protocol
branch matching how the file was written. The GATE G'/H'/I'/J'/Contract'/K'
verifications in STEP 3 (and the WHOLE-PROJECT SANITY GATE at Phase 4 CHECKPOINT)
MUST see the latest edits — stale graph = false pass. This applies to the
modernized codebase under \`${out}\`; the legacy reference at
\`${parsed.referenceProject ? parsed.referenceProject.replace(/\\/g, '/') : ws}\`
is read-only and does not need per-Todo updates.

#### A. Edit/Write tool で書いた場合 (推奨)

1. 自動更新 Layer 1 が 1.5 秒 debounce 後にトリガー
2. **明示確認**: Edit 完了から 2 秒後、対象ファイルが graph に反映されたか check:
   \`\`\`
   graph_query("file:<path-of-edited-file>", "bfs", 5)
   \`\`\`
   Expected: nodes に該当ファイル名が含まれる (filter by kind='file' or sourceFile match)
3. 含まれなければ: 1.5 秒待って再 query (debounce 完了を待つ)
4. それでも無ければ: 手動 \`/graphify\` でフルリビルド

#### B. Bash heredoc / cat > file (RESTRICTED — only when Edit/Write cannot work)

⚠️ STRONGLY DISCOURAGED for Phase 4 STEP 2. Bash heredoc bypasses Layer 1
auto-update and relies on chokidar (Layer 2) which has 1-3s delay AND can fail
silently if the file watcher missed a setup.

**Allowed scenarios** (otherwise FORBIDDEN):
- Generating files outside \`\${ws}/frontend\` and \`\${ws}/backend\` (e.g. CI configs at root)
- Multi-MB binary files (rare in Phase 4)
- Generated artifacts (compiled output, not source)

**MANDATORY post-write verification** if you must use heredoc:
1. Wait 3 seconds (chokidar debounce + processing)
2. Verify graph picked up the file:
   \`\`\`
   graph_query("file:<path-of-edited-file>", "bfs", 5)
   \`\`\`
   Expected: nodes contain the file
3. If NOT in graph after 5 seconds: run \`/graphify\` to force full rebuild
4. **DO NOT proceed to STEP 3** until graph reflects the heredoc'd file

**For Phase 4 STEP 2 source code generation**: ALWAYS use Edit/Write tools.
This is the only reliable path for graph-driven GATE verification.
(modernize 文脈では COBOL→React 変換で生成されるファイルが多数あるため、
Edit/Write を徹底することで GATE の信頼性が大幅に向上する)

#### C. STEP 3 検証前のグラフ整合性確認

STEP 3 (検証) を実行する前に以下を必ず実施:
1. このモジュールで生成・編集した全ファイルを enumerate (PHASE4_PROGRESS.md の
   checklist / PRP-{NNN}-frontend-progress.md から)
2. 各ファイルが graph に存在するか \`graph_query("file:X")\` で確認
3. 1 つでも missing なら fail-fast: STEP 3 を実行せず \`/graphify\` でリビルド後に再開

#### D. graph 失敗時の retry policy

\`graph_query\` が timeout (>200ms) または error を返した場合:
- 1 回 retry (1 秒待ち)
- それでも fail なら STEP 2 を中断、ユーザに \`/graphify\` 実行を依頼
- stale graph 上で STEP 3 を実行してはならない

⚠️ STEP 3 の GATE 検証は ALWAYS 最新グラフに依存。**stale graph での検証は
false pass を生み、airlinesys5/6 クラスの事故を再発させる** (legacy 由来の
ビジネスロジックが正しく modern 側に反映されたかの検証が GATE 依存のため、
特に modernize 文脈では致命的)。

Skipping this protocol leads to:
- Phantom "broken nav" reports when the Edit page exists but the graph missed it
- False "dead tokens" reports when tokens.css was heredoc-written
- False "contract gap" reports when the input exists but the graph was stale

The protocol costs <1s per criterion. Treat it as mandatory.

---

🎨 **FRONTEND GOLDEN EXAMPLES — copy & adapt, do NOT invent from scratch.**

When modernizing COBOL green-screen UIs (BMS maps, CICS panels, RPG screens) into
React, agents tend to produce \`<div>Under construction</div>\` skeletons because
"full React page from COBOL spec" is too big a jump. The fix: the agent prompt
MUST include these three golden patterns. Change entity names / fields only.

**GOLDEN A — List page** (\`frontend/src/pages/OrderList.tsx\`, COBOL OD010 equivalent):

\`\`\`tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Order } from '../types/api'

export default function OrderList() {
  const [items, setItems] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<Order[]>('/orders')
      .then(data => { if (!cancelled) setItems(data) })
      .catch(e => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <div role="alert" data-testid="error">Failed to load: {error}</div>
  if (items === null) return <div data-testid="loading">Loading…</div>
  if (items.length === 0) return <div data-testid="empty">No orders.</div>

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Orders</h1>
        <Link to="/orders/new">+ New</Link>
      </header>
      <table>
        <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map(o => (
            <tr key={o.id} data-testid={\`row-\${o.id}\`}>
              <td>{o.orderNo}</td>
              <td>{o.customerName}</td>
              <td>{o.total.toFixed(2)}</td>
              <td>{o.status}</td>
              <td><Link to={\`/orders/\${o.id}\`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
\`\`\`

**GOLDEN B — Test** (\`frontend/src/pages/OrderList.test.tsx\`):

\`\`\`tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OrderList from './OrderList'

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }))
import { api } from '../api/client'

const renderPage = () => render(<MemoryRouter><OrderList /></MemoryRouter>)

describe('OrderList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading then data', async () => {
    ;(api.get as any).mockResolvedValueOnce([
      { id: 1, orderNo: 'O-001', customerName: 'Acme', total: 123.45, status: 'OPEN' },
    ])
    renderPage()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument())
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('shows empty state when API returns []', async () => {
    ;(api.get as any).mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
  })

  it('shows error on failure', async () => {
    ;(api.get as any).mockRejectedValueOnce(new Error('500 boom'))
    renderPage()
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument())
  })
})
\`\`\`

**GOLDEN C — Typed API client** (\`frontend/src/api/client.ts\`, **zero \`any\`**):

\`\`\`ts
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(\`\${BASE}\${path}\`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`\${res.status} \${res.statusText}\${text ? \`: \${text}\` : ''}\`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get:   <T>(path: string)                => request<T>(path),
  post:  <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  del:   <T = void>(path: string)         => request<T>(path, { method: 'DELETE' }),
}
\`\`\`

Plus \`frontend/src/types/api.ts\` — one interface per modernized entity, NO \`any\`.

---

**GOLDEN D — Form page (Create/Edit)** — MANDATORY pattern for ALL form pages.

The airlinesys5 incident: Create/Edit forms shipped with half the required
backend fields missing from the DOM. Every submit returned 422. The fix below
includes input fields for ALL required backend fields. Copy verbatim, change
only: entity name, /path, and the field list (each input per required schema field).

\`\`\`tsx
// frontend/src/pages/passengers/PassengerCreatePage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Button } from '../../components/ui/Button'

export default function PassengerCreatePage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null); setSubmitting(true)
    const form = e.currentTarget
    const data = new FormData(form)
    const body = {
      firstname: String(data.get('firstname') ?? ''),
      lastname:  String(data.get('lastname')  ?? ''),
      email:     String(data.get('email')     ?? ''),
      address:   String(data.get('address')   ?? ''),
      phone:     String(data.get('phone')     ?? '') || null,
    }
    try {
      const created = await api.post<{ passengerid: number }>('/passengers', body)
      navigate(\`/passengers/\${created.passengerid}\`)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h1>New Passenger</h1>
      <form onSubmit={onSubmit} data-testid="passenger-create-form">
        {error && <div role="alert" data-testid="error">{error}</div>}

        {/* ONE <input name="..."> per REQUIRED backend field. Case-sensitive. */}
        <label>First Name<input name="firstname" required maxLength={50} /></label>
        <label>Last Name<input  name="lastname"  required maxLength={50} /></label>
        <label>Email<input      name="email"     required type="email" maxLength={100} /></label>
        <label>Address<textarea name="address"   required /></label>

        {/* Optional fields clearly separated — no \`required\` attribute */}
        <label>Phone (optional)<input name="phone" maxLength={20} /></label>

        <Button type="submit" disabled={submitting} data-testid="submit-btn">
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </form>
    </section>
  )
}
\`\`\`

**GOLDEN D rules (STEP 3 scans for these — missing any = FAIL):**

- Every \`required\` backend field has a corresponding \`<input name="...">\` whose
  name EXACTLY matches the backend field name (case-sensitive).
- \`onSubmit\` calls \`api.post\` / \`api.put\` with the full form body.
- After success: navigate away (detail page or list), do NOT silently stay.
- Errors surface via \`data-testid="error"\` — tests depend on this.
- All required inputs have the \`required\` HTML attribute so the browser blocks empty submits.
- If your entity is NOT literally "Passenger": grep the committed file for the
  token "Passenger" or "passenger". Zero matches required. Any match = FAIL
  (template contamination).
- Backend constraints (maxLength, minLength, pattern, ge/le) MUST be copied
  from YOUR schema file, not reused from the Passenger template example.

**STEP 3 contract check (automated):** for each Create/Edit page, STEP 3 will
read the backend schema and compare the set of \`required\` fields against the
set of \`name=\` attributes in the form .tsx. Any required field missing from the
form = IMMEDIATE FAIL. Do not attempt to fix by deleting the backend field.

---

**GOLDEN E — Detail page** — MANDATORY for any module's Detail route.

⚠️ The airlinesys6 Edit-button-no-Edit-page bug: Detail pages had Edit buttons
calling \`navigate('/resource/:id/edit')\`, but the Edit page was never created.
Result: clicking Edit shows blank page.

The fix: GOLDEN E enforces a strict pattern where Edit is a \`<Link>\` (not
\`navigate()\`) — this lets graph-based GATE H' verify the link target exists.

Template (\`frontend/src/pages/passengers/PassengerDetailPage.tsx\`):

\`\`\`tsx
// ⚠️ TEMPLATE — replace ALL of these before committing:
//   - "Passenger" / "passenger"  → your modernized entity (e.g. "Order" / "order")
//   - "/passengers"              → your REST path (e.g. "/orders")
//   - passengerid                → your entity's PK field name

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { Passenger } from '../../types/api'

export default function PassengerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<Passenger | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get<Passenger>(\`/passengers/\${id}\`)
      .then(d => { if (!cancelled) setItem(d) })
      .catch(e => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this passenger?')) return
    setDeleting(true)
    try {
      await api.del(\`/passengers/\${id}\`)
      navigate('/passengers')
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setDeleting(false)
    }
  }

  if (error) return <div role="alert" data-testid="error">Error: {error}</div>
  if (!item) return <div data-testid="loading">Loading…</div>

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Passenger #{item.passengerid}</h1>
        <div>
          {/* Edit button MUST be <Link to=...> NOT navigate() — for graph verification */}
          <Link to={\`/passengers/\${id}/edit\`} data-testid="edit-link">
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} data-testid="delete-btn">
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </header>

      <Card>
        <dl>
          {/* one <dt>/<dd> per displayable field, with data-testid */}
          <dt>First Name</dt><dd data-testid="firstname">{item.firstname}</dd>
          <dt>Last Name</dt><dd data-testid="lastname">{item.lastname}</dd>
          <dt>Email</dt><dd>{item.email}</dd>
        </dl>
      </Card>
    </section>
  )
}
\`\`\`

**GOLDEN E rules:**
- Edit button MUST be \`<Link to={\\\`/\${entity}/\${id}/edit\\\`}>\` — NOT \`navigate()\` —
  so that graph parser detects edge from Detail to Edit page reliably.
- Delete button uses \`api.del()\` and navigates back to list on success.
- Use shared \`<Card>\`, \`<Button>\` components — never raw \`<div>\` / \`<button>\`.
- Display every field from the entity schema, with data-testid for each.
- For modernized legacy: preserve DDS/BMS field labels ("Flight No." rather than
  "flightno") for user continuity.

---

**GOLDEN F — List page with Search/Filter** — for List routes that need filtering.

For modules where FRONTEND_DESIGN.md §4.X specifies a search box or filter
(e.g. legacy DDS subfile with position-to field, CICS inquiry screen with key filter),
use this pattern (extends GOLDEN A):

\`\`\`tsx
// frontend/src/pages/passengers/PassengerListPage.tsx
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { Passenger } from '../../types/api'

export default function PassengerListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Passenger[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search term synced with URL (?q=...)
  const q = searchParams.get('q') ?? ''

  useEffect(() => {
    let cancelled = false
    const url = q ? \`/passengers?search=\${encodeURIComponent(q)}\` : '/passengers'
    api.get<Passenger[]>(url)
      .then(d => { if (!cancelled) setItems(d) })
      .catch(e => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [q])

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setSearchParams(v ? { q: v } : {})
  }

  if (error) return <div role="alert" data-testid="error">Error: {error}</div>
  if (items === null) return <div data-testid="loading">Loading…</div>

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Passengers</h1>
        <Link to="/passengers/new"><Button variant="primary">+ New</Button></Link>
      </header>

      <Input
        type="search"
        placeholder="Search by name..."
        value={q}
        onChange={onSearchChange}
        data-testid="search-input"
      />

      {items.length === 0
        ? <div data-testid="empty">No passengers match "{q}".</div>
        : <table>
            <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.passengerid} data-testid={\`row-\${p.passengerid}\`}>
                  <td>{p.firstname} {p.lastname}</td>
                  <td>{p.email}</td>
                  <td><Link to={\`/passengers/\${p.passengerid}\`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>}
    </section>
  )
}
\`\`\`

**GOLDEN F rules:**
- Search term synced with URL via useSearchParams — bookmarkable, browser-back works.
- Empty state distinguishes "no data ever" vs "no match for current filter".
- Filters wired to \`/api/...?search=...&...\` query params (backend supports this
  in standard CRUD). This is the modern equivalent of legacy "position-to" prompts.

---

**Adaptation rules for COBOL → React modernization:**
1. Map each BMS/CICS panel to a List + Detail React page. Preserve field labels.
2. Preserve 4-state rendering (loading / error / empty / data). Do NOT collapse to a single render.
3. KEEP \`data-testid\` attributes — tests depend on them.
4. PIC X(N) string fields → \`string\`; PIC 9(N) numeric → \`number\`; COMP-3 decimals → \`number\` (format to N dp in JSX).
5. If TypeScript forces \`any\`, add a proper interface in \`types/api.ts\` — never suppress.

⚠️ **VITEST UNIT TESTS ARE MANDATORY — Playwright/Cypress does NOT substitute.**

airlinesys5 shipped with 0 Vitest unit tests because Meta Coder chose Playwright
E2E instead. This is now FORBIDDEN. Rule:

- Vitest unit test at \`frontend/src/pages/<Page>.test.tsx\` → **REQUIRED per page**
- Playwright E2E at \`frontend/tests/e2e/*.spec.ts\` → optional, additional only

Without the sibling \`<Page>.test.tsx\`, the page counts as UNTESTED regardless of
E2E coverage. GATE E in the final CHECKPOINT will enforce this.

🚫 **FORBIDDEN PATTERNS — STEP 3 will scan and auto-FAIL the module if found:**
- \`<div>Under construction</div>\` / "Coming soon" / "WIP" / \`// TODO\` lines in \`frontend/src/pages/**\`
- A page component that returns JSX without any \`useEffect\` / \`useState\` / custom hook call
- \`: any\` or \`as any\` anywhere under \`frontend/src/api/\` or \`frontend/src/types/\`
- A page \`Foo.tsx\` with no sibling \`Foo.test.tsx\`
- Vitest file count < 80% of page count for this module

The agent prompt you spawn in STEP 2 MUST paste Golden A+B+C verbatim under a
"Templates to adapt" section. Past incidents (airlinesys3/airlinesys4) proved that
without the verbatim templates, agents default to skeletons.

---

#### STEP 3 — Run code, verify every criterion

MANDATORY. No criterion may be claimed as \`verified: true\` without being executed
in this step. Fabricating verification is FRAUD — the code-side verifier re-runs
each command and rejects the module if results disagree.

For each criterion in \`${out}/.project/criteria/{PRP-name}.json\`:

- **curl**: run evidence.command via Bash. Confirm returned HTTP code matches \`expectedStatusMatch\`
  and response body contains \`expectedBodyContains\` (if set). Use \`-w '\\n%{http_code}'\` so the
  status is on its own trailing line — the verifier extracts \`/\\n(\\d{3})\\s*$/\`.
- **pytest**: run evidence.command (with cwd=${out} if \`workspaceRelative: true\`). Assert
  exit code matches \`expectedExitCode\` and stdout contains \`expectedStdoutContains\` (e.g., "3 passed").
  Beware: \`pytest\` with 0 matching tests exits 0 and prints "no tests ran" — use a concrete
  \`expectedStdoutContains: "N passed"\` to catch this.
- **filesystem**: Read evidence.file. If \`contains\` array set, ALL substrings must appear.
  If \`notContains\` array set, NONE of the substrings must appear. If \`regex\` set, the pattern
  must match.
- **chrome-mcp**: use Chrome MCP \`navigate\` + \`read_console_messages onlyErrors=true\` +
  \`get_page_text\` (length > 50 chars, no "Cannot GET"). Write a summary.json to the path
  in \`evidence.summaryPath\` with shape \`{ pass: true, consoleErrors: 0, text_length: N, route: "..." }\`.
  If \`--frontend-url\` not provided, OMIT chrome-mcp criteria — do not fabricate.
- **static**: trusted by the verifier only if used sparingly. Prefer concrete methods.

🚫 **FRONTEND ANTI-SKELETON SCAN — MANDATORY if this module has UI pages.**

Run these commands verbatim from \`${out}\`. Each must pass before you advance:

\`\`\`bash
# 1. No placeholder text under src/pages
rg -n "Under construction|Coming soon|^\\s*// ?TODO|WIP" frontend/src/pages/ && exit 1 || true

# 2. No 'any' under api/ or types/
rg -n ":\\s*any\\b|as\\s+any\\b" frontend/src/api/ frontend/src/types/ && exit 1 || true

# 3. Test coverage ratio ≥ 80% of page count for this module
pages=$(find frontend/src/pages -name "*.tsx" -not -name "*.test.tsx" | wc -l)
tests=$(find frontend/src/pages -name "*.test.tsx" | wc -l)
echo "pages=$pages tests=$tests"
test "$tests" -ge "$(( pages * 8 / 10 ))" || { echo "FAIL: tests < 80% of pages"; exit 1; }

# 4. Vitest passes for this module
cd frontend && npx vitest run --reporter=dot 2>&1 | tail -20
\`\`\`

Add a filesystem criterion capturing this scan so the code-side verifier re-runs it:

\`\`\`json
{
  "criterion": "No skeleton placeholders remain in frontend/src/pages",
  "method": "filesystem",
  "evidence": { "file": "frontend/src/pages", "notContains": ["Under construction", "Coming soon"] }
}
\`\`\`

If any scan fails, return to STEP 2 and fix — do not proceed to STEP 4.

Record the outcome per criterion in \`${out}/.project/criteria/{PRP-name}.result.json\`:

\`\`\`json
{
  "prpName": "PRP-003-Orders",
  "ranAt": "2026-04-19T10:42:11.000Z",
  "results": [
    { "id": "C1", "passed": true,  "evidence": "HTTP 201; body contained orderId" },
    { "id": "C2", "passed": true,  "evidence": "pytest: 5 passed, 0 failed" },
    { "id": "C3", "passed": true,  "evidence": "grep matched 'orders' in src/main.py" },
    { "id": "C4", "passed": true,  "evidence": "no PIC X / COMP-3 / PROCEDURE DIVISION in 8 scanned files" },
    { "id": "C5", "passed": true,  "evidence": "chrome-mcp: /orders rendered, 0 console errors, text length 1822" }
  ]
}
\`\`\`

**If any criterion failed**: return to STEP 2, spawn a fix-specific agent with the
failure evidence, re-run STEP 3. Do NOT advance to STEP 4 until all criteria pass.

---

🔎 **GRAPH-DRIVEN GATES G' / H' / I' / J' / Contract' — MANDATORY (NEW)**

These gates use the semantic knowledge graph built in Phase 0 to catch defects
that text-grep cannot: missing pages, broken navigation, hardcoded colors,
shared-component abandonment, contract mismatches. Each gate queries the graph
(0 token cost, <10ms) and either passes or reports a concrete defect list.
Run these **per module**, immediately after STEP 3 acceptance criteria pass and
BEFORE writing the module's completion.json.

Before running these, ensure the graph is fresh: \`graph_query("any new page")\`
should return results. If the graph is stale (Edit happened but not reflected),
run /graphify explicitly before proceeding.

**STEP 3.0: Mandatory graph rebuild + pre-flight freshness check (BEFORE any GATE)**

After finishing all Edit/Write operations for this modernized module, BEFORE running any GATE:

1. **Always rebuild first**: run \`/graphify\` ONCE so the graph spans BOTH the legacy reference tree AND your freshly modernized output. The chokidar watcher debounces updates but a hard rebuild guarantees a clean baseline.
2. **Verify non-empty**: run \`graph_query("route", "bfs", 5)\` (or any simple query).
3. If the returned \`nodes\` array is empty OR \`graph_neighbors\` returns 0 successors for well-known labels (e.g. \`App.tsx\`, \`main.py\`), the graph is EMPTY.
4. When still empty after the rebuild in step 1:
   - Escalate to the user with the message:
     \`[GATE PRE-FLIGHT] Graph is empty after /graphify — parser may not cover this tech stack. GATEs cannot be trusted.\`
   - Do NOT proceed to the GATEs; do NOT write \`gates_verified: PASS\`.
5. Only proceed to GATE G' once the graph reports at least one relevant \`react_route\` or \`python_route\` or \`designed_route\` node.

**WHY THIS MATTERS**: Previous incidents (digtalhuman, 2026-04-21) had the AI "verify" GATEs against an empty graph and report false PASS. For modernization this risk is especially acute because the legacy source tree is large and the parser may silently skip unfamiliar extensions. The graph MUST have nodes or every GATE is a lie.

---

### GATE G' (Frontend Coverage — graph-driven, MANDATORY)

⚠️ This GATE replaces the old grep-based coverage check (which missed
airlinesys6's 5 missing Edit pages and 4 missing Shift pages).

Phase 4 STEP 3 MUST verify that EVERY route in any PRP-NNN.md "Frontend Routes"
table (derived from the modernized design, not the legacy screens directly)
has a corresponding implementation file AND <Route> registration.

Procedure (use \`graph_query\`, NOT grep — ALWAYS apply STEP 5.5 kind filters):

1. Get DESIGNED routes (from PRP Markdown table rows — these originate from
   the legacy screen inventory done in Phase 3):
   Call: \`graph_query("designed_route from PRP", "bfs", 200)\`
   **IMPORTANT**: filter results to only nodes where \`kind === 'designed_route'\`
   (parser extension 0 — Markdown table parser).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, label, kind: 'designed_route', urlPath, signature, sourceFile }],
     edges: [...] }
   \`\`\`
   Each node represents one row from a PRP "Frontend Routes" table (legacy
   origin: BMS map / CICS transaction / RPG screen, mapped to modern route).
   Extract: \`{ route: node.urlPath, component: node.signature, prp: node.sourceFile }\`
   for each.
   **Fallback**: if \`designed_route\` nodes are empty (parser ext 0 not yet run),
   fall back to \`${prpDir}/done/PRP-{NNN}-frontend-progress.md\` (STEP 1.5 output)
   for the designed route list.

2. Get IMPLEMENTED routes (from React Router \`<Route>\` declarations in the
   modernized codebase under \`${out}/frontend\`):
   Call: \`graph_query("react_route in App.tsx or routes.tsx", "bfs", 200)\`
   **IMPORTANT**: filter to nodes where \`kind === 'react_route'\`
   (parser extension 1).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, label, kind: 'react_route', urlPath, signature, sourceFile }],
     edges: [...] }
   \`\`\`
   Extract: \`{ path: node.urlPath, element: node.signature }\`.

3. Compute set difference (semantic, in TypeScript pseudocode):
   \`\`\`typescript
   const designedPaths  = new Set(designed.map(d => d.route))
   const implementedPaths = new Set(implemented.map(i => i.path))
   const missing = [...designedPaths].filter(p => !implementedPaths.has(p))
   const orphan  = [...implementedPaths].filter(p => !designedPaths.has(p))
   \`\`\`
   (/:param normalized, route-path equality is case-sensitive.)

4. **JUDGMENT** (concrete pass/fail):
   - If \`missing.length > 0\` → **FAIL**
     Log each: \`"Missing page: <route> (designed in <prp>, no <Route> registration)"\`.
     Phase 4 returns to per-module STEP 2 to implement the missing page.
     This means a legacy screen has no modernized equivalent reachable in the UI.
   - If \`orphan.length > 0\` → **WARNING** (page implemented but not in any PRP —
     possible scope creep or a modernization addition). Log each, but do NOT block.
   - If both are zero → **PASS**.

5. Success log: \`"GATE G' (Coverage): {N} designed, {M} implemented, 0 missing, {K} orphan"\`

Why graph over grep:
- Scales to 10K+ files (sub-linear)
- Captures semantic relationships (route → element component)
- Auto-updates with each Edit (last 1.5s)
- 0 token cost

Modernization note: the mapping from legacy CICS / 3270 screens to React routes
is defined in PRPs at Phase 3. This GATE verifies only that the modernized
surface is complete — legacy↔modern equivalence of individual screens is
validated by /systest Phase 5B golden flows.

---

### GATE H' (Broken Navigation — graph-driven, MANDATORY)

Verify every \`navigate('/x/y')\` call has a matching \`<Route path>\` registration.
Catches the airlinesys6 bug class where Detail pages call navigate() to
non-existent routes — which usually means the corresponding legacy screen's
workflow is unreachable in the modernized UI (silent regression).

Procedure (ALWAYS apply STEP 5.5 kind filters):

1. Get all navigation targets:
   Call: \`graph_query("navigate_call with target path", "bfs", 500)\`
   **IMPORTANT**: filter to nodes where \`kind === 'navigate_call'\`
   (parser extension 2 — normalizes \`\\\${var}\` → \`:param\`).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, kind: 'navigate_call', urlPath, sourceFile, sourceLine }], edges: [...] }
   \`\`\`
   Extract: \`{ target: node.urlPath, file: node.sourceFile, line: node.sourceLine }\`.

2. Get all registered Route paths:
   Call: \`graph_query("react_route", "bfs", 200)\`
   **IMPORTANT**: filter to nodes where \`kind === 'react_route'\`.
   Extract: \`registeredPaths = nodes.map(n => n.urlPath)\`.

3. Compute broken navigations (React Router pattern matching):
   \`\`\`typescript
   // React Router: :param in registered matches any segment in target
   const broken = navigateCalls.filter(nav =>
     !registeredPaths.some(rp => matchRoutePattern(rp, nav.target))
   )
   \`\`\`

4. **JUDGMENT**:
   - If \`broken.length > 0\` → **FAIL**
     Log each: \`"Broken navigate: <target> at <file>:<line> (no matching <Route>)"\`.
     These WILL produce blank pages at runtime.
     Either add the missing \`<Route>\` OR fix the \`navigate()\` target.
   - If \`broken.length === 0\` → **PASS**.

5. Success log: \`"GATE H' (Broken Nav): {N} navigate calls, 0 broken"\`

Zero tolerance — a broken navigation on a modernized screen usually means the
corresponding legacy workflow is unreachable.

---

### GATE I' (Design Token Usage — graph-driven, MANDATORY if global.css OR tailwind.config exists)

If the modernized project defines design tokens in CSS (\`--color-*\`, \`--space-*\`,
etc.) or in \`tailwind.config.*\`, verify components actually USE them via
\`var(--name)\` (or Tailwind tokenized classes) instead of hardcoding hex.

Catches the airlinesys6 bug where global.css defined 50+ tokens but Button.tsx
hardcoded \`bg-[#635BFF]\` instead of \`var(--color-primary)\`. (Legacy 3270 green-
screen palettes are preserved intentionally via tokens — bypassing tokens
causes visual inconsistency across modernized modules.)

Procedure (ALWAYS apply STEP 5.5 kind filters):

1. Get defined CSS variables (from \`:root\` and tailwind.config):
   Call: \`graph_query("css_variable definitions", "bfs", 200)\`
   **IMPORTANT**: filter to nodes where
   - \`kind === 'css_variable'\` AND
   - \`sourceFile\` matches \`/(global|theme|tokens)\\.s?css$/\` OR
     \`/tailwind\\.config\\.(j|t|c|m)s$/\`
   (parser extension 7 — tailwind.config.js / .ts is ALSO recognized as
   css_variable definition since parser extension 7+).
   Build \`definedTokens = new Set(nodes.map(n => n.id))\`.

2. For each defined variable, count usage via graph_neighbors:
   \`\`\`typescript
   for (const token of definedTokens) {
     const inc = graph_neighbors(token, { depth: 1, direction: 'predecessors' })
     const usageCount = inc.edges.filter(e => e.relation === 'uses_variable').length
     usedMap.set(token, usageCount)
   }
   const usedTokens = [...usedMap.entries()].filter(([_, c]) => c > 0).map(([t]) => t)
   \`\`\`

3. ⚠️ **DANGLING EDGE HANDLING** (G-4):
   Some \`uses_variable\` edges may point to tokens NOT in the definitions set
   (e.g. a CSS file not yet parsed, or external CDN tokens like Bootstrap variables
   inherited from a legacy web UI shim).
   These dangling edges MUST be excluded from the "unused" calculation.
   \`\`\`typescript
   const unusedTokens = [...definedTokens].filter(t => (usedMap.get(t) ?? 0) === 0)
   // Do NOT count danglings (edges whose target is NOT in definedTokens) as "usage"
   // for any defined token — they're unrelated references.
   \`\`\`
   If the ratio of dangling refs (edges whose target is unknown) is > 20% of all
   \`uses_variable\` edges: log a WARN ("many dangling uses_variable edges —
   parser may have stale data") but do NOT fail this GATE on danglings alone.

4. Get hardcoded colors:
   Call: \`graph_query("hardcoded_color in JSX or CSS", "bfs", 200)\`
   **IMPORTANT**: filter to nodes where \`kind === 'hardcoded_color'\`
   (parser extension 8 detects \`bg-[#XXX]\`, hex literals, etc.).
   Exclude sources in \`tailwind.config.*\` (those are token definitions,
   not anti-pattern). Exclude \`global.css\` / \`theme.css\` / \`tokens.css\`
   (token definition files are allowed hex).
   \`\`\`typescript
   const hardcoded = nodes
     .filter(n => n.kind === 'hardcoded_color')
     .filter(n => !/tailwind\\.config\\.|(global|theme|tokens)\\.s?css$/.test(n.sourceFile))
   \`\`\`

5. Compute metrics:
   \`\`\`typescript
   const usageRate = usedTokens.length / Math.max(definedTokens.size, 1)
   const hardcodedCount = hardcoded.length
   \`\`\`

6. **JUDGMENT**:
   - **First Phase 4 iteration for this project**: WARNING only (allow time to
     refactor colors into tokens during the legacy→modern conversion).
   - **Subsequent iterations**: if \`usageRate < 0.6\` **OR** \`hardcodedCount > 5\`
     → **FAIL** (no more excuses — tokens exist, agents must use them).
   - Log unused tokens (first 10) and hardcoded sites (first 10) regardless.

7. Success log: \`"GATE I' (Token Usage): {N} defined, {M} used ({R}%), {K} hardcoded"\`

---

### GATE J' (Shared Component Adoption — graph-driven, WARNING)

If \`frontend/src/components/ui/\` exists with shared components (Button, Input,
Card, etc.), verify pages import them rather than reinventing. Shared UI
primitives are the modernize equivalent of COBOL copybooks — each legacy
screen's modernized page should reuse them, not reimplement.

Procedure (ALWAYS apply STEP 5.5 kind filters):

1. Get shared components:
   Call: \`graph_query("file under frontend/src/components/ui", "bfs", 100)\`
   **IMPORTANT**: filter to nodes where
   - \`kind === 'file'\` AND
   - \`sourceFile\` starts with \`frontend/src/components/ui/\`
   Expected return shape:
   \`\`\`
   { nodes: [{ id, kind: 'file', label, sourceFile }], edges: [...] }
   \`\`\`

2. For each shared component, count imports from pages:
   \`\`\`typescript
   for (const comp of sharedComponents) {
     const preds = graph_neighbors(comp.id, { depth: 1, direction: 'predecessors' })
     const pageImports = preds.edges
       .filter(e => e.relation === 'imports_from')
       .filter(e => preds.nodes.find(n => n.id === e.source)?.sourceFile.includes('/pages/'))
     adoptionMap.set(comp.id, pageImports.length)
   }
   \`\`\`

3. Detect raw-HTML anti-patterns (optional, informational):
   - Pages using raw \`<button>\` while \`<Button>\` is available
   - Pages using raw \`<input>\` while \`<Input>\` is available
   (Use \`graph_query("form_input")\` filtered to page files and cross-check.)

4. Compute adoption rate per component:
   \`\`\`typescript
   const totalPages = pageFiles.length
   const adoptionRate = adoptionMap.get(comp.id) / Math.max(totalPages, 1)
   \`\`\`

5. **JUDGMENT**:
   - If any shared component has \`adoptionRate < 0.3\` (used by < 30% of pages)
     → log WARN with suggestion to migrate. Never FAIL (some raw HTML is
     legitimate — \`type=hidden\`, untyped inputs in edge cases, etc.).
   - Log per component: \`"Button.tsx: imported by 12/24 pages (50%)"\`

6. Success log: \`"GATE J' (Component Adoption): {N} shared components, avg adoption {R}%"\`

---

### GATE Contract' (Frontend-Backend Contract Validation — graph-driven, MANDATORY)

Catches the airlinesys5 422 error: form submits with missing required fields
because the form .tsx didn't include all inputs from backend schema.
In modernize context, this is common when the COBOL record layout has 10+
fields but the React form agent only rendered a subset.

This GATE runs AFTER all Form pages are implemented in this module.

## BACKEND CONTEXT (for GATE Contract')
- Detected backend language: ${parsed?.backendLang ?? 'auto-detect at runtime'}
- Primary schema node kind by backend:
  - Python / FastAPI → \`pydantic_field\` (parser ext 5)
  - TypeScript / Hono / NestJS → \`openapi_field\` (from \`/openapi.json\` or generated spec)
  - Go / go-zero → \`openapi_field\` (from \`swagger.yaml\` or generated spec)
  - Any other framework emitting OpenAPI → \`openapi_field\`
- Strategy: try \`pydantic_field\` first, fall back to \`openapi_field\` if empty.
  Both node kinds carry the same \`schemaClass\` + \`required\` attributes
  (parser Round 6 extension normalized the shape).

Procedure (ALWAYS apply STEP 5.5 kind filters):

1. Get required fields — tries \`pydantic_field\` first, falls back to \`openapi_field\`:

   **Primary query** (Python / FastAPI backends):
   Call: \`graph_query("pydantic_field nodes with required attribute", "bfs", 500)\`
   **IMPORTANT**: filter to nodes where
   - \`kind === 'pydantic_field'\` AND
   - \`required === true\`
   (parser extension 5 detects field-level required/optional).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, kind: 'pydantic_field', fieldName, fieldType, required,
               schemaClass, sourceFile }], edges: [...] }
   \`\`\`
   Build map: \`schemaClass -> Set<fieldName>\` for required fields only.

   **Fallback query** (TypeScript / Go / any OpenAPI-emitting backend):
   If primary returned **zero** matching nodes:
   Call: \`graph_query("openapi_field nodes from components.schemas", "bfs", 500)\`
   **IMPORTANT**: filter to nodes where
   - \`kind === 'openapi_field'\` AND
   - \`required === true\`
   (parser extension 6 — openApiParser.ts — detects required fields in
   \`components.schemas.*.required[]\`, which in modernize flows typically
   comes from the canonical \`contracts/openapi.yaml\` produced in Phase 3.5).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, kind: 'openapi_field', fieldName, fieldType, required,
               schemaClass, sourceFile }], edges: [...] }
   \`\`\`
   Build the SAME map: \`schemaClass -> Set<fieldName>\` for required fields only.

   ### IMPORTANT: False Green Prevention

   If **BOTH** \`pydantic_field\` AND \`openapi_field\` queries return zero nodes:
   - **DO NOT** output "GATE Contract': PASS" with 0 contract gaps
   - Instead output "GATE Contract': **SKIPPED** (no schema field nodes in graph)"
   - Include diagnostic:
     - Backend language detected: ${parsed?.backendLang ?? 'unknown'}
     - Expected node kinds: Python → \`pydantic_field\`, any-language-with-OpenAPI → \`openapi_field\`
     - Action needed: run \`/graphify\` to rebuild the graph, or verify parser
       extensions 5 (Pydantic) and 6 (OpenAPI YAML/JSON) are enabled.
       In modernize flows also verify Phase 3.5 produced \`contracts/openapi.yaml\`.
   - Record in PHASE4_GATE_REPORT.md as \`Contract': SKIPPED (graph missing schema nodes)\`
   - This prevents the "empty results = no bugs = pass" false green pattern
     (airlinesys5 class of bugs where tests reported PASS but functionality broken)

2. Get all form input fields:
   Call: \`graph_query("form_input", "bfs", 500)\`
   **IMPORTANT**: filter to nodes where \`kind === 'form_input'\`
   (parser extension 3 detects \`<input name="X" required>\`).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, kind: 'form_input', inputName, required, pageFile }],
     edges: [...] }
   \`\`\`
   Build map: \`pageFile -> Set<inputName>\`.

3. Match forms to schemas via naming convention:
   - \`PassengerCreatePage.tsx\` → schema \`PassengerCreate\`
   - \`PassengerEditPage.tsx\` → schema \`PassengerUpdate\`
   - Or read from Phase 3 PRP "Source PRP fields" column if convention fails

4. For each matched \`{pageFile, schemaClass}\` pair, compute:
   \`\`\`typescript
   const requiredFields = requiredMap.get(schemaClass) ?? new Set()
   const formFields    = formMap.get(pageFile) ?? new Set()
   const missingInForm = [...requiredFields].filter(f => !formFields.has(f))
   const extraInForm   = [...formFields].filter(f => !allSchemaFields.has(f))
   \`\`\`

5. **JUDGMENT**:
   - If any \`missingInForm.length > 0\` → **FAIL**
     Log each: \`"<pageFile> missing required field: <fieldName> (backend <schemaClass>)"\`.
     This WILL produce 422 at runtime. Module NOT marked completed until form fixed.
   - If any \`extraInForm.length > 0\` → **WARNING** (likely typo or stale schema)
   - If a form has no matching schema: WARN (manual review suggested)
   - If STEP 1 was SKIPPED (no schema nodes): do NOT run JUDGMENT — emit WARN
     with the diagnostic from STEP 1 and leave gate status as SKIPPED.

6. Success log: \`"GATE Contract': {N} form-schema pairs matched, 0 contract gaps (source: <pydantic_field|openapi_field>)"\`

**Triangulation** (recommended — ALWAYS applicable in modernize runs because
Phase 3.5 produces canonical \`contracts/openapi.yaml\`): when BOTH
\`pydantic_field\` AND \`openapi_field\` nodes exist, cross-check them for the
same \`schemaClass\`. If required-field sets disagree → **FAIL** (contract
sources disagree — upstream drift between legacy-derived Pydantic and the
canonical contract). Fix the contract, then re-run this GATE.

---

### GATE K' (Module Cohesion & Anti-pattern — graph-driven, ADVISORY)

Use \`graph_communities\` and \`graph_god_nodes\` to assess code health. This GATE
is advisory (never fails Phase 4) — findings feed the overall gate report.

In modernize context, it is especially valuable to compare the cohesion of
the LEGACY modules (COBOL programs grouped by copybook / JCL flow) against
the MODERN modules (React + FastAPI grouped by PRP). A modern module should
generally have equal or better cohesion than the legacy module it replaces.

Procedure:

1. **Module cohesion check** (community detection):
   Call: \`graph_communities()\`
   → returns top N communities (clusters of tightly-coupled nodes).
   Expected: each PRP module corresponds to one or two communities.

   ANTI-PATTERN detection:
   - If files from **2 different PRP modules** are in the SAME community,
     they may be too tightly coupled — flag for refactoring.
   - If **1 PRP module's files are split across many communities** (> 3),
     the module may lack internal cohesion — flag for review.
   - **Legacy vs modern cohesion comparison** (modernize-specific): pick the
     legacy community corresponding to this PRP's origin (e.g. a COBOL
     program + its copybooks) and compare density with the modern community.
     A significantly less cohesive modern community than its legacy origin
     suggests over-fragmentation — flag for review.

2. **God-node detection** (degree centrality):
   Call: \`graph_god_nodes(10)\`
   → returns 10 most-connected nodes (highest total degree).

   ANTI-PATTERN: a single utility / component connected to > 100 other nodes
   suggests over-coupling. Candidates for splitting:
   - A mega utils file
   - A single-dispatch router handling everything
   - A kitchen-sink component
   - In modernize: a catch-all "legacyCompat" file that mirrors every COBOL
     paragraph — consider splitting per business domain.

3. **JUDGMENT**:
   - **Always PASS** (informational only — never blocks Phase 4)
   - Findings are recorded in STEP 3.9 \`PHASE4_GATE_REPORT.md\` as ADVISORY

4. Success log: \`"GATE K' (Cohesion): {N} communities, {M} god-nodes flagged (advisory)"\`

High anti-pattern counts across modules signal refactoring needs for the next
iteration, but do not block the current module.

---

### STEP 3 FINAL — \`gates_verified\` block (MANDATORY for STEP 4) — B-1 enforcement

After running ALL six GATEs (G', H', I', J', Contract', K'), you MUST record
their outcomes in the module's completion.json under the \`gates_verified\`
field. This is the physical audit trail that STEP 0 Resume Check reads next
session to decide if a module is truly done or needs re-implementation.

\`\`\`json
{
  "prpName": "PRP-003-Orders",
  "acceptanceCriteria": [ /* ... existing array ... */ ],
  "gates_verified": {
    "G":        { "pass": true, "designed_count": 4, "implemented_count": 4, "missing": [] },
    "H":        { "pass": true, "navigate_calls": 8, "broken": [] },
    "I":        { "pass": true, "token_usage_rate": 0.72, "hardcoded_color_count": 2 },
    "J":        { "pass": true, "shared_components_used": ["Button", "Input", "Card"] },
    "Contract": { "pass": true, "source": "pydantic_field", "pairs_matched": 3, "gaps": [] },
    "K":        { "advisory": true, "communities_identified": 2, "god_nodes": [] }
  },
  /* ...other fields... */
}
\`\`\`

**To satisfy this step exactly**: \`Read(${prpDir}/PRP-NNN-*.md)\`, locate the
\`## Completion Marker Template\` section at the bottom of the PRP you just
implemented, COPY the JSON block from that section, replace each placeholder
(\`<...>\`) with the runtime value (completed_at = current UTC time,
acceptanceCriteria[].verified/evidence from your STEP 2 work,
gates_verified.*.pass (or K.advisory) from STEP 3 GATE results, artifacts.sourceFiles from
\`git status\` / your Edits). Then write the filled JSON to
\`${prpDir}/done/PRP-NNN-slug.completion.json\`. Verifying:
\`ls ${prpDir}/done/PRP-NNN-*.completion.json\` must return the file you just
wrote. Do NOT reconstruct the JSON from scratch — the skeleton in the PRP is
the canonical source.

INVARIANTS (every module's completion.json MUST satisfy these):
- ALL 6 keys (\`G\`, \`H\`, \`I\`, \`J\`, \`Contract\`, \`K\`) MUST be present as
  sibling keys under \`gates_verified\`.
- Each MUST have \`"pass": true\` (except \`K\` which uses \`"advisory": true\`).
- If any GATE was legitimately SKIPPED (e.g. Contract' with no schema nodes
  in the graph, or G'/H'/I'/J' when this is a backend-only module with no
  \`frontend/\` directory), record it as:
  \`{ "pass": false, "skipped": true, "reason": "<why>" }\`
- Empty arrays / zero counts are OK, but the key MUST exist — do not omit.

⚠️ Phase 4 STEP 0 Resume Check will read \`gates_verified\` on the next
session. If the block is absent, malformed, or reports a non-skipped
\`"pass": false\`, the module is classified as \`invalid\` and re-implemented
from scratch — losing your iteration progress. DO NOT skip recording gate
results. This is the airlinesys6 / digtalhuman failure mode where AI
claimed all modules done but Edit pages were systematically missing
because GATE G' was never actually verified.

---

#### STEP 3.9 — Aggregate Gate Report (NEW — MANDATORY per module / per Phase 4 pass)

After all GATE G'/H'/I'/J'/Contract'/K' have run across the project, aggregate
results into per-module and overall reports.

For each PRP module, write \`${prpDir}/done/PRP-{NNN}-gate-report.md\` with:

\`\`\`markdown
# PRP-{NNN} Phase 4 Gate Report

## Summary
| GATE                  | Status           | Detail                               |
|-----------------------|:-:|--------------------------------------|
| G' (Coverage)         | {PASS/FAIL/WARN} | {N missing pages, K orphan}          |
| H' (Broken Nav)       | {PASS/FAIL}      | {N broken navigate targets}          |
| I' (Token Usage)      | {PASS/FAIL/WARN} | {usage rate R%, hardcoded K}         |
| J' (Component Adopt)  | {PASS/WARN}      | {avg adoption R%}                    |
| Contract'             | {PASS/FAIL}      | {N contract gaps}                    |
| K' (Cohesion)         | ADVISORY         | {communities N, god-nodes M}         |

## Detailed Findings (failed/warned only)

### GATE G' Findings
- Missing: <list route → component (legacy origin screen if known)>
- Orphan: <list>

### GATE H' Findings
- Broken navigate: <list file:line → target>

(... one section per failed/warned GATE ...)

### GATE K' Advisory
- Cross-module communities: <list>
- God-nodes: <list id (degree)>
- Legacy-vs-modern cohesion delta: <community X (legacy) vs module Y (modern)>

## Module Disposition
- Phase 4 STEP 4 (completion): **{ALLOWED / BLOCKED}**
- If BLOCKED: return to STEP 2 to address FAIL findings above.
\`\`\`

**Aggregation across all modules** (when the last module's STEP 3.9 completes,
or at Phase 4 CHECKPOINT before WHOLE-PROJECT SANITY GATE):
Write \`${prpDir}/done/PHASE4_OVERALL_GATE_REPORT.md\`:

\`\`\`markdown
# Phase 4 Overall Gate Report

## Per-module status
| Module               | G' | H' | I' | J' | Contract' | K'  | Status |
|----------------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| PRP-001-Auth         | ✓  | ✓  | ✓  | ✓  | ✓         | adv | PASS   |
| PRP-002-Passengers   | ✓  | ✗  | ~  | ✓  | ✓         | adv | FAIL   |

## Critical issues across all modules
- Cross-module god-nodes (parser util, legacyCompat bridges, etc.)
- Communities spanning modules (tight coupling)
- Contract gaps remaining
- Legacy→modern cohesion regressions (advisory)

## Disposition
- {ALL modules PASS → proceed to service start + /systest}
- {Some modules FAIL → return to module STEP 2 for listed modules}
\`\`\`

This overall report is referenced by Phase 6 Documentation and by the
WHOLE-PROJECT SANITY GATE.

---

**How to run these gates:**

You can either (a) use graph_query / graph_neighbors directly via the graph tool
suite, or (b) invoke the project's code-side verifier if it has a built-in
graphify gate runner. For modernize.ts runs, (a) is the expected path:

1. Run each query above
2. Collect defects
3. If any gate fails: emit the defect list, return to STEP 0, fix responsible
   modules, re-run. Do NOT advance to service startup.
4. On full pass: append the results summary to \`${out}/PHASE4_FINAL_GATE.md\`
   under a section "Graph-Driven Gates".

**Skip rules:**
- If no \`frontend/\` directory → skip GATES G' / H' / I' / J' / Contract'
- Otherwise all applicable graph gates must pass

**Record per-module gate results** to \`${out}/PHASE4_FINAL_GATE.md\` under a
section "Graph-Driven Gates (per-module)" with the failing/advisory items.
This is the audit trail the WHOLE-PROJECT SANITY GATE at the CHECKPOINT
reads to confirm no gate silently regressed across modules.

If ANY per-module gate fails: return to STEP 2 for THIS module, fix, re-run
this module's GATEs. Do NOT advance to STEP 4 WRITE for this module until
every applicable GATE passes.

---

#### STEP 4 — Write completion.json with re-runnable evidence

---

### STEP 4 PRE-CHECK — PHASE4_PROGRESS.md location verification (B-3 enforcement)

Before writing completion.json, verify that
\`${join(parsed.output, '.project', 'PHASE4_PROGRESS.md').replace(/\\/g, '/')}\`
exists at the **canonical project status location** (NOT inside \`${prpDir}\`
or any subdirectory).

1. Check existence: the file MUST be at
   \`${join(parsed.output, '.project', 'PHASE4_PROGRESS.md').replace(/\\/g, '/')}\`.
   - NOT: \`${prpDir}/progress.md\`
   - NOT: \`${prpDir}/PHASE4_PROGRESS.md\`
   - NOT: \`${projectDir}/prps/progress.md\`
   - NOT: any other subdirectory variant

2. If found at a wrong location:
   - Emit WARNING log with actual path vs expected path.
   - Move the file to the correct location using the Write tool (read old,
     write to canonical, delete old if possible).
   - Update internal tracking so the next iteration sees the canonical path.

3. If not found AT ALL:
   - Create the canonical PHASE4_PROGRESS.md with the current module's
     status using the format from STEP 0 (Total / Completed / Pending
     sections), seeded from physical state just discovered.

4. Append or update the current module's checkbox under
   \`## Completed (source files verified on disk)\` in PHASE4_PROGRESS.md
   BEFORE proceeding to the completion.json write below.

⚠️ The canonical PHASE4_PROGRESS.md is THE authoritative progress tracker
for Phase 4 across sessions. Writing to alternate locations
(\`${prpDir}/progress.md\` etc.) causes the next session's STEP 0 Resume
Check to lose progress — the exact bug seen in digtalhuman where modules
1/2/6 completed but the subsequent session treated them as pending.

---

🚨 **SCHEMA ENFORCEMENT — airlinesys5 incident lesson.**

airlinesys5 shipped with 0 Vitest tests, debug test files present, and
\`datetime.utcnow()\` deprecation warnings because completion.json was written in
a FREE-FORM shape that the code-side runtime verifier could not re-execute.
DO NOT repeat this.

❌ REJECTED SHAPE (what airlinesys5 did — verifier has nothing to re-run):
\`\`\`json
{ "criterion": "App renders without console errors",
  "verified": true,
  "notes": "TypeScript compilation passed with no errors" }
\`\`\`
Reasons rejected:
- No \`method\` field → verifier can't pick a re-executor
- No \`evidence\` field → "notes" is self-report text, not a re-runnable command
- Fraud is undetectable because there's no command to re-run

✅ ACCEPTED SHAPE (every criterion MUST look like this):
\`\`\`json
{ "criterion": "...",
  "verified": true,
  "method": "curl" | "pytest" | "filesystem" | "chrome-mcp" | "static",
  "evidence": { /* shape depends on method */ } }
\`\`\`

NOTE on \`method: "pytest"\`: generic "run \`evidence.command\`, assert exit code
+ stdout contains". NOT limited to Python pytest — use it for \`npx vitest run\`,
\`npm test\`, \`jest\`, \`go test ./...\`, Cargo test, etc. The verifier re-executes
the command string and checks \`expectedExitCode\` + \`expectedStdoutContains\`.

PRE-FLIGHT SELF-CHECK (run mentally before you Write the file):
1. Does EVERY criterion have \`method\` = one of the 5 enum values? If any missing → REWRITE.
2. Does EVERY criterion have \`evidence\` with re-runnable commands/paths? If any has only \`notes\` → REWRITE.
3. Grep your own draft: if \`"notes":\` appears INSIDE an \`acceptanceCriteria\` item (not in top-level \`implementationNotes\`), you used the wrong schema. REWRITE.
4. Could a fresh shell (zero state, cold cache) reproduce every verdict from \`evidence\` alone? If no → REWRITE.

The code-side runtime verifier re-executes \`evidence.command\` / reads \`evidence.file\` / inspects \`evidence.summaryPath\`. "unsupported method" or "cannot re-run" = module REJECTED and re-queued.

---

### STEP 4 WRITE — EXACT PATH AND FILENAME REQUIRED (B-4 enforcement)

🚨 **STRICTLY SPECIFIED — deviation breaks STEP 0 Resume Check next session** 🚨

Path: \`${prpDir}/done/PRP-{NNN}-{ModuleName}.completion.json\`

Breakdown:
- Directory name: LITERALLY \`done\` (4 characters: d-o-n-e)
  - NOT \`completion\` (this was the digtalhuman bug — lost 3 modules)
  - NOT \`completed\`
  - NOT \`finished\`
- Filename: \`{PRP id}-{module slug}.completion.json\`
  - Suffix MUST be \`.completion.json\` (two-part extension)
  - NOT just \`.json\` (this was the digtalhuman bug)
  - Example: \`PRP-003-Orders.completion.json\`

You MUST use the Write or Edit tool (not Bash heredoc, not fs APIs from
scripts) so that meta-coder's graphify watcher picks it up and the next
session's STEP 0 Resume Check can verify it.

Before writing, sanity-check the target path:

\`\`\`
Expected: ${prpDir}/done/PRP-003-Orders.completion.json
          └── dir=done, suffix=.completion.json
\`\`\`

If you're about to write to \`${prpDir}/completion/\` or a filename without
the \`.completion.json\` suffix: STOP. You are deviating. Use the spec exactly.

---

Use the **Write tool** to create \`${prpDir}/done/{PRP-name}.completion.json\`:

\`\`\`json
{
  "prpName": "PRP-003-Orders",
  "startedAt": "{ISO-8601 from criteria/{PRP-name}.json}",
  "completedAt": "{ISO-8601 now}",
  "acceptanceCriteria": [
    {
      "criterion": "POST /api/orders (modernized from OD010) returns 201 with orderId",
      "verified": true,
      "method": "curl",
      "evidence": {
        "command": "curl -s -X POST http://localhost:8000/api/orders -H 'Content-Type: application/json' -d '{\\"customerId\\":1,\\"items\\":[{\\"sku\\":\\"A\\",\\"qty\\":1}]}' -w '\\n%{http_code}'",
        "expectedStatusMatch": "201",
        "expectedBodyContains": "orderId"
      }
    },
    {
      "criterion": "pytest tests/test_orders.py passes (>= 3 tests)",
      "verified": true,
      "method": "pytest",
      "evidence": {
        "command": "pytest tests/test_orders.py -v --tb=no",
        "workspaceRelative": true,
        "expectedExitCode": 0,
        "expectedStdoutContains": "3 passed"
      }
    },
    {
      "criterion": "Router for orders module wired into src/main.py",
      "verified": true,
      "method": "filesystem",
      "evidence": { "file": "src/main.py", "contains": ["orders"] }
    },
    {
      "criterion": "No legacy COBOL idioms leaked into new source",
      "verified": true,
      "method": "filesystem",
      "evidence": { "file": "src/orders/api.py", "notContains": ["PIC X", "COMP-3", "PROCEDURE DIVISION"] }
    },
    {
      "criterion": "Frontend /orders renders without console errors (OD010 equivalent)",
      "verified": true,
      "method": "chrome-mcp",
      "evidence": { "summaryPath": ".systest/evidence/phase4/orders/summary.json", "expectedPass": true }
    }
  ],
  "artifacts": {
    "sourceFiles": ["src/orders/models.py", "src/orders/api.py", "src/orders/service.py"],
    "testFiles":   ["tests/test_orders.py"],
    "frontend": {
      "sourceFiles": ["frontend/src/pages/orders/List.tsx", "frontend/src/pages/orders/Detail.tsx"],
      "testFiles":   ["frontend/src/__tests__/pages/orders/List.test.tsx"]
    }
  },
  "bestPracticesChecked": [${bpCheckedList}]
}
\`\`\`

⚠️ **Hard requirements — the code-side runtime verifier re-executes each criterion's \`command\` / \`glob\` / \`url\` against the live services. Fabricated \`verified: true\` will be detected and the module will be re-run.**

- \`startedAt\` / \`completedAt\` both ISO-8601; duration must be >= 10s
- Every criterion in the original criteria file MUST appear here with \`verified: true\`
- \`command\` fields must be exactly what you ran in STEP 3 (no secrets stripped,
  no placeholders re-introduced)
- \`sourceFiles[]\` entries must exist on disk

After writing completion.json, emit a single terse line: \`✓ {PRP} ({X}/{N})\`.
Then IMMEDIATELY begin STEP 1 of the next module in the SAME response — no
"Progress Update", no "Continuing with...", no confirmation prompt.

---

**STEP 3.POST: Verify your marker is actually on disk and valid (MANDATORY)**

After writing \`done/PRP-NNN-*.completion.json\`, verify it using Claude Code's built-in tools:

1. \`Glob({ pattern: "${prpDir}/done/PRP-NNN-*.completion.json" })\` — must return exactly one path. Zero = you did not write the file. Two or more = duplicate, rename one.
2. \`Read(<that path>)\` — must parse as JSON (no syntax errors).
3. Schema check (at least ONE must hold):
   - **NEW**: \`acceptanceCriteria\` is a non-empty array AND at least one entry has \`verified === true\`
   - **OLD**: \`verification.reviewVerdict === "PASS"\` AND \`verification.testsPass === true\`
4. \`gates_verified\` check (MANDATORY, no exceptions):
   - All 6 keys present: \`G\`, \`H\`, \`I\`, \`J\`, \`Contract\`, \`K\`
   - Each value is an object with one of: \`pass: true\`, \`advisory: true\`, or \`skipped: true\`
5. Filesystem evidence: if \`artifacts.sourceFiles\` is listed, every path must exist on disk (\`ls <path>\` or \`Read\`).

If ANY check fails → re-write the completion.json with corrected fields and re-verify. **DO NOT advance to the next PRP until all 5 checks pass.**

Your own "I wrote the file" claim does NOT count. Only the 5 checks above count.

---

### 3 MANDATORY RULES (replaces the old 14)

1. **Every acceptance criterion MUST be actually RUN (STEP 3) before STEP 4.**
   Writing \`verified: true\` into completion.json without executing the corresponding
   \`command\` / \`glob\` / \`url\` is FRAUD. The code-side runtime verifier re-runs
   every command against the live services and rejects the module on mismatch.

2. **completion.json evidence MUST be RE-RUNNABLE by a fresh process.**
   No hidden state, no "after X step earlier in this session", no env-dependent
   paths. If the verifier re-runs the command 30 minutes later, it must produce the
   same verdict. This is why criteria use absolute paths, explicit ports
   (\${BACKEND_PORT} / \${FRONTEND_PORT}) and verbatim Bash commands.

3. **Phase 4 is CONTINUOUS — NO PAUSES BETWEEN MODULES, AND NO STOP AFTER THE LAST MODULE.**
   Once the per-module loop starts, only these stops are legitimate:
   - A criterion failed 3× in a row despite fix-agents → emit visible FAIL and stop
   - Explicit user interruption
   "All modules done" is NOT a legitimate stop — it is the midpoint. Proceed
   directly into the Phase 4 SANITY CHECK and then into the CHECKPOINT section
   (start services + /systest command) in the SAME response.
   "Progress Update / Next Steps / Continuing with PRP-X" multi-line blocks are a
   violation. One terse \`✓ {PRP} ({X}/{N})\` line, then immediately STEP 1 of the
   next module in the same response.

---

**Phase 4 SANITY CHECK (MANDATORY before advancing to Phase 5)**

Before declaring Phase 4 complete:

1. \`Glob({ pattern: "${prpDir}/PRP-*.md" })\` → count = N (source of truth for how many modules exist).
2. \`Glob({ pattern: "${prpDir}/done/PRP-*.completion.json" })\` → count = M.
3. If **M < N**: at least one PRP has NO marker. Identify which PRP-NNN is missing, go back to its STEP 3 FINAL, and write the marker. Repeat until M == N.
4. For every marker, re-run all 5 checks from STEP 3.POST above. Any failure → fix and re-check.
5. Only when M == N AND all 5 checks pass for every marker may you proceed to the CHECKPOINT section below.

Do NOT skip this. Do NOT proceed with missing completion markers — STEP 0 Resume Check will re-enter Phase 4 next session and waste an entire re-implementation round.

---

🚨 **MANDATORY NEXT STEP — DO NOT STOP HERE.**

Phase 4 SANITY CHECK passed (M == N, all markers valid). You MUST now proceed **IMMEDIATELY** to the \`CHECKPOINT: Phase 4 Complete → Start Services + Session Reset\` section below. This is NOT optional. Do NOT:

- Emit a "Phase 4 complete" summary and stop
- Ask the user "should I continue?"
- Output a \`✅ Phase 4 implementation finished\` banner and wait
- Switch topics or offer to do anything else

The CHECKPOINT section below is where you:
1. Run the WHOLE-PROJECT SANITY GATE (GATES A-F)
2. Start the backend service (with port rotation + health check)
3. Start the frontend service (with port rotation + health check)
4. Run Phase 4.5 Contract Conformance
5. Write the Phase 4 summary
6. Output the \`/systest\` command for the user to copy/paste

**WITHOUT THESE STEPS, the user cannot test the modernized project.** Stopping here silently leaves services unstarted and /systest command unprinted — forcing the user to repeat Phase 4 next session. Proceed DIRECTLY to the CHECKPOINT below, in the SAME response. Treat the CHECKPOINT as step 6 of the per-module loop that runs ONCE after all PRPs complete.

---

### Frontend Infrastructure (LAST module in MODULE_INDEX.md)

Frontend Infrastructure (PRP-*-Frontend-Infrastructure.md, written in Phase 3
STEP 3.5) is treated as just another PRP — run it through the SAME 4 steps above.
Its criteria will typically require: \`${out}/frontend/src/components/ui/*.tsx\`
files to exist (Button, Input, Form, DataTable, Modal, LoadingSpinner, ErrorBoundary),
\`MainLayout.tsx\` + \`Sidebar\` + \`Header\`, \`useAuth.ts\`, \`ProtectedRoute.tsx\`,
\`apiClient.ts\`, \`tokens.css\`. Subsequent per-module frontend agents import from
these — the Reviewer flags violations.

---

### CHECKPOINT: Phase 4 Complete → Start Services + Session Reset

🚨 **ENTRY GATE — PHYSICAL VERIFICATION REQUIRED:**

Before doing ANYTHING in this CHECKPOINT section, verify ALL modules are physically complete
**using cross-platform AI tools** (Glob/Read — works on Windows, macOS, Linux):

1. List all PRP files: \`Glob({ pattern: "${prpDir}/PRP-*.md" })\` → total N
2. List all completion.json files: \`Glob({ pattern: "${prpDir}/done/*.completion.json" })\`
3. For each completion.json, Read and verify (accept BOTH schemas):
   - **NEW schema**: \`acceptanceCriteria\` non-empty array, every item \`verified === true\`. Spot-check one curl criterion by re-running its command.
   - **OLD schema** (legacy): \`verification.reviewVerdict === "PASS"\` AND \`verification.testsPass === true\` AND at least one artifacts.sourceFiles path exists
4. Count verified-complete modules → X
5. If X < N:
   - Derive missing list by comparing PRP names vs verified completion.json names
   - Announce: "Only X/N modules verified complete. Cannot proceed to CHECKPOINT."
   - List exactly which modules are missing
   - GO BACK to STEP 0 resume check, continue implementing the missing modules
   - DO NOT start services, write PHASE4_SUMMARY.md, or suggest /systest

**Do NOT trust PHASE4_PROGRESS.md — it may contain AI self-reported (incorrect) status.
The AUTHORITATIVE source is ${prpDir}/done/*.md.done file count.**

Only proceed if done == total.

Phase 4 (ALL N modules implemented, reviewed, tested) is done. You MUST start
services and provide the user with the exact test command before stopping.

---

🛡️ **WHOLE-PROJECT SANITY GATE — MANDATORY before any /systest command.**

Per-module criteria passed, but airlinesys5 still shipped with 35% of backend
tests broken and 0 Vitest tests. Reason: per-module verification cannot catch
cross-module regressions or whole-suite rot. Run these 6 gates VERBATIM from
\`${out}\`. **ALL SIX must pass.** If any fails, return to STEP 0 and fix the
responsible module(s). Do NOT start services or print /systest until all pass.

\`\`\`bash
# GATE A: Backend whole-suite pass rate ≥ 95%
cd ${out} && pytest tests/ --tb=no -q 2>&1 | tail -5
# Must show "X passed" with X/total ≥ 0.95.
# If integration tests ERROR due to missing fixtures: FIX them OR mark
# @pytest.mark.skip("<explicit reason>") — never silently ignore.

# GATE B: No debug / tmp / simple test residue
# Match TOP-LEVEL throwaway files only — legitimate names like test_simple_auth.py pass.
find tests -type f \\( -name "test_simple.py" -o -name "test_debug.py" \\
  -o -name "test_tmp*.py" -o -name "test_*_debug.py" -o -name "test_*_tmp.py" \\
  -o -name "*_scratch.py" -o -name "*_playground.py" \\) 2>/dev/null \\
  | grep -v __pycache__ || true
# Output MUST be EMPTY. Delete any matches.

# GATE C: No deprecated datetime API (Python 3.12+)
rg -n "datetime\\.utcnow\\(\\)" src/ app/ backend/ 2>/dev/null || true
# Output MUST be EMPTY. Replace with \`datetime.now(timezone.utc)\`.

# GATE D: Vitest coverage ratio ≥ 80% of page count
pages=$(find frontend/src/pages -name "*.tsx" -not -name "*.test.tsx" 2>/dev/null | wc -l)
tests=$(find frontend/src -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null | wc -l)
echo "pages=$pages vitest-tests=$tests"
test "$tests" -ge "$(( pages * 8 / 10 ))" || { echo "FAIL: Vitest < 80% of pages"; false; }

# GATE E: Vitest actually runs green
cd ${out}/frontend && npx vitest run --reporter=dot 2>&1 | tail -10

# GATE F: No frontend skeleton remnants
rg -n "Under construction|Coming soon|^\\s*// ?TODO|WIP" frontend/src/pages/ || true
# Output MUST be EMPTY.
\`\`\`

**Skip rules (classic gates):**
- If no \`frontend/\` directory → skip GATES D / E / F
- If no \`tests/\` directory → skip GATES A / B / C
- Otherwise ALL applicable gates must pass

**Record results** to \`${out}/PHASE4_FINAL_GATE.md\` with each gate's actual
stdout (first/last 10 lines). This is the audit trail for user verification.

If ANY gate fails: DO NOT proceed. DO NOT start services. Announce which gate
failed and return to STEP 0 to fix the responsible module(s).

---

**STEP 1: Start BACKEND service (MANDATORY — port rotation on conflict)**

🚨 The backend MUST be running and reachable BEFORE you print the /systest command.
A /systest command pointing at a dead port wastes the user's next session.

**1a. Find the backend start command** by inspecting these files in order:
- \`${out}/package.json\` — scripts.start / scripts.dev / scripts["start:api"] / scripts.server
- \`${out}/pyproject.toml\` + \`${out}/src/main.py\` (FastAPI pattern — uvicorn)
- \`${out}/pom.xml\` → Spring Boot (mvn spring-boot:run)
- \`${out}/go.mod\` → \`go run ./cmd/...\`
- \`${out}/composer.json\` → PHP (\`php -S localhost:<port> -t public\`)

**1b. Pick an AVAILABLE backend port** — start with the framework default, rotate on conflict:
- Python/FastAPI default: 8000 → if busy try 8001, 8002, 8003
- Spring Boot default: 8080 → try 8081, 8082
- Generic Node: 3000 → try 3001, 3002
- Check availability: \`Bash({ command: "curl -s -o /dev/null -w '%{http_code}' http://localhost:<PORT>/ --connect-timeout 1", timeout: 3000 })\`
  - Response "000" = free (connection refused) ✓
  - Any HTTP code = port already in use, try next
- On Windows Git Bash, **DO NOT use \`lsof\` / \`netstat | grep\`** (unreliable or missing); use curl as shown
- Stop trying after 10 ports — if none free, fail with message to user

**1c. Launch** the backend in the background with Bash \`run_in_background: true\`:
- Python: \`cd ${out} && python -m uvicorn src.main:app --host 127.0.0.1 --port <PORT> > .systest/backend.log 2>&1\`
- Node: \`cd ${out} && PORT=<PORT> npm start > .systest/backend.log 2>&1\`
- Spring Boot: \`cd ${out} && mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=<PORT>\`
- (Ensure dependencies are installed first: \`pip install -r requirements.txt\`, \`npm install\`, \`mvn dependency:resolve\`)

**1d. Health check with retry** — wait up to 30s for server to accept connections:
\`\`\`
for i in 1..15:
  sleep 2
  curl -s -o /dev/null -w '%{http_code}' http://localhost:<PORT>/docs --connect-timeout 2
  if code starts with 2xx or 3xx: break
else: FAIL — report backend didn't start, investigate .systest/backend.log
\`\`\`

**1e. Record the ACTUAL port** as a variable \`BACKEND_PORT\` in your working memory.

---

**STEP 2: Start FRONTEND service (MANDATORY — port rotation on conflict)**

**2a. Find the frontend start command**:
- \`${out}/frontend/package.json\` — scripts.dev (Vite/Next) / scripts.start (CRA)
- If no \`frontend/\` dir but root package.json has frontend scripts, use root

**2b. Pick an AVAILABLE frontend port**:
- Vite default: 5173 → if busy try 5174, 5175, 5176
- Next.js default: 3000 → try 3001, 3002 (coordinate with backend — must differ)
- Check availability with same curl pattern as 1b

**2c. Launch** in the background:
- \`cd ${out}/frontend && npm install && npm run dev -- --port <PORT> --host 127.0.0.1 > ../.systest/frontend.log 2>&1\`
- Some dev servers ignore \`--port\` if conflict; pass \`PORT=<PORT>\` env too for safety

**2d. Health check with retry** — wait up to 45s (Vite cold start can be slow):
\`\`\`
for i in 1..22:
  sleep 2
  curl -s -o /dev/null -w '%{http_code}' http://localhost:<PORT>/ --connect-timeout 2
  if code starts with 2xx or 3xx: break
else: FAIL — report frontend didn't start, investigate .systest/frontend.log
\`\`\`

**2e. Record the ACTUAL port** as \`FRONTEND_PORT\`.

---

## Phase 4.5: Contract Conformance (NEW — between Phase 4 service-start and PHASE4_SUMMARY)

⚠️ **Executed INSIDE Phase 4 CHECKPOINT, AFTER services are running but BEFORE
writing PHASE4_SUMMARY.md and printing the /systest command.**

Purpose: catch backend/frontend drift from \`${prpDir}/contracts/openapi.yaml\`
**while the implementation session still has full context**. Drift caught here
costs ~30 seconds to fix; drift caught by /systest forces a full session reset.

Scope note for modernization: Phase 4.5 verifies that the modernized backend and
frontend AGREE with each other via the OpenAPI contract. Whether the modernized
backend is **semantically equivalent to the legacy COBOL behavior** is NOT
Phase 4.5's job — that is /systest's job (Phase 5B golden-flow tests re-use
legacy fixtures). Phase 4.5 only checks contract conformance.

Let \`backendUrl = http://localhost:\${BACKEND_PORT}\` (from STEP 1e) and
\`frontendUrl = http://localhost:\${FRONTEND_PORT}\` (from STEP 2e).

### STEP 1: Backend conformance check

The backend's live OpenAPI spec must match the canonical contract.

\`\`\`bash
# 1. Fetch live spec
curl -sf \${backendUrl}/openapi.json -o ${out}/.project/runtime_openapi.json \\
  || { echo "FAIL: backend did not serve /openapi.json"; exit 1; }

# 2. Diff paths (set comparison)
python -c "
import json, yaml, sys
live = json.load(open('${out}/.project/runtime_openapi.json'))
canon = yaml.safe_load(open('${prpDir}/contracts/openapi.yaml'))
live_paths = set(live.get('paths', {}).keys())
canon_paths = set(canon.get('paths', {}).keys())
missing = canon_paths - live_paths
extra = live_paths - canon_paths
if missing: print('MISSING in backend:', sorted(missing))
if extra: print('EXTRA in backend (not in contract):', sorted(extra))
sys.exit(1 if (missing or extra) else 0)
"
\`\`\`

For each path present in both, verify per-operation:

- Request body schema property names == contract schema property names
- Required fields in the backend schema ⊇ required fields in the contract schema
  (backend may make a contract-optional field required only with explicit PRP
  justification; the reverse — backend missing a contract-required field — is
  always a FAIL)
- Response schema shape matches (field names + types)

Record results as \`${out}/.project/conformance/backend.json\`:

\`\`\`json
{
  "timestamp": "2026-04-19T12:00:00Z",
  "paths_checked": 12,
  "paths_passing": 12,
  "issues": []
}
\`\`\`

Any issue → module responsible must be sent back to Phase 4 STEP 2 for rework.
Do NOT proceed to STEP 2 below with unresolved backend issues.

### STEP 2: Frontend conformance check (\`tsc --noEmit\`)

Because the Frontend Agents in Phase 4 were told to import from
\`${out}/frontend/src/types/api.ts\` (generated from \`openapi.yaml\`), a clean
\`tsc --noEmit\` run is strong evidence the frontend compiles against the
contract.

\`\`\`bash
cd ${out}/frontend

# Regenerate types from the canonical contract (idempotent)
# openapi-typescript is already in devDependencies from Phase 3.5 STEP 6
npx --no-install openapi-typescript ${prpDir}/contracts/openapi.yaml -o src/types/api.ts

# Type-check the whole frontend
npx tsc --noEmit > ../.project/conformance/frontend_tsc.log 2>&1 \\
  || { echo "FAIL: tsc --noEmit errors — see conformance/frontend_tsc.log"; exit 1; }

# Grep for banned patterns
grep -rn ": any" src/ && { echo "FAIL: 'any' type used in frontend"; exit 1; } || true
grep -rn "// @ts-ignore" src/ && { echo "FAIL: @ts-ignore used in frontend"; exit 1; } || true
\`\`\`

Also verify, for each Create/Edit page the PRP defined, that the form's
\`<input name="…">\` attributes cover every field in the contract's
\`{Entity}Create\` / \`{Entity}Update\` \`required\` array. This is the
airlinesys5-style contract-gap check, but run now while agents are still
available for fixes.

Record \`${out}/.project/conformance/frontend.json\` with the same shape as
\`backend.json\`.

### STEP 3: End-to-end contract test

Spin up a minimal live test that proves the frontend-visible type of a round-trip
call matches the contract. One sample per POST/PUT path in the contract is enough:

\`\`\`bash
# Example: create a passenger through the live backend
curl -sf -X POST \${backendUrl}/api/passengers \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Test","status":"A"}' \\
  -o ${out}/.project/conformance/sample_create.json \\
  || { echo "FAIL: POST /api/passengers returned non-2xx — contract 422?"; exit 1; }

# Validate response against contract schema
python -c "
import json, yaml
resp = json.load(open('${out}/.project/conformance/sample_create.json'))
canon = yaml.safe_load(open('${prpDir}/contracts/openapi.yaml'))
schema = canon['components']['schemas']['Passenger']
for field in schema.get('required', []):
    assert field in resp, f'response missing required field: {field}'
print('E2E contract test passed')
"
\`\`\`

If this fails with 422 — that IS the contract mismatch. Re-run Phase 4 STEP 2
for the responsible module with the actual error body as input.

### STEP 4: Conformance Report

Write \`${prpDir}/CONFORMANCE_REPORT.md\`:

\`\`\`markdown
# Contract Conformance Report

Canonical contract: \`${prpDir}/contracts/openapi.yaml\`
Generated: <ISO timestamp>
Backend: http://localhost:{BACKEND_PORT}
Frontend: http://localhost:{FRONTEND_PORT}

## Summary
- Paths in contract: M
- Backend paths conforming: M/M
- Frontend pages conforming: K/K
- E2E round-trip tests: P/P

## Per-path results
| Path | Method | Backend | Frontend (if page) | E2E |
|------|--------|---------|---------------------|-----|
| /api/passengers | GET | PASS | PASS | PASS |
| /api/passengers | POST | PASS | PASS | PASS |
| ... |

## Issues (if any)
- (empty on clean run)

## Notes (modernization-specific)
Contract conformance here verifies backend↔frontend agreement only.
Legacy-equivalence verification (COBOL semantics vs. FastAPI handler behavior)
is performed by /systest Phase 5B golden flows, not here.
\`\`\`

### STEP 5: Conformance gate

\`\`\`
if backend.json.issues == [] and frontend.json.issues == [] and E2E passes:
  log "Phase 4.5 PASS — contract conformance verified"
  proceed to Phase 4 CHECKPOINT STEP 3 (write PHASE4_SUMMARY.md)
else:
  for each issue:
    identify responsible PRP module
    send back to Phase 4 STEP 2 with the conformance issue text
    re-run that module's Coding + Reviewer + Tester loop
    re-run Phase 4.5 until clean
\`\`\`

Do NOT write PHASE4_SUMMARY.md or print the /systest command until Phase 4.5
is clean. A /systest run against a contract-non-conformant build will fail in
Phase 5C with confusing UI errors that look like frontend bugs but are actually
upstream schema drift.

---

**STEP 3: Write PHASE4_SUMMARY.md with actual URLs**

Write to ${join(parsed.output, '.project', 'PHASE4_SUMMARY.md').replace(/\\/g, '/')}:
\`\`\`markdown
# Phase 4 Completion Summary

## Services Running
- Backend:  http://localhost:{BACKEND_PORT}  (Swagger UI: /docs)
- Frontend: http://localhost:{FRONTEND_PORT}

## Modules Implemented (N/N)
- PRP-001-... — <file count>, <endpoint count>
- PRP-002-... — ...
- (all modules listed)

## Next Step
User MUST run /clear, then the /systest command (see STEP 4 output).
\`\`\`

---

**STEP 4 — CRITICAL FINAL OUTPUT (EXACTLY as shown, with actual ports interpolated)**

🚨 This is the LAST thing you output in this Phase 4 session. Do NOT output anything
after this block. Do NOT offer to run /systest yourself — the user must /clear first
to reset context. Do NOT summarize further — the summary is already in PHASE4_SUMMARY.md.

Using \`BACKEND_PORT\` and \`FRONTEND_PORT\` recorded in STEPs 1e/2e, output EXACTLY:

---

╔══════════════════════════════════════════════════════════════════╗
║  ✅ Phase 4 COMPLETE — N/N modules verified                      ║
║                                                                  ║
║  Services running:                                               ║
║    Backend:  http://localhost:{BACKEND_PORT}   (Swagger: /docs)  ║
║    Frontend: http://localhost:{FRONTEND_PORT}                    ║
║                                                                  ║
║  👉 NEXT STEP: reset session, then run /systest                  ║
╚══════════════════════════════════════════════════════════════════╝

**Step 1 — Reset session (copy/paste this):**

\`\`\`
/clear
\`\`\`

**Step 2 — Run system test (copy/paste this, already fully parameterized):**

\`\`\`
/systest run --workspace ${out} --backend-url http://localhost:{BACKEND_PORT} --frontend-url http://localhost:{FRONTEND_PORT}${parsed.databaseUrl ? ' --database ' + parsed.databaseUrl : ''}${parsed.designDocsDir ? ' --design-docs ' + parsed.designDocsDir.replace(/\\\\/g, '/') : ''}
\`\`\`

🚨 **CRITICAL — do NOT drop \`--frontend-url\` when copying.**
Without \`--frontend-url\`, Phase 5C (frontend E2E testing) is silently skipped
and the final report will say "E2E framework not configured" or similar — that
message is a HALLUCINATION; the real reason is always "frontend URL missing".
The skip gate checks ONLY \`!!ctx.frontendUrl\`; Chrome MCP / Playwright status
is irrelevant to it.

⚠️ The /systest command above is READY-TO-RUN:
- Backend + Frontend are already running (don't start them again)
- All URLs point to the actual ports allocated in STEPs 1-2
- Workspace and ${parsed.databaseUrl ? 'database ' : ''}${parsed.designDocsDir ? 'design-docs ' : ''}are filled in from this Phase 4 session
- No additional arguments needed — just copy/paste

---

**STOP HERE.** Do NOT proceed to Phase 5 in this session.
Do NOT delete, stop, or restart the backend/frontend processes — /systest will use them.
If the user's terminal gets cluttered with server logs, advise them to use a split terminal.

---

## Phase 6: Documentation

NOTE: Phase 6 documentation will be generated by /systest after Phase 5 testing.
However, if the user does NOT run /systest, generate documentation here as fallback.

Generate the following 5 documents in ${docsDir}/:

### 1. API_REFERENCE.md
- All API endpoints with request/response examples
- Authentication requirements
- Error codes and handling

### 2. ARCHITECTURE.md
- System architecture overview
- Module dependency graph
- Data flow diagrams
- Technology choices and rationale

### 3. DATABASE.md
- Schema diagrams (entity relationships)
- Migration instructions
- Seed data documentation
${parsed.databaseUrl ? '- Connection configuration reference' : ''}

### 4. DEPLOYMENT.md
- Environment setup instructions
- Configuration variables
- Build and run commands
- Docker/container setup if applicable

### 5. ${finalReportPath.split('/').pop()}
- Executive summary of modernization
- Legacy vs. new architecture comparison
- Module-by-module migration status
- Test coverage summary (from Phase 5 results)
- Remaining technical debt and recommendations

---

`

  return prompt
}


// ---------------------------------------------------------------------------
// Env context section builder
// ---------------------------------------------------------------------------

import type { SkillEnvContext } from '../../services/envManager/deployment/types.js'

/**
 * Build the env context section appended to the modernize prompt.
 *
 * Modernize-specific rules:
 * - If target env tag includes 'production', refuse and require a staging detour.
 * - Otherwise, surface the DB primary connection string for the migration phase.
 */
function buildModernizeEnvSection(
  ctx: SkillEnvContext,
  workspacePath: string,
): string {
  const lines: string[] = []
  lines.push('### Env Context for Migration (pre-flight check)')
  lines.push('')

  if (!ctx.ok) {
    lines.push(`> No active environment configured (${ctx.reason ?? 'no env set'}).`)
    lines.push('> Env context is optional — migration will proceed without it.')
    lines.push('> To activate: `/env use staging` (or the target env name).')
    return lines.join('\n')
  }

  lines.push(ctx.block)
  lines.push('')

  // Production guard — use STRUCTURED env metadata (tags), not Markdown
  // pattern-matching. Reviewer #1 fix: prior implementation matched
  // "production" as a substring of the rendered block, which both false-
  // positived on description text and could be bypassed by description
  // wording. Spec §1.5.1 mandates structured tag-based detection.
  if (ctx.isProduction) {
    lines.push('> **STOP**: The active environment appears to be a production environment.')
    lines.push('> Direct migration to production is not allowed.')
    lines.push('> Required staging detour:')
    lines.push('> 1. Switch to a staging env: `/env use staging`')
    lines.push('> 2. Run `/modernize` against staging')
    lines.push('> 3. After staging verification, promote via `/env promote staging prod`')
    lines.push('')
    lines.push('_The migration will not proceed until a non-production env is active._')
    return lines.join('\n')
  }

  lines.push('**Database connection for migration phase:**')
  lines.push('- Use `${var:DB_HOST_*}` / `${var:DB_USER_*}` from the env block above.')
  lines.push('- DB passwords are secret refs — they are resolved at tool-call time, not stored here.')
  lines.push('- Run migrations against the env\'s `database.primary` host (see ENV block).')
  lines.push('')
  lines.push(`_Workspace: ${workspacePath}_`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Skill registration
// ---------------------------------------------------------------------------

export function registerModernizeSkill(): void {
  registerBundledSkill({
    name: 'modernize',
    description: 'Legacy project modernization: analyze legacy code -> design -> TDD develop -> test -> document. Supports [--env <name>] to activate env context.',
    userInvocable: true,
    async getPromptForCommand(args) {
      // Extract optional --env flag before forwarding args to parseProjectArgs
      const { envName: envOverride, rest: cleanArgs } = extractEnvFlag(args ?? '')
      const effectiveArgs = cleanArgs

      if (!effectiveArgs || !effectiveArgs.includes('--workspace')) {
        return [{
          type: 'text',
          text: 'Usage: /modernize --workspace <legacy-code-path> --database <conn> [--output <new-code-path>] [--design-style <name>] [--language <ja|en|zh>] [--team] [-v|--verify] [--env <env-name>]',
        }]
      }

      try {
        const parsed = parseProjectArgs(effectiveArgs)

        // Resume detection — check if project is being resumed
        const resumeCtx = await detectResumeContext(parsed.output)
        if (resumeCtx.isResume && !parsed.resume) {
          console.log('[modernize] Resume context detected — existing done/ directory')
          parsed.resume = true
        }

        // If resume: skip Phase 1-3, generate resume-specific prompt
        if (parsed.resume) {
          if (resumeCtx.pendingModules.length === 0) {
            return [{
              type: 'text',
              text: `All modules already completed (${resumeCtx.completedModules.length} modules). Nothing to resume.\n\nCompleted:\n${resumeCtx.completedModules.map(m => '- ' + m).join('\n')}\n\nTo proceed to testing: /clear then /systest run --workspace ${parsed.output.replace(/\\/g, '/')} --backend-url http://localhost:8000 --frontend-url http://localhost:5173${parsed.databaseUrl ? ' --database ' + parsed.databaseUrl : ''}`,
            }]
          }

          // Resolve best practices files for resume context (re-use same logic as buildModernizePrompt)
          const resumeStack = resolveTechStack(parsed, { techStack: {} as any, entities: [], routes: [], services: [], communities: [], graphStats: null }, 'legacy')
          const resumeBp = getBestPracticesFiles({
            language: resumeStack.language,
            backend: resumeStack.backend,
            frontend: resumeStack.frontend,
          })
          const resumeBpText = (resumeBp.backend || resumeBp.frontend)
            ? `## Best Practices (apply to pending modules)

When spawning Coding/Reviewer Agents for pending modules, MANDATORILY include these file references:
${resumeBp.backend ? '- Backend (' + resumeBp.backendLabel + '): ' + resumeBp.backend : ''}
${resumeBp.frontend ? '- Frontend (' + resumeBp.frontendLabel + '): ' + resumeBp.frontend : ''}

The Coding Agent must READ these files BEFORE writing code.
The Reviewer Agent must verify compliance and flag violations as HIGH severity.

`
            : ''

          const resumePrompt = `# Resume Phase 4 — Legacy Modernization

A previous /modernize session was interrupted. Resuming from physical state.

## Resume Context

- Project output: ${parsed.output.replace(/\\/g, '/')}
- PRP directory: ${resumeCtx.prpDir.replace(/\\/g, '/')}
- Total modules: ${resumeCtx.completedModules.length + resumeCtx.pendingModules.length}
- Completed (verified via done/*.md.done): ${resumeCtx.completedModules.length}
- Pending: ${resumeCtx.pendingModules.length}

## Completed modules (skip these)
${resumeCtx.completedModules.map(m => '- ✓ ' + m).join('\n') || '(none)'}

## Pending modules (implement these)
${resumeCtx.pendingModules.map(m => '- ⧗ ' + m).join('\n')}

${resumeBpText}## Your task

1. Display this EXACT message to the user:

   ---
   📋 Resume detected: ${resumeCtx.completedModules.length} completed, ${resumeCtx.pendingModules.length} pending modules.
   Reply **"continue"** (or "proceed" / "ok" / "go") to resume implementation.
   Reply with specific instructions to change scope.
   ---

2. 🛑 **STOP HERE. Do NOT spawn any Agent. Do NOT start Phase 4 workflow.**
   Wait for user input. Only proceed when user explicitly approves.
3. For each pending module (in MODULE_INDEX.md order), run the Phase 4 4-step workflow:
   - STEP 1: Define 4-10 acceptance criteria → \`.project/criteria/{PRP}.json\`
   - STEP 2: Implement (you choose: 1 agent or many, serial or parallel)
   - STEP 3: Run every criterion, record results in \`.project/criteria/{PRP}.result.json\`
   - STEP 4: Write \`done/{PRP}.completion.json\` with re-runnable evidence
4. After all pending done: proceed to CHECKPOINT (start services, provide /systest command).

## MANDATORY RULES

1. Do NOT re-implement already-completed modules (they have completion.json)
2. Do NOT trust any markdown checkbox — only completion.json with verified criteria counts
3. Every acceptance criterion in STEP 1 must be actually RUN in STEP 3 before STEP 4
4. completion.json evidence must be RE-RUNNABLE — the code-side verifier re-executes it
5. The done/ directory is the authoritative source of truth

## Files to read

- ${resumeCtx.prpDir.replace(/\\/g, '/')}/MODULE_INDEX.md — execution order
- ${resumeCtx.prpDir.replace(/\\/g, '/')}/FRONTEND_DESIGN.md — UI design
- ${resumeCtx.prpDir.replace(/\\/g, '/')}/PRP-*.md — individual specs
- ${resumeCtx.doneDir.replace(/\\/g, '/')}/*.completion.json — what's already done

Begin by asking for user confirmation, then process pending modules one by one.
`
          return [{ type: 'text', text: resumePrompt }]
        }

        // Normal flow: Phase 1-3 sync + prompt for Phase 4+
        // Phase 1: Initialize project structure
        console.log('[modernize] Phase 1: Initializing...')
        await initializeProject(parsed)

        // Build knowledge graph of LEGACY code (source of Phase 2-3 analysis).
        // buildKnowledgeGraph calls resetEngine(workspace) internally on success,
        // so the fresh graph.json is visible to getGraphEngine below even if
        // bootstrap.ts cached a stale null-engine at session start.
        console.log('[modernize] Building knowledge graph of legacy code:', parsed.workspace)
        const graphStats = await buildKnowledgeGraph(parsed.workspace)
        if (graphStats) {
          console.log('[modernize] Legacy graph:', graphStats.nodes, 'nodes,', graphStats.edges, 'edges')
          if (graphStats.nodes === 0) {
            console.warn('[modernize] WARNING: legacy graph has 0 nodes — parser may not cover this tech stack. GATEs and PRP generation will be degraded.')
          }
        } else {
          console.warn('[modernize] WARNING: legacy graph build returned null — graphify-out/ may not exist. GATEs will be degraded.')
        }

        // ALSO initialize an (initially empty) graph at the OUTPUT directory.
        //
        // Why two graphs:
        //   - Legacy graph (parsed.workspace) is read by analyzeProjectStructure
        //     to design PRPs — it is the "what we have" snapshot.
        //   - Output graph (parsed.output) is what Phase 4 GATEs (G'/H'/I'/J'/
        //     Contract'/K') query to verify the MODERNIZED code. autoUpdate
        //     maintains it as Edit/Write tool calls generate new files. Without
        //     this init, output has no graphify-out/ at Phase 4 start and
        //     graph_query returns empty, bypassing GATE enforcement.
        //
        // Skip when workspace === output (user modernizing in-place).
        if (parsed.output !== parsed.workspace) {
          console.log('[modernize] Initializing output graph (for Phase 4 GATE queries):', parsed.output)
          const outStats = await buildKnowledgeGraph(parsed.output)
          if (outStats) {
            console.log('[modernize] Output graph:', outStats.nodes, 'nodes,', outStats.edges, 'edges')
            if (outStats.nodes === 0) {
              console.log('[modernize] (empty output graph — expected for fresh modernization; autoUpdate will populate as Phase 4 generates code)')
            }
          } else {
            console.warn('[modernize] WARNING: output graph init returned null. Phase 4 GATEs will be degraded until /graphify is run manually.')
          }
        }

        // Load graph engine for analysis. getGraphEngine always forces
        // reinitialize() so any stale engine reference is dropped. Note we
        // load the LEGACY engine here for Phase 2-3 structure analysis;
        // Phase 4 GATEs use graph_query against process.cwd()'s engine
        // (which resolves to the output graph once Claude Code is cwd'd there).
        const engine = await getGraphEngine(parsed.workspace)

        // Phase 2: Analyze legacy code structure
        console.log('[modernize] Phase 2: Analyzing legacy code...')
        const structure = await analyzeProjectStructure(parsed.workspace, engine)

        // Detect tech stack for context (only override if meaningful values found)
        const detectedStack = detectTechStack(parsed.workspace)
        if (detectedStack.language !== 'unknown' || detectedStack.backend !== 'unknown') {
          structure.techStack = detectedStack
        }

        // Generate INITIAL.md specification
        const initialMd = generateINITIAL(structure, parsed, 'legacy')
        const projectDir = join(parsed.output, '.project')
        const initialPath = join(projectDir, 'INITIAL.md')
        const { mkdirSync, writeFileSync } = await import('node:fs')
        mkdirSync(projectDir, { recursive: true })
        writeFileSync(initialPath, initialMd)
        console.log('[modernize] INITIAL.md generated:', initialPath)

        // Phase 3: Generate PRP module files
        console.log('[modernize] Phase 3: Generating module PRPs...')
        const prpInfo = await generatePRPs(initialMd, structure, parsed)
        console.log('[modernize] Generated', prpInfo.moduleCount, 'PRP modules')

        // Ensure output directories exist
        for (const dir of ['src', 'tests', 'docs', 'migrations']) {
          mkdirSync(join(parsed.output, dir), { recursive: true })
        }

        // Enable Agent Teams if --team mode (allows fully independent teammate sessions)
        if (parsed.teamMode) {
          process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
        }

        // Build prompt — multi-agent is always the default (PM + Coding + Reviewer + Tester)
        const prompt = buildModernizePrompt(parsed, structure, graphStats, prpInfo)

        // Env context injection — best-effort; skill continues on failure
        const envCtx = await buildEnvContextForSkill('modernize', parsed.output, { envOverride })
        const envSection = buildModernizeEnvSection(envCtx, parsed.output)

        return [{ type: 'text', text: prompt + '\n\n' + envSection }]
      } catch (error) {
        return [{
          type: 'text',
          text: '[modernize] Setup failed: ' + (error instanceof Error ? error.message : String(error)),
        }]
      }
    },
  })
}
