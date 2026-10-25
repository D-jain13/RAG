import React from 'react'

interface DocumentStatusBadgeProps {
  status: DocumentStatus
}

type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'indexed'
  | 'duplicate'
  | 'near_duplicate'
  | 'failed'

const STATUS_CONFIG: Record<string, { color: string; text: string; border: string; label: string }> = {
  pending: {
    color: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    label: 'Pending',
  },
  processing: {
    color: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100',
    label: 'Processing',
  },
  indexed: {
    color: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    label: 'Indexed',
  },
  duplicate: {
    color: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-100',
    label: 'Duplicate',
  },
  near_duplicate: {
    color: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-100',
    label: 'Near Duplicate',
  },
  failed: {
    color: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-100',
    label: 'Failed',
  },
}

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  )
}
