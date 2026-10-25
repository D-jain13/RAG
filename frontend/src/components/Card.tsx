import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddingMap: Record<string, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div
      className={[
        'bg-white rounded-xl border border-neutral-200 shadow-sm',
        paddingMap[padding],
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
