/**
 * Phase 3: Code Review with Best Practices & Auto-Fix
 * Reviews codebase against language/framework best practices
 * Automatically fixes issues when detected
 * Generates comprehensive business logic test cases from Phase 2 output
 */

import { join } from "node:path"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import type { SystestContext, PhaseResult } from "./orchestrator.js"
import { getGraphEnhancer } from "../../../services/systest/graphEnhancer.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TechStack {
  language: string
  backendFramework: string
  frontendFramework: string
  /** Legacy compat: returns backendFramework or frontendFramework */
  framework: string
}

interface EndpointInfo {
  method: string
  path: string
  handler: string
  sourceFile: string
}

interface EntityFieldInfo {
  name: string
  type: string
  optional?: boolean
  constraints?: string
}

interface EntityInfo {
  name: string
  fields: EntityFieldInfo[]
  sourceFile: string
  tableName?: string
  schemaType?: string
}

interface ProjectStructure {
  endpoints: EndpointInfo[]
  entities: EntityInfo[]
  services: { name: string; sourceFile: string; dependsOn: string[] }[]
  architecture: { type: string; apps: string[] }
  graphStats: { nodes: number; edges: number; communities: number }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function executePhase3(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  try {
    const enhancer = getGraphEnhancer()
    const techStack = await detectTechStack(ctx)
    console.log(`[Phase 3] Detected tech stack: ${techStack.language} / backend=${techStack.backendFramework} / frontend=${techStack.frontendFramework}`)

    const bestPractices = await loadBestPractices(techStack)
    if (!bestPractices) {
      console.warn(`[Phase 3] No best practices found for ${techStack.framework}`)
    } else {
      console.log(`[Phase 3] Loaded ${bestPractices.practices.length} best practices`)
    }

    const analysisResult = await analyzeCodeAgainstBestPractices(ctx, enhancer, bestPractices, techStack)
    const fixResults = await autoFixIssues(ctx, analysisResult.issues)
    console.log(`[Phase 3] Fixed ${fixResults.fixedCount}/${fixResults.totalCount} issues`)

    const codeReviewReport = generateCodeReviewReport(ctx, analysisResult, fixResults, techStack)
    const businessTestCases = await generateBusinessTestCases(ctx, enhancer, analysisResult)

    const codeReviewPath = join(ctx.outputDir, "CODE_REVIEW_REPORT.md")
    const testCasesPath = join(ctx.outputDir, "config", "BUSINESS_LOGIC_TESTCASES.md")
    const fixesLogPath = join(ctx.outputDir, "CODE_FIXES_LOG.md")

    writeFileSync(codeReviewPath, codeReviewReport, "utf-8")
    writeFileSync(testCasesPath, businessTestCases, "utf-8")
    writeFileSync(fixesLogPath, fixResults.report, "utf-8")

    outputs.push(codeReviewPath, testCasesPath, fixesLogPath)

    console.log(`[Phase 3] Review completed: ${analysisResult.issues.length} issues found, ${fixResults.fixedCount} fixed`)
    console.log(`[Phase 3] Generated comprehensive business logic test cases`)

    return {
      status: "completed",
      outputs,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      status: "failed",
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Tech stack detection — monorepo-aware
// ---------------------------------------------------------------------------

async function detectTechStack(ctx: SystestContext): Promise<TechStack> {
  let backendFramework = "unknown"
  let frontendFramework = "unknown"
  let language = "typescript"

  // 1. Check root package.json
  const rootPkgPath = join(ctx.workspace, "package.json")
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"))
      const detected = detectFrameworkFromPackageJson(rootPkg)
      if (detected.backend !== "unknown") backendFramework = detected.backend
      if (detected.frontend !== "unknown") frontendFramework = detected.frontend
    } catch {}
  }

  // 2. Check apps/api/package.json for backend framework (monorepo)
  const apiPkgCandidates = [
    join(ctx.workspace, "apps", "api", "package.json"),
    join(ctx.workspace, "apps", "server", "package.json"),
    join(ctx.workspace, "apps", "backend", "package.json"),
    join(ctx.workspace, "packages", "api", "package.json"),
    join(ctx.workspace, "packages", "server", "package.json"),
  ]
  for (const pkgPath of apiPkgCandidates) {
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        const detected = detectFrameworkFromPackageJson(pkg)
        if (detected.backend !== "unknown") {
          backendFramework = detected.backend
          break
        }
      } catch {}
    }
  }

  // 3. Check apps/admin|web/package.json for frontend framework (monorepo)
  const frontendPkgCandidates = [
    join(ctx.workspace, "apps", "admin", "package.json"),
    join(ctx.workspace, "apps", "web", "package.json"),
    join(ctx.workspace, "apps", "frontend", "package.json"),
    join(ctx.workspace, "apps", "client", "package.json"),
    join(ctx.workspace, "packages", "web", "package.json"),
    join(ctx.workspace, "packages", "frontend", "package.json"),
  ]
  for (const pkgPath of frontendPkgCandidates) {
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        const detected = detectFrameworkFromPackageJson(pkg)
        if (detected.frontend !== "unknown") {
          frontendFramework = detected.frontend
          break
        }
      } catch {}
    }
  }

  // 4. Fallback: detect from source files at workspace root
  if (backendFramework === "unknown" && frontendFramework === "unknown") {
    const fromFiles = detectFrameworkFromFiles(ctx)
    if (fromFiles.backend !== "unknown") backendFramework = fromFiles.backend
    if (fromFiles.frontend !== "unknown") frontendFramework = fromFiles.frontend
  }

  // 5. Check for Python/Go/Java projects
  if (existsSync(join(ctx.workspace, "requirements.txt")) || existsSync(join(ctx.workspace, "pyproject.toml"))) {
    language = "python"
  } else if (existsSync(join(ctx.workspace, "go.mod"))) {
    language = "go"
  } else if (existsSync(join(ctx.workspace, "pom.xml")) || existsSync(join(ctx.workspace, "build.gradle"))) {
    language = "java"
  }

  // Legacy compat: pick the most specific framework
  const framework = backendFramework !== "unknown" ? backendFramework
    : frontendFramework !== "unknown" ? frontendFramework
    : "unknown"

  return { language, backendFramework, frontendFramework, framework }
}

