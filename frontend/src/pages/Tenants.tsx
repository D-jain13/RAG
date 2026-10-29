import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useTenantId } from "../hooks/useTenant";
import axios from "axios";

const PAGE_SIZES = [5, 10, 25, 50];

export default function Tenants() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const queryClient = useQueryClient();
  const activeId = useTenantId();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenants", "page", page, pageSize],
    queryFn: () => api.listTenantsPage({ page, page_size: pageSize }),
    placeholderData: keepPreviousData,
  });
  const tenants = data?.items;
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Deleting the last row of the last page would leave us on an empty page
  useEffect(() => {
    if (data && page > data.total_pages) setPage(data.total_pages);
  }, [data, page]);

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTenant(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setShowCreateForm(false);
      toast.success("Tenant created");
    },
    onError: (error: unknown) => {
      let message = "Failed to create tenant";

      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail ?? message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      toast.error(message);
    },
  });

  const [tenantToDelete, setTenantToDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant deleted");
    },
    onSettled: () => setTenantToDelete(null),
  });

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById(
      "tenant-name-input",
    ) as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;
    createMutation.mutate(name);
    input.value = "";
  };

  const handleDeleteTenant = (tenant: { tenant_id: string; name: string }) =>
    setTenantToDelete({ id: tenant.tenant_id, name: tenant.name });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Tenants
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your multi‑tenant workspaces
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
        >
          Create Tenant
        </button>
      </header>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-neutral-900 mb-4">
            New Tenant
          </h3>
          <form onSubmit={handleCreateTenant} className="flex gap-4">
            <div className="flex-1">
              <input
                id="tenant-name-input"
                type="text"
                placeholder="Tenant name"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                disabled={createMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Tenants list */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-indigo-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm">
          Failed to load tenants. Please try again later.
        </div>
      )}

      {tenants && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-neutral-200">
            {tenants.length === 0 ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-neutral-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900">
                    No tenants found
                  </h3>
                  <p className="text-neutral-600 text-sm">
                    Get started by creating your first tenant
                  </p>
                </div>
              </div>
            ) : (
              tenants.map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="p-6 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        {tenant.name}
                        {tenant.tenant_id === activeId && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        ID: {tenant.tenant_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {tenant.tenant_id !== activeId && (
                        <button
                          onClick={() => api.setTenantId(tenant.tenant_id)}
                          className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        >
                          Switch
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTenant(tenant)}
                        disabled={deleteMutation.isPending}
                        className="text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <label htmlFor="tenant-page-size">Rows per page</label>
                <select
                  id="tenant-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
                  of {total}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!tenantToDelete}
        title="Delete tenant?"
        message={`"${tenantToDelete?.name}" and all of its documents and chunks will be permanently removed. This cannot be undone.`}
        loading={deleteMutation.isPending}
        onConfirm={() => tenantToDelete && deleteMutation.mutate(tenantToDelete.id)}
        onCancel={() => setTenantToDelete(null)}
      />
    </div>
  );
}