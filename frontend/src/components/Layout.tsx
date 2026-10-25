
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

const navigation = [
  {
    label: 'Chat',
    description: 'Ask your knowledge base',
    to: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 10h8M8 14h5" />
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4-.8L3 21l1.8-4.1A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
      </svg>
    ),
  },
  {
    label: 'Documents',
    description: 'Manage your knowledge',
    to: '/documents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
        <path d="M13 3v7h7M8 14h8M8 17h8" />
      </svg>
    ),
  },
  {
    label: 'Tenants',
    description: 'Manage workspaces',
    to: '/tenants',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10 21v-3h4v3" />
      </svg>
    ),
  },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const queryClient = useQueryClient()

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  })

  const activeTenantId = api.getTenantId() || ''

  const activeTenant = tenants.find(
    (tenant) => tenant.tenant_id === activeTenantId,
  )

  const page = navigation.find((item) =>
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to),
  )

  const changeTenant = (tenantId: string) => {
    api.setTenantId(tenantId || null)
    queryClient.invalidateQueries()
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z" />
              <path d="m4.5 7.2 7.5 4.4 7.5-4.4M12 11.6V21" />
              <path d="m8.5 5 7.5 4.4" />
            </svg>
          </div>
          <div>
            <p className="text-[16px] font-bold tracking-tight text-slate-900">
              Atlas AI
            </p>
            <p className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">
              KNOWLEDGE WORKSPACE
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeMobile}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}
                    >
                      <span className="h-[19px] w-[19px] [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-[1.7]">
                        {item.icon}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[11px] ${
                          isActive ? 'text-indigo-500' : 'text-slate-400'
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/70">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 7h16M7 4v6m10-6v6M5 11h14v9H5z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  Active workspace
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Your knowledge scope
                </p>
              </div>
            </div>

            <select
              aria-label="Active tenant"
              value={activeTenantId}
              onChange={(event) => changeTenant(event.target.value)}
              disabled={tenantsLoading}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
            >
              <option value="">
                {tenantsLoading ? 'Loading workspaces...' : 'Select workspace'}
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.name}
                </option>
              ))}
            </select>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  activeTenant ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="truncate text-[11px] text-slate-500">
                {activeTenant?.name || 'No workspace selected'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
              AI
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800">
                Knowledge Assistant
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Document intelligence
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {page?.label || 'Workspace'}
              </p>
              <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">
                {activeTenant?.name || 'Select a workspace to get started'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Workspace ready
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
              AI
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