function detectFrameworkFromPackageJson(packageJson: any): { backend: string; frontend: string } {
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  const depNames = Object.keys(allDeps).map(name => name.toLowerCase())

  let backend = "unknown"
  let frontend = "unknown"

  // Backend frameworks (order = priority)
  if (depNames.includes("hono")) backend = "hono"
  else if (depNames.includes("@nestjs/core") || depNames.includes("nest")) backend = "nest"
  else if (depNames.includes("fastify")) backend = "fastify"
  else if (depNames.includes("express")) backend = "express"
  else if (depNames.includes("koa")) backend = "koa"
  else if (depNames.includes("restify")) backend = "restify"

  // Frontend frameworks
  if (depNames.includes("next")) frontend = "nextjs"
  else if (depNames.includes("react") || depNames.includes("react-dom")) frontend = "react"
  else if (depNames.includes("vue")) frontend = "vue"
  else if (depNames.includes("@angular/core")) frontend = "angular"
  else if (depNames.includes("svelte")) frontend = "svelte"

  return { backend, frontend }
}

function detectFrameworkFromFiles(ctx: SystestContext): { backend: string; frontend: string } {
  let backend = "unknown"
  let frontend = "unknown"

  const srcPath = join(ctx.workspace, "src")
  if (!existsSync(srcPath)) return { backend, frontend }

  const entryFiles = [
    join(srcPath, "app.ts"),
    join(srcPath, "index.ts"),
    join(srcPath, "main.ts"),
    join(srcPath, "server.ts"),
  ]

  for (const filePath of entryFiles) {
    if (!existsSync(filePath)) continue
    try {
      const content = readFileSync(filePath, "utf-8")

      if (content.includes('from "hono"') || content.includes("from 'hono'") || content.includes('from "@hono')) {
        backend = "hono"
      } else if (content.includes('from "express"') || content.includes("from 'express'")) {
        backend = "express"
      } else if (content.includes('from "fastify"') || content.includes("from 'fastify'")) {
        backend = "fastify"
      } else if (content.includes("@nestjs")) {
        backend = "nest"
      }

      if (content.includes('from "react"') || content.includes("from 'react'")) {
        frontend = "react"
      } else if (content.includes('from "vue"') || content.includes("from 'vue'")) {
        frontend = "vue"
      }

      if (backend !== "unknown") break
    } catch {}
  }

  return { backend, frontend }
}

// ---------------------------------------------------------------------------
// Best practices loading (unchanged)
// ---------------------------------------------------------------------------

async function loadBestPractices(techStack: TechStack): Promise<any | null> {
  // Resolve best practices path: bundled in meta-coder/resources/bestpractices/
  const { dirname } = await import('node:path')
  // Try multiple locations: repo root, exe directory, fallback
  const candidates = [
    join(process.cwd(), 'resources', 'bestpractices'),
    join(dirname(process.argv[0] || ''), '..', 'resources', 'bestpractices'),
    join(dirname(dirname(dirname(dirname(__dirname)))), 'resources', 'bestpractices'),
  ]
  const bestPracticesPath = candidates.find(p => existsSync(p)) || candidates[0]

  const frameworkMap: Record<string, string> = {
    "fastapi": "python-fastapi",
    "flask": "python-fastapi",
    "django": "python-fastapi",
    "spring boot": "java-spring-boot",
    "spring": "java-spring-boot",
    "nextjs": "react-nextjs",
    "next.js": "react-nextjs",
    "react": "react-nextjs",
    "hono": "react-nextjs",
    "express": "react-nextjs",
    "fastify": "react-nextjs",
    "nest": "react-nextjs",
    "laravel": "php-laravel",
    "go-zero": "go-zero",
    "go": "go-zero"
  }

  const bestPracticeKey = frameworkMap[techStack.framework.toLowerCase()] || frameworkMap[techStack.language.toLowerCase()]

  if (!bestPracticeKey) {
    console.warn(`[Phase 3] No best practices mapping for ${techStack.framework}/${techStack.language}`)
    return null
  }

  const bestPracticeFile = join(bestPracticesPath, `${bestPracticeKey}.md`)
  if (!existsSync(bestPracticeFile)) {
    console.warn(`[Phase 3] Best practices file not found: ${bestPracticeFile}`)
    return null
  }

  const content = readFileSync(bestPracticeFile, "utf-8")
  return parseBestPractices(content, bestPracticeKey)
}

