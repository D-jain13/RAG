import { useEffect, useState } from 'react'

interface MarkdownParserProps {
  content: string
}

export function MarkdownParser({ content }: MarkdownParserProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    const renderMarkdown = (text: string): string => {
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      // Headers
      html = html.replace(
        /^### (.*$)/gim,
        '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>'
      )
      html = html.replace(
        /^## (.*$)/gim,
        '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>'
      )
      html = html.replace(
        /^# (.*$)/gim,
        '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>'
      )

      // Bold and italic
      html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
      html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>')
      html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>')
      html = html.replace(/_(.*?)_/gim, '<em>$1</em>')

      // Inline code
      html = html.replace(
        /`([^`]+)`/gim,
        '<code class="bg-neutral-200 px-1 py-0.5 rounded text-sm font-mono">$1</code>'
      )

      // Code blocks
      html = html.replace(
        /```([\s\S]*?)```/gim,
        '<pre class="bg-neutral-800 text-neutral-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-3"><code>$1</code></pre>'
      )

      // Links
      html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/gim,
        '<a href="$2" target="_blank" rel="noopener" class="text-indigo-600 underline">$1</a>'
      )

      // Unordered lists
      html = html.replace(
        /^\s*-\s+(.*$)/gim,
        '<li class="ml-4 list-disc my-1">$1</li>'
      )

      // Ordered lists
      html = html.replace(
        /^\s*\d+\.\s+(.*$)/gim,
        '<li class="ml-4 list-decimal my-1">$1</li>'
      )

      // Blockquotes
      html = html.replace(
        /^\s*>\s+(.*$)/gim,
        '<blockquote class="border-l-4 border-neutral-300 pl-4 italic text-neutral-600 my-2">$1</blockquote>'
      )

      // Paragraphs
      html = html
        .split('\n\n')
        .map((p) => {
          const trimmed = p.trim()
          if (!trimmed) return ''
          if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed
          return `<p class="my-2 leading-relaxed">${trimmed}</p>`
        })
        .join('\n')

      return html
    }

    setHtml(renderMarkdown(content))
  }, [content])

  return (
    <div
      className="prose-chat"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}