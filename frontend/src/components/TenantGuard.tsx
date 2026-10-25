import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface TenantGuardProps {
  children: ReactNode
}

export function TenantGuard({ children }: TenantGuardProps) {
  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700 text-sm">
        Failed to load tenants. Please try again later.
      </div>
    )
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-medium text-neutral-900 mb-2">No tenants found</h3>
        <p className="text-neutral-600 text-sm mb-4">
          Create a tenant first to start using the RAG application.
        </p>
        <Navigate to="/tenants" replace />
      </div>
    )
  }

  return <>{children}</>
}