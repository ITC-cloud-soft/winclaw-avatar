/**
 * Enhanced Graph Data Model for Semantic Knowledge Graph
 * 
 * Extends the original topology-based graph with semantic relationships,
 * confidence scores, and support for multiple file types.
 */

// ---------------------------------------------------------------------------
// Node Types (17 types, up from 11)
// ---------------------------------------------------------------------------

export const NODE_TYPES = {
  // Original code node types
  CLASS: 'class',
  FUNCTION: 'function',
  VARIABLE: 'variable',
  PARAMETER: 'parameter',
  
  // Database schema types
  TABLE: 'table',
  FIELD: 'field',
  SCHEMA: 'schema',
  
  // API/Route types
  ROUTE: 'route',
  ENDPOINT: 'endpoint',
  
  // Service types
  SERVICE: 'service',
  MIDDLEWARE: 'middleware',
  
  // NEW: Document and content types
  DOCUMENT: 'document',
  SECTION: 'section',
  CONCEPT: 'concept',
  
  // NEW: Configuration types
  CONFIG: 'config',
  SETTING: 'setting',
  
  // NEW: Media types
  IMAGE: 'image',
  DIAGRAM: 'diagram',
} as const

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES]

// ---------------------------------------------------------------------------
// Relation Types (13 types, up from 7)
// ---------------------------------------------------------------------------

export const RELATION_TYPES = {
  // Original structural relations
  IMPORTS: 'imports',
  IMPLEMENTS: 'implements',
  EXTENDS: 'extends',
  CALLS: 'calls',
  USES: 'uses',
  
  // Database relations
  REFERENCES: 'references',
  BELONGS_TO: 'belongs_to',
  
  // NEW: Semantic relations
  DESCRIBES: 'describes',
  DEFINES: 'defines',
  EXAMPLE_OF: 'example_of',
  RELATED_TO: 'related_to',
  DEPENDS_ON: 'depends_on',
  CONFIGURES: 'configures',
} as const

export type RelationType = typeof RELATION_TYPES[keyof typeof RELATION_TYPES]

// ---------------------------------------------------------------------------
// Relation Categories
// ---------------------------------------------------------------------------

export const RELATION_CATEGORIES = {
  STRUCTURAL: 'structural',  // From AST/code structure (100% confidence)
  SEMANTIC: 'semantic',      // From NLP analysis (0.5-1.0 confidence)
  INFERRED: 'inferred',      // From ML/statistical inference (0.3-0.7 confidence)
} as const

export type RelationCategory = typeof RELATION_CATEGORIES[keyof typeof RELATION_CATEGORIES]

// ---------------------------------------------------------------------------
// Enhanced Node Interface
// ---------------------------------------------------------------------------

export interface EnhancedNode {
  // Core fields (compatible with original)
  id: string
  label: string
  kind: NodeType
  source_file: string
  source_location?: string
  community: number
  
  // NEW: Optional semantic metadata
  description?: string
  aliases?: string[]           // Alternative names
  tags?: string[]              // User-defined tags
  confidence?: number          // 0-1, extraction confidence
  
  // Type-specific fields
  signature?: string           // For functions
  fieldType?: string           // For fields/variables
  httpMethod?: string          // For routes
  urlPath?: string             // For routes
  optional?: boolean           // For fields
  nullable?: boolean           // For fields
  constraints?: Record<string, any>  // Validation constraints
  
  // NEW: Document-specific fields
  content_type?: 'code' | 'text' | 'markdown' | 'config' | 'image'
  language?: string            // For code blocks
  heading_level?: number       // For markdown sections
  
  // NEW: Image-specific fields
  image_format?: string        // png, jpg, svg, etc.
  image_size?: { width: number; height: number }
  caption?: string
  ocr_text?: string            // Extracted text from image
  
  // NEW: Configuration-specific fields
  config_format?: string       // json, yaml, toml, etc.
  config_schema?: string       // Schema name if applicable
}

// ---------------------------------------------------------------------------
// Enhanced Edge (Relation) Interface
// ---------------------------------------------------------------------------

export interface EnhancedEdge {
  // Core fields (compatible with original)
  source: string
  target: string
  relation: RelationType
  confidence: number          // 0-1
  source_file: string
  source_location?: string
  weight: number
  
  // NEW: Relation category
  category: RelationCategory
  
  // NEW: Optional metadata
  evidence?: string[]          // Why this relation exists
  extracted_by?: string        // Which extractor found this
  timestamp?: number           // When extracted
}

// ---------------------------------------------------------------------------
// Enhanced Graph Data
// ---------------------------------------------------------------------------

export interface EnhancedGraphData {
  nodes: EnhancedNode[]
  edges: EnhancedEdge[]
  
  // NEW: Metadata about the graph
  metadata: {
    version: string           // Graph schema version
    build_time: number        // Unix timestamp
    build_options: {
      root_dir: string
      file_types: string[]    // File types included
      semantic_analysis: boolean
      confidence_threshold: number
    }
    statistics: {
      total_nodes: number
      total_edges: number
      nodes_by_type: Record<NodeType, number>
      edges_by_type: Record<RelationType, number>
      edges_by_category: Record<RelationCategory, number>
    }
  }
}

// ---------------------------------------------------------------------------
// File Type Categories
// ---------------------------------------------------------------------------

export const FILE_TYPE_CATEGORIES = {
  CODE: ['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c', 'h'],
  DOCUMENT: ['md', 'txt', 'rst', 'adoc'],
  CONFIG: ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'xml'],
  MARKUP: ['html', 'htm', 'xml', 'svg'],
  STYLE: ['css', 'scss', 'sass', 'less'],
  DATA: ['sql', 'csv', 'tsv'],
  IMAGE: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  ARCHIVE: ['zip', 'tar', 'gz', 'bz2'],
} as const

export type FileTypeCategory = keyof typeof FILE_TYPE_CATEGORIES

export function getFileTypeCategory(extension: string): FileTypeCategory | null {
  const ext = extension.toLowerCase().replace(/^\./, '')
  
  for (const [category, extensions] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category as FileTypeCategory
    }
  }
  
  return null
}

// ---------------------------------------------------------------------------
// Parser Registry
// ---------------------------------------------------------------------------

export interface Parser {
  name: string
  supportedExtensions: string[]
  parse(filePath: string, content: string): Promise<{
    nodes: EnhancedNode[]
    edges: EnhancedEdge[]
  }>
}

export const parserRegistry: Parser[] = []

export function registerParser(parser: Parser): void {
  parserRegistry.push(parser)
}

export function getParser(extension: string): Parser | null {
  const ext = extension.toLowerCase()
  
  for (const parser of parserRegistry) {
    if (parser.supportedExtensions.includes(ext)) {
      return parser
    }
  }
  
  return null
}

// ---------------------------------------------------------------------------
// Confidence Scoring
// ---------------------------------------------------------------------------

export function calculateConfidence(base: number, factors: {
  hasLocation?: boolean
  hasMultipleEvidence?: boolean
  isWellFormed?: boolean
  hasContext?: boolean
}): number {
  let confidence = base
  
  if (factors.hasLocation) confidence += 0.1
  if (factors.hasMultipleEvidence) confidence += 0.15
  if (factors.isWellFormed) confidence += 0.1
  if (factors.hasContext) confidence += 0.1
  
  return Math.min(1.0, confidence)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateEnhancedNode(node: any): node is EnhancedNode {
  return (
    typeof node === 'object' &&
    typeof node.id === 'string' &&
    typeof node.label === 'string' &&
    typeof node.kind === 'string' &&
    typeof node.source_file === 'string' &&
    typeof node.community === 'number' &&
    Object.values(NODE_TYPES).includes(node.kind as NodeType)
  )
}

export function validateEnhancedEdge(edge: any): edge is EnhancedEdge {
  return (
    typeof edge === 'object' &&
    typeof edge.source === 'string' &&
    typeof edge.target === 'string' &&
    typeof edge.relation === 'string' &&
    typeof edge.confidence === 'number' &&
    typeof edge.source_file === 'string' &&
    typeof edge.category === 'string' &&
    Object.values(RELATION_TYPES).includes(edge.relation as RelationType) &&
    Object.values(RELATION_CATEGORIES).includes(edge.category as RelationCategory)
  )
}
