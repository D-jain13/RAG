import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api/client'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { TenantGuard } from '../components/TenantGuard'
import { useTenantId } from '../hooks/useTenant'

const ACCEPT = '.pdf,.docx,.txt,.csv,.xlsx,.md'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Documents() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const { data: documents, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['documents', tenantId],
    queryFn: async () => (await api.listDocuments()).items,
    enabled: !!tenantId,
    staleTime: 0,
    // keep polling while anything is still being processed
    refetchInterval: (q) =>
      q.state.data?.some((d) => d.status === 'pending' || d.status === 'processing') ? 3000 : false,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file, setUploadProgress),
    onSuccess: (res, file) => {
      if (res?.already_exists) toast(`"${file.name}" already exists`, { icon: 'ℹ️' })
      else toast.success(`"${file.name}" uploaded`)
    },
    onError: (err: any, file) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : `Failed to upload "${file.name}"`)
    },
    onSettled: () => {
      setUploadProgress(null)
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const isUploading = uploadMutation.isPending

  const upload = (files: FileList | null) => {
    if (!files?.length || isUploading) return
    setUploadProgress(0)
    uploadMutation.mutate(files[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <TenantGuard>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h2>
          <p className="mt-1 text-sm text-slate-500">Upload and manage your source documents</p>
        </header>

        <div
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            upload(e.dataTransfer.files)
          }}
          className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
          }`}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files)} />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          {isUploading ? (
            <div className="mx-auto max-w-xs">
              <p className="text-sm font-medium text-slate-700">Uploading… {uploadProgress ?? 0}%</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${uploadProgress ?? 0}%` }} />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800">
                Drop a file here, or <span className="text-indigo-600">browse</span>
              </p>
              <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">PDF · DOCX · TXT · CSV · XLSX · MD</p>
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Your documents{documents ? <span className="ml-2 font-normal text-slate-400">{documents.length}</span> : null}
            </h3>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {isLoading && (
            <div className="divide-y divide-slate-100">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                    <div className="h-2.5 w-1/4 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-sm text-rose-600">
              Failed to load documents.{' '}
              <button onClick={() => refetch()} className="font-semibold underline underline-offset-2">
                Retry
              </button>
            </div>
          )}

          {documents && documents.length === 0 && (
            <div className="p-10 text-center">
              <h3 className="text-base font-semibold text-slate-800">No documents yet</h3>
              <p className="mt-1 text-sm text-slate-500">Upload your first document to get started</p>
            </div>
          )}

          {documents && documents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="hidden px-6 py-3 sm:table-cell">Uploaded</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Zm0 0v7h7" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="max-w-[260px] truncate text-sm font-medium text-slate-900" title={doc.filename}>
                              {doc.filename}
                            </div>
                            {doc.failure_reason && (
                              <div className="max-w-[260px] truncate text-xs text-rose-500" title={doc.failure_reason}>
                                {doc.failure_reason}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm text-slate-500">{formatSize(doc.size_bytes)}</td>
                      <td className="hidden whitespace-nowrap px-6 py-3.5 text-sm text-slate-500 sm:table-cell">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-3.5">
                        <DocumentStatusBadge status={doc.status as any} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TenantGuard>
  )
}
