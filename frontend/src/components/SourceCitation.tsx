import React, { useState } from 'react'

interface SourceCitationProps {
  source: {
    ref: number
    document_id: string
    filename: string
    heading_path: string | null
    chunk_index: number
  }
}

export function SourceCitation({ source }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group relative">
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          expanded ? 'bg-brand-50 text-brand-700' : 'bg-brand-50/50 text-brand-600 hover:bg-brand-50'
        }`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <svg
          className={`w-3.5 h-3.5 text-brand-600 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14m10-11v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h4a2 2 0 012 2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2z"
          />
        </svg>
        Ref {source.ref}
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-1.5 w-72 z-10 bg-white rounded-lg border border-neutral-200 shadow-lg p-3 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="font-medium text-sm text-neutral-900 mb-1 truncate">{source.filename}</div>
          <div className="text-xs text-neutral-500 mb-1">Chunk {source.chunk_index + 1}</div>
          {source.heading_path && (
            <div className="text-xs text-neutral-500 capitalize">{source.heading_path}</div>
          )}
        </div>
      )}
    </div>
  )
}