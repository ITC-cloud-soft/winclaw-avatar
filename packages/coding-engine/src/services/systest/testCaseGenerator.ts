/**
 * Test Case Generator
 * 
 * Generates test cases from the semantic knowledge graph.
 * Provides both API and UI test cases based on route, service, and schema information.
 */

import type { GraphEngine } from '../../graphify/engine.js'

export interface ApiTestCase {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description: string
  fields: ApiTestField[]
  testData: Record<string, any>
  expectedStatus: number
}

export interface ApiTestField {
  name: string
  type: string
  required: boolean
  constraints?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
}

export interface UiTestPlan {
  layer1: {
    navigationTests: UiNavigationTest[]
    formTests: UiFormTest[]
  }
  layer2: {
    scenarios: UiScenarioTest[]
  }
}

export interface UiNavigationTest {
  url: string
  label: string
  expectations: string[]
}

export interface UiFormTest {
  apiEndpoint: string
  fields: ApiTestField[]
  formSelector?: string
}

export interface UiScenarioTest {
  name: string
  description: string
  steps: UiTestStep[]
}

export interface UiTestStep {
  action: 'navigate' | 'click' | 'type' | 'submit' | 'wait' | 'verify'
  target?: string
  value?: string
  expectation?: string
}

/**
 * Generate API test cases from the semantic graph.
 */
export async function generateApiTestCases(engine: any): Promise<ApiTestCase[]> {
  const testCases: ApiTestCase[] = []
  
  if (!engine || !engine.isReady?.()) {
    console.warn('[TestCaseGenerator] Graph not available, returning empty test cases')
    return testCases
  }
  
  try {
    // 1. Get all route nodes from the graph
    const routesQuery = engine.query('route router endpoint handler', 'bfs', 100)
    const routes = routesQuery.nodes || []
    
    // 2. For each route, trace to service and schema
    for (const route of routes) {
      const routeId = route.id || route.label
      
      // Get neighbors to find connected service and schema
      let neighbors
      try {
        neighbors = engine.getNeighbors(route.label, 2)
      } catch {
        continue
      }
      
      // Find HTTP method and URL path
      const method = (route.httpMethod || route.method || 'GET').toUpperCase()
      let urlPath = route.urlPath || route.path || route.label || '/'
      
      // Find connected schema
      const schema = neighbors.successors?.find((n: any) => 
        n.kind === 'schema' || n.kind === 'model' || n.kind === 'entity'
      )
      
      // Extract fields from schema
      let fields: ApiTestField[] = []
      if (schema) {
        try {
          const schemaNeighbors = engine.getNeighbors(schema.label, 1)
          fields = (schemaNeighbors.successors || [])
            .filter((n: any) => n.kind === 'field' || n.kind === 'column' || n.kind === 'property')
            .map((n: any) => ({
              name: n.label,
              type: n.fieldType || n.type || 'string',
              required: !n.optional && !n.nullable,
              constraints: n.constraints || {},
            }))
        } catch {
          // If we can't get schema details, use empty fields
        }
      }
      
      // Generate test data
      const testData = generateTestData(fields)
      
      // Determine expected status
      const expectedStatus = 200
      
      testCases.push({
        endpoint: urlPath,
        method: method as any,
        description: 'Test ' + method + ' ' + urlPath,
        fields,
        testData,
        expectedStatus,
      })
      
      // Generate CRUD variations for each route
      if (method === 'GET') {
        // Test list and single item - remove trailing slashes
        const cleanPath = urlPath.replace(/\/+$/, '')
        testCases.push({
          endpoint: cleanPath + '/:id',
          method: 'GET',
          description: 'Test GET single item ' + urlPath + '/:id',
          fields,
          testData: { id: '1' },
          expectedStatus: 200,
        })
      }
    }
    
    return testCases
  } catch (error) {
    console.error('[TestCaseGenerator] Error generating API test cases:', error)
    return []
  }
}

/**
 * Generate UI test plan from the semantic graph.
 */
