/**
 * Test Data Generator
 * 
 * Generates realistic test data based on schema field definitions.
 * Considers field types, constraints, and relationships.
 */

export interface FieldDefinition {
  name: string
  type: string
  required: boolean
  optional?: boolean
  nullable?: boolean
  constraints?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    enum?: string[]
    format?: string
  }
}

export interface TestDataOptions {
  valid?: boolean  // Generate valid data (default: true)
  violations?: string[]  // Specific constraint violations to introduce
}

/**
 * Generate test data for a set of fields.
 */
export function generateTestData(
  fields: FieldDefinition[],
  options: TestDataOptions = {}
): Record<string, any> {
  const { valid = true, violations = [] } = options
  const data: Record<string, any> = {}
  
  for (const field of fields) {
    // Skip optional fields when generating valid data
    if (field.optional && !field.required && valid) {
      continue
    }
    
    // Check if this field should have a violation
    const shouldViolate = !valid && violations.includes(field.name)
    
    data[field.name] = generateFieldValue(field, shouldViolate)
  }
  
  return data
}

/**
 * Generate a value for a specific field.
 */
function generateFieldValue(field: FieldDefinition, violate: boolean = false): any {
  const { type, constraints } = field
  
  // If violating constraints, generate invalid data
  if (violate) {
    return generateInvalidValue(field)
  }
  
  // Generate valid data based on type
  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'varchar':
    case 'char':
      return generateString(constraints)
    
    case 'number':
    case 'integer':
    case 'int':
    case 'bigint':
    case 'smallint':
    case 'decimal':
    case 'numeric':
    case 'float':
    case 'double':
      return generateNumber(constraints, type)
    
    case 'boolean':
    case 'bool':
      return true
    
    case 'date':
      return generateDate()
    
    case 'datetime':
    case 'timestamp':
      return new Date().toISOString()
    
    case 'time':
      return new Date().toTimeString().split(' ')[0]
    
    case 'email':
      return generateEmail()
    
    case 'url':
      return generateUrl()
    
    case 'uuid':
      return generateUuid()
    
    case 'array':
    case 'json':
    case 'jsonb':
      return generateJson()
    
    case 'enum':
      if (constraints?.enum && constraints.enum.length > 0) {
        return constraints.enum[0]
      }
      return 'enum_value'
    
    default:
      return 	est__
  }
}

/**
 * Generate invalid value for testing constraint violations.
 */
function generateInvalidValue(field: FieldDefinition): any {
  const { type, constraints } = field
  
  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'varchar':
      if (constraints?.maxLength) {
        // Exceed max length
        return 'a'.repeat(constraints.maxLength + 10)
      }
      if (constraints?.minLength) {
        // Below min length
        return 'a'.repeat(Math.max(0, constraints.minLength - 1))
      }
      if (constraints?.pattern) {
        // Violate pattern
        return 'invalid'
      }
      return ''
    
    case 'number':
    case 'integer':
    case 'int':
      if (constraints?.min !== undefined) {
        return constraints.min - 1
      }
      if (constraints?.max !== undefined) {
        return constraints.max + 1
      }
      return 'not_a_number'
    
    case 'email':
      return 'invalid-email-format'
    
    case 'url':
      return 'not-a-url'
    
    case 'uuid':
      return 'not-a-uuid'
    
    case 'array':
    case 'json':
      return 'not-json'
    
    default:
      return null
  }
}

/**
 * Generate a random string.
 */
function generateString(constraints?: any): string {
  const minLength = constraints?.minLength || 5
  const maxLength = constraints?.maxLength || 50
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength
  
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'test_' + Math.random().toString(36).substring(2, 8) + '_'
  
  while (result.length < length) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result.substring(0, length)
}

/**
 * Generate a random number.
 */
function generateNumber(constraints?: any, type: string = 'number'): number {
  const min = constraints?.min ?? 1
  const max = constraints?.max ?? 100
  
  if (type.includes('int')) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  
  return Math.random() * (max - min) + min
}

/**
 * Generate a date string.
 */
function generateDate(): string {
  const date = new Date()
  return date.toISOString().split('T')[0]
}

/**
 * Generate an email address.
 */
function generateEmail(): string {
  const domains = ['example.com', 'test.org', 'demo.net', 'sample.co']
  const users = ['user', 'test', 'demo', 'sample', 'admin']
  const random = Math.floor(Math.random() * 10000)
  
  return `${users[Math.floor(Math.random() * users.length)]}@${domains[Math.floor(Math.random() * domains.length)]}`
}

/**
 * Generate a URL.
 */
function generateUrl(): string {
  const paths = ['home', 'about', 'contact', 'products', 'services']
  const path = paths[Math.floor(Math.random() * paths.length)]
  return `https://example.com/${path}`
}

/**
 * Generate a UUID.
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate a JSON object/array.
 */
function generateJson(): any {
  return {
    id: generateUuid(),
    name: generateString(),
    value: generateNumber(),
    active: true,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Generate test data for CRUD operations.
 */
export function generateCrudTestData(fields: FieldDefinition[]): {
  create: Record<string, any>
  update: Record<string, any>
  invalid: Record<string, any>
} {
  return {
    create: generateTestData(fields, { valid: true }),
    update: generateTestData(fields.filter(f => !isReadOnlyField(f)), { valid: true }),
    invalid: generateTestData(fields, { valid: false, violations: ['email', 'required'] }),
  }
}

/**
 * Check if a field is read-only (e.g., id, createdAt, updatedAt).
 */
function isReadOnlyField(field: FieldDefinition): boolean {
  const readOnlyNames = ['id', 'createdat', 'updatedat', 'created_at', 'updated_at', 'deletedat', 'deleted_at']
  return readOnlyNames.includes(field.name.toLowerCase())
}
