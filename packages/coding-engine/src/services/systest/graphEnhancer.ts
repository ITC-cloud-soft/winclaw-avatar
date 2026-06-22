/**
 * Graphify integration adapter for systest.
 * 
 * Provides enhanced testing capabilities using the knowledge graph,
 * with graceful degradation when the graph is unavailable.
 */

import type { GraphEngine } from '../graphify/engine.js'
import { getEngine, getEngineForWorkspace } from '../graphify/engineLoader.js'

export interface ProjectStructure {
  stats: {
    nodeCount: number
    edgeCount: number
    communityCount: number
    kindBreakdown: Record<string, number>
  }
  communities: Array<{
    id: number
    label: string
    size: number
    cohesion: number
    godNodes: Array<{ label: string; degree: number }>
    anchorDir: string
  }>
  godNodes: Array<{
    label: string
    degree: number
    sourceFile: string
  }>
  models: Array<{
    id: string
    label: string
    sourceFile: string
    kind?: string
  }>
  routes: Array<{
    id: string
    label: string
    sourceFile: string
    httpMethod?: string
    urlPath?: string
  }>
  services: Array<{
    id: string
    label: string
    sourceFile: string
  }>
  schemas: Array<{
    id: string
    label: string
    sourceFile: string
    fields: SchemaField[]
  }>
  routeToServiceMap: Map<string, string[]>
  serviceToModelMap: Map<string, string[]>
}

export interface SchemaField {
  name: string
  type: string
  optional?: boolean
  nullable?: boolean
  constraints?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    enum?: string[]
  }
}

export interface ReviewPriority {
  nodeId: string
  label: string
  sourceFile: string
  priority: 'high' | 'medium' | 'low'
  reason: string
  degree: number
}

export interface EntityLocation {
  entityName: string
  nodeId: string
  sourceFile: string
  kind: string
  dependencies: string[]
  dependents: string[]
  fields: SchemaField[]
}

export interface CallChain {
  path: Array<{
    nodeId: string
    label: string
    sourceFile: string
    relation: string
  }>
  hops: number
  complete: boolean
}

/**
 * GraphEnhancer provides graph-augmented testing capabilities.
 */
export class GraphEnhancer {
  private engine: GraphEngine | null = null
  private available: boolean = false
  private workspace: string | null = null

