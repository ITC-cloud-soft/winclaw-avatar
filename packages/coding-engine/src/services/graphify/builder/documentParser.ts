/**
 * Multi-format document parser for design documents
 * Supports: .md, .pdf, .docx, .xlsx, .txt, .rst, .adoc
 */

import type { ParsedSymbol, ParsedRelation, ParsedImport } from './parser.js'

export interface ParsedDocument {
  title?: string
  sections: Array<{
    title: string
    lineNo: number
    level: number
  }>
  apiSpecs: Array<{
    method: string
    path: string
    lineNo: number
    description?: string
  }>
  entitySpecs: Array<{
    name: string
    lineNo: number
    fields: Array<{
      name: string
      type: string
      optional: boolean
      description?: string
    }>
  }>
  uiSpecs: Array<{
    component: string
    description: string
    lineNo: number
  }>
  requirements: string[]
  codeReferences: string[]
}

export async function parseDocument(filePath: string, content?: string): Promise<ParsedDocument> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  if (!content) {
    try {
      const fs = await import('node:fs')
      const binaryExtensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']
      if (binaryExtensions.includes(ext)) {
        // Don't read binary files - let specialized parsers handle them
      } else {
        content = fs.readFileSync(filePath, 'utf-8')
      }
    } catch (error) {
      throw new Error(`Failed to read file: ${filePath}`)
    }
  }

  switch (ext) {
    case 'pdf':
      return await parsePdfDocument(filePath)
    case 'docx':
    case 'doc':
      return await parseWordDocument(filePath)
    case 'xlsx':
    case 'xls':
      return await parseExcelDocument(filePath)
    case 'md':
    case 'rst':
    case 'adoc':
    case 'txt':
    default:
      return parseTextDocument(content || '', ext)
  }
}

function parseTextDocument(content: string, ext: string): ParsedDocument {
  const lines = content.split('\n')
  const result: ParsedDocument = {
    sections: [],
    apiSpecs: [],
    entitySpecs: [],
    uiSpecs: [],
    requirements: [],
    codeReferences: []
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed.startsWith('#')) {
      const level = (trimmed.match(/^#+/) || [''])[0].length
      const title = trimmed.replace(/^#+\s*/, '')
      result.sections.push({ title, lineNo: i + 1, level })
      if (i === 0 || level === 1) {
        result.title = title
      }
    }
    
    const apiMatch = trimmed.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)/i)
    if (apiMatch) {
      result.apiSpecs.push({
        method: apiMatch[1].toUpperCase(),
        path: apiMatch[2],
        lineNo: i + 1
      })
    }
    
    if (trimmed.toLowerCase().startsWith('requirement:')) {
      result.requirements.push(trimmed.replace(/^requirement:?\s*/i, ''))
    }
  }
  
  return result
}

async function parsePdfDocument(filePath: string): Promise<ParsedDocument> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const fs = await import('node:fs')
    const dataBuffer = new Uint8Array(fs.readFileSync(filePath))
    const parser = new PDFParse({ data: dataBuffer })
    const doc = await parser.load()
    const numPages = doc.numPages || 0

    // Extract text from all pages
    let fullText = ''
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await doc.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n'
      } catch {
        // Skip unreadable pages
      }
    }

    // Cleanup: destroy parser to free resources
    try { await doc.destroy() } catch {}

    console.log(`[PDF] Parsed ${filePath}: ${numPages} pages, ${fullText.length} chars`)
    return parseTextDocument(fullText, 'pdf')
  } catch (error) {
    console.error(`Failed to parse PDF ${filePath}:`, error)
    return { sections: [], apiSpecs: [], entitySpecs: [], uiSpecs: [], requirements: [], codeReferences: [] }
  }
}

async function parseWordDocument(filePath: string): Promise<ParsedDocument> {
  try {
    const mammoth = await import('mammoth')
    const fs = await import('node:fs')
    const buffer = fs.readFileSync(filePath)
    const result = await mammoth.extractRawText({ buffer })
    return parseTextDocument(result.value, 'docx')
  } catch (error) {
    console.error(`Failed to parse Word document ${filePath}:`, error)
    return { sections: [], apiSpecs: [], entitySpecs: [], uiSpecs: [], requirements: [], codeReferences: [] }
  }
}

async function parseExcelDocument(filePath: string): Promise<ParsedDocument> {
  try {
    const xlsx = await import('xlsx')
    const workbook = xlsx.readFile(filePath)
    const result: ParsedDocument = {
      sections: [],
      apiSpecs: [],
      entitySpecs: [],
      uiSpecs: [],
      requirements: [],
      codeReferences: []
    }
    
    for (const sheetName of workbook.SheetNames) {
      result.sections.push({ title: sheetName, lineNo: 1, level: 2 })
    }
    
    return result
  } catch (error) {
    console.error(`Failed to parse Excel document ${filePath}:`, error)
    return { sections: [], apiSpecs: [], entitySpecs: [], uiSpecs: [], requirements: [], codeReferences: [] }
  }
}
