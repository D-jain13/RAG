import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helper?: string
}

export function Select({ label, error, helper, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        className={[
          'w-full rounded-lg border px-3.5 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50 disabled:cursor-not-allowed appearance-none',
          error ? 'border-error-500 focus:ring-error-100 focus:border-error-500' : 'border-neutral-300 focus:border-brand-500',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-error-600">{error}</p>}
      {helper && !error && <p className="mt-1 text-sm text-neutral-500">{helper}</p>}
    </div>
  )
}