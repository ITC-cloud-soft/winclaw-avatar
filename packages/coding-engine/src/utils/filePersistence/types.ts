// Stub types for filePersistence
export const DEFAULT_UPLOAD_CONCURRENCY = 5
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = 'outputs'

export type FailedPersistence = {
  filePath: string
  error: string
}

export type FilesPersistedEventData = {
  succeeded: number
  failed: number
  totalSize: number
}

export type PersistedFile = {
  filePath: string
  fileId: string
  size: number
}

export type TurnStartTime = number
