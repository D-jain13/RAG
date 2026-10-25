import { useEffect, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useTenantId() {
  return useSyncExternalStore(api.subscribeTenant, () => api.getTenantId())
}

/** Loads tenants and keeps the active tenant valid (auto-selects the first one). */
export function useTenants() {
  const tenantId = useTenantId()
  const query = useQuery({ queryKey: ['tenants'], queryFn: () => api.listTenants() })
  const tenants = query.data

  useEffect(() => {
    if (!tenants) return
    if (tenants.length === 0) {
      api.setTenantId(null)
    } else if (!tenants.some((t) => t.tenant_id === tenantId)) {
      api.setTenantId(tenants[0].tenant_id)
    }
  }, [tenants, tenantId])

  return { ...query, tenants: tenants ?? [], tenantId }
}
