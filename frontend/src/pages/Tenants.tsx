import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export default function Tenants() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTenant(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowCreateForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault()
    const input = document.getElementById('tenant-name-input') as HTMLInputElement
    const name = input.value.trim()
    if (!name) return
    createMutation.mutate(name)
    input.value = ''
  }

  const handleDeleteTenant = (id: string) => {
    if (confirm('Are you sure you want to delete this tenant? All documents and data will be permanently removed.')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Tenants</h2>
          <p className="text-neutral-600 mt-1">Manage your multi‑tenant workspaces</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Create Tenant
        </button>
      </header>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-neutral-900 mb-4">New Tenant</h3>
          <form onSubmit={handleCreateTenant} className="flex gap-4">
            <div className="flex-1">
              <input
                id="tenant-name-input"
                type="text"
                placeholder="Tenant name"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={createMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </form>
          {createMutation.error && (
            <p className="mt-2 text-sm text-error-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create tenant'}
            </p>
          )}
        </div>
      )}

      {/* Tenants list */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-primary-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700 text-sm">
          Failed to load tenants. Please try again later.
        </div>
      )}

      {tenants && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-neutral-200">
            {tenants.length === 0 ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900">No tenants found</h3>
                  <p className="text-neutral-600 text-sm">Get started by creating your first tenant</p>
                </div>
              </div>
            ) : (
              tenants.map((tenant) => (
                <div key={tenant.tenant_id} className="p-6 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-900">{tenant.name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">ID: {tenant.tenant_id}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteTenant(tenant.tenant_id)}
                      disabled={deleteMutation.isPending}
                      className="text-error-600 hover:text-error-700 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
