import axios from 'axios'
import type { AxiosInstance } from 'axios'

const BASE_URL = '/api/v1'

class ApiClient {
  private client: AxiosInstance
  private tenantId: string | null = null
  private listeners = new Set<() => void>()

  constructor() {
    try {
      this.tenantId = localStorage.getItem('tenant_id')
    } catch {
      /* storage unavailable */
    }
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use((config) => {
      if (this.tenantId) {
        config.headers['x-tenant-id'] = this.tenantId
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 404 && error.response?.data?.detail?.includes('tenant')) {
          // Tenant not found - clear tenant
          this.setTenantId(null)
        }
        return Promise.reject(error)
      }
    )
  }

  setTenantId(tenantId: string | null) {
    if (this.tenantId === tenantId) return
    this.tenantId = tenantId
    try {
      if (tenantId) localStorage.setItem('tenant_id', tenantId)
      else localStorage.removeItem('tenant_id')
    } catch {
      /* storage unavailable */
    }
    this.listeners.forEach((l) => l())
  }

  subscribeTenant = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getTenantId(): string | null {
    return this.tenantId
  }

  // Tenant endpoints
  async listTenantsPage(params: { page: number; page_size: number}): Promise<TenantListResponse> {
    const response = await this.client.get<TenantListResponse>('/tenants',{params})
    return response.data
  }

  async listTenants(): Promise<any[]> {
    const response = await this.client.get<any[]>('/tenants/all')
    return response.data
  }

  async createTenant(name: string): Promise<any> {
    const response = await this.client.post<any>('/tenants', { name })
    return response.data
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.client.delete(`/tenants/${tenantId}`)
  }

  // Document endpoints
  async uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post<any>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      },
    })
    return response.data
  }

  async listDocuments(params?: { status?: string; page?: number; page_size?: number }): Promise<DocumentListResponse> {
    const response = await this.client.get<DocumentListResponse>('/documents', { params })
    return response.data
  }

  async deleteDocument(documentId : string): Promise<void>{
    await this.client.delete(`/documents/${documentId}`)
  }

  async testParser(file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.client.post('/documents/test-parser', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  }

  // Chat endpoints
  async chat(question: string): Promise<any> {
    const response = await this.client.post<any>('/chat', { question })
    return response.data
  }
  
  async chatStream(
  question: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
  history: ChatHistoryMessage[] = [],
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (this.tenantId) headers['x-tenant-id'] = this.tenantId

  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, history }),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (frame: string) => {
    let event = 'message'
    const data: string[] = []

    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''))
      }
    }

    if (!data.length) return

    const payload = JSON.parse(data.join('\n'))

    if (event === 'sources') handlers.onSources?.(payload)
    else if (event === 'token') handlers.onToken(payload)
    else if (event === 'error') throw new Error(payload)
  }

  for (;;) {
    const { done, value } = await reader.read()

    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')

    let idx: number

    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      dispatch(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 2)
    }

    if (done) break
  }

  if (buffer.trim()) dispatch(buffer)
  }
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatStreamHandlers {
  onSources?: (sources: Source[]) => void
  onToken: (text: string) => void
}

export const api = new ApiClient()

export interface Tenant {
  tenant_id: string
  name: string
}

export interface TenantListResponse{
  items: Tenant[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DocumentOut {
  id: string
  filename: string
  size_bytes: number
  status: string
  duplicate_of: string | null
}

export interface DocumentListItem extends DocumentOut {
  content_type: string | null
  similarity: number | null
  failure_reason: string | null
  created_at: string
  processed_at: string | null
}

export interface DocumentListResponse {
  items: DocumentListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
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