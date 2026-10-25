import React, { useState, useCallback } from 'react'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  disabled?: boolean
  isLoading?: boolean
}

export function FileDropzone({ onFileSelect, accept, disabled, isLoading }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)

      if (disabled || isLoading) return

      const file = e.dataTransfer.files[0]
      if (file) onFileSelect(file)
    },
    [disabled, isLoading, onFileSelect]
  )

  const handleClick = () => {
    if (disabled || isLoading) return
    fileInputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      className={[
        'relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
        isDragActive
          ? 'border-brand-500 bg-brand-50'
          : disabled || isLoading
          ? 'border-neutral-200 bg-neutral-50 cursor-not-allowed'
          : 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50/50',
      ].join(' ')}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={disabled || isLoading}
      />

      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4">
          {isLoading ? (
            <svg className="w-6 h-6 animate-spin text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
        </div>

        <p className="text-sm font-medium text-neutral-900 mb-1">
          {isLoading ? 'Uploading...' : 'Drop a file or click to select'}
        </p>
        <p className="text-xs text-neutral-500 mb-2">
          {accept || 'PDF · DOCX · TXT · CSV · XLSX · MD'}
        </p>

        {!isLoading && !disabled && (
          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
            Browse Files
          </Button>
        )}
      </div>
    </div>
  )
}