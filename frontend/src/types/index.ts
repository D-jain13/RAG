export interface Tenant {
  tenant_id: string
  name: string
}

export interface DocumentOut {
  id: string
  filename: string
  size_bytes: number
  status: string
  duplicate_of: string | null
}

export interface UploadResponse {
  document: DocumentOut
  already_exists: boolean
}

export interface Source {
  ref: number
  document_id: string
  filename: string
  heading_path: string | null
  chunk_index: number
}

export interface ChatResponse {
  answer: string
  sources: Source[]
}

export type DocumentStatus =
  | 'pending'
  | 'indexed'
  | 'duplicate'
  | 'near_duplicate'
  | 'processing'
  | 'failed'
