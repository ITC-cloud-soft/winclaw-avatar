import { registerBundledSkill } from '../bundledSkills.js'
import { join } from 'node:path'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import {
  parseProjectArgs, initializeProject, buildKnowledgeGraph, getGraphEngine,
  analyzeProjectStructure, generateINITIAL, generatePRPs, detectTechStack,
  detectResumeContext, getBestPracticesFiles, resolveTechStack,
  autoDetectReferenceCode,
  type ProjectArgs, type ProjectStructure, type PRPResult,
} from './shared/projectSetup.js'
import { buildEnvContextForSkill, extractEnvFlag } from '../../services/envManager/skillBridge.js'
import { generateEnvScaffold } from './shared/envScaffold.js'
// Note: buildSharedTestPrompt is used by /systest, not directly by /newproject

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequirementsAnalysis {
  documents: Array<{ name: string; path: string; type: string }>
  apis: Array<{ method: string; path: string; description: string }>
  entities: Array<{ name: string; fields: Array<{ name: string; type: string }> }>
  uiSpecs: Array<{ page: string; components: string[] }>
  businessRules: string[]
}

// PRPInfo = PRPResult from shared/projectSetup
type PRPInfo = PRPResult

// ---------------------------------------------------------------------------
// Requirements analysis
// ---------------------------------------------------------------------------

async function analyzeRequirements(parsed: ProjectArgs): Promise<RequirementsAnalysis> {
  // Only list documents — AI will analyze their content in Phase 3.
  // Code should NOT try to regex-parse requirements from free-form documents.
  const analysis: RequirementsAnalysis = {
    documents: [],
    apis: [],
    entities: [],
    uiSpecs: [],
    businessRules: [],
  }

  const docsDir = parsed.designDocsDir
  if (!docsDir || !existsSync(docsDir)) {
    console.log('[newproject] No design docs directory')
    return analysis
  }

  // Scan all documents — just record file name, path, type
  const docExts = /\.(md|txt|pdf|docx|doc|xlsx|xls|pptx|csv|json|yaml|yml)$/i
  const files = readdirSync(docsDir).filter(f => docExts.test(f))

  for (const file of files) {
    const filePath = join(docsDir, file)
    const ext = file.split('.').pop()?.toLowerCase() || ''
    analysis.documents.push({ name: file, path: filePath, type: ext })
  }

  console.log('[newproject] Design documents:', analysis.documents.length, 'files found')
  return analysis
}

// ---------------------------------------------------------------------------
// Structure builder from requirements
// ---------------------------------------------------------------------------

