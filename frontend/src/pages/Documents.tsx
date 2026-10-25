import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { TenantGuard } from '../components/TenantGuard'

export default function Documents() {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  })
  const { data: documents, isPending: fetchingDocuments } = useQuery({
    queryKey: ['documents', api.getTenantId()],
    queryFn: () => {
      if (!api.getTenantId()) return []
      return api.listTenants().then(() =>
        api.client.get<any[]>('/documents')
      )
    },
    enabled: !!api.getTenantId(),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file, setUploadProgress),
    onSettled: () => {
      setIsUploading(false)
      setUploadProgress(0)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    uploadMutation.mutate(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    setIsUploading(true)
    uploadMutation.mutate(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <TenantGuard>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">Documents</h2>
            <p className="text-neutral-600 mt-1">Upload and manage your source documents</p>
          </div>
        </header>

        {/* Upload card */}
        <div
          className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-center space-x-4 mb-4">
            <label
              className="flex items-center gap-3 cursor-pointer bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Select file
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
            />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">
              PDF · DOCX · TXT · CSV · XLSX · MD
            </span>
          </div>

          {uploadProgress > 0 && (
            <div className="w-full bg-neutral-100 rounded-full h-2 mb-4">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          {isUploading && (
            <p className="text-sm text-neutral-600">Uploading file...</p>
          )}
        </div>

        {/* Documents list */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          {fetchingDocuments && (
            <div className="p-8 text-center text-neutral-500">
              Loading documents...
            </div>
          )}

          {!fetchingDocuments && documents && documents.length === 0 && (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-neutral-900">No documents yet</h3>
                <p className="text-neutral-600 text-sm">Upload your first document to get started</p>
              </div>
            </div>
          )}

          {!fetchingDocuments && documents && documents.length > 0 && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-neutral-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 text-sm">{doc.filename}</div>
                          <div className="text-xs text-neutral-500">{doc.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {(doc.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-6 py-4">
                      <DocumentStatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </TenantGuard>
  )
}
