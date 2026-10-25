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
  return (
    <div
      className="flex max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
      title={source.heading_path ?? source.filename}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-700">
        {source.ref}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[220px] truncate text-xs font-semibold text-slate-800">
          {source.filename}
        </span>
        <span className="block max-w-[220px] truncate text-[11px] text-slate-400">
          {source.heading_path ? `${source.heading_path} · ` : ''}Chunk {source.chunk_index + 1}
        </span>
      </span>
    </div>
  )
}
