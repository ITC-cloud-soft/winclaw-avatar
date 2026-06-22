/**
 * Document parser adapter for integrating document parsing into the graph builder
 */

import path from 'node:path'
import type { ParseResult, ParsedSymbol, ParsedRelation, ParsedImport } from './parser.js'
import { parseDocument as parseDocumentFile } from './documentParser.js'

/**
 * Convert parsed document to graph symbols and relations
 */
export function convertDocumentToGraph(
  doc: Awaited<ReturnType<typeof parseDocumentFile>>, 
  filePath: string
): ParseResult {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  const imports: ParsedImport[] = []

  const fileId = path.basename(filePath, path.extname(filePath)).toLowerCase()
  
  // Add document file node
  symbols.push({
    id: fileId,
    label: path.basename(filePath),
    sourceFile: filePath,
    sourceLocation: 'L1',
    kind: 'document'
  })

  // Add sections
  for (const section of doc.sections) {
    const sectionId = `${fileId}_section_${section.lineNo}`
    symbols.push({
      id: sectionId,
      label: section.title,
      sourceFile: filePath,
      sourceLocation: `L${section.lineNo}`,
      kind: 'section'
    })
    relations.push({
      sourceId: fileId,
      targetId: sectionId,
      relation: 'contains',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: `L${section.lineNo}`
    })
  }

  // Add API specs
  for (const apiSpec of doc.apiSpecs) {
    const safePath = apiSpec.path.replace(/[^a-z0-9]/gi, '_')
    const apiId = `${fileId}_api_${apiSpec.method}_${safePath}`
    symbols.push({
      id: apiId,
      label: `${apiSpec.method.toUpperCase()} ${apiSpec.path}`,
      sourceFile: filePath,
      sourceLocation: `L${apiSpec.lineNo}`,
      kind: 'api_spec',
      httpMethod: apiSpec.method,
      urlPath: apiSpec.path
    })
    relations.push({
      sourceId: fileId,
      targetId: apiId,
      relation: 'specifies',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: `L${apiSpec.lineNo}`
    })
  }

  // Add entity specs
  for (const entity of doc.entitySpecs) {
    const entityId = `${fileId}_entity_${entity.name.toLowerCase()}`
    symbols.push({
      id: entityId,
      label: entity.name,
      sourceFile: filePath,
      sourceLocation: `L${entity.lineNo}`,
      kind: 'entity_spec'
    })
    relations.push({
      sourceId: fileId,
      targetId: entityId,
      relation: 'describes',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: `L${entity.lineNo}`
    })
    
    // Add fields
    for (const field of entity.fields) {
      const fieldId = `${fileId}_field_${entity.name.toLowerCase()}_${field.name.toLowerCase()}`
      symbols.push({
        id: fieldId,
        label: `${entity.name}.${field.name}`,
        sourceFile: filePath,
        sourceLocation: `L${entity.lineNo}`,
        kind: 'field',
        fieldType: field.type,
        optional: field.optional
      })
      relations.push({
        sourceId: entityId,
        targetId: fieldId,
        relation: 'has_field',
        confidence: 'EXTRACTED',
        sourceFile: filePath,
        sourceLocation: `L${entity.lineNo}`
      })
    }
  }

  // Add UI specs
  for (const uiSpec of doc.uiSpecs) {
    const uiId = `${fileId}_ui_${uiSpec.component.toLowerCase()}`
    symbols.push({
      id: uiId,
      label: `${uiSpec.component}: ${uiSpec.description}`,
      sourceFile: filePath,
      sourceLocation: `L${uiSpec.lineNo}`,
      kind: 'ui_spec'
    })
    relations.push({
      sourceId: fileId,
      targetId: uiId,
      relation: 'describes',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: `L${uiSpec.lineNo}`
    })
  }

  // Add requirements
  for (let i = 0; i < doc.requirements.length; i++) {
    const reqId = `${fileId}_req_${i}`
    const label = doc.requirements[i].length > 50 
      ? doc.requirements[i].substring(0, 50) + '...' 
      : doc.requirements[i]
    symbols.push({
      id: reqId,
      label: label,
      sourceFile: filePath,
      sourceLocation: 'L1',
      kind: 'requirement'
    })
    relations.push({
      sourceId: fileId,
      targetId: reqId,
      relation: 'contains',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: 'L1'
    })
  }

  return { symbols, relations, imports }
}