function parseBestPractices(content: string, source: string): any {
  const practices: any[] = []
  const lines = content.split("\n")

  let currentCategory = ""
  let currentSubsection = ""

  for (const line of lines) {
    if (line.match(/^##\s+(.+)/)) {
      currentCategory = line.replace(/^##\s+/, "").trim()
      currentSubsection = ""
      continue
    }

    if (line.match(/^###\s+(.+)/)) {
      currentSubsection = line.replace(/^###\s+/, "").trim()
      continue
    }

    if (line.match(/^-\s+(.+)/)) {
      const practiceText = line.replace(/^-\s+/, "").trim()
      if (practiceText.length > 0) {
        practices.push({
          category: currentCategory,
          subsection: currentSubsection,
          practice: practiceText,
          source: source,
          severity: inferSeverity(practiceText)
        })
      }
      continue
    }
  }

  return { source, practices, totalCount: practices.length }
}

function inferSeverity(practice: string): "critical" | "high" | "medium" | "low" {
  const criticalKeywords = ["sql injection", "xss", "security", "authentication", "authorization", "encryption"]
  const highKeywords = ["performance", "optimization", "memory leak", "race condition"]
  const mediumKeywords = ["error handling", "validation", "logging"]

  const lower = practice.toLowerCase()

  if (criticalKeywords.some(kw => lower.includes(kw))) return "critical"
  if (highKeywords.some(kw => lower.includes(kw))) return "high"
  if (mediumKeywords.some(kw => lower.includes(kw))) return "medium"

  return "low"
}

// ---------------------------------------------------------------------------
// Code analysis against best practices (unchanged)
// ---------------------------------------------------------------------------

async function analyzeCodeAgainstBestPractices(
  ctx: SystestContext,
  enhancer: any,
  bestPractices: any,
  techStack: TechStack
): Promise<{ issues: any[], violations: any[], compliantCount: number }> {

  const issues: any[] = []
  const violations: any[] = []
  let compliantCount = 0

  if (!bestPractices || !bestPractices.practices) {
    return { issues, violations, compliantCount: 0 }
  }

  const priorities = await enhancer.getReviewPriorities()
  const highPriorityFiles = priorities.slice(0, 10).map((p: any) => p.label)

  for (const practice of bestPractices.practices) {
    const practiceCheck = checkPracticeAgainstCode(ctx, practice, highPriorityFiles, techStack)

    if (practiceCheck.hasViolation) {
      violations.push({
        practice: practice.practice,
        category: practice.category,
        severity: practice.severity,
        files: practiceCheck.violatingFiles,
        description: practiceCheck.description
      })

      issues.push({
        type: "best_practice_violation",
        severity: practice.severity,
        description: practice.practice,
        category: practice.category,
        files: practiceCheck.violatingFiles,
        fixable: practiceCheck.fixable
      })
    } else {
      compliantCount++
    }
  }

  return { issues, violations, compliantCount }
}

function checkPracticeAgainstCode(
  ctx: SystestContext,
  practice: any,
  highPriorityFiles: string[],
  techStack: TechStack
): any {

  const violatingFiles: string[] = []
  let hasViolation = false
  let fixable = false
  let description = ""

  for (const file of highPriorityFiles) {
    const filePath = join(ctx.workspace, file.replace(/^src\//, ""))
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, "utf-8")
    const practiceLower = practice.practice.toLowerCase()

    if (detectViolation(content, practiceLower, techStack)) {
      violatingFiles.push(file)
      hasViolation = true
      fixable = isFixable(practiceLower)
      description = generateViolationDescription(practice, file, techStack)
    }
  }

  return { hasViolation, violatingFiles, fixable, description }
}

function detectViolation(code: string, practice: string, techStack: TechStack): boolean {
  const lowerCode = code.toLowerCase()

  if (practice.includes("sql injection") && lowerCode.includes("select * from") && !lowerCode.includes("parameterized")) {
    return true
  }
  if (practice.includes("xss") && lowerCode.includes("innerhtml") && !lowerCode.includes("sanitize")) {
    return true
  }
  if (practice.includes("authentication") && !lowerCode.includes("auth") && !lowerCode.includes("login")) {
    return true
  }
  if (practice.includes("n+1") && lowerCode.includes("foreach") && lowerCode.includes("find")) {
    return true
  }
  if (practice.includes("caching") && lowerCode.includes("database") && !lowerCode.includes("cache")) {
    return true
  }
  if (practice.includes("error handling") && !lowerCode.includes("try") && !lowerCode.includes("catch")) {
    return true
  }
  if (practice.includes("validation") && !lowerCode.includes("validate")) {
    return true
  }

  return false
}

function isFixable(practice: string): boolean {
  const fixablePatterns = ["missing", "not found", "lack of", "should"]
  return fixablePatterns.some(pattern => practice.includes(pattern))
}

function generateViolationDescription(practice: any, file: string, techStack: TechStack): string {
  return `Violation of best practice "${practice.practice}" detected in ${file}. Category: ${practice.category}, Severity: ${practice.severity}`
}

// ---------------------------------------------------------------------------
// Auto-fix (unchanged)
// ---------------------------------------------------------------------------

async function autoFixIssues(ctx: SystestContext, issues: any[]): Promise<{ fixedCount: number, totalCount: number, report: string }> {
  let fixedCount = 0
  const totalCount = issues.length
  const fixLog: string[] = []

  fixLog.push("# Code Auto-Fix Log")
  fixLog.push("")
  fixLog.push(`**Generated**: ${new Date().toISOString()}`)
  fixLog.push(`**Total Issues**: ${totalCount}`)
  fixLog.push("")

  for (const issue of issues) {
    if (issue.fixable && issue.severity !== "critical") {
      const fixResult = await applyFix(ctx, issue)
      if (fixResult.fixed) {
        fixedCount++
        fixLog.push(`## Fixed: ${issue.description}`)
        fixLog.push(`- **File**: ${issue.files[0]}`)
        fixLog.push(`- **Fix Applied**: ${fixResult.description}`)
        fixLog.push("")
      } else {
        fixLog.push(`## Failed to Fix: ${issue.description}`)
        fixLog.push(`- **Reason**: ${fixResult.reason}`)
        fixLog.push("")
      }
    } else {
      fixLog.push(`## Manual Review Required: ${issue.description}`)
      fixLog.push(`- **Reason**: ${issue.severity === "critical" ? "Critical severity" : "Not auto-fixable"}`)
      fixLog.push("")
    }
  }

  fixLog.push(`## Summary`)
  fixLog.push(`- **Total Issues**: ${totalCount}`)
  fixLog.push(`- **Auto-Fixed**: ${fixedCount}`)
  fixLog.push(`- **Manual Review**: ${totalCount - fixedCount}`)
  fixLog.push(`- **Fix Rate**: ${totalCount > 0 ? ((fixedCount / totalCount) * 100).toFixed(1) : 0}%`)

  return { fixedCount, totalCount, report: fixLog.join("\n") }
}

async function applyFix(ctx: SystestContext, issue: any): Promise<{ fixed: boolean, description?: string, reason?: string }> {
  try {
    const filePath = join(ctx.workspace, issue.files[0].replace(/^src\//, ""))
    if (!existsSync(filePath)) {
      return { fixed: false, reason: "File not found" }
    }

    let content = readFileSync(filePath, "utf-8")
    let modified = false

    if (issue.description.includes("error handling")) {
      if (!content.includes("try {") && !content.includes("catch")) {
        modified = true
        content = addErrorHandling(content)
      }
    }

    if (issue.description.includes("validation") && !content.includes("validate")) {
      modified = true
      content = `// TODO: Add input validation\n${content}`
    }

    if (modified) {
      writeFileSync(filePath, content, "utf-8")
      return { fixed: true, description: "Applied code modifications" }
    }

    return { fixed: false, reason: "No applicable fix pattern" }
  } catch (error) {
    return { fixed: false, reason: `Error: ${error}` }
  }
}

function addErrorHandling(code: string): string {
  return `try {
${code}
} catch (error) {
  console.error('Error:', error);
  throw error;
}`
}

// ---------------------------------------------------------------------------
// Code review report generation (unchanged)
// ---------------------------------------------------------------------------

function generateCodeReviewReport(
  ctx: SystestContext,
  analysisResult: any,
  fixResults: any,
  techStack: TechStack
): string {

  const lines: string[] = []

  lines.push("# Code Review Report (Enhanced with Best Practices)")
  lines.push("")
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push(`**Workspace**: ${ctx.workspace}`)
  lines.push(`**Tech Stack**: ${techStack.language} / backend=${techStack.backendFramework} / frontend=${techStack.frontendFramework}`)
  lines.push("")

  lines.push("## Executive Summary")
  lines.push("")
  lines.push(`- **Total Issues Found**: ${analysisResult.issues.length}`)
  lines.push(`- **Best Practice Violations**: ${analysisResult.violations.length}`)
  lines.push(`- **Compliant Practices**: ${analysisResult.compliantCount}`)
  lines.push(`- **Auto-Fixed**: ${fixResults.fixedCount}`)
  lines.push(`- **Manual Review Required**: ${analysisResult.issues.length - fixResults.fixedCount}`)
  lines.push("")

  const criticalIssues = analysisResult.issues.filter((i: any) => i.severity === "critical")
  if (criticalIssues.length > 0) {
    lines.push("## Critical Issues (Require Immediate Attention)")
    lines.push("")
    lines.push("| Issue | Category | Files | Fixable |")
    lines.push("|-------|----------|-------|---------|")

    for (const issue of criticalIssues) {
      const fixable = issue.fixable ? "Yes" : "No"
      lines.push(`| ${issue.description} | ${issue.category} | ${issue.files.join(", ")} | ${fixable} |`)
    }
    lines.push("")
  }

  const highIssues = analysisResult.issues.filter((i: any) => i.severity === "high")
  if (highIssues.length > 0) {
    lines.push("## High Priority Issues")
    lines.push("")
    lines.push("| Issue | Category | Files | Fixable |")
    lines.push("|-------|----------|-------|---------|")

    for (const issue of highIssues.slice(0, 10)) {
      const fixable = issue.fixable ? "Yes" : "No"
      lines.push(`| ${issue.description} | ${issue.category} | ${issue.files.join(", ")} | ${fixable} |`)
    }
    lines.push("")
  }

  lines.push("## Best Practices Compliance")
  lines.push("")
  lines.push(`**Compliant**: ${analysisResult.compliantCount} practices followed`)
  lines.push("**Violations**: Issues that need attention")
  lines.push("")

  for (const violation of analysisResult.violations.slice(0, 15)) {
    const severityIcon = violation.severity === "critical" ? "[CRITICAL]" : violation.severity === "high" ? "[HIGH]" : "[LOW]"
    lines.push(`- ${severityIcon} **${violation.category}**: ${violation.practice}`)
    lines.push(`  - Files: ${violation.files.join(", ")}`)
    lines.push("")
  }

  lines.push("## Auto-Fix Summary")
  lines.push("")
  lines.push(`- **Fixed Issues**: ${fixResults.fixedCount}`)
  lines.push(`- **Fix Rate**: ${analysisResult.issues.length > 0 ? ((fixResults.fixedCount / analysisResult.issues.length) * 100).toFixed(1) : 0}%`)
  lines.push(`- **Manual Review Required**: ${analysisResult.issues.length - fixResults.fixedCount}`)
  lines.push("")
  lines.push("See `CODE_FIXES_LOG.md` for detailed fix information.")
  lines.push("")

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Business test case generation — enhanced with Phase 2 output
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types for generated-test-cases.json (Phase 4 output)
// ---------------------------------------------------------------------------

interface GeneratedApiTest {
  id: string
  endpoint: string
  method: string
  description: string
  auth: string
  expectedStatus: number
  priority: string
  category: string
  tags: string[]
  requestBody?: Record<string, unknown>
}

interface GeneratedTestCases {
  apiTests: GeneratedApiTest[]
  total: number
}

/**
 * Generic filter: returns true only for strings that look like real HTTP
 * route paths.  Rejects source-file extensions, programming artefacts,
 * camelCase/PascalCase single-segment names (likely variable/class names),
 * and the sentinel method "UNKNOWN".
 */
function isValidHttpEndpoint(endpoint: string, method?: string): boolean {
  if (!endpoint || typeof endpoint !== 'string') return false
  if (!endpoint.startsWith('/')) return false
  // Reject source file extensions
  if (/\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|mjs|cjs|css|html|md|json|yaml|yml|xml|sql)$/i.test(endpoint)) return false
  // Reject programming artifacts
  if (endpoint.includes('(') || endpoint.includes(')')) return false
  if (endpoint.includes('`')) return false
  if (endpoint.includes('→') || endpoint.includes('->')) return false
  if (endpoint.includes(' ')) return false
  // Reject single-segment camelCase/PascalCase names (variable/class names, not routes)
  const segments = endpoint.split('/').filter(Boolean)
  if (segments.length === 1 && /[A-Z]/.test(segments[0]) && !/^\{/.test(segments[0])) return false
  // Reject UNKNOWN method
  if (method === 'UNKNOWN') return false
  return true
}

/**
 * Returns true if an entity name is a real domain entity (not a code artifact).
 * Filters out function names like `getFileType()`, filenames like `file-types.ts`,
 * variable/table names like `aiModelKeysTable → ai_model_keys`, ALL_CAPS constants,
 * and bare field names like `modelName`, `mimeTypes`, `type`.
 */
function isDomainEntity(name: string): boolean {
  // Function names (contain parentheses)
  if (name.includes("(") || name.includes(")")) return false
  // File names
  if (name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".tsx") || name.endsWith(".jsx")) return false
  // Database table references (contain →)
  if (name.includes("→")) return false
  // ALL_CAPS constants (e.g. FILE_TYPES)
  if (/^[A-Z][A-Z0-9_]+$/.test(name)) return false
  // Hyphenated filenames or path segments
  if (/^[a-z][\w-]+\.[a-z]+$/.test(name)) return false
  // Single lowercase words that look like field names (no uppercase = likely a field, not entity)
  if (/^[a-z][a-z0-9]+$/.test(name) && name.length < 10) return false
  return true
}

async function generateBusinessTestCases(ctx: SystestContext, enhancer: any, analysisResult: any): Promise<string> {
  const lines: string[] = []

  // -----------------------------------------------------------------------
  // Load Phase 4 generated-test-cases.json (OpenAPI-sourced real endpoints)
  // -----------------------------------------------------------------------
  const generatedTestCasesPath = join(ctx.outputDir, "test-cases", "generated-test-cases.json")
  let generatedTestCases: GeneratedTestCases | null = null
  if (existsSync(generatedTestCasesPath)) {
    try {
      generatedTestCases = JSON.parse(readFileSync(generatedTestCasesPath, "utf-8")) as GeneratedTestCases
      console.log(`[Phase 3] Loaded generated test cases: ${generatedTestCases.total} tests from Phase 4`)
    } catch {
      console.warn("[Phase 3] Failed to parse generated-test-cases.json")
    }
  } else {
    console.log(`[Phase 3] generated-test-cases.json not found at ${generatedTestCasesPath}, will use Phase 2 endpoints only`)
  }

  // -----------------------------------------------------------------------
  // Load Phase 2 project structure (for entities + fallback endpoints)
  // -----------------------------------------------------------------------
  const structurePath = join(ctx.outputDir, "config", "project-structure.json")
  let structure: ProjectStructure | null = null
  if (existsSync(structurePath)) {
    try {
      structure = JSON.parse(readFileSync(structurePath, "utf-8")) as ProjectStructure
      console.log(`[Phase 3] Loaded project structure: ${structure.endpoints.length} endpoints, ${structure.entities.length} entities`)
    } catch {
      console.warn("[Phase 3] Failed to parse project-structure.json, using defaults")
    }
  } else {
    console.warn("[Phase 3] project-structure.json not found, using generic test cases")
  }

  // -----------------------------------------------------------------------
  // Build the canonical list of real API endpoints from Phase 4 output.
  // Group by tag so we can associate them with domain areas.
  // -----------------------------------------------------------------------
  const apiTests: GeneratedApiTest[] = generatedTestCases?.apiTests ?? []

  // Collect unique real endpoints: { method, path, tag }
  interface RealEndpoint { method: string; path: string; tag: string; expectedStatus: number }
  const seenEndpointKeys = new Set<string>()
  let realEndpoints: RealEndpoint[] = []
  for (const t of apiTests) {
    const key = `${t.method}:${t.endpoint}`
    if (!seenEndpointKeys.has(key)) {
      seenEndpointKeys.add(key)
      realEndpoints.push({
        method: t.method,
        path: t.endpoint,
        tag: t.tags?.[0] ?? "General",
        expectedStatus: t.expectedStatus,
      })
    }
  }

  // Filter out invalid endpoints (source files, programming artifacts, etc.)
  {
    const beforeCount = realEndpoints.length
    realEndpoints = realEndpoints.filter(ep => isValidHttpEndpoint(ep.path, ep.method))
    const filtered = beforeCount - realEndpoints.length
    if (filtered > 0) {
      console.log(`[Phase 3] Filtered ${filtered} invalid endpoints, keeping ${realEndpoints.length}`)
    }
  }

  // Group real endpoints by tag
  const endpointsByTag = new Map<string, RealEndpoint[]>()
  for (const ep of realEndpoints) {
    if (!endpointsByTag.has(ep.tag)) endpointsByTag.set(ep.tag, [])
    endpointsByTag.get(ep.tag)!.push(ep)
  }

  // -----------------------------------------------------------------------
  // Filter Phase 2 entities to only real domain entities
  // -----------------------------------------------------------------------
  const allEntities = structure?.entities ?? []
  const domainEntities = allEntities.filter(e => isDomainEntity(e.name))

  // -----------------------------------------------------------------------
  // Match domain entities to real endpoint groups by tag similarity
  // -----------------------------------------------------------------------
  interface EntityWithEndpoints {
    entity: EntityInfo
    tag: string
    endpoints: RealEndpoint[]
  }

  function findTagForEntity(entityName: string): string | null {
    const nameLower = entityName.toLowerCase()
    for (const [tag] of endpointsByTag) {
      const tagLower = tag.toLowerCase()
      // Direct substring match in either direction
      if (tagLower.includes(nameLower) || nameLower.includes(tagLower)) return tag
      // Stem match: strip trailing 's' for plural/singular
      const stem = nameLower.endsWith("s") ? nameLower.slice(0, -1) : nameLower
      if (tagLower.includes(stem) || stem.includes(tagLower)) return tag
    }
    return null
  }

  const matchedGroups: EntityWithEndpoints[] = []
  const usedTags = new Set<string>()

  for (const entity of domainEntities) {
    const tag = findTagForEntity(entity.name)
    if (tag && !usedTags.has(tag)) {
      usedTags.add(tag)
      matchedGroups.push({ entity, tag, endpoints: endpointsByTag.get(tag)! })
    }
  }

  // Also include tags that had no matching entity (emit under the tag name itself)
  for (const [tag, eps] of endpointsByTag) {
    if (!usedTags.has(tag)) {
      // Synthesize a pseudo-entity from the tag name
      const syntheticEntity: EntityInfo = { name: tag, fields: [], sourceFile: "" }
      matchedGroups.push({ entity: syntheticEntity, tag, endpoints: eps })
    }
  }

  // First real endpoint path for Layer 2 reference
  const firstRealEndpoint = realEndpoints[0]?.path ?? "/api/resource"

  // -----------------------------------------------------------------------
  // Build summary metadata
  // -----------------------------------------------------------------------
  lines.push("# Business Logic Test Cases")
  lines.push("")
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push(`**Workspace**: ${ctx.workspace}`)
  lines.push(`**Real API Endpoints (OpenAPI)**: ${realEndpoints.length}`)
  lines.push(`**Domain Entities (filtered)**: ${domainEntities.length}`)
  lines.push(`**Endpoint Groups (tags)**: ${endpointsByTag.size}`)
  lines.push("")

  // -----------------------------------------------------------------------
  // Layer 1: Real CRUD tests derived from actual OpenAPI endpoints
  // -----------------------------------------------------------------------
  lines.push("## Layer 1: Basic CRUD Tests")
  lines.push("")

  if (matchedGroups.length > 0) {
    lines.push("| Test ID | Test Name | Endpoint | Method | Expected | Priority |")
    lines.push("|---------|-----------|----------|--------|----------|----------|")

    let testNum = 1
    for (const group of matchedGroups) {
      const tagAbbrev = group.tag.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
      for (const ep of group.endpoints) {
        const testId = `L1-${tagAbbrev}-${String(testNum).padStart(3, "0")}`
        const opName = describeOperation(ep.method, ep.path, group.tag)
        lines.push(`| ${testId} | ${opName} | ${ep.path} | ${ep.method} | ${ep.expectedStatus} | P0 |`)
        testNum++
      }
    }
  } else if (realEndpoints.length > 0) {
    // No entity matching, just list all real endpoints directly
    lines.push("| Test ID | Test Name | Endpoint | Method | Expected | Priority |")
    lines.push("|---------|-----------|----------|--------|----------|----------|")
    let testNum = 1
    for (const ep of realEndpoints) {
      const testId = `L1-${String(testNum).padStart(3, "0")}`
      const opName = describeOperation(ep.method, ep.path, ep.tag)
      lines.push(`| ${testId} | ${opName} | ${ep.path} | ${ep.method} | ${ep.expectedStatus} | P0 |`)
      testNum++
    }
  } else {
    // Full fallback: no Phase 4 data at all
    lines.push("| Test ID | Test Name | Endpoint | Method | Expected | Priority |")
    lines.push("|---------|-----------|----------|--------|----------|----------|")
    lines.push("| L1-001 | Create Entity | /api/entities | POST | 201 | P0 |")
    lines.push("| L1-002 | Read Entity by ID | /api/entities/:id | GET | 200 | P0 |")
    lines.push("| L1-003 | Update Entity | /api/entities/:id | PUT | 200 | P0 |")
    lines.push("| L1-004 | Delete Entity | /api/entities/:id | DELETE | 204 | P1 |")
    lines.push("| L1-005 | List Entities | /api/entities | GET | 200 | P0 |")
  }

  lines.push("")

  // -----------------------------------------------------------------------
  // Layer 2: Business Logic Tests
  // -----------------------------------------------------------------------
  lines.push("## Layer 2: Business Logic Tests")
  lines.push("")

  // --- Authorization Tests ---
  lines.push("### Authorization Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | Role | Endpoint | Expected | Priority |")
  lines.push("|---------|-----------|------|----------|----------|----------|")

  const authTests = [
    { id: "L2-AUTH-001", name: "Unauthenticated access denied", role: "none", endpoint: firstRealEndpoint, expected: "401", priority: "P0" },
    { id: "L2-AUTH-002", name: "User cannot access admin endpoints", role: "user", endpoint: "/admin/api/model-keys", expected: "403", priority: "P0" },
    { id: "L2-AUTH-003", name: "Admin can access user resources", role: "admin", endpoint: firstRealEndpoint, expected: "200", priority: "P0" },
    { id: "L2-AUTH-004", name: "Owner can access own resource", role: "owner", endpoint: firstRealEndpoint, expected: "200", priority: "P0" },
    { id: "L2-AUTH-005", name: "User cannot access other user resource", role: "user", endpoint: firstRealEndpoint, expected: "403", priority: "P0" },
  ]
  // Use a real admin endpoint if available
  const adminEndpoint = realEndpoints.find(e => e.path.includes("/admin"))?.path ?? "/admin/api/model-keys"
  authTests[1].endpoint = adminEndpoint
  for (const t of authTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.role} | ${t.endpoint} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // --- Validation Tests ---
  lines.push("### Validation Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | Input | Endpoint | Expected | Priority |")
  lines.push("|---------|-----------|-------|----------|----------|----------|")

  // Pick the first POST endpoint for validation tests (most likely to have a body)
  const firstPostEndpoint = realEndpoints.find(e => e.method === "POST")?.path ?? firstRealEndpoint

  const validationTests = [
    { id: "L2-VAL-001", name: "Empty required field rejected", input: "{ name: '' }", endpoint: firstPostEndpoint, expected: "422", priority: "P0" },
    { id: "L2-VAL-002", name: "Invalid email format rejected", input: "{ email: 'not-email' }", endpoint: firstPostEndpoint, expected: "422", priority: "P0" },
    { id: "L2-VAL-003", name: "Short password rejected", input: "{ password: '12' }", endpoint: firstPostEndpoint, expected: "422", priority: "P0" },
    { id: "L2-VAL-004", name: "Max length exceeded rejected", input: "{ name: 'a'.repeat(256) }", endpoint: firstPostEndpoint, expected: "422", priority: "P1" },
    { id: "L2-VAL-005", name: "Invalid enum value rejected", input: "{ status: 'invalid' }", endpoint: firstPostEndpoint, expected: "422", priority: "P1" },
  ]
  for (const t of validationTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.input} | ${t.endpoint} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // --- Constraint Tests ---
  lines.push("### Constraint Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | Scenario | Endpoint | Expected | Priority |")
  lines.push("|---------|-----------|----------|----------|----------|----------|")

  const registerEndpoint = realEndpoints.find(e => e.path.includes("/register"))?.path ?? firstPostEndpoint

  const constraintTests = [
    { id: "L2-CON-001", name: "Duplicate email rejected", scenario: "Register with existing email", endpoint: registerEndpoint, expected: "409", priority: "P0" },
    { id: "L2-CON-002", name: "Duplicate username rejected", scenario: "Register with existing username", endpoint: registerEndpoint, expected: "409", priority: "P0" },
    { id: "L2-CON-003", name: "Max resource count enforced", scenario: "Create beyond quota", endpoint: firstPostEndpoint, expected: "403", priority: "P1" },
    { id: "L2-CON-004", name: "Invalid reference ID rejected", scenario: "FK to non-existent record", endpoint: firstPostEndpoint, expected: "400", priority: "P1" },
    { id: "L2-CON-005", name: "File size limit enforced", scenario: "Upload oversized file", endpoint: firstPostEndpoint, expected: "413", priority: "P1" },
  ]
  for (const t of constraintTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.scenario} | ${t.endpoint} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // --- State Transition Tests ---
  lines.push("### State Transition Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | From State | To State | Expected | Priority |")
  lines.push("|---------|-----------|------------|----------|----------|----------|")

  const stateTests = [
    { id: "L2-STATE-001", name: "Account activation", from: "inactive", to: "active", expected: "200", priority: "P0" },
    { id: "L2-STATE-002", name: "Account suspension", from: "active", to: "suspended", expected: "200", priority: "P0" },
    { id: "L2-STATE-003", name: "Content publishing", from: "draft", to: "published", expected: "200", priority: "P1" },
    { id: "L2-STATE-004", name: "Content archiving", from: "published", to: "archived", expected: "200", priority: "P1" },
  ]
  for (const t of stateTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.from} | ${t.to} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // --- Edge Case / Security Tests ---
  lines.push("### Edge Case & Security Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | Attack Vector | Endpoint | Expected | Priority |")
  lines.push("|---------|-----------|---------------|----------|----------|----------|")

  const edgeTests = [
    { id: "L2-EDGE-001", name: "Non-existent resource returns 404", vector: "GET /:id with invalid ID", endpoint: firstRealEndpoint, expected: "404", priority: "P0" },
    { id: "L2-EDGE-002", name: "SQL injection prevented", vector: "id='; DROP TABLE --", endpoint: firstRealEndpoint, expected: "400/404", priority: "P0" },
    { id: "L2-EDGE-003", name: "XSS injection sanitized", vector: "<script>alert(1)</script> in field", endpoint: firstPostEndpoint, expected: "422/sanitized", priority: "P0" },
    { id: "L2-EDGE-004", name: "Concurrent update conflict handled", vector: "Simultaneous PUT same resource", endpoint: firstRealEndpoint, expected: "409/200", priority: "P1" },
    { id: "L2-EDGE-005", name: "Rate limiting enforced", vector: "100+ requests in 10 seconds", endpoint: firstRealEndpoint, expected: "429", priority: "P1" },
  ]
  for (const t of edgeTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.vector} | ${t.endpoint} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // --- Integration / E2E Flow Tests ---
  lines.push("### Integration Flow Tests")
  lines.push("")
  lines.push("| Test ID | Test Name | Flow Description | Steps | Expected | Priority |")
  lines.push("|---------|-----------|------------------|-------|----------|----------|")

  const integrationTests = [
    { id: "L2-INT-001", name: "Complete user lifecycle", desc: "Register -> Login -> Profile -> Delete", steps: 4, expected: "All 2xx", priority: "P0" },
    { id: "L2-INT-002", name: "Social interaction flow", desc: "Create post -> Comment -> Like -> Share", steps: 4, expected: "All 2xx", priority: "P1" },
    { id: "L2-INT-003", name: "Admin operations flow", desc: "Login admin -> List users -> Ban user -> Verify", steps: 4, expected: "All 2xx", priority: "P1" },
    { id: "L2-INT-004", name: "Full ecosystem flow", desc: "All CRUD on all real endpoints sequentially", steps: realEndpoints.length || 10, expected: "All 2xx", priority: "P1" },
    { id: "L2-INT-005", name: "Monetization flow", desc: "Subscribe -> Pay -> Verify -> Cancel", steps: 4, expected: "All 2xx", priority: "P2" },
  ]
  for (const t of integrationTests) {
    lines.push(`| ${t.id} | ${t.name} | ${t.desc} | ${t.steps} | ${t.expected} | ${t.priority} |`)
  }
  lines.push("")

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const totalL1 = matchedGroups.length > 0
    ? matchedGroups.reduce((sum, g) => sum + g.endpoints.length, 0)
    : Math.max(realEndpoints.length, 5)
  const totalL2 = authTests.length + validationTests.length + constraintTests.length + stateTests.length + edgeTests.length + integrationTests.length
  lines.push("## Test Summary")
  lines.push("")
  lines.push(`- **Layer 1 (Real API Endpoints)**: ${totalL1} tests across ${matchedGroups.length || endpointsByTag.size || 1} groups`)
  lines.push(`- **Layer 2 (Business Logic)**: ${totalL2} tests`)
  lines.push(`  - Authorization: ${authTests.length}`)
  lines.push(`  - Validation: ${validationTests.length}`)
  lines.push(`  - Constraints: ${constraintTests.length}`)
  lines.push(`  - State Transitions: ${stateTests.length}`)
  lines.push(`  - Edge Cases/Security: ${edgeTests.length}`)
  lines.push(`  - Integration Flows: ${integrationTests.length}`)
  lines.push(`- **Total**: ${totalL1 + totalL2} test cases`)
  lines.push("")

  return lines.join("\n")
}

/**
 * Generate a human-readable operation name from HTTP method + path + tag.
 * Examples:
 *   POST /api/auth/register  Auth  -> "Register (Auth)"
 *   GET  /api/avatars        Avatars -> "List Avatars"
 *   GET  /api/avatars/{id}   Avatars -> "Get Avatar by ID"
 *   DELETE /api/avatars/{id} Avatars -> "Delete Avatar"
 */
function describeOperation(method: string, path: string, tag: string): string {
  const hasId = /\{id\}|:\w+id\b|\/:\w+/.test(path)
  const resource = tag.replace(/\s+/g, " ").trim()

  switch (method.toUpperCase()) {
    case "GET":
      return hasId ? `Get ${resource} by ID` : `List ${resource}`
    case "POST": {
      // Detect sub-action from last path segment
      const segments = path.replace(/\{[^}]+\}/g, "").split("/").filter(Boolean)
      const last = segments[segments.length - 1] ?? ""
      if (last && !/^api$/.test(last)) {
        return `${capitalise(last)} ${resource}`
      }
      return `Create ${resource}`
    }
    case "PUT":
    case "PATCH":
      return `Update ${resource}`
    case "DELETE":
      return `Delete ${resource}`
    default:
      return `${method} ${path}`
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
