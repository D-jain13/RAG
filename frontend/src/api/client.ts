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
  async listTenants(): Promise<any[]> {
    const response = await this.client.get<any[]>('/tenants')
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

  async listDocuments(params?: { status?: string; limit?: number; offset?: number }): Promise<DocumentListResponse> {
    const response = await this.client.get<DocumentListResponse>('/documents', { params })
    return response.data
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
}

export const api = new ApiClient()

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
  limit: number
  offset: number
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