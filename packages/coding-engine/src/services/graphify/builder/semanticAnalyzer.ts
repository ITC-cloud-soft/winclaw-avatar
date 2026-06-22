import type { ParseResult, ParsedSymbol, ParsedRelation } from './parser.js'

export interface BusinessEntity {
  name: string
  type: 'actor' | 'entity' | 'value_object' | 'aggregate' | 'service'
  description?: string
  attributes: Attribute[]
  lineNo: number
}

export interface Attribute {
  name: string
  type: string
  optional: boolean
  description?: string
}

export interface Requirement {
  id: string
  type: 'functional' | 'non_functional' | 'constraint'
  priority: 'must' | 'should' | 'could' | 'wont'
  statement: string
  sourceEntity?: string
  lineNo: number
}

export interface SemanticRelation {
  sourceId: string
  targetId: string
  relation: 'IMPLEMENTS' | 'SATISFIES' | 'DEPENDS_ON' | 'EXTENDS' | 'CONFLICTS_WITH' | 'VALIDATES' | 'CREATES' | 'UPDATES' | 'DELETES' | 'READS'
  confidence: number
  context: string
}

export interface SemanticAnalysisResult {
  businessEntities: BusinessEntity[]
  requirements: Requirement[]
  semanticRelations: SemanticRelation[]
}

export function analyzeDocumentSemantics(content: string, filePath: string): SemanticAnalysisResult {
  const lines = content.split('\n')
  return {
    businessEntities: extractEntitiesWithAttributes(lines),
    requirements: extractRequirements(lines),
    semanticRelations: extractSemanticRelations(lines)
  }
}

function extractEntitiesWithAttributes(lines: string[]): BusinessEntity[] {
  const entities: BusinessEntity[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#+\s*(.+?)\s*(?:Entity|Model|Table)\s*$/i)
    if (match) {
      const entity: BusinessEntity = {
        name: match[1].trim(),
        type: 'entity',
        attributes: [],
        lineNo: i + 1
      }
      // Look for table in next 20 lines
      for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
        if (lines[j].trim().startsWith('|') && j + 1 < lines.length && lines[j + 1].includes('---')) {
          entity.attributes = parseAttributeTable(lines, j)
          break
        }
        // Only stop at level 1 or 2 headers (## or #), not level 3 (###)
        if (lines[j].match(/^#{1,2}\s/)) break
      }
      entities.push(entity)
    }
  }
  return entities
}

function parseAttributeTable(lines: string[], startLine: number): Attribute[] {
  const attrs: Attribute[] = []
  if (startLine + 1 >= lines.length) return attrs
  for (let i = startLine + 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|') || line === '') break
    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    if (cells.length >= 2) {
      attrs.push({
        name: cells[0],
        type: cells[1] || 'string',
        optional: cells[2] === 'Yes' || cells[2] === 'yes',
        description: cells[3] || ''
      })
    }
  }
  return attrs
}

function extractRequirements(lines: string[]): Requirement[] {
  const reqs: Requirement[] = []
  let counter = 1
  lines.forEach((line, i) => {
    if (line.match(/^\|/) || line.match(/^- \[ \]/)) return
    const cleanLine = line.replace(/^[-*]\s*\[?\s*\]?\s*/, '').trim()
    if ((cleanLine.match(/MUST|REQUIRED|必须|必需/i) || cleanLine.match(/SHOULD|RECOMMENDED|应该/i)) && cleanLine.length > 5) {
      reqs.push({
        id: 'REQ-' + counter.toString().padStart(3, '0'),
        type: 'functional',
        priority: cleanLine.match(/MUST|REQUIRED|必须|必需/i) ? 'must' : 'should',
        statement: cleanLine.replace(/^(必须|应该|MUST|SHOULD)?\s*/i, '').trim(),
        lineNo: i + 1
      })
      counter++
    }
  })
  return reqs
}

function extractSemanticRelations(lines: string[]): SemanticRelation[] {
  const relations: SemanticRelation[] = []
  const patterns = [
    { regex: /CREATES|创建|新增/i, type: 'CREATES' },
    { regex: /DEPENDS_ON|依赖/i, type: 'DEPENDS_ON' },
    { regex: /SATISFIES|满足/i, type: 'SATISFIES' },
    { regex: /VALIDATES|验证|校验/i, type: 'VALIDATES' },
    { regex: /DELETES|删除|移除/i, type: 'DELETES' }
  ]
  lines.forEach(line => {
    patterns.forEach(({ regex, type }) => {
      if (regex.test(line)) {
        const entities = line.match(/\b(User|Avatar|Skill|Subscription|Payment|Order|Product|Customer|Account|Profile|Settings|Role|Permission|Session|Token|Message|Notification|File|Document|Project|Task|Workflow|Team|Member|Comment|Tag)\b/g)
        if (entities && entities.length >= 2) {
          relations.push({
            sourceId: entities[0],
            targetId: entities[1],
            relation: type as any,
            confidence: 0.7,
            context: line.trim()
          })
        }
      }
    })
  })
  return relations
}

export function convertSemanticToGraph(analysis: SemanticAnalysisResult, filePath: string, fileId: string): { symbols: ParsedSymbol[], relations: ParsedRelation[] } {
  const symbols: ParsedSymbol[] = []
  const relations: ParsedRelation[] = []
  
  for (const entity of analysis.businessEntities) {
    const entityId = fileId + '_entity_' + entity.name.toLowerCase()
    symbols.push({
      id: entityId,
      label: entity.name + ' (' + entity.attributes.length + ' attrs)',
      sourceFile: filePath,
      sourceLocation: 'L' + entity.lineNo,
      kind: 'entity_spec',
      fieldType: entity.type
    })
    relations.push({
      sourceId: fileId,
      targetId: entityId,
      relation: 'describes',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: 'L' + entity.lineNo
    })
    for (const attr of entity.attributes) {
      const attrId = fileId + '_attr_' + entity.name.toLowerCase() + '_' + attr.name.toLowerCase()
      symbols.push({
        id: attrId,
        label: entity.name + '.' + attr.name + ' (' + attr.type + ')',
        sourceFile: filePath,
        sourceLocation: 'L' + entity.lineNo,
        kind: 'field',
        fieldType: attr.type,
        optional: attr.optional
      })
      relations.push({
        sourceId: entityId,
        targetId: attrId,
        relation: 'has_field',
        confidence: 'EXTRACTED',
        sourceFile: filePath,
        sourceLocation: 'L' + entity.lineNo
      })
    }
  }
  
  for (const req of analysis.requirements) {
    const reqId = fileId + '_req_' + req.id.toLowerCase()
    const label = req.id + ': ' + (req.statement.length > 40 ? req.statement.substring(0, 40) + '...' : req.statement)
    symbols.push({
      id: reqId,
      label: label,
      sourceFile: filePath,
      sourceLocation: 'L' + req.lineNo,
      kind: 'requirement'
    })
    relations.push({
      sourceId: fileId,
      targetId: reqId,
      relation: 'contains',
      confidence: 'EXTRACTED',
      sourceFile: filePath,
      sourceLocation: 'L' + req.lineNo
    })
  }
  
  for (const semRel of analysis.semanticRelations) {
    relations.push({
      sourceId: fileId + '_entity_' + semRel.sourceId.toLowerCase(),
      targetId: fileId + '_entity_' + semRel.targetId.toLowerCase(),
      relation: semRel.relation as any,
      confidence: 'HIGH',
      sourceFile: filePath,
      sourceLocation: 'L1'
    })
  }
  
  return { symbols, relations }
}