export async function generateUiTestPlan(engine: any): Promise<UiTestPlan> {
  const plan: UiTestPlan = {
    layer1: {
      navigationTests: [],
      formTests: [],
    },
    layer2: {
      scenarios: [],
    },
  }
  
  if (!engine || !engine.isReady?.()) {
    return plan
  }
  
  try {
    // 1. Get all routes, separate API and page routes
    const routesQuery = engine.query('route router endpoint handler page', 'bfs', 100)
    const routes = routesQuery.nodes || []
    
    const apiRoutes = routes.filter((r: any) => {
      const path = r.urlPath || r.path || ''
      return path.startsWith('/api')
    })
    
    const pageRoutes = routes.filter((r: any) => {
      const path = r.urlPath || r.path || ''
      return !path.startsWith('/api')
    })
    
    // 2. Generate Layer 1 navigation tests
    for (const page of pageRoutes) {
      const urlPath = page.urlPath || page.path || page.label || '/'
      plan.layer1.navigationTests.push({
        url: urlPath,
        label: page.label || urlPath,
        expectations: ['page loads', 'no console errors', 'title exists'],
      })
    }
    
    // 3. Generate Layer 1 form tests (from POST/PUT endpoints)
    for (const apiRoute of apiRoutes) {
      const method = (apiRoute.httpMethod || apiRoute.method || 'GET').toUpperCase()
      if (method !== 'POST' && method !== 'PUT') continue
      
      // Get schema fields
      let fields: ApiTestField[] = []
      try {
        const neighbors = engine.getNeighbors(apiRoute.label, 2)
        const schema = neighbors.successors?.find((n: any) => 
          n.kind === 'schema' || n.kind === 'model' || n.kind === 'entity'
        )
        
        if (schema) {
          const schemaNeighbors = engine.getNeighbors(schema.label, 1)
          fields = (schemaNeighbors.successors || [])
            .filter((n: any) => n.kind === 'field' || n.kind === 'column')
            .map((n: any) => ({
              name: n.label,
              type: n.fieldType || n.type || 'string',
              required: !n.optional && !n.nullable,
            }))
        }
      } catch {
        // Use empty fields
      }
      
      plan.layer1.formTests.push({
        apiEndpoint: apiRoute.urlPath || apiRoute.path || '/',
        fields,
      })
    }
    
    // 4. Generate Layer 2 scenario tests
    plan.layer2.scenarios = inferBusinessScenarios(engine, routes)
    
    return plan
  } catch (error) {
    console.error('[TestCaseGenerator] Error generating UI test plan:', error)
    return plan
  }
}

/**
 * Infer business scenarios from the graph structure.
 */
function inferBusinessScenarios(engine: any, routes: any[]): UiScenarioTest[] {
  const scenarios: UiScenarioTest[] = []
  
  // Common business scenarios based on route patterns
  const hasAuth = routes.some((r: any) => {
    const path = r.urlPath || r.path || ''
    return path.includes('login') || path.includes('auth')
  })
  
  const hasCrud = routes.some((r: any) => {
    const method = r.httpMethod || r.method || ''
    return method === 'POST' || method === 'PUT' || method === 'DELETE'
  })
  
  // Auth scenario
  if (hasAuth) {
    scenarios.push({
      name: 'User Authentication Flow',
      description: 'Complete login-logout flow',
      steps: [
        { action: 'navigate', target: '/login' },
        { action: 'type', target: 'email input', value: 'test@example.com' },
        { action: 'type', target: 'password input', value: 'password123' },
        { action: 'click', target: 'submit button' },
        { action: 'verify', expectation: 'redirected to dashboard' },
        { action: 'click', target: 'logout button' },
        { action: 'verify', expectation: 'redirected to login page' },
      ],
    })
  }
  
  // CRUD scenario
  if (hasCrud) {
    scenarios.push({
      name: 'CRUD Operations Flow',
      description: 'Create, Read, Update, Delete operations',
      steps: [
        { action: 'navigate', target: '/' },
        { action: 'click', target: 'create new button' },
        { action: 'type', target: 'name input', value: 'Test Item' },
        { action: 'submit', target: 'form' },
        { action: 'verify', expectation: 'item created successfully' },
        { action: 'navigate', target: '/' },
        { action: 'verify', expectation: 'new item visible in list' },
        { action: 'click', target: 'edit button' },
        { action: 'type', target: 'name input', value: 'Updated Item' },
        { action: 'submit', target: 'form' },
        { action: 'verify', expectation: 'item updated successfully' },
        { action: 'click', target: 'delete button' },
        { action: 'verify', expectation: 'item deleted successfully' },
      ],
    })
  }
  
  return scenarios
}

/**
 * Generate test data based on field definitions.
 */
function generateTestData(fields: ApiTestField[]): Record<string, any> {
  const data: Record<string, any> = {}
  
  for (const field of fields) {
    if (!field.required) continue
    
    switch (field.type.toLowerCase()) {
      case 'string':
      case 'text':
      case 'varchar':
        data[field.name] = 'test_' + field.name + '_' + Date.now()
        break
      case 'number':
      case 'integer':
      case 'int':
        const min = field.constraints?.min ?? 1
        const max = field.constraints?.max ?? 100
        data[field.name] = Math.floor(Math.random() * (max - min + 1)) + min
        break
      case 'boolean':
      case 'bool':
        data[field.name] = true
        break
      case 'email':
        data[field.name] = 'test_' + Date.now() + '@example.com'
        break
      case 'date':
      case 'datetime':
        data[field.name] = new Date().toISOString()
        break
      case 'array':
      case 'json':
        data[field.name] = []
        break
      default:
        data[field.name] = 'test_value_' + Date.now()
    }
  }
  
  return data
}
