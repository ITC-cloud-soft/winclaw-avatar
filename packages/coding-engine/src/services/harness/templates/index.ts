/**
 * Template registry for the Harness Engineering scaffolding system.
 *
 * Each template is a map of relative paths (within harness/) to file content.
 * Templates are keyed by HarnessTemplateName as defined in types.ts.
 */

import type { HarnessTemplateName } from '../types.js'
import { minimalTemplate } from './minimal/index.js'
import { javaSpringTemplate } from './javaSpring/index.js'
import { nodeFastapiTemplate } from './nodeFastapi/index.js'
import { pythonDjangoTemplate } from './pythonDjango/index.js'
import { goMicroserviceTemplate } from './goMicroservice/index.js'
import { reactNextjsTemplate } from './reactNextjs/index.js'
import { cobolModernizationTemplate } from './cobolModernization/index.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A template is a map from relative path (within harness/) to file content.
 * Every path uses forward slashes regardless of host OS.
 */
export type Template = Record<string, string>

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * All registered templates.
 * Key is the HarnessTemplateName; value is the file map for that template.
 */
export const TEMPLATES: Record<HarnessTemplateName, Template> = {
  minimal: minimalTemplate,
  'java-spring-enterprise': javaSpringTemplate,
  'node-fastapi': nodeFastapiTemplate,
  'python-django': pythonDjangoTemplate,
  'go-microservice': goMicroserviceTemplate,
  'react-nextjs-frontend': reactNextjsTemplate,
  'cobol-modernization': cobolModernizationTemplate,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the file map for a named template.
 * Returns undefined if the name is not registered — callers should validate
 * using the HarnessTemplateName union type before calling this.
 */
export function getTemplate(name: HarnessTemplateName): Template {
  return TEMPLATES[name]
}

/**
 * List all available templates with human-readable descriptions.
 */
export function listTemplates(): Array<{ name: HarnessTemplateName; description: string }> {
  return [
    {
      name: 'minimal',
      description: 'Minimal harness: architecture + coding rules, review skill, and phase/gate workflow',
    },
    {
      name: 'java-spring-enterprise',
      description: 'Java / Spring Boot enterprise: 5-layer DDD, @Service/@Repository conventions, JPA rules',
    },
    {
      name: 'node-fastapi',
      description: 'Node.js TypeScript + Python FastAPI side-car: ESM patterns, inter-service client rules',
    },
    {
      name: 'python-django',
      description: 'Python / Django REST Framework: app-layer architecture, Celery worker rules, migration safety',
    },
    {
      name: 'go-microservice',
      description: 'Go microservice: interface-based DI, errgroup concurrency, table-driven tests',
    },
    {
      name: 'react-nextjs-frontend',
      description: 'React / Next.js App Router: Server Components first, Server Actions, accessibility rules',
    },
    {
      name: 'cobol-modernization',
      description: 'COBOL modernization: strangler-fig pattern, dual-run harness, decimal-precision rules',
    },
  ]
}