  constructor(workspace?: string) {
    if (workspace) {
      this.workspace = workspace
    }
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      this.engine = this.workspace ? await getEngineForWorkspace(this.workspace) : await getEngine()
      this.available = this.engine !== null && this.engine.isReady?.()
    } catch {
      this.available = false
    }
  }

  /**
   * Check if the graph is available.
   */
  isAvailable(): boolean {
    return this.available && this.engine !== null
  }

  /**
   * Set the workspace for the graph enhancer.
   * This allows systest to work with graphs from different workspaces.
   */
  setWorkspace(workspace: string): void {
    this.workspace = workspace
  }

  /**
   * Get the current workspace.
   */
  getWorkspace(): string | null {
    return this.workspace
  }

  /**
   * Get the underlying GraphEngine (returns null if unavailable).
   */
  getEngine(): GraphEngine | null {
    return this.engine
  }

  /**
   * Get project structure information for Phase 2.
   */
  async getProjectStructure(): Promise<ProjectStructure | null> {
    if (!this.isAvailable() || !this.engine) {
      return null
    }

    try {
      const stats = this.engine.getStats()
      const communities = this.engine.getCommunities(15)
      const godNodes = this.engine.getGodNodes(15)
      
      // Query for models/entities
      const modelQuery = this.engine.query('model entity schema drizzle table type class', 'bfs', 50)
      const models = modelQuery.nodes.map(n => ({
        id: n.id,
        label: n.label,
        sourceFile: n.source_file,
        kind: (n as any).kind,
      }))
      
      // Query for routes/endpoints
      const routeQuery = this.engine.query('router route endpoint handler controller get post put delete', 'bfs', 30)
      const routes = routeQuery.nodes.map(n => ({
        id: n.id,
        label: n.label,
        sourceFile: n.source_file,
        httpMethod: (n as any).httpMethod,
        urlPath: (n as any).urlPath,
      }))
      
      // Query for services
      const serviceQuery = this.engine.query('service', 'bfs', 30)
      const services = serviceQuery.nodes.map(n => ({
        id: n.id,
        label: n.label,
        sourceFile: n.source_file,
      }))
      
      // Query for schemas with fields (NEW)
      const schemas = await this.extractSchemasWithFields()
      
      return {
        stats,
        communities: communities.map(c => ({
          id: c.id,
          label: c.label,
          size: c.size,
          cohesion: c.cohesion,
          godNodes: c.godNodes,
          anchorDir: c.anchorDir,
        })),
        godNodes,
        models,
        routes,
        services,
        schemas,
        routeToServiceMap: await this.buildRouteServiceMap(routes, services),
        serviceToModelMap: await this.buildServiceModelMap(services, models),
      }
    } catch (error) {
      console.warn('[GraphEnhancer] Error getting project structure:', error)
      return null
    }
  }

  /**
   * Extract schemas with their fields - NEW ENHANCED METHOD.
   */
  async extractSchemasWithFields(): Promise<Array<{
    id: string
    label: string
    sourceFile: string
    fields: SchemaField[]
  }>> {
    if (!this.engine) {
      return []
    }

    try {
      const schemas: Array<{
        id: string
        label: string
        sourceFile: string
        fields: SchemaField[]
      }> = []
      
      // Query for schema/model/table nodes
      const schemaQuery = this.engine.query('schema model table drizzle prisma entity', 'bfs', 50)
      const schemaNodes = schemaQuery.nodes || []
      
      for (const schemaNode of schemaNodes) {
        try {
          // Get neighbors to find fields
          const neighbors = this.engine.getNeighbors(schemaNode.label, 2)
          
          // Find field nodes
          const fieldNodes = neighbors.successors?.filter((n: any) =>
            n.kind === 'field' || n.kind === 'column' || n.kind === 'property'
          ) || []
          
          const fields: SchemaField[] = fieldNodes.map((field: any) => ({
            name: field.label,
            type: field.fieldType || field.type || 'unknown',
            optional: field.optional || field.nullable || false,
            nullable: field.nullable || false,
            constraints: field.constraints || {},
          }))
          
          schemas.push({
            id: schemaNode.id,
            label: schemaNode.label,
            sourceFile: schemaNode.source_file || '',
            fields,
          })
        } catch {
          // If we can't get fields for this schema, add it without fields
          schemas.push({
            id: schemaNode.id,
            label: schemaNode.label,
            sourceFile: schemaNode.source_file || '',
            fields: [],
          })
        }
      }
      
      return schemas
    } catch (error) {
      console.warn('[GraphEnhancer] Error extracting schemas:', error)
      return []
    }
  }

  /**
   * Get review priorities for Phase 3.
   */
  async getReviewPriorities(): Promise<ReviewPriority[]> {
    if (!this.isAvailable() || !this.engine) {
      return []
    }

    try {
      const godNodes = this.engine.getGodNodes(20)
      const priorities: ReviewPriority[] = []
      
      for (const god of godNodes) {
        let priority: 'high' | 'medium' | 'low' = 'medium'
        let reason = 'High connectivity node'
        
        if (god.degree > 50) {
          priority = 'high'
          reason = 'Very high connectivity - changes have wide impact'
        } else if (god.degree < 10) {
          priority = 'low'
          reason = 'Moderate connectivity'
        }
        
        priorities.push({
          nodeId: god.label,
          label: god.label,
          sourceFile: god.source_file,
          priority,
          reason,
          degree: god.degree,
        })
      }
      
      return priorities
    } catch {
      return []
    }
  }

  /**
   * Locate entities for Phase 5A test data generation.
   */
  async locateEntities(): Promise<EntityLocation[]> {
    if (!this.isAvailable() || !this.engine) {
      return []
    }

    try {
      const query = this.engine.query('model entity schema drizzle table', 'bfs', 50)
      const entities: EntityLocation[] = []
      
      for (const node of query.nodes) {
        try {
          const neighbors = this.engine!.getNeighbors(node.label)
          const dependencies: string[] = []
          const dependents: string[] = []
          
          for (const succ of neighbors.successors) {
            dependencies.push(succ.label)
          }
          
          for (const pred of neighbors.predecessors) {
            dependents.push(pred.label)
          }
          
          // Extract fields for this entity (NEW)
          const fieldNeighbors = this.engine!.getNeighbors(node.label, 2)
          const fields: SchemaField[] = fieldNeighbors.successors
            ?.filter((n: any) => n.kind === 'field' || n.kind === 'column')
            .map((n: any) => ({
              name: n.label,
              type: n.fieldType || n.type || 'unknown',
              optional: n.optional || n.nullable || false,
              nullable: n.nullable || false,
              constraints: n.constraints || {},
            })) || []
          
          entities.push({
            entityName: node.label,
            nodeId: node.id,
            sourceFile: node.source_file,
            kind: (node as any).kind || 'unknown',
            dependencies,
            dependents,
            fields,
          })
        } catch {
          entities.push({
            entityName: node.label,
            nodeId: node.id,
            sourceFile: node.source_file,
            kind: (node as any).kind || 'unknown',
            dependencies: [],
            dependents: [],
            fields: [],
          })
        }
      }
      
      return entities
    } catch {
      return []
    }
  }

  /**
   * Trace call chain for Phase 5B failure analysis.
   */
  async traceCallChain(from: string, to: string): Promise<CallChain | null> {
    if (!this.isAvailable() || !this.engine) {
      return null
    }

    try {
      const result = this.engine.shortestPath(from, to)
      
      if (!result.found) {
        return {
          path: [],
          hops: 0,
          complete: false,
        }
      }
      
      return {
        path: (result.path || []).map((p, i) => ({
          nodeId: p.id,
          label: p.label,
          sourceFile: p.source_file,
          relation: (result.pathEdges?.[i]?.relation) || 'related',
        })),
        hops: result.hops || 0,
        complete: true,
      }
    } catch {
      return null
    }
  }

  /**
   * Build a map from routes to the services they call.
   */
  private async buildRouteServiceMap(
    routes: Array<{ id: string; label: string }>,
    services: Array<{ id: string; label: string }>
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    
    if (!this.engine) return map
    
    try {
      for (const route of routes) {
        const neighbors = this.engine.getNeighbors(route.label)
        const connectedServices: string[] = []
        
        for (const succ of neighbors.successors) {
          const isService = services.some(s => s.label === succ.label)
          if (isService) {
            connectedServices.push(succ.label)
          }
        }
        
        map.set(route.label, connectedServices)
      }
    } catch {
      // Return empty map on error
    }
    
    return map
  }

  /**
   * Build a map from services to the models they use.
   */
  private async buildServiceModelMap(
    services: Array<{ id: string; label: string }>,
    models: Array<{ id: string; label: string }>
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    
    if (!this.engine) return map
    
    try {
      for (const service of services) {
        const neighbors = this.engine.getNeighbors(service.label)
        const connectedModels: string[] = []
        
        for (const succ of neighbors.successors) {
          const isModel = models.some(m => m.label === succ.label)
          if (isModel) {
            connectedModels.push(succ.label)
          }
        }
        
        map.set(service.label, connectedModels)
      }
    } catch {
      // Return empty map on error
    }
    
    return map
  }

  /**
   * Get community-based coverage report.
   */
  async getCoverageReport(): Promise<Array<{
    communityId: number
    communityName: string
    testedNodes: number
    totalNodes: number
    coverage: number
  }>> {
    if (!this.isAvailable() || !this.engine) {
      return []
    }

    try {
      const communities = this.engine.getCommunities()
      
      return communities.map(c => ({
        communityId: c.id,
        communityName: c.label,
        testedNodes: 0, // Will be populated during test execution
        totalNodes: c.size,
        coverage: 0,
      }))
    } catch {
      return []
    }
  }

  /**
   * Get schema fields for a specific entity - NEW HELPER METHOD.
   */
  async getSchemaFields(entityName: string): Promise<SchemaField[]> {
    if (!this.isAvailable() || !this.engine) {
      return []
    }

    try {
      const neighbors = this.engine.getNeighbors(entityName, 2)
      
      return neighbors.successors
        ?.filter((n: any) => n.kind === 'field' || n.kind === 'column' || n.kind === 'property')
        .map((n: any) => ({
          name: n.label,
          type: n.fieldType || n.type || 'unknown',
          optional: n.optional || n.nullable || false,
          nullable: n.nullable || false,
          constraints: n.constraints || {},
        })) || []
    } catch {
      return []
    }
  }

  /**
   * Get design documents from the knowledge graph.
   */
  async getDesignDocuments(): Promise<Array<{
    id: string
    label: string
    sourceFile: string
    sections: Array<{ title: string; lineNo: number }>
    apiSpecs: Array<{ method: string; path: string }>
    entitySpecs: Array<{ name: string; fields: Array<{ name: string; type: string }> }>
    uiSpecs: Array<{ component: string; description: string }>
    requirements: string[]
  }>> {
    if (!this.isAvailable() || !this.engine) {
      return []
    }

    try {
      const docQuery = this.engine.query('document markdown readme design spec api', 'bfs', 30)
      const documents = []
      const docNodes = docQuery.nodes || []

      for (const node of docNodes) {
        if ((node as any).kind === 'document') {
          try {
            const neighbors = this.engine!.getNeighbors(node.label, 2)

            // Extract sections
            const sections = neighbors.successors
              ?.filter((n: any) => n.kind === 'section')
              .map((n: any) => ({ title: n.label, lineNo: parseInt(n.source_location?.replace('L', '') || '0') })) || []

            // Extract API specs
            const apiSpecs = neighbors.successors
              ?.filter((n: any) => n.kind === 'api_spec')
              .map((n: any) => ({ method: n.httpMethod || 'get', path: n.urlPath || '/' })) || []

            // Extract UI specs
            const uiSpecs = neighbors.successors
              ?.filter((n: any) => n.kind === 'ui_spec')
              .map((n: any) => ({ component: n.label.split(':')[0], description: n.label })) || []

            // Extract requirements
            const requirements = neighbors.successors
              ?.filter((n: any) => n.kind === 'requirement')
              .map((n: any) => n.label) || []

            documents.push({
              id: node.id,
              label: node.label,
              sourceFile: node.source_file,
              sections,
              apiSpecs,
              entitySpecs: [],
              uiSpecs,
              requirements,
            })
          } catch {
            continue
          }
        }
      }

      return documents
    } catch (error) {
      console.warn('[GraphEnhancer] Error getting design documents:', error)
      return []
    }
  }

  /**
   * Reinitialize the graph enhancer after a graph rebuild.
   * Called when systest rebuilds the knowledge graph.
   */
  async reinitialize(): Promise<void> {
    try {
      // Reset engine reference
      this.engine = null
      this.available = false
      
      // Reload engine with new graph
      this.engine = this.workspace ? await getEngineForWorkspace(this.workspace) : await getEngine()
      this.available = this.engine !== null && this.engine.isReady?.()
    } catch (error) {
      console.error('[GraphEnhancer] Reinitialization failed:', error)
      this.engine = null
      this.available = false
    }
  }
}

/**
 * Singleton instance.
 */
let enhancerInstance: GraphEnhancer | null = null

export function getGraphEnhancer(workspace?: string): GraphEnhancer {
  if (!enhancerInstance || (workspace && enhancerInstance.getWorkspace() !== workspace)) {
    enhancerInstance = new GraphEnhancer(workspace)
  }
  return enhancerInstance
}