function buildStructureFromRequirements(
  req: RequirementsAnalysis,
  refStructure: ProjectStructure | null,
  parsed?: ProjectArgs,
): ProjectStructure {
  // Default stack — will be overridden by resolvedStack in generateINITIAL
  const defaultStack = refStructure?.techStack || {
    language: parsed?.backendLang || 'TypeScript',
    backend: 'auto-detect',
    frontend: parsed?.frontendLang || 'React',
    database: 'auto-detect',
  }
  return {
    techStack: {
      ...defaultStack,
      ...(parsed?.backendLang ? { language: parsed.backendLang } : {}),
      ...(parsed?.frontendLang ? { frontend: parsed.frontendLang } : {}),
    },
    entities: req.entities.map(e => ({
      name: e.name,
      fields: e.fields,
      sourceFile: '(from requirements)',
    })),
    routes: req.apis.map(a => ({
      method: a.method,
      path: a.path,
      handler: '',
      sourceFile: '(from requirements)',
    })),
    services: [],
    communities: [],
    graphStats: null,
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildNewProjectPrompt(
  parsed: ProjectArgs,
  structure: ProjectStructure,
  req: RequirementsAnalysis,
  prpInfo: PRPInfo,
): string {
  const designMdPath = join(parsed.output, '.project', 'DESIGN.md').replace(/\\/g, '/')
  const designMdExists = existsSync(join(parsed.output, '.project', 'DESIGN.md'))
  const designStyleName = parsed.designStyle || ''

  const ws = parsed.output.replace(/\\/g, '/')
  const projectDir = join(parsed.output, '.project').replace(/\\/g, '/')
  const initialPath = join(projectDir, 'INITIAL.md').replace(/\\/g, '/')
  const prpDir = prpInfo.prpDir.replace(/\\/g, '/')

  const moduleIndexPath = prpInfo.indexPath.replace(/\\/g, '/')
  const designDocsDir = parsed.designDocsDir?.replace(/\\/g, '/') || '(not provided)'
  const databaseConn = parsed.databaseUrl || '(not provided)'
  const lang = parsed.language || 'en'

  const techSummary = structure.techStack
    ? `${structure.techStack.language || 'TypeScript'} / ${structure.techStack.backend || 'TBD'} / ${structure.techStack.frontend || 'TBD'} / ${structure.techStack.database || 'TBD'}`
    : 'Not determined yet -- decide based on requirements'

  // Use RESOLVED stack (user params + DB URL inference) — not raw detection.
  // This ensures best practices match user intent even if structure.techStack is 'auto-detect'
  // or defaults before Phase 1.5 Socratic refines the stack.
  const resolvedTech = resolveTechStack(parsed, structure, 'new')
  const bpFiles = getBestPracticesFiles({
    language: resolvedTech.language,
    backend: resolvedTech.backend,
    frontend: resolvedTech.frontend,
  })
  // Only advertise files when we have a confident match — no silent wrong fallback.
  // Note: for /newproject the Socratic Phase 1.5 may refine the stack AFTER this prompt is
  // built. The PM is instructed (below) to re-resolve best-practices if the user changes
  // language during Phase 1.5.
  const bpBackendSection = bpFiles.backend
    ? `- Backend (${bpFiles.backendLabel}): ${bpFiles.backend}`
    : ''
  const bpFrontendSection = bpFiles.frontend
    ? `- Frontend (${bpFiles.frontendLabel}): ${bpFiles.frontend}`
    : ''
  const bpHasAny = !!(bpFiles.backend || bpFiles.frontend)
  // De-duplicate: if backend and frontend resolve to the same file, list it once.
  const bpCheckedList = Array.from(new Set([bpFiles.backend, bpFiles.frontend].filter(Boolean) as string[]))
    .map(p => '"' + p + '"').join(', ')

  const entityList = structure.entities.length > 0
    ? structure.entities.map(e => '  - ' + e.name + (e.fields.length > 0 ? ' (' + e.fields.map(f => f.name + ':' + f.type).join(', ') + ')' : '')).join('\n')
    : '  (none extracted -- analyze design docs for entities)'

  const apiList = structure.routes.length > 0
    ? structure.routes.map(r => '  - ' + r.method + ' ' + r.path).join('\n')
    : '  (none extracted -- analyze design docs for API endpoints)'

  const pageList = req.uiSpecs.length > 0
    ? req.uiSpecs.map(u => '  - ' + u.page).join('\n')
    : '  (none extracted -- analyze design docs for UI pages)'

  const ruleList = req.businessRules.length > 0
    ? req.businessRules.map(r => '  - ' + r).join('\n')
    : '  (none extracted)'

  const docList = req.documents.length > 0
    ? req.documents.map(d => '  - ' + d.path.replace(/\\/g, '/') + ' (' + d.type + ')').join('\n')
    : '  (no documents found)'

  const refSection = parsed.referenceProject
    ? `
## Reference Project

A reference project was analyzed for architecture guidance:
  Path: ${parsed.referenceProject.replace(/\\/g, '/')}
  Tech stack: ${techSummary}

Use this project's patterns (directory structure, naming conventions, architecture)
as a reference when generating code. The knowledge graph for this project has been
built -- use graph_query, graph_neighbors, graph_path to explore its structure.
`
    : ''

  // Phase 1.5: Socratic requirements confirmation section
  const socraticSection = `
## Phase 0: Graph Init (MANDATORY first step — NEW)

⚠️ This phase MUST run before any other Phase. The semantic knowledge graph
is the foundation for all subsequent verification (GATE G/H/I/J, contract validation).

### STEP 1: Initialize graphify

${parsed.referenceProject ? `A reference project is provided at: ${parsed.referenceProject.replace(/\\/g, '/')}
- Run /graphify against the reference project to scan and build initial graph
- This populates graphify-out/graph.json with reference codebase structure` : `No reference project was provided for this run.
- Initialize empty graph for the workspace ${ws}
- Watcher will populate graph as files are created`}

### STEP 2: Verify graph readiness

Verify by checking that the \`graphify-out/graph.json\` file exists (it may
be nearly-empty for a fresh workspace, that's OK).

- For new workspaces (no reference project): graph nodes will be 0 initially —
  this is expected. The watcher will populate the graph as Phase 4 generates code.
  A \`graph_query("test")\` that returns "0 results" is a SUCCESS for empty
  workspaces — it proves the engine responded.
- For workspaces with reference project: expect \`graph_query()\` to return
  non-empty results referencing the legacy code structure.

If \`graph.json\` doesn't exist OR \`graph_query()\` throws (not "returns empty"
— actually throws): STOP and report error before proceeding.

### STEP 3: Confirm auto-update is active

The auto-update layer is built-in:
- Layer 1: Each Edit/Write tool call triggers graph update (1.5s debounce)
- Layer 2: chokidar file watcher catches external changes
- Layer 3: Bootstrap injects repository map at session start

This means: every Todo (acceptance criterion) implementation automatically
refreshes the graph. No manual graph update needed between Todos.

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

### STEP 5: Use graph tools for navigation

In subsequent phases, prefer graph_* tools over Grep/Glob:
- graph_query(): semantic search, 0 token, <10ms
- graph_neighbors(): dependency analysis
- graph_path(): call chain tracking
- graph_communities(): module clustering
- graph_explain(): node detail

This applies to ALL Phase 1-4 work.

### STEP 5.5: graph_query Result Interpretation Guide (NEW — applies to ALL Phases)

⚠️ graph_query uses natural language search. Results may include unintended matches,
and a single query can return nodes of many kinds. NEVER consume raw results
blindly — ALWAYS post-process in your reasoning.

Standard post-processing pipeline (apply for EVERY graph_query call):

1. **Filter by kind**: result shape is \`{ nodes: [...], edges: [...] }\`. Each
   node has a \`kind\` field (e.g. \`react_route\`, \`designed_route\`, \`css_variable\`,
   \`hardcoded_color\`, \`pydantic_field\`, \`form_input\`, \`openapi_field\`, \`navigate_call\`).
   Always filter to ONLY the kind(s) you actually need:
   \`\`\`typescript
   const reactRoutes = result.nodes.filter(n => n.kind === 'react_route')
   \`\`\`
   Relying on a query's natural-language phrasing alone is non-deterministic —
   kind is the structural ground truth.

2. **Filter by sourceFile when needed**: e.g. to restrict to the app routing file,
   \`\`\`typescript
   const appRoutes = reactRoutes.filter(n =>
     n.sourceFile.endsWith('/App.tsx') || n.sourceFile.endsWith('/routes.tsx'))
   \`\`\`

3. **Don't trust label string matching alone**: use structural fields
   (\`kind\`, \`urlPath\`, \`signature\`, \`fieldType\`, \`required\`) for judgment.
   Labels may be truncated or inconsistently cased.

4. **Empty result handling**: if filtered result is empty, this may mean any of:
   - No matching nodes exist (real absence — what you wanted to prove)
   - Parser extension didn't capture the pattern yet (false absence)
   - Query phrasing missed relevant nodes (try \`graph_neighbors\` / \`graph_explain\`
     on a known node and widen)
   When in doubt: cross-check with Grep/Glob for the same pattern, OR run
   \`/graphify\` to force a rebuild, then re-query.

5. **Results may be paginated / capped**: if your bfs or dfs traversal hits the
   depth or limit ceiling, you may be missing nodes. Re-call with higher limit
   (e.g. 500) or narrow the query.

6. **Kind inventory reference** (parser extensions 0-8 — Round 6):
   - ext 0: \`designed_route\` — rows from PRP Markdown "Frontend Routes" tables
   - ext 1: \`react_route\` — React Router \`<Route>\` declarations
   - ext 2: \`navigate_call\` — \`navigate('/path')\` calls (\`\\\${var}\` → \`:param\`)
   - ext 3: \`form_input\` — \`<input name="X" required>\` in JSX
   - ext 4: \`fastapi_route\` — FastAPI route definition with method, path, request_model
   - ext 5: \`pydantic_field\` — class-level \`field: Type\` with required flag
   - ext 6: \`openapi_field\` — fields from openapi.yaml \`components.schemas\`
   - ext 7: \`css_variable\` — \`--token-name\` in \`:root\` or tailwind.config
   - ext 8: \`hardcoded_color\` — hex / \`bg-[#XXX]\` literals in JSX or CSS

This guide applies to ALL graph_query usage in Phase 1-6. GATE prompts below
reference it.

---

## Phase 1.5: Requirements Confirmation (Socratic Method)

Before starting development, you MUST confirm key decisions with the user.

### YOUR TASK: Ask 7-15 confirmation questions

1. Read ALL files in the design documents directory: ${designDocsDir}
2. Read the generated INITIAL.md: ${initialPath}
3. Identify what's clearly specified vs what's ambiguous or missing
4. Generate 7-15 questions covering:
   - Technical Architecture (2-3 questions): framework, database, auth, API style
   - Core Business Logic (2-3 questions): entities, workflows, user roles
   - UI/UX Design (2-3 questions): design style, responsive, i18n, dark mode
   - Non-functional Requirements (1-2 questions): performance, security, deployment
   - MVP Scope (1-2 questions): module priority, first release scope

5. For EACH question, format EXACTLY like this:

---
📋 Question {N}/{total}: {Title}

{1-2 sentences: why this decision matters, referencing what you found in the docs}

  A. {Option description} (Recommended)
  B. {Option description}
  C. {Option description}
  D. Other (please specify)
---

6. Rules:
   - Mark ONE option as "(Recommended)" based on your analysis of the design docs
   - Always include "Other (please specify)" as the last option
   - If the design docs CLEARLY specify something, skip that question
   - Focus on AMBIGUOUS or MISSING decisions
   - Minimum 7 questions, maximum 15

7. Ask ALL questions at once in a single message
8. Wait for the user to answer (e.g., "1:A, 2:B, 3:A, ...")

### After Receiving Answers

1. Write all answers to: ${projectDir}/config/requirements-confirmed.json
   Format:
   \\\`\\\`\\\`json
   {
     "confirmed_at": "ISO timestamp",
     "total_questions": N,
     "answers": [
       { "id": 1, "question": "...", "selected": "A", "answer": "...", "category": "architecture" }
     ],
     "decisions": {
       "backend_framework": "Hono",
       "frontend_framework": "React",
       "database": "MySQL",
       "auth_method": "JWT",
       "design_style": "${designStyleName || 'to be decided'}",
       "mvp_scope": "..."
     }
   }
   \\\`\\\`\\\`

2. Log: "Requirements confirmed. Starting Phase 3..."
3. Use the confirmed decisions for ALL subsequent phases

---

### CHECKPOINT: Phase 1.5 Complete -> AUTO-PROCEED to Phase 3

Log: "Phase 1.5 complete. Proceeding to Phase 3..."
Proceed immediately to Phase 3 (do NOT ask again).

Note: Socratic Q&A is itself an interactive review — the user already answered
7-15 questions to confirm decisions. Additional stop with \`-v\` would be redundant.
The \`-v\` flag only stops at the END of Phase 3 (after module decomposition),
since that is where human review has the highest value (before Phase 4 code generation).

---
`

  return socraticSection + `# New Project Development -- Phase 1.5 / 3 / 3.5 / 4 / 4.5 / 5 / 6

## ⚠️ UNIVERSAL RULES — READ FIRST, VIOLATION = BUILD FAILURE

These rules apply across ALL phases. Phase 4 adds 3 more specific rules
(see "Phase 4 MANDATORY RULES" later) — Phase 4 rules COMPLEMENT these, not replace.

1. **DATABASE**: Use the database specified in Project Configuration. NEVER silently switch to SQLite.
2. **All code goes in ${ws}** — NEVER modify files outside this directory
3. **Socratic questions are NOT optional** — ask 7-15 questions before development (Phase 1.5)
4. **Follow the tech stack** specified in INITIAL.md
5. **On Windows: use UTF-8 encoding** — never use Out-File or > redirect. Use Set-Content -Encoding UTF8, or Edit/Write tools.
6. **CONTINUOUS Phase 4 execution — DO NOT PAUSE BETWEEN MODULES**. Once Phase 3
   is approved (or auto-proceed kicks in), implement ALL pending modules without
   waiting for additional confirmation. Do NOT emit "Progress Update / Next Steps /
   Continuing with PRP-X" style announcements. One-line log per module
   (\`✓ module (X/N)\`) is fine; multi-line announcements are NOT.

(Former rules 2-4, 7-12 — "read INITIAL.md first", "generate all code", "write tests",
"knowledge graph usage", "production quality", "MAX 20 tool calls", "Swagger UI mandatory" —
are now enforced by the acceptance-criteria system in Phase 4, not via separate prose rules.)

You are building a NEW project from requirements. This is NOT a modernization of
existing code -- you are generating ALL code from scratch.

## Project Configuration

- Output workspace: ${ws}
- Design documents: ${designDocsDir}
- Database connection: ${databaseConn}
- Language: ${lang}
- Backend language: ${parsed.backendLang || structure.techStack?.language || 'typescript'} (framework: ${structure.techStack?.backend || 'TBD'})
- Frontend language: ${parsed.frontendLang || 'typescript'} (framework: ${structure.techStack?.frontend || 'TBD'})
- Tech stack: ${techSummary}

## Best Practices${bpHasAny ? `

Pre-resolved best practices files (absolute paths — Read them directly):
${bpBackendSection}
${bpFrontendSection}

The Coding and Reviewer Agents will be instructed to READ and ENFORCE these files.
NOTE: Phase 1.5 Socratic may refine the stack. If the user picks a different language
in Socratic, re-detect by matching: Python→python-fastapi, TypeScript→react-nextjs,
Java→java-spring-boot, PHP→php-laravel, Go→go-zero.` : `

No bundled best-practices file matches the resolved tech stack exactly.
Apply general secure-coding + clean-architecture principles.
If Phase 1.5 Socratic picks a specific language, re-detect:
Python→python-fastapi, TypeScript→react-nextjs, Java→java-spring-boot, PHP→php-laravel, Go→go-zero.`}

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

## Critical Files (YOU MUST READ THESE FIRST)

1. INITIAL.md (technical spec): ${initialPath}
2. Module index: ${moduleIndexPath}
3. PRP modules directory: ${prpDir}

Read INITIAL.md and MODULE_INDEX.md first. They contain the full technical
specification and module breakdown for the project.

## Performance Guard — PREVENT API TIMEOUT

⚠️ The API will timeout if you make too many consecutive tool calls.

1. **Use knowledge graph when available** — graph_query / graph_communities are
   faster and use 0 tokens compared to Read tool (1000+ tokens per file).
2. **Keep each module under 20 tool calls** — focus on writing code, not reading.
3. **Do NOT read design docs line by line** — INITIAL.md already summarizes them.
   Only re-read specific design docs when you need detail not in INITIAL.md.

## Requirements Summary

### Documents
${docList}

### Entities (extracted from requirements)
${entityList}

### API Endpoints (extracted from requirements)
${apiList}

### UI Pages (extracted from requirements)
${pageList}

### Business Rules
${ruleList}
${refSection}
---

## Phase 3: Module Decomposition (YOU must do this FIRST)

Before writing any code, you MUST design the module structure based on the requirements.

### STEP 1: Analyze the requirements

1. Read INITIAL.md at ${initialPath}
2. Read ${prpDir}/RAW_GRAPH_SUMMARY.md for pre-extracted data
3. If a reference project exists, use graph_communities / graph_query to study its structure
4. Read design documents in ${designDocsDir} for detailed requirements

### STEP 2: Design module decomposition

Decompose the project into **5-15 modules by business function**.
Name them after what they do (e.g., "Authentication", "User-Management", "Dashboard"), NOT after technical layers.

### STEP 3: Write PRP files

For EACH business module, write a PRP file to ${prpDir}/PRP-{NNN}-{module-name}.md containing:
- Goal (1-2 sentences)
- API Endpoints (method, path, description, auth)
- Data Models (entity, fields, source)
- Frontend Pages (route, page, components)
- Success Criteria (testable)

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
4. The "Source PRP fields" column references the Pydantic schema name
   (PassengerCreate / PassengerUpdate) for Form rows.

#### DATA MODEL RULES (MANDATORY)

For EACH entity in Data Model, write a complete field table:

\`\`\`markdown
### Passenger
| Field        | Type         | Required | PK | Default | Notes |
|--------------|--------------|:-:|:-:|---------|-------|
| passengerid  | int          | yes | ✓ | auto    | server-assigned |
| firstname    | varchar(50)  | **yes** | | —       |       |
| lastname     | varchar(50)  | **yes** | | —       |       |
| email        | varchar(100) | **yes** | | —       | unique |
| phone        | varchar(20)  | no  | | NULL    |       |
| address      | text         | **yes** | | —       |       |

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
3. NEVER omit required fields — defaulting to "yes" if business identity
   (name, code, type), "no" only if legacy explicitly allows NULL.

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

After business PRPs, write ONE more PRP: \`PRP-{last+1}-Frontend-Infrastructure.md\`.

This covers cross-cutting frontend concerns that have NO corresponding backend module
but still require implementation work that needs a completion.json record:

- App shell (Sidebar, Header, Footer)
- Authentication context + protected routes
- React Router setup with route guards
- API client (base URL + auto auth token)
- Global providers (QueryClient, Auth, Router, Theme)
- Design system application (from FRONTEND_DESIGN.md §1)

Required Deliverables include: \`frontend/src/App.tsx\`, \`frontend/src/layout/*\`,
\`frontend/src/auth/*\`, \`frontend/src/api/client.ts\`, \`frontend/src/routes.tsx\`,
\`frontend/src/styles/global.css\`.

Success criteria: \`npm run build\` passes, login flow works end-to-end, protected
routes enforce auth, all business module routes registered in sidebar.

**Every PRP — including Frontend Infrastructure — must produce a completion.json
in done/ after Phase 4 processes it.**

### STEP 4: Write MODULE_INDEX.md

Update ${moduleIndexPath} with execution order and dependency diagram.
**List ALL PRPs including Frontend Infrastructure as the LAST entry** (depends on all business modules).

### STEP 5: Write FRONTEND_DESIGN.md (MANDATORY — unified design document)

Write \`${prpDir}/FRONTEND_DESIGN.md\` — a single unified design document used by:
- Phase 4 Coding Agents (as design spec, not free-form)
- Phase 4 Reviewer Agent (verify code matches design)
- User review (if -v flag is used)

The document MUST have exactly 5 sections:

**Section 1: Design System** — Color palette (token/value/usage), typography (token/font/size/weight), spacing scale, component styles (Button/Input/Select/Table/Card/Modal)
- If DESIGN.md exists at \`${designMdPath}\`: extract tokens from there
- Otherwise: use modern SaaS defaults (Inter font, neutral + one accent)

**Section 2: Shared UI Patterns** — List Page / Detail Page / Form Page / Loading / Error / Empty states as structured text (no ASCII wireframes)

**Section 3: Global Layout** — App shell (header + sidebar + content), responsive breakpoints

**Section 4: Per-Module Design** — For EACH business PRP, write a subsection:

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
- Who can see this page / perform each action

**Reference:** {source file, screenshot, or design doc if available, else "N/A"}

**States:** (if non-standard)
- Loading/Error/Empty handling specific to this route
\`\`\`

Rules:
- Every field MUST trace to a PRP data model field
- Every action MUST trace to a PRP API endpoint
- Every validation MUST trace to a PRP business rule
- NO invented endpoints or fields
- NO placeholder text / copywriting detail
- NO ASCII wireframes

**Section 5: Navigation** — Sidebar items with Label, Icon hint, Route, Visibility rule

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
**Required fields** (from backend Pydantic schema):
| Field       | Type  | Validation     | UI Hint    |
|-------------|-------|----------------|------------|
| firstname   | text  | maxLength:50   | TextInput  |
| lastname    | text  | maxLength:50   | TextInput  |
| email       | email | format:email   | EmailInput |
| address     | text  | -              | TextArea   |
\`\`\`

INVARIANTS:
1. Routes table must have IDENTICAL # / Route / Component / Pattern columns as PRP.
2. Each Form Pattern row MUST list ALL required fields from matching Pydantic
   Create/Update schema. NEVER omit a required backend field.
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
   c. Diff: any required field in Pydantic but missing from DESIGN form = error

Write \`${prpDir}/PRP_DESIGN_AUDIT.md\` with all findings.
If errors: STOP and ask user before proceeding to Phase 4.

This catches the airlinesys-class issue where PRP says "Edit button" but
FRONTEND_DESIGN doesn't list /resource/{id}/edit, leading to Phase 4 missing pages.

### CHECKPOINT: Phase 3 Complete${parsed.verify ? ' → Verify Review Required' : ' → Proceed to Phase 4'}
${parsed.verify ? `
🛑 **VERIFY MODE (-v flag detected) — STOP for user review**

**STEP 1: Display a compact summary:**
- Module count and names (from MODULE_INDEX.md)
- Execution order
- Tech stack
- Design system highlights (colors/typography)
- Key design decisions made
- Gaps or assumptions

**STEP 2: Display the file list:**
- \`${initialPath}\` — overall spec
- \`${moduleIndexPath}\` — execution order
- \`${prpDir}/PRP-*.md\` — per-module specs
- \`${prpDir}/FRONTEND_DESIGN.md\` — unified UI design

**STEP 3: Display this EXACT message and STOP:**

---

📋 **Phase 3 Complete — Review Required (-v mode)**

Design artifacts written. Please review the files listed above.

- To proceed to Phase 3.5 (Contract Generation) then Phase 4, reply: **"continue"** or **"proceed"**
- To request changes, describe what you want adjusted (free text)

---

**STEP 4: Wait for user input.** Do NOT start Phase 3.5 or Phase 4.

**STEP 5: Handle user response:**
- If user approves ("continue" / "proceed" / "ok" / "go"): proceed to Phase 3.5, then Phase 4
- If user requests changes: apply them, re-display summary, STOP again
- Loop until approved
` : `
After all Phase 3 files are written, log: "Phase 3 complete: {N} modules defined. Starting Phase 3.5..."
Proceed immediately to Phase 3.5 (Contract Generation), then Phase 4.
`}

---

## Phase 3.5: Contract Generation (NEW — between Phase 3 and Phase 4)

⚠️ This phase produces the CANONICAL API contract that BOTH backend and frontend
agents will reference in Phase 4. Without this, backend and frontend can drift
(airlinesys5 422 class of bugs).

### STEP 1: Aggregate API endpoints from PRPs

Read all PRP-NNN.md files. For each PRP that defines API endpoints:
1. Extract endpoint list (method + path + summary)
2. For each endpoint, identify:
   - Request body schema name (entity name + Create/Update suffix)
   - Response schema name
   - Auth requirement (none / bearer / admin)

### STEP 2: Aggregate Data Models from PRPs

Read all PRP-NNN.md "Data Model" sections. For each entity:
1. Extract fields (name, type, required, validation constraints)
2. Read the {Entity}Create / {Entity}Update sections (added in Phase 3 enhancement)
3. Identify constraints: maxLength, pattern, min/max, format

### STEP 3: Write OpenAPI 3.1 Contract

Generate \`${prpDir}/contracts/openapi.yaml\`. Structure:

\`\`\`yaml
openapi: 3.1.0
info:
  title: ${(parsed.workspace.replace(/\\/g, '/').split('/').pop() || 'Project')} API
  version: 1.0.0

paths:
  /api/passengers:
    get:
      summary: List passengers
      parameters:
        - name: search
          in: query
          schema: { type: string }
          required: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items: { \\$ref: '#/components/schemas/Passenger' }
    post:
      summary: Create passenger
      requestBody:
        required: true
        content:
          application/json:
            schema: { \\$ref: '#/components/schemas/PassengerCreate' }
      responses:
        '201':
          content:
            application/json:
              schema: { \\$ref: '#/components/schemas/Passenger' }
        '422':
          description: Validation error

  /api/passengers/{id}:
    get: { ... }
    put:
      requestBody:
        content:
          application/json:
            schema: { \\$ref: '#/components/schemas/PassengerUpdate' }
    delete: { ... }

components:
  schemas:
    Passenger:
      type: object
      required: [passengerid, firstname, lastname, email, address]
      properties:
        passengerid: { type: integer, readOnly: true }
        firstname:   { type: string, maxLength: 50 }
        lastname:    { type: string, maxLength: 50 }
        email:       { type: string, format: email }
        phone:       { type: string, nullable: true }
        address:     { type: string }

    PassengerCreate:
      type: object
      required: [firstname, lastname, email, address]
      properties:
        firstname:   { type: string, maxLength: 50 }
        lastname:    { type: string, maxLength: 50 }
        email:       { type: string, format: email }
        phone:       { type: string, nullable: true }
        address:     { type: string }

    PassengerUpdate:
      type: object
      required: [firstname, lastname, email, address]
      properties:
        firstname:   { type: string, maxLength: 50 }
        lastname:    { type: string, maxLength: 50 }
        email:       { type: string, format: email }
        phone:       { type: string, nullable: true }
        address:     { type: string }
\`\`\`

INVARIANTS for the generated openapi.yaml:
1. Every endpoint mentioned in any PRP MUST appear in paths.
2. Every entity in PRP Data Model MUST have a schema in components.
3. Every {Entity}Create / {Entity}Update MUST have its required[] populated
   from the PRP's required field list.
4. NEVER invent fields or endpoints not in any PRP.
5. NEVER omit required fields from PRP {Entity}Create / {Entity}Update sections.

### STEP 4: Validate the Contract

If \`@redocly/cli\` is already installed in the project (check with
\`npx --no-install @redocly/cli --version\`), run the linter:

\`\`\`bash
npx --no-install @redocly/cli lint ${prpDir}/contracts/openapi.yaml
\`\`\`

If not installed: skip lint, log a warning, continue to STEP 5. Do NOT
auto-install — the Phase 4.5 conformance check will re-validate via FastAPI's
built-in schema generation.

If errors: STOP and ask user before proceeding to Phase 4.

### STEP 5: Generate TypeScript types from contract

Install \`openapi-typescript\` as a devDependency so type generation is
reproducible and version-pinned (do NOT use on-the-fly \`npx -y\`):

\`\`\`bash
cd ${ws}/frontend
npm install --save-dev openapi-typescript
npx --no-install openapi-typescript ${prpDir}/contracts/openapi.yaml -o src/types/api.ts
\`\`\`

This produces \`frontend/src/types/api.ts\` with auto-generated types from
the contract. Phase 4 Frontend Agents MUST import these types.

If \`${ws}/frontend\` does not yet exist (Phase 4 will create it), defer the
install + generation — record a reminder in the first Frontend-Infrastructure
PRP agent prompt to run the two commands above before writing any page.

### STEP 6: Commit contract to graph

The auto-update layer (Phase 0 STEP 4) will pick up:
- ${prpDir}/contracts/openapi.yaml — parsed by openApiParser.ts (NEW)
- frontend/src/types/api.ts — parsed by parser.ts as TypeScript types

After STEP 5, verify graph integration:
\`graph_query("openapi_endpoint nodes", "bfs", 100)\`
→ should return the endpoints just defined.

### STEP 7: Phase 3.5 CHECKPOINT

If all steps succeeded:
- ${prpDir}/contracts/openapi.yaml exists, lint clean
- frontend/src/types/api.ts generated (or marked as deferred)
- graph_query returns openapi_endpoint nodes

Write a brief summary log and proceed to Phase 4.

If any step failed:
- STOP, report which step failed, and ask user.

---

## Phase 4: Code Generation

Generate ALL project code in ${ws}. Follow the INITIAL.md spec and your PRP files.

### STEP 1: Project Setup (YOU do this)

1. Read MODULE_INDEX.md at ${moduleIndexPath}
2. Create the project skeleton:
   - Initialize package.json / project config
   - Set up directory structure per INITIAL.md
   - Configure build tools, linting, formatting
${parsed.databaseUrl ? `3. Database setup:
   - Database URL: ${parsed.databaseUrl}
   - Verify/create database: CREATE DATABASE IF NOT EXISTS
   - Run initial migrations` : ''}

### 🚨 CRITICAL LOOP CONTROL — READ THIS FIRST

Phase 4 has **ONE WORKFLOW that repeats for EVERY PRP module**. You MUST complete
ALL modules before reaching the CHECKPOINT at the end. Common failure mode:
completing 1 module and stopping — **THIS IS A CRITICAL VIOLATION.**

**Progress Tracking (MANDATORY):**

1. Read MODULE_INDEX.md and count the total number of PRP modules: N
2. Create \`${projectDir}/PHASE4_PROGRESS.md\`:
   \`\`\`markdown
   # Phase 4 Progress
   Total modules: N
   Completed: 0/N

   - [ ] PRP-001-{name}
   - [ ] PRP-002-{name}
   ... (all modules from MODULE_INDEX.md)
   \`\`\`
3. After EACH module completes, check off the box and save the file
4. Do NOT pause or emit a user-visible progress announcement between modules.
   A terse single-line log (e.g., \`✓ module-name (3/8)\`) is OK; a multi-line
   "Progress Update / Next Steps / Continuing with..." block is a VIOLATION
   of the continuation rule.

**Loop Exit Condition:**

You may ONLY proceed to the CHECKPOINT when:
- \`Completed: N/N\` in PHASE4_PROGRESS.md
- EVERY checkbox is checked

**If you have completed module X < N and are tempted to stop:** YOU ARE WRONG.
Go back to STEP 2 with the next unchecked module. Do NOT announce completion,
do NOT suggest /systest, do NOT write PHASE4_SUMMARY.md.

---

### 🔄 STEP 0 — Resume Check (MANDATORY before STEP 2)

Before starting any module work, check for previously completed modules.
**Use cross-platform AI tools (Glob/Read/Write), NOT bash-specific commands.**

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

3. Check for misplaced progress files and move them to canonical location
   \`${projectDir}/PHASE4_PROGRESS.md\`:
   - \`${prpDir}/progress.md\` → move to \`${projectDir}/PHASE4_PROGRESS.md\`
   - \`${prpDir}/PHASE4_PROGRESS.md\` → move to \`${projectDir}/PHASE4_PROGRESS.md\`
   - Any \`PHASE4_PROGRESS.md\` outside \`${projectDir}/\` → move it

4. Log WARNING listing every wrong path you encountered and the canonical
   destination you moved it to. This keeps the audit trail for the user.

After rescue, proceed with normal Resume Check below using the canonical paths.

#### STEP 0 MAIN — Classify completion markers

1. List existing completion markers: \`Glob({ pattern: "${prpDir}/done/*.completion.json" })\`

2. For each completion.json, Read and verify (accept BOTH schemas):
   - **NEW schema** (acceptance-criteria-driven): \`acceptanceCriteria\` is a non-empty array, AND every item has \`verified === true\`
   - **OLD schema** (legacy projects): \`verification.reviewVerdict === "PASS"\` AND \`verification.testsPass === true\`
   - Plus: evidence files referenced (filesystem method \`file\`, or artifacts.sourceFiles[]) actually exist on disk

3. List all PRPs: \`Glob({ pattern: "${prpDir}/PRP-*.md" })\`

3.5. Verify \`gates_verified\` block (B-1 enforcement — NEW)
   For each completion.json that passed the step-2 acceptanceCriteria check:
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

4. Classify:
   - completed — has valid completion.json + gates_verified intact + source files exist on disk
   - semi-valid — valid acceptanceCriteria but no gates_verified (legacy / pre-B1); accept but flag
   - pending — missing/invalid completion.json, or source files missing
   - invalid — has .done marker but completion.json missing/invalid, OR gates_verified reports unskipped failure (treat as pending)

5. Display to user:
   \`\`\`
   📊 Phase 4 Status (code-verified, not AI self-reported):
   - Verified complete: {count(completed)}/{total}
   - Pending: {count(pending)} — {list}
   - Invalid markers detected: {count(invalid)} (re-implementing)
   \`\`\`

6. Write PHASE4_PROGRESS.md using Write tool (mirror physical state):
   \`\`\`markdown
   # Phase 4 Progress (auto-synced from verified completion.json files)
   Total: N
   Completed (verified): X

   ## Completed (source files verified on disk)
   - [x] {PRP name} — completed at {timestamp from completion.json}

   ## Pending
   - [ ] {PRP names without valid completion.json}
   \`\`\`

⚠️ **AUTHORITATIVE STATUS:** The PHYSICAL files in done/ are the source of truth.
NEVER trust AI-written checkboxes without corresponding .done markers.

If all modules done (Completed == N): skip to CHECKPOINT.
Otherwise: proceed to the per-module loop below.

---

### Multi-Agent TDD Development (you decide the shape)

You are the PM. For each PRP module, you define acceptance criteria, delegate
implementation however you see fit (one agent, two agents, sequential, parallel —
YOUR call), and verify the module actually works before marking it complete.

The code-side verifier will re-run every acceptance criterion's evidence.
Lying about completion is physically impossible — the curl that "returned 200"
either still returns 200 today, or your claim is rejected.

---

### For EACH PRP module (iterate, no pause between modules):

#### STEP 1 — Define Acceptance Criteria

Read the PRP. Append to \`${projectDir}/PHASE4_PROGRESS.md\` under this module's heading:

\`\`\`
## PRP-{NNN}-{ModuleName}
started: {ISO-8601 now}
acceptanceCriteria:
  - <concrete verifiable outcome>  [method: curl | pytest | chrome-mcp | filesystem]
  - <another outcome>
  ...
\`\`\`

Write 4-10 criteria. Each must be DIRECTLY verifiable by running a command and
checking output. Examples for "Authentication":

- POST /auth/register with valid data returns 201 [curl]
- POST /auth/login with registered creds returns 200 + access_token in body [curl]
- GET /employees without Authorization returns 401 [curl]
- GET /employees with valid JWT returns 200 + employee list [curl]
- pytest tests/test_auth.py -v exits 0 with "passed" in stdout [pytest]
- Frontend /login page renders without console errors [chrome-mcp]
- SECRET_KEY is read from env (not hardcoded in config.py) [filesystem]

BAD criteria (too vague, can't verify programmatically):
- "Auth module works correctly"  ← vague, no method
- "Code is clean"  ← subjective
- "Security is good"  ← unverifiable

🎯 **FRONTEND ACCEPTANCE CRITERIA — MANDATORY for every module that has UI pages.**

If FRONTEND_DESIGN.md §4.{NNN} lists P pages for this module, you MUST write **at
least these criteria types per page** (skip any and STEP 3 will reject the module):

Per page \`<Page>\` at route \`/<route>\`:
  - [ ] \`<Page>\` renders real API data (NOT "Under construction" / "Coming soon" / skeleton)
        method: chrome-mcp — navigate, wait 2s, assert page text length > 200 AND
        \`get_page_text\` does NOT contain "Under construction" | "Coming soon" | "TODO"
  - [ ] \`<Page>\` has a passing Vitest test at \`frontend/src/pages/<Page>.test.tsx\`
        method: pytest-like — \`cd frontend && npx vitest run src/pages/<Page>.test.tsx\`
        exits 0 with ≥3 assertions
  - [ ] \`<Page>\` handles loading + error states
        method: filesystem — test file must contain BOTH "loading" (or spinner regex)
        AND "error" assertion patterns

Per Create/Edit form page (in addition to the above):
  - [ ] Form renders one \`<input name="FIELD">\` for EVERY required field in the
        backend schema. Zero missing = required.
        method: filesystem — parse backend schema file (\`backend/src/app/schemas/{entity}.py\`)
        to extract the \`{Entity}Create\` required fields, then grep the form .tsx
        for \`name="{field}"\`. All required fields MUST be present.
  - [ ] Form submission returns 2xx (not 422) when called with seed test data.
        method: chrome-mcp — navigate to \`/<entity>/new\`, fill all inputs with
        values from \`seed.entities.{Entity}.records[0]\`, click submit, observe
        network request status. 422 = FAIL (contract mismatch).

Module-wide (one time, not per page):
  - [ ] Zero \`any\` types in API client
        method: filesystem — \`frontend/src/api/*.ts\` does NOT match regex \`:\\s*any\\b|as\\s+any\\b\`
  - [ ] Vitest test file count ≥ 80% of page count
        method: filesystem — count \`frontend/src/pages/**/*.test.tsx\` ≥ P * 0.8

Example for a "Departments" module with 2 pages (List, Detail):
  - DepartmentList page renders ≥1 row from GET /api/departments [chrome-mcp]
  - DepartmentList.test.tsx passes with loading+error+data assertions [pytest]
  - DepartmentDetail page renders fields from GET /api/departments/:id [chrome-mcp]
  - DepartmentDetail.test.tsx passes [pytest]
  - No \`any\` in frontend/src/api/*.ts [filesystem]
  - Vitest file count ≥ 2 [filesystem]

📋 **REQUIRED CRITERION CHECKLIST — your criteria MUST include these when applicable:**

If this module has BACKEND code (Python/FastAPI/Django/etc):
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

After appending criteria to PHASE4_PROGRESS.md, grep your own entry and CONFIRM
each applicable checkbox is present. If any required criterion is missing, ADD
it — do not proceed to STEP 2 without them. The CHECKPOINT gate (end of Phase 4)
re-enforces these at the whole-project level; skipping here = failing there.

🚨 RETRY SEMANTICS: If STEP 3 fails and you retry STEP 2, KEEP the original
\`started:\` timestamp. Do NOT overwrite.

#### STEP 1.5 — Per-module Frontend Progress Checklist (NEW — graph-driven)

For modules that include a "Frontend Routes" table in the PRP
(\`${prpDir}/PRP-{NNN}-*.md\` § Frontend Routes), generate a per-module progress
file so that GATE G' can cross-check even when the graph parser is stale.

Procedure:

1. Read this module's PRP, locate the "Frontend Routes" table (Markdown table
   with columns: Route | Component | Pattern | ...). If no such table exists,
   skip STEP 1.5 (module has no UI).

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
\`\`\`

3. **Update checkboxes at end of STEP 2** — after each implementation cycle,
   re-run the four graph checks above and tick the boxes. Commit the file
   before STEP 3 so GATE G' can use it as fallback.

4. GATE G' in STEP 3 uses this file as a fallback data source when the PRP
   Markdown table parser (parser extension 0 → \`designed_route\` nodes) is
   temporarily stale.

#### STEP 2 — Implement (your approach)

### Phase 4 STEP 2 — Contract-aware Implementation (NEW)

Backend Agent (or sub-agent) MUST:

1. Read \`${prpDir}/contracts/openapi.yaml\` (canonical contract from Phase 3.5)
2. For each schema in components.schemas: generate corresponding Pydantic class
   - Use \`required[]\` for fields without defaults
   - Use \`format\`, \`maxLength\`, \`nullable\` for Pydantic validators
3. For each path: implement FastAPI handler with matching path, method,
   request_model, response_model
4. DO NOT invent additional fields. DO NOT skip required fields.

Frontend Agent (or sub-agent) MUST:

1. Verify \`frontend/src/types/api.ts\` exists (generated in Phase 3.5)
2. Import generated types in components:
   \`\`\`tsx
   import type { components } from '../types/api'
   type PassengerCreate = components['schemas']['PassengerCreate']
   \`\`\`
3. Use typed forms:
   \`\`\`tsx
   const [form, setForm] = useState<PassengerCreate>({
     firstname: '', lastname: '', email: '', address: '',
     // TS compile error if a required field is missing
   })
   \`\`\`
4. NEVER suppress TS errors with \`as any\`.
5. NEVER hand-write the request body interface — always import from types/api.ts.

This pattern ensures:
- 422 errors are PREVENTED at compile time (not just detected at runtime)
- Backend and frontend are TRULY independent (both reference the same contract)
- Schema changes propagate automatically (regenerate types/api.ts after openapi.yaml change)

---

You choose how to implement. Common approaches:
- Single agent (backend + frontend + tests)
- Two agents in parallel (backend | frontend)
- Three agents (backend | frontend | tester)
- Sequential if dependencies require it

Whatever you pick, the module must satisfy ALL acceptance criteria from STEP 1.
${bpHasAny ? `
**Best practices (consult when implementing):**
${bpBackendSection}
${bpFrontendSection}` : ''}

Frontend design: READ \`${prpDir}/FRONTEND_DESIGN.md\` §4.{NNN} if this module has
frontend pages. Import from \`${ws}/frontend/src/components/ui/\`, \`/layouts/\`, \`/hooks/\`
rather than reinventing.

If this PRP is Frontend Infrastructure, implement it FIRST (before any per-module
frontend work) — subsequent frontend agents depend on it.

---

🎨 **FRONTEND GOLDEN EXAMPLES — copy & adapt these, do NOT invent from scratch.**

The airlinesys3/airlinesys4 incidents showed that when agents write frontend from
scratch, they produce \`<div>Under construction</div>\` skeletons and skip tests.
The fix: you MUST mirror these three patterns. Change entity names / fields only.

**GOLDEN A — List page** (\`frontend/src/pages/DepartmentList.tsx\`):

\`\`\`tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Department } from '../types/api'

export default function DepartmentList() {
  const [items, setItems] = useState<Department[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<Department[]>('/departments')
      .then(data => { if (!cancelled) setItems(data) })
      .catch(e => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <div role="alert" data-testid="error">Failed to load: {error}</div>
  if (items === null) return <div data-testid="loading">Loading…</div>
  if (items.length === 0) return <div data-testid="empty">No departments yet.</div>

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Departments</h1>
        <Link to="/departments/new">+ New</Link>
      </header>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Manager</th><th></th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.id} data-testid={\`row-\${d.id}\`}>
              <td>{d.code}</td>
              <td>{d.name}</td>
              <td>{d.managerName ?? '—'}</td>
              <td><Link to={\`/departments/\${d.id}\`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
\`\`\`

**GOLDEN B — Test for that page** (\`frontend/src/pages/DepartmentList.test.tsx\`):

\`\`\`tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DepartmentList from './DepartmentList'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))
import { api } from '../api/client'

const renderPage = () =>
  render(<MemoryRouter><DepartmentList /></MemoryRouter>)

describe('DepartmentList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading then data', async () => {
    ;(api.get as any).mockResolvedValueOnce([
      { id: 1, code: 'ENG', name: 'Engineering', managerName: 'Alice' },
    ])
    renderPage()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument())
    expect(screen.getByText('Engineering')).toBeInTheDocument()
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
    expect(screen.getByRole('alert').textContent).toMatch(/500 boom/)
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
  // 204 No Content
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get:   <T>(path: string)                           => request<T>(path),
  post:  <T>(path: string, body: unknown)            => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown)            => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown)            => request<T>(path, { method: 'PATCH',body: JSON.stringify(body) }),
  del:   <T = void>(path: string)                    => request<T>(path, { method: 'DELETE' }),
}
\`\`\`

And \`frontend/src/types/api.ts\` — one interface per entity, NO \`any\`:

\`\`\`ts
export interface Department { id: number; code: string; name: string; managerName: string | null }
export interface Employee   { id: number; name: string; email: string; departmentId: number }
// ... one per backend resource
\`\`\`

**GOLDEN D — Form page (Create/Edit)** — MANDATORY pattern for ALL form pages.

⚠️ THE AIRLINESYS5 CONTRACT MISMATCH INCIDENT: when agents write Create/Edit
forms from scratch, they guess fields from the PRP text and miss required backend
schema fields (e.g. Airport form shipped without \`address\` / \`zipcode\`,
producing 422 on every submit — 100% of the feature non-functional).

The fix: BEFORE writing any Create/Edit form .tsx, you MUST:

1. **Read the backend OpenAPI spec for the matching endpoint.** If backend is
   already running, fetch \`\${backendUrl}/openapi.json\` and look up the request
   body schema for the POST (Create) or PUT (Edit) endpoint. If backend is not
   running yet, read the backend Pydantic / SQLAlchemy model source file
   (e.g. \`backend/src/app/schemas/<entity>.py\`) — the \`class XxxCreate(BaseModel)\`
   definition is the source of truth.

2. **Enumerate ALL required fields** from that schema. A field is required when:
   - Pydantic: no default value, no \`Optional[...]\`, no \`= None\`
   - OpenAPI: listed in the schema's \`required\` array
   - NEVER guess from the PRP text or the frontend design doc alone — those
     frequently omit fields

3. **Generate one form input per required field.** Match types:
   - \`str\` / \`string\` → \`<input type="text">\`
   - \`int\` / \`float\` / \`number\` → \`<input type="number">\`
   - \`EmailStr\` / \`format: email\` → \`<input type="email">\`
   - \`date\` / \`datetime\` → \`<input type="date">\`
   - \`bool\` → \`<input type="checkbox">\`
   - \`Enum\` / \`enum\` → \`<select>\` with one \`<option>\` per value

4. **Echo backend validation constraints**: \`minLength\`, \`maxLength\`, \`pattern\`,
   \`ge\`/\`le\` → HTML5 \`minLength\`, \`maxLength\`, \`pattern\`, \`min\`, \`max\`.

Template (\`frontend/src/pages/AirportCreate.tsx\`):

\`\`\`tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

// ⚠️ THIS IS A TEMPLATE — before committing, replace ALL of these:
//   - "Airport" / "airport"  → your entity in PascalCase / lowercase (e.g. "Department" / "department")
//   - "/airports"            → your REST path (e.g. "/departments")
//   - Fields { code, name, city, country, address, zipcode } → your entity's ACTUAL required fields (from backend schema)
//   - maxLength={4} on "code" → check YOUR backend constraint (4 is Airport-specific, IATA codes)
//   - maxLength={100} on "name" → check YOUR backend constraint
// If the final committed file still contains ANY "Airport" / "airport" identifier
// and your entity is NOT literally Airport: STOP and rename every occurrence.
// STEP 3 contract-check scans for this and will FAIL the module.

// REQUIRED: one field per backend-required property. Do NOT omit any.
// Source: backend/src/app/schemas/airport.py AirportCreate
interface AirportCreateBody {
  code: string       // required, maxLength 4
  name: string       // required, maxLength 100
  city: string       // required
  country: string    // required
  address: string    // required  ← frequently forgotten, DO NOT omit
  zipcode: string    // required  ← frequently forgotten, DO NOT omit
}

export default function AirportCreate() {
  const nav = useNavigate()
  const [form, setForm] = useState<AirportCreateBody>({
    code: '', name: '', city: '', country: '', address: '', zipcode: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (k: keyof AirportCreateBody) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const created = await api.post<{ id: number }>('/airports', form)
      nav(\`/airports/\${created.id}\`)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} data-testid="airport-create-form">
      {error && <div role="alert" data-testid="error">{error}</div>}
      <label>Code   <input name="code"    value={form.code}    onChange={update('code')}    required maxLength={4} /></label>
      <label>Name   <input name="name"    value={form.name}    onChange={update('name')}    required maxLength={100} /></label>
      <label>City   <input name="city"    value={form.city}    onChange={update('city')}    required /></label>
      <label>Country<input name="country" value={form.country} onChange={update('country')} required /></label>
      <label>Address<input name="address" value={form.address} onChange={update('address')} required /></label>
      <label>Zipcode<input name="zipcode" value={form.zipcode} onChange={update('zipcode')} required /></label>
      <button type="submit" disabled={submitting} data-testid="submit">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}
\`\`\`

**GOLDEN D rules (STEP 3 scans for these — missing any = FAIL):**

- Every \`required\` backend field has a corresponding \`<input name="...">\` whose
  name EXACTLY matches the backend field name (case-sensitive).
- \`onSubmit\` calls \`api.post\` / \`api.put\` with the full form body.
- After success: navigate away (detail page or list), do NOT silently stay.
- Errors surface via \`data-testid="error"\` — tests depend on this.
- All inputs have the \`required\` HTML attribute so the browser blocks empty submits.
- If your entity is NOT literally "Airport": grep the committed file for the token "Airport" or "airport". Zero matches required. Any match = FAIL (template contamination).
- Backend constraints (maxLength, minLength, pattern, ge/le) MUST be copied from YOUR schema file, not reused from the Airport template example.

**STEP 3 contract check (automated):** for each Create/Edit page, STEP 3 will
read the backend schema and compare the set of \`required\` fields against the
set of \`name=\` attributes in the form .tsx. Any required field missing from the
form = IMMEDIATE FAIL. Do not attempt to fix by deleting the backend field.

**Adaptation rules:**
1. Rename \`Department\` → your entity, keep the 4-state machine (loading / error / empty / data).
2. KEEP \`data-testid\` attributes. Tests select by testid, not by text content
   (text changes with i18n; testid does not).
3. For Detail / Create / Edit pages: same structure, \`api.get<T>\`/\`api.post\`/\`api.put\`.
4. Never import \`client.ts\` with \`any\`. If TypeScript complains, fix the type in \`types/api.ts\`.

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
//   - "Passenger" / "passenger"  → your entity (e.g. "Department" / "department")
//   - "/passengers"              → your REST path (e.g. "/departments")
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

---

**GOLDEN F — List page with Search/Filter** — for List routes that need filtering.

For modules where FRONTEND_DESIGN.md §4.X specifies a search box or filter
(e.g. "DateFilter", "SearchForm name/email"), use this pattern (extends GOLDEN A):

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

  // Debounced search (in real impl, use a hook; this is the simple pattern)
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
- Filters wired to \`/api/...?search=...&...\` query params (backend supports this in standard CRUD).

---

⚠️ **VITEST UNIT TESTS ARE MANDATORY — Playwright/Cypress does NOT substitute.**

airlinesys5 shipped with 0 Vitest unit tests because Meta Coder chose Playwright
E2E instead. This is now FORBIDDEN. Rule:

- Vitest unit test at \`frontend/src/pages/<Page>.test.tsx\` → **REQUIRED per page**
- Playwright E2E at \`frontend/tests/e2e/*.spec.ts\` → optional, additional only

Without the sibling \`<Page>.test.tsx\`, the page counts as UNTESTED regardless of
E2E coverage. Reason: Vitest runs in CI in milliseconds without a browser; E2E
is slow, flaky, and often skipped under time pressure. Both are valuable — only
Vitest is mandatory. GATE E in the final CHECKPOINT will enforce this.

🚫 **FORBIDDEN PATTERNS — STEP 3 will scan and auto-FAIL the module if found:**
- \`<div>Under construction</div>\` / "Coming soon" / "WIP" / "TODO" text in any \`src/pages/**\`
- A page component that returns JSX without any \`useEffect\` / \`useState\` / hook call
  (except trivial static pages like About / Home landing — those still need a test)
- \`: any\` or \`as any\` anywhere under \`frontend/src/api/\` or \`frontend/src/types/\`
- A page file \`Foo.tsx\` with no sibling \`Foo.test.tsx\`
- Vitest file count < 80% of page count for this module
- A Create/Edit form .tsx missing an \`<input name="X">\` for any required
  field X from the backend \`{Entity}Create\` Pydantic schema (contract gap)
- A form .tsx that posts/puts without calling \`api.post\` / \`api.put\` (no submit)

---

### Per-Todo Graph Update Protocol (NEW — STRENGTHENED)

After EACH acceptance criterion completion in this STEP 2, follow the protocol
branch matching how the file was written. The GATE G'/H'/I'/J'/Contract'/K'
verifications in STEP 3 MUST see the latest edits — stale graph = false pass.

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
false pass を生み、airlinesys5/6 クラスの事故を再発させる**。

---

#### STEP 3 — Verify by Running Your Own Code (MANDATORY)

🚨 This is NON-NEGOTIABLE. Before writing completion.json you MUST actually
execute each acceptance criterion. Reason: airlinesys3 incident showed that
claims like "Authorization header sent" turn out to be \`Authorization = Bearer\`
with the template literal UNEXPANDED — because the AI never ran the code.

For EACH criterion, run the corresponding verification:

**curl criteria** — execute via Bash. MUST use \`-w '\\n%{http_code}'\` so status
ends on its own line (the runtime verifier parses \`/\\n(\\d{3})\\s*$/\`; without the
newline, body digits like \`"count":404\` would spoof the status).
\`\`\`
# Status only:
curl -s -o /dev/null -w '\n%{http_code}' http://localhost:<BACKEND_PORT>/api/employees
# Status + body (for expectedBodyContains):
curl -s http://localhost:<BACKEND_PORT>/api/login -d '...' -w '\n%{http_code}'
\`\`\`
Evidence shape: \`{ command, expectedStatusMatch, expectedBodyContains? }\`. Status
match is regex-tested against the 3-digit code.

**Windows note**: single-quoted JSON bodies (\`-d '{...}'\`) fail on cmd.exe — if
your harness is Windows-native bash (Git Bash / WSL), you're fine. If running
through cmd.exe, switch to heredoc or a temp body file.

**pytest criteria** — execute:
\`\`\`
cd ${ws} && pytest <specific test> -v --tb=short
\`\`\`
Confirm exit code 0 and "passed" in stdout.

**chrome-mcp criteria** — if --frontend-url is provided:
- mcp__Claude_in_Chrome__navigate url=<frontendUrl>/<route>
- Wait 2s for mount
- mcp__Claude_in_Chrome__read_console_messages onlyErrors=true → must be empty
- mcp__Claude_in_Chrome__get_page_text → length > 50 chars, not "Cannot GET"
- Write summary to \`${ws}/.systest/evidence/phase4/<module>/<route-slug>.json\`

**filesystem criteria** — read the file, assert the pattern matches or absent.

🚫 **FRONTEND ANTI-SKELETON SCAN — MANDATORY if this module has UI pages.**

Run these commands verbatim (from \`${ws}\`). Each MUST return 0 / pass
before you write completion.json:

\`\`\`bash
# 1. No placeholder text anywhere under src/pages
rg -n "Under construction|Coming soon|^\\s*// ?TODO|WIP" frontend/src/pages/ && exit 1 || true

# 2. No any in api/ or types/
rg -n ":\\s*any\\b|as\\s+any\\b" frontend/src/api/ frontend/src/types/ && exit 1 || true

# 3. Test coverage ratio ≥ 80%
pages=$(find frontend/src/pages -name "*.tsx" -not -name "*.test.tsx" | wc -l)
tests=$(find frontend/src/pages -name "*.test.tsx" | wc -l)
echo "pages=$pages tests=$tests"
test "$tests" -ge "$(( pages * 8 / 10 ))" || { echo "FAIL: tests < 80% of pages"; exit 1; }

# 4. Vitest actually runs and passes for this module's test files
cd frontend && npx vitest run --reporter=dot 2>&1 | tail -20

# 5. Contract check (MANDATORY — catches airlinesys5-class contract mismatches)
for form in frontend/src/pages/*Create.tsx frontend/src/pages/*Edit.tsx; do
  [ -f "$form" ] || continue
  entity=$(basename "$form" .tsx | sed 's/Create$//;s/Edit$//')
  entity_lc=$(echo "$entity" | tr '[:upper:]' '[:lower:]')
  schema_file="backend/src/app/schemas/\${entity_lc}.py"
  [ -f "$schema_file" ] || { echo "contract-check: no $schema_file for $form — skip"; continue; }
  required=$(python3 -c "
import importlib.util, sys
spec = importlib.util.spec_from_file_location('m', '$schema_file')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
cls = getattr(m, '\${entity}Create', None)
if cls is None: sys.exit(0)
for f, info in cls.model_fields.items():
    if info.is_required(): print(f)
" 2>/dev/null)
  for field in $required; do
    grep -q "name=\\"$field\\"" "$form" || { echo "CONTRACT GAP: $form missing <input name=\\"$field\\"> (required by $schema_file)"; exit 1; }
  done
done && echo "contract-check: all forms match backend schemas"
#
# The airlinesys5 Airport form shipped without \`address\` / \`zipcode\` inputs
# despite backend \`AirportCreate\` requiring them — every submit returned 422.
# This scan catches that BEFORE completion.json is written.
\`\`\`

If any of these fail, return to STEP 2 and fix — do not proceed to completion.json.
Record the scan as a filesystem criterion in completion.json so the verifier
re-runs it, e.g.:

\`\`\`json
{
  "criterion": "No skeleton placeholders in frontend/src/pages",
  "verified": true,
  "method": "filesystem",
  "evidence": {
    "file": "frontend/src/pages",
    "notContains": ["Under construction", "Coming soon"],
    "regex": null
  }
}
\`\`\`

**If ANY criterion fails:** FIX THE CODE (not the criterion), repeat STEP 3.
Do NOT water down a criterion to make it pass.

**Retry cap**: burn at most **3 attempts** on the same failing criterion. If the
criterion still fails after 3 fix-agent rounds, STOP this module and emit a
visible FAIL to the user (with the failing criterion text and latest stdout).
Proceed to the next module. This prevents infinite loops on fundamentally
broken criteria or unreachable services.

**If you find you need to start a backend/DB for verification**, do so:
\`\`\`
cd ${ws} && python -m uvicorn src.main:app --port 8999 > /tmp/phase4-backend.log 2>&1 &
\`\`\`
Kill the process after STEP 3 completes (we don't keep it running between modules —
the FINAL checkpoint starts the user-visible services).

---

**STEP 3.0: Mandatory graph rebuild + pre-flight freshness check (BEFORE any GATE)**

After finishing all Edit/Write operations for this module, BEFORE running any GATE:

1. **Always rebuild first**: run \`/graphify\` ONCE so the graph reflects the freshly generated code. The chokidar watcher debounces updates but a hard rebuild guarantees a clean baseline.
2. **Verify non-empty**: run \`graph_query("route", "bfs", 5)\` (or any simple query).
3. If the returned \`nodes\` array is empty OR \`graph_neighbors\` returns 0 successors for well-known labels (e.g. \`App.tsx\`, \`main.py\`), the graph is EMPTY.
4. When still empty after the rebuild in step 1:
   - Escalate to the user with the message:
     \`[GATE PRE-FLIGHT] Graph is empty after /graphify — parser may not cover this tech stack. GATEs cannot be trusted.\`
   - Do NOT proceed to the GATEs; do NOT write \`gates_verified: PASS\`.
5. Only proceed to GATE G' once the graph reports at least one relevant \`react_route\` or \`python_route\` or \`designed_route\` node.

**WHY THIS MATTERS**: Previous incidents (digtalhuman, 2026-04-21) had the AI "verify" GATEs against an empty graph and report false PASS. The graph MUST have nodes or every GATE is a lie.

---

### GATE G' (Frontend Coverage — graph-driven, MANDATORY)

⚠️ This GATE replaces the old grep-based coverage check (which missed
airlinesys6's 5 missing Edit pages and 4 missing Shift pages).

Phase 4 STEP 3 MUST verify that EVERY route in any PRP-NNN.md "Frontend Routes"
table has a corresponding implementation file AND <Route> registration.

Procedure (use \`graph_query\`, NOT grep — ALWAYS apply STEP 5.5 kind filters):

1. Get DESIGNED routes (from PRP Markdown table rows):
   Call: \`graph_query("designed_route from PRP", "bfs", 200)\`
   **IMPORTANT**: filter results to only nodes where \`kind === 'designed_route'\`
   (parser extension 0 — Markdown table parser).
   Expected return shape:
   \`\`\`
   { nodes: [{ id, label, kind: 'designed_route', urlPath, signature, sourceFile }],
     edges: [...] }
   \`\`\`
   Each node represents one row from a PRP "Frontend Routes" table.
   Extract: \`{ route: node.urlPath, component: node.signature, prp: node.sourceFile }\`
   for each.
   **Fallback**: if \`designed_route\` nodes are empty (parser ext 0 not yet run),
   fall back to \`${prpDir}/done/PRP-{NNN}-frontend-progress.md\` (STEP 1.5 output)
   for the designed route list.

2. Get IMPLEMENTED routes (from React Router \`<Route>\` declarations):
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
   - If \`orphan.length > 0\` → **WARNING** (page implemented but not in any PRP —
     possible scope creep). Log each, but do NOT block.
   - If both are zero → **PASS**.

5. Success log: \`"GATE G' (Coverage): {N} designed, {M} implemented, 0 missing, {K} orphan"\`

Why graph over grep:
- Scales to 10K+ files (sub-linear)
- Captures semantic relationships (route → element component)
- Auto-updates with each Edit (last 1.5s)
- 0 token cost

---

### GATE H' (Broken Navigation — graph-driven, MANDATORY)

Verify every \`navigate('/x/y')\` call has a matching \`<Route path>\` registration.
Catches the airlinesys6 bug where Detail pages call navigate() to non-existent routes.

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

---

### GATE I' (Design Token Usage — graph-driven, MANDATORY if global.css OR tailwind.config exists)

If the project defines design tokens in CSS (\`--color-*\`, \`--space-*\`, etc.) or
in \`tailwind.config.*\`, verify components actually USE them via \`var(--name)\`
(or Tailwind tokenized classes) instead of hardcoding hex.

Catches the airlinesys6 bug where global.css defined 50+ tokens but Button.tsx
hardcoded \`bg-[#635BFF]\` instead of \`var(--color-primary)\`.

Procedure (ALWAYS apply STEP 5.5 kind filters):

1. Get defined CSS variables (from \`:root\` and tailwind.config):
   Call: \`graph_query("css_variable definitions", "bfs", 200)\`
   **IMPORTANT**: filter to nodes where
   - \`kind === 'css_variable'\` AND
   - \`sourceFile\` matches \`/(global|theme|tokens)\\.s?css$/\` OR
     \`/tailwind\\.config\\.(j|t|c|m)s$/\`
   (parser extension 7).
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
   (e.g. a CSS file not yet parsed, or external CDN tokens like Bootstrap variables).
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
     refactor colors into tokens).
   - **Subsequent iterations**: if \`usageRate < 0.6\` **OR** \`hardcodedCount > 5\`
     → **FAIL**.
   - Log unused tokens (first 10) and hardcoded sites (first 10) regardless.

7. Success log: \`"GATE I' (Token Usage): {N} defined, {M} used ({R}%), {K} hardcoded"\`

---

### GATE J' (Shared Component Adoption — graph-driven, WARNING)

If \`frontend/src/components/ui/\` exists with shared components (Button, Input,
Card, etc.), verify pages import them rather than reinventing.

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
   \`components.schemas.*.required[]\`).
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
       extensions 5 (Pydantic) and 6 (OpenAPI YAML/JSON) are enabled
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

**Triangulation** (recommended when BOTH \`pydantic_field\` AND \`openapi_field\`
exist — typical on Python backends with generated OpenAPI): cross-check
\`pydantic_field\` against \`openapi_field\` nodes for the same \`schemaClass\`.
If required-field sets disagree → **FAIL** (contract sources disagree, upstream drift).

---

### GATE K' (Module Cohesion & Anti-pattern — graph-driven, ADVISORY)

Use \`graph_communities\` and \`graph_god_nodes\` to assess code health. This GATE
is advisory (never fails Phase 4) — findings feed the overall gate report.

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

2. **God-node detection** (degree centrality):
   Call: \`graph_god_nodes(10)\`
   → returns 10 most-connected nodes (highest total degree).

   ANTI-PATTERN: a single utility / component connected to > 100 other nodes
   suggests over-coupling. Candidates for splitting:
   - A mega utils file
   - A single-dispatch router handling everything
   - A kitchen-sink component

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
  "prpName": "PRP-001-Auth-User-Management",
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

#### STEP 3.9 — Aggregate Gate Report (NEW — MANDATORY per module)

After all GATE G'/H'/I'/J'/Contract'/K' have run for this module, aggregate
results into a single per-module report.

Write \`${prpDir}/done/PRP-{NNN}-gate-report.md\` with:

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
- Missing: <list route → component>
- Orphan: <list>

### GATE H' Findings
- Broken navigate: <list file:line → target>

(... one section per failed/warned GATE ...)

### GATE K' Advisory
- Cross-module communities: <list>
- God-nodes: <list id (degree)>

## Module Disposition
- Phase 4 STEP 4 (completion): **{ALLOWED / BLOCKED}**
- If BLOCKED: return to STEP 2 to address FAIL findings above.
\`\`\`

**Aggregation across all modules** (when last module's STEP 3.9 completes):
Write \`${prpDir}/done/PHASE4_OVERALL_GATE_REPORT.md\`:

\`\`\`markdown
# Phase 4 Overall Gate Report

## Per-module status
| Module               | G' | H' | I' | J' | Contract' | K'  | Status |
|----------------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| PRP-001-Auth         | ✓  | ✓  | ✓  | ✓  | ✓         | adv | PASS   |
| PRP-002-Passengers   | ✓  | ✗  | ~  | ✓  | ✓         | adv | FAIL   |

## Critical issues across all modules
- Cross-module god-nodes (parser util, etc.)
- Communities spanning modules (tight coupling)
- Contract gaps remaining

## Disposition
- {ALL modules PASS → proceed to CHECKPOINT}
- {Some modules FAIL → return to module STEP 2 for listed modules}
\`\`\`

This overall report is referenced by Phase 6 Documentation and by the
WHOLE-PROJECT SANITY GATE.

---

#### STEP 4 — Record Completion

### STEP 4 PRE-CHECK — PHASE4_PROGRESS.md location verification (B-3 enforcement)

Before writing completion.json, verify that \`${projectDir}/PHASE4_PROGRESS.md\`
exists at the **canonical project status location** (NOT inside \`${prpDir}\`
or any subdirectory).

1. Check existence: the file MUST be at \`${projectDir}/PHASE4_PROGRESS.md\`.
   - NOT: \`${prpDir}/progress.md\`
   - NOT: \`${prpDir}/PHASE4_PROGRESS.md\`
   - NOT: \`${projectDir}/prps/progress.md\`
   - NOT: any other subdirectory variant

2. If found at a wrong location:
   - Emit WARNING log with actual path vs expected path.
   - Move the file to the correct location using the Write tool (read old,
     write to \`${projectDir}/PHASE4_PROGRESS.md\`, delete old if possible).
   - Update internal tracking so the next iteration sees the canonical path.

3. If not found AT ALL:
   - Create \`${projectDir}/PHASE4_PROGRESS.md\` with the current module's
     status using the format from STEP 0 (Total / Completed / Pending
     sections), seeded from physical state just discovered.

4. Append or update the current module's checkbox under
   \`## Completed (source files verified on disk)\` in PHASE4_PROGRESS.md
   BEFORE proceeding to the completion.json write below.

⚠️ \`${projectDir}/PHASE4_PROGRESS.md\` is THE authoritative progress tracker
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
  "evidence": { /* shape depends on method, see schema below */ } }
\`\`\`

NOTE on \`method: "pytest"\`: this is a generic "run \`evidence.command\`, assert
exit code + stdout contains". It is NOT limited to Python pytest — use it for
\`npx vitest run\`, \`npm test\`, \`jest\`, \`go test ./...\`, Cargo test, etc. The
verifier doesn't inspect the runner; it re-executes the command string and
checks \`expectedExitCode\` + \`expectedStdoutContains\`.

PRE-FLIGHT SELF-CHECK (run mentally before you Write the file):
1. Does EVERY criterion have \`method\` = one of the 5 enum values? If any missing → REWRITE.
2. Does EVERY criterion have \`evidence\` with re-runnable commands/paths? If any has only \`notes\` → REWRITE.
3. Grep your own draft: if you see \`"notes":\` INSIDE an \`acceptanceCriteria\` item (not at top-level \`implementationNotes\`), you used the wrong schema. REWRITE.
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
  - Example: \`PRP-001-Auth-User-Management.completion.json\`

You MUST use the Write or Edit tool (not Bash heredoc, not fs APIs from
scripts) so that meta-coder's graphify watcher picks it up and the next
session's STEP 0 Resume Check can verify it.

Before writing, sanity-check the target path:

\`\`\`
Expected: ${prpDir}/done/PRP-001-Auth-User-Management.completion.json
          └── dir=done, suffix=.completion.json
\`\`\`

If you're about to write to \`${prpDir}/completion/\` or a filename without
the \`.completion.json\` suffix: STOP. You are deviating. Use the spec exactly.

---

Write \`${prpDir}/done/{PRP_filename}.completion.json\` with this content:

\`\`\`json
{
  "prpName": "PRP-XXX-ModuleName",
  "startedAt": "<ISO-8601 from STEP 1>",
  "completedAt": "<ISO-8601 now>",
  "acceptanceCriteria": [
    {
      "criterion": "POST /auth/login returns 200 + access_token",
      "verified": true,
      "method": "curl",
      "evidence": {
        "command": "curl -s -X POST http://localhost:8999/auth/login -H 'Content-Type: application/json' -d '{\\"email\\":\\"test@x.y\\",\\"password\\":\\"pass123\\"}' -w '\\n%{http_code}'",
        "expectedStatusMatch": "200",
        "expectedBodyContains": "access_token"
      }
    },
    {
      "criterion": "pytest tests/test_auth.py passes",
      "verified": true,
      "method": "pytest",
      "evidence": {
        "command": "pytest tests/test_auth.py -v --tb=no",
        "workspaceRelative": true,
        "expectedExitCode": 0,
        "expectedStdoutContains": "passed"
      }
    },
    {
      "criterion": "SECRET_KEY is not hardcoded",
      "verified": true,
      "method": "filesystem",
      "evidence": {
        "file": "src/core/config.py",
        "notContains": ["SECRET_KEY = \\"", "SECRET_KEY='"],
        "contains": ["os.environ", "os.getenv"]
      }
    }
  ]
}
\`\`\`

Schema rules:
- Evidence must be RE-RUNNABLE. The code-side verifier re-executes it.
- Each criterion's \`method\` maps to an evidence shape:
  - curl: \`{ command, expectedStatusMatch?, expectedBodyContains? }\`
  - pytest: \`{ command, workspaceRelative?, expectedExitCode, expectedStdoutContains? }\`
  - chrome-mcp: \`{ summaryPath, expectedPass }\`
  - filesystem: \`{ file, contains?: string[], notContains?: string[], regex? }\`
  - static: \`{ note }\` — reserved for criteria that truly cannot be automated;
    use sparingly, verifier will warn if too many
- Do NOT pad with extra fields. The verifier ignores them but clutter is discouraged.

Then write the empty marker:
\`${prpDir}/done/{PRP_filename}.md.done\`

Emit a single terse line: \`✓ {PRP} ({X}/{N})\`

**IMMEDIATELY proceed to STEP 1 of the next unfinished module in the SAME response.**
NO progress report, NO "Next up:", NO user-facing announcement.

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

### Phase 4 MANDATORY RULES (supplement the UNIVERSAL rules at the top)

1. **Every acceptance criterion must be RUN before STEP 4.** Writing
   \`"verified": true\` without actually executing the evidence is FRAUD. The
   code-side verifier re-executes each criterion and rejects the module if
   results disagree.

2. **completion.json evidence must be RE-RUNNABLE.** If your curl command uses
   a port that's already gone, your pytest references a test that no longer
   exists, or your filesystem path is wrong — verifier fails the module.

3. **CONTINUOUS Phase 4.** No user-facing pauses between modules. No
   summaries. No "should I continue?" questions. Complete N/N, then run the
   Phase 4 SANITY CHECK below, then **IMMEDIATELY** continue into the CHECKPOINT
   section (start services + /systest command). "Complete N/N" is NOT a
   stopping point — it is the midpoint of Phase 4.

---

**Phase 4 SANITY CHECK (MANDATORY before advancing to Phase 5)**

Before declaring Phase 4 complete:

1. \`Glob({ pattern: "${prpDir}/PRP-*.md" })\` → count = N (source of truth for how many modules exist).
2. \`Glob({ pattern: "${prpDir}/done/PRP-*.completion.json" })\` → count = M.
3. If **M < N**: at least one PRP has NO marker. Identify which PRP-NNN is missing, go back to its STEP 3 FINAL, and write the marker. Repeat until M == N.
4. For every marker, re-run all 5 checks from STEP 3.POST above. Any failure → fix and re-check.
5. Only when M == N AND all 5 checks pass for every marker may you proceed to the CHECKPOINT section below.

Do NOT skip. Do NOT proceed with missing completion markers — STEP 0 Resume Check will re-enter Phase 4 next session and waste an entire re-implementation round.

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
5. Write \`${projectDir}/PHASE4_SUMMARY.md\`
6. Output the \`/systest\` command for the user to copy/paste

**WITHOUT THESE STEPS, the user cannot test the project.** Stopping here silently leaves services unstarted, PHASE4_SUMMARY.md missing, and /systest command unprinted — forcing the user to repeat Phase 4 next session. Proceed DIRECTLY to the CHECKPOINT below, in the SAME response. Treat the CHECKPOINT as step 6 of the per-module loop that runs ONCE after all PRPs complete.

---

### CHECKPOINT: Phase 4 Complete → Start Services + Session Reset

🚨 **ENTRY GATE — PHYSICAL VERIFICATION REQUIRED:**

Before doing ANYTHING in this CHECKPOINT, verify using cross-platform AI tools:

1. List PRPs: \`Glob({ pattern: "${prpDir}/PRP-*.md" })\` → total N
2. List completion.json: \`Glob({ pattern: "${prpDir}/done/*.completion.json" })\`
3. For each completion.json, Read and verify (accept BOTH schemas):
   - **NEW schema** (acceptance-criteria-driven): \`acceptanceCriteria\` is a non-empty array AND every item has \`verified === true\`. Spot-check: pick one curl criterion and re-run its command — status must still match.
   - **OLD schema** (legacy): \`verification.reviewVerdict === "PASS"\` AND \`verification.testsPass === true\` AND at least one artifacts.sourceFiles path exists
4. Count verified → X
5. If X < N: GO BACK to STEP 0, complete missing modules.
   DO NOT start services, write summary, or suggest /systest.

**Do NOT trust PHASE4_PROGRESS.md — only valid completion.json files count as proof.**

Phase 4 (ALL N modules verified) is complete. Start services and provide the test command.

---

🛡️ **WHOLE-PROJECT SANITY GATE — MANDATORY before any /systest command.**

Per-module criteria passed, but airlinesys5 still shipped with 35% of backend
tests broken and 0 Vitest tests. Reason: per-module verification cannot catch
cross-module regressions or whole-suite rot. Run these 6 gates VERBATIM from
\`${ws}\`. **ALL SIX must pass.** If any fails, return to STEP 0 and fix the
responsible module(s). Do NOT start services or print /systest until all pass.

\`\`\`bash
# GATE A: Backend whole-suite pass rate ≥ 95%
cd ${ws} && pytest tests/ --tb=no -q 2>&1 | tail -5
# Read the summary. Must show "X passed" with X/total ≥ 0.95.
# If integration tests ERROR due to missing fixtures: FIX the fixtures OR
# mark @pytest.mark.skip("<explicit reason>") — never silently ignore.

# GATE B: No debug / tmp / simple test residue
# Match TOP-LEVEL throwaway files (test_simple.py, test_debug.py, test_tmp*.py, *_debug.py)
# — NOT legitimate names like test_simple_auth.py where "simple" is part of the feature name.
find tests -type f \\( -name "test_simple.py" -o -name "test_debug.py" \\
  -o -name "test_tmp*.py" -o -name "test_*_debug.py" -o -name "test_*_tmp.py" \\
  -o -name "*_scratch.py" -o -name "*_playground.py" \\) 2>/dev/null \\
  | grep -v __pycache__ || true
# Output MUST be EMPTY. Delete any matches — they are throwaway development files.

# GATE C: No deprecated datetime API (Python 3.12+)
# Scan common Python source roots (different stacks use different conventions).
rg -n "datetime\\.utcnow\\(\\)" src/ app/ backend/ 2>/dev/null || true
# Output MUST be EMPTY. Replace with \`datetime.now(timezone.utc)\`.

# GATE D: Vitest coverage ratio ≥ 80% of page count
pages=$(find frontend/src/pages -name "*.tsx" -not -name "*.test.tsx" 2>/dev/null | wc -l)
tests=$(find frontend/src -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null | wc -l)
echo "pages=$pages vitest-tests=$tests"
test "$tests" -ge "$(( pages * 8 / 10 ))" || { echo "FAIL: Vitest < 80% of pages"; false; }

# GATE E: Vitest actually runs green
cd ${ws}/frontend && npx vitest run --reporter=dot 2>&1 | tail -10
# Must exit 0 and show all tests passing.

# GATE F: No frontend skeleton remnants
rg -n "Under construction|Coming soon|^\\s*// ?TODO|WIP" frontend/src/pages/ || true
# Output MUST be EMPTY.
\`\`\`

**Skip rules:**
- If no \`frontend/\` directory exists → skip GATES D / E / F
- If no \`tests/\` directory exists → skip GATES A / B / C
- Otherwise ALL applicable gates must pass

**Record the results:** after all gates pass, write \`${ws}/PHASE4_FINAL_GATE.md\`
capturing each gate's actual stdout (first/last 10 lines). This becomes the
audit trail the user inspects if /systest reports anomalies.

If ANY gate fails: DO NOT proceed. DO NOT start services. DO NOT write
PHASE4_SUMMARY.md. Announce which gate failed and return to STEP 0 resume
check to fix the responsible module(s).

---

**STEP 1: Start BACKEND service (MANDATORY — port rotation on conflict)**

🚨 The backend MUST be running and reachable BEFORE you print the /systest command.
A /systest command pointing at a dead port wastes the user's next session.

**1a. Find the backend start command** by inspecting these files in order:
- \`${ws}/package.json\` — scripts.start / scripts.dev / scripts["start:api"] / scripts.server
- \`${ws}/pyproject.toml\` + \`${ws}/src/main.py\` (FastAPI pattern — uvicorn)
- \`${ws}/pom.xml\` → Spring Boot (mvn spring-boot:run)
- \`${ws}/go.mod\` → \`go run ./cmd/...\`
- \`${ws}/composer.json\` → PHP (\`php -S localhost:<port> -t public\`)

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
- Python: \`cd ${ws} && python -m uvicorn src.main:app --host 127.0.0.1 --port <PORT> > .systest/backend.log 2>&1\`
- Node: \`cd ${ws} && PORT=<PORT> npm start > .systest/backend.log 2>&1\`
- Spring Boot: \`cd ${ws} && mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=<PORT>\`
- (Ensure dependencies are installed first: \`pip install -r requirements.txt\`, \`npm install\`, \`mvn dependency:resolve\`)

**1d. Health check with retry** — wait up to 30s for server to accept connections:
\`\`\`
for i in 1..15:
  sleep 2
  curl -s -o /dev/null -w '%{http_code}' http://localhost:<PORT>/docs --connect-timeout 2
  if code starts with 2xx or 3xx: break
else: FAIL — report backend didn't start, investigate .systest/backend.log
\`\`\`

**1e. Record the ACTUAL port** as a variable \`BACKEND_PORT\` in your working memory. Do
NOT forget it — you'll need it in STEP 3 and STEP 4.

---

**STEP 2: Start FRONTEND service (MANDATORY — port rotation on conflict)**

**2a. Find the frontend start command**:
- \`${ws}/frontend/package.json\` — scripts.dev (Vite/Next) / scripts.start (CRA)
- If no \`frontend/\` dir but root package.json has frontend scripts, use root

**2b. Pick an AVAILABLE frontend port**:
- Vite default: 5173 → if busy try 5174, 5175, 5176
- Next.js default: 3000 → try 3001, 3002 (coordinate with backend — must differ)
- Check availability with same curl pattern as 1b

**2c. Launch** in the background:
- \`cd ${ws}/frontend && npm install && npm run dev -- --port <PORT> --host 127.0.0.1 > ../.systest/frontend.log 2>&1\`
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

Purpose: verify that the implemented backend and frontend ACTUALLY match the
canonical contract from Phase 3.5 — catch drift **while the implementation
session still has full context**. Drift caught here costs ~30 seconds to fix;
drift caught by /systest forces a full session reset.

### STEP 1: Backend conformance check

1. Services are already running (STEP 1/2 above). Reuse those ports.
2. Fetch \`http://localhost:{BACKEND_PORT}/openapi.json\`
3. Compare with canonical \`${prpDir}/contracts/openapi.yaml\`:

   If \`@redocly/cli\` available:
   \`\`\`bash
   npx --no-install @redocly/cli diff \\
     ${prpDir}/contracts/openapi.yaml \\
     /tmp/backend-emitted.json
   \`\`\`

   Otherwise: graph-based diff using the openApiParser.ts integration.
   - Get canonical endpoints: \`graph_query("openapi_endpoint from canonical")\`
   - Get emitted endpoints: graph_query on the fetched openapi.json
   - Diff the sets

4. If diff is non-empty:
   - Log specific endpoint/schema mismatches
   - FAIL Phase 4.5 — backend doesn't match contract
   - Either fix backend OR update contract (Phase 3.5 STEP 3) and re-run

### STEP 2: Frontend conformance check

1. Run \`tsc --noEmit\` on frontend
2. Any TS errors are real bugs (since types are auto-generated from contract):
   - Missing required field in form → compile error
   - Wrong type passed to api.post → compile error
3. Fix all TS errors before proceeding

### STEP 3: End-to-end contract test

For each Form route in any FRONTEND_DESIGN.md:
1. Identify the matching POST/PUT endpoint and its schema
2. Get sample data from seed (PRP \`${prpDir}/seed.json\` or \`${ws}/.systest/seed.json\` if exists)
3. POST to the backend with the sample data
4. Expect 2xx response (NOT 422)
5. If 422: schema or implementation drift — log and FAIL

This ensures backend, frontend, and contract are all aligned.

### STEP 4: Phase 4.5 Conformance Report

Write \`${prpDir}/CONFORMANCE_REPORT.md\`:

\`\`\`markdown
# Contract Conformance Report

- Canonical contract: ${prpDir}/contracts/openapi.yaml
- Backend emitted: from /openapi.json fetch
- Frontend types: frontend/src/types/api.ts

## Backend Conformance
- Endpoints in canonical: N
- Endpoints in backend: M
- Match: K
- Drift: <list of differences>

## Frontend Conformance
- TS errors in frontend: <count>
- Files with errors: <list>

## E2E Contract Tests
- Form routes tested: N
- Passed (2xx): K
- Failed (422 or other): <list>

## Conclusion
- Conformance score: K/N (target: 100%)
- Status: PASS / FAIL
\`\`\`

### STEP 5: Conformance gate

If conformance score < 100%:
- FAIL Phase 4.5
- Loop back to Phase 4 STEP 2 (per-module rework) to fix drift
- Re-run Phase 4.5 until clean
- Do NOT write PHASE4_SUMMARY.md or print the /systest command yet

If conformance == 100%:
- Log "Phase 4.5 Conformance: PASS"
- **Proceed to PHASE4_SUMMARY.md (Phase 4 CHECKPOINT STEP 3 below)**

Do NOT write PHASE4_SUMMARY.md or print the /systest command until Phase 4.5
is clean. A /systest run against a contract-non-conformant build will fail in
Phase 5C with confusing UI errors that look like frontend bugs but are actually
upstream schema drift.

---

**STEP 3: Write PHASE4_SUMMARY.md with actual URLs**

Write to ${projectDir}/PHASE4_SUMMARY.md:
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
║  ✅ Phase 4 COMPLETE — 11/11 modules verified                    ║
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
/systest run --workspace ${ws} --backend-url http://localhost:{BACKEND_PORT} --frontend-url http://localhost:{FRONTEND_PORT}${parsed.databaseUrl ? ' --database ' + parsed.databaseUrl : ''}${parsed.designDocsDir ? ' --design-docs ' + parsed.designDocsDir.replace(/\\\\/g, '/') : ''}
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

Generate these files in ${ws}:

1. **README.md** -- Project overview, setup instructions, API reference
2. **API documentation** -- OpenAPI / Swagger spec (if backend)
3. **.env.example** -- All required environment variables with descriptions
4. **Database schema docs** -- ER diagram or table descriptions (if database)

---

`
}


// ---------------------------------------------------------------------------
// Env setup section builder
// ---------------------------------------------------------------------------

/**
 * Build the "### Step N: Env Setup" section appended to the newproject prompt.
 * If no active env is configured, provides guidance on setting one up.
 */
function buildEnvSetupSection(
  envBlock: string | null,
  envOverride: string | undefined,
  workspacePath: string,
): string {
  const lines: string[] = []
  lines.push('### Step N: Env Setup (run before Phase 1)')
  lines.push('')

  if (envBlock) {
    lines.push('An active environment is configured for this project. Use the context below for all infra references:')
    lines.push('')
    lines.push(envBlock)
    lines.push('')
    lines.push('**Actions to take:**')
    lines.push(`1. Verify \`${workspacePath}/.metacoder/environments.yaml\` exists.`)
    lines.push('2. If DB access is needed, reference vars/secrets from the env block above.')
    lines.push('3. Run `metacoder env import .env` if an existing `.env` file should be imported.')
  } else {
    const scaffold = generateEnvScaffold({
      stagingEnvName: envOverride ?? 'staging',
      includeDatabase: false,
    })
    lines.push('No active environment is configured. To set one up:')
    lines.push('')
    lines.push('**1. Create `.metacoder/environments.yaml`** (skeleton below):')
    lines.push('')
    lines.push('```yaml')
    lines.push(scaffold.yaml)
    lines.push('```')
    lines.push('')
    lines.push('**2. Activate an env:**')
    lines.push('```')
    lines.push('/env use dev')
    lines.push('```')
    lines.push('')
    lines.push('**3. Import existing secrets (optional):**')
    lines.push('```')
    lines.push('metacoder env import .env')
    lines.push('```')
    if (scaffold.secretsToRegister.length > 0) {
      lines.push('')
      lines.push('**4. Register secrets in OS credential store:**')
      for (const hint of scaffold.registrationHints) {
        lines.push(hint)
      }
    }
    lines.push('')
    lines.push('_Env setup is optional — the skill continues without it._')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Skill registration
// ---------------------------------------------------------------------------

export function registerNewProjectSkill(): void {
  registerBundledSkill({
    name: 'newproject',
    description: 'New project development from requirements: design -> TDD develop -> test -> document. Supports [--env <name>] to activate env context.',
    userInvocable: true,
    async getPromptForCommand(args) {
      // Extract optional --env flag before forwarding args to parseProjectArgs
      const { envName: envOverride, rest: cleanArgs } = extractEnvFlag(args ?? '')
      const effectiveArgs = cleanArgs

      if (!effectiveArgs || !effectiveArgs.includes('--workspace')) {
        return [{
          type: 'text',
          text: 'Usage: /newproject --workspace <output-path> --design-docs <requirements-path> --database <conn> [--reference <ref-project>] [--design-style <name>] [--language <ja|en|zh>] [--team] [-v|--verify] [--env <env-name>]',
        }]
      }

      try {
        const parsed = parseProjectArgs(effectiveArgs)

        // Resume detection
        // detectResumeContext is imported at the top of the file
        const resumeCtx = await detectResumeContext(parsed.output)
        if (resumeCtx.isResume && !parsed.resume) {
          console.log('[newproject] Resume context detected — existing done/ directory')
          parsed.resume = true
        }

        // Resume branch: skip Phase 1.5/3, build resume prompt
        if (parsed.resume) {
          if (resumeCtx.pendingModules.length === 0) {
            return [{
              type: 'text',
              text: `All modules already completed (${resumeCtx.completedModules.length} modules). Nothing to resume.\n\nCompleted:\n${resumeCtx.completedModules.map(m => '- ' + m).join('\n')}\n\nTo test: /clear then /systest run --workspace ${parsed.output.replace(/\\/g, '/')}${parsed.databaseUrl ? ' --database ' + parsed.databaseUrl : ''}`,
            }]
          }

          // Resolve best practices files for resume context
          const resumeStack = resolveTechStack(parsed, { techStack: {} as any, entities: [], routes: [], services: [], communities: [], graphStats: null }, 'new')
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

          const resumePrompt = `# Resume Phase 4 — New Project

A previous /newproject session was interrupted. Resuming from physical state.

## Resume Context

- Project output: ${parsed.output.replace(/\\/g, '/')}
- PRP directory: ${resumeCtx.prpDir.replace(/\\/g, '/')}
- Total modules: ${resumeCtx.completedModules.length + resumeCtx.pendingModules.length}
- Completed (verified): ${resumeCtx.completedModules.length}
- Pending: ${resumeCtx.pendingModules.length}

## Completed modules (skip)
${resumeCtx.completedModules.map(m => '- ✓ ' + m).join('\n') || '(none)'}

## Pending modules (implement)
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
3. For each pending module (in MODULE_INDEX.md order), run the Phase 4 multi-agent workflow:
   - STEP 2: Read PRP, write spec (PM)
   - STEP 3: Spawn Coding Agent
   - STEP 4: Spawn Reviewer Agent (loop until PASS)
   - STEP 5: Spawn Tester Agent (loop until 100% pass)
   - STEP 6: PHYSICAL VERIFICATION + write done/{PRP}.md.done
4. After all done: proceed to CHECKPOINT (start services, provide /systest command).

## MANDATORY RULES

1. Do NOT re-implement already-completed modules
2. Do NOT trust markdown checkboxes — only .done markers
3. For each module, Coding Agent must register router in main.py
4. STEP 6 verification must run actual bash commands
5. The done/ directory is the source of truth

## Files to read

- ${resumeCtx.prpDir.replace(/\\/g, '/')}/MODULE_INDEX.md
- ${resumeCtx.prpDir.replace(/\\/g, '/')}/FRONTEND_DESIGN.md
- ${resumeCtx.prpDir.replace(/\\/g, '/')}/PRP-*.md
- ${resumeCtx.doneDir.replace(/\\/g, '/')}/*.completion.json

Ask for user confirmation, then process pending modules.
`
          return [{ type: 'text', text: resumePrompt }]
        }

        // Phase 1: Initialize project directory
        console.log('[newproject] Phase 1: Initializing...')
        await initializeProject(parsed)

        // Phase 0: knowledge graph — ALWAYS build on workspace root so graphify-out/
        // exists for GATE queries, the autoUpdate watcher, and post-generation rebuilds.
        // Empty workspace → empty graph (still valid infrastructure, populated by later phases).
        // Reference code discovery (explicit flag or auto-detect docs/reference/legacy/...)
        // is logged for transparency; analysis always runs against the workspace graph
        // since it already scans all subdirectories including docs/.
        console.log('[newproject] Phase 0: Building knowledge graph of workspace:', parsed.workspace)
        const workspaceStats = await buildKnowledgeGraph(parsed.workspace)
        if (workspaceStats) {
          console.log('[newproject] Workspace graph:', workspaceStats.nodes, 'nodes,', workspaceStats.edges, 'edges')
          if (workspaceStats.nodes === 0) {
            console.log('[newproject] (empty graph — expected for greenfield projects; will populate after Phase 4)')
          }
        } else {
          console.warn('[newproject] WARNING: workspace graph build returned null — graphify-out/ may not exist. GATEs will be degraded.')
        }

        let refStructure: ProjectStructure | null = null
        let refPath = parsed.referenceProject
        if (!refPath) {
          const autoDetected = autoDetectReferenceCode(parsed.workspace)
          if (autoDetected) {
            console.log('[newproject] Auto-detected reference code:', autoDetected, '(covered by workspace graph)')
            refPath = autoDetected
          }
        }

        // Analyze structure from the workspace graph (covers docs/ and any auto-detected reference inside workspace).
        const workspaceEngine = await getGraphEngine(parsed.workspace)
        refStructure = await analyzeProjectStructure(parsed.workspace, workspaceEngine)

        // If explicit --reference-project points OUTSIDE the workspace, graphify it too and merge findings.
        const path = await import('node:path')
        const refIsOutsideWorkspace = parsed.referenceProject && !path.resolve(parsed.referenceProject).startsWith(path.resolve(parsed.workspace))
        if (refIsOutsideWorkspace && parsed.referenceProject) {
          console.log('[newproject] Explicit reference outside workspace — building separate graph:', parsed.referenceProject)
          const refStats = await buildKnowledgeGraph(parsed.referenceProject)
          if (refStats) {
            console.log('[newproject] Reference graph:', refStats.nodes, 'nodes,', refStats.edges, 'edges')
          }
          const refEngine = await getGraphEngine(parsed.referenceProject)
          const externalRefStructure = await analyzeProjectStructure(parsed.referenceProject, refEngine)
          // Prefer external reference structure for entities/routes (it's the actual PoC); keep workspace stats for graphStats.
          if (externalRefStructure.entities.length > 0 || externalRefStructure.routes.length > 0) {
            refStructure = externalRefStructure
          }
        }

        // Phase 2: Analyze requirements documents
        console.log('[newproject] Phase 2: Analyzing requirements...')
        const requirementsAnalysis = await analyzeRequirements(parsed)

        // Build structure from requirements (not from existing code)
        const structure = buildStructureFromRequirements(requirementsAnalysis, refStructure, parsed)

        // If reference project available, detect its tech stack for recommendations
        if (refPath && !refStructure?.techStack) {
          try {
            const detected = detectTechStack(refPath)
            if (detected) {
              structure.techStack = detected
            }
          } catch {
            // Tech stack detection is best-effort
          }
        }

        // Generate INITIAL.md
        const initialMd = generateINITIAL(structure, parsed, 'new')
        const { writeFileSync, mkdirSync } = await import('node:fs')
        const projectDir = join(parsed.output, '.project')
        mkdirSync(projectDir, { recursive: true })
        const initialPath = join(projectDir, 'INITIAL.md')
        writeFileSync(initialPath, initialMd)
        console.log('[newproject] INITIAL.md generated:', initialPath)

        // Phase 3: Generate PRP modules
        console.log('[newproject] Phase 3: Generating module PRPs...')
        const prpInfo = await generatePRPs(initialMd, structure, parsed)
        console.log('[newproject] Generated', prpInfo.moduleCount, 'PRP modules')

        // Enable Agent Teams if --team mode (allows fully independent teammate sessions)
        if (parsed.teamMode) {
          process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
        }

        // Build prompt — multi-agent is always the default (PM + Coding + Reviewer + Tester)
        const prompt = buildNewProjectPrompt(parsed, structure, requirementsAnalysis, prpInfo)

        // Step N: Env Setup — best-effort env context injection
        const envCtx = await buildEnvContextForSkill('newproject', parsed.output, { envOverride })
        const envSection = buildEnvSetupSection(envCtx.ok ? envCtx.block : null, envOverride, parsed.output)

        return [{ type: 'text', text: prompt + '\n\n' + envSection }]
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return [{ type: 'text', text: '[newproject] Setup failed: ' + msg }]
      }
    },
  })
}
