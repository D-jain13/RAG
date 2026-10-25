export function Spinner({
  className = 'h-8 w-8',
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <div className="flex items-center justify-center" role="status" aria-label={label}>
      <div className={`animate-spin rounded-full border-2 border-neutral-200 border-t-indigo-600 ${className}`}>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}
