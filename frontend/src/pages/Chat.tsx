import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { MarkdownParser } from '../components/MarkdownParser'
import { SourceCitation } from '../components/SourceCitation'
import { TenantGuard } from '../components/TenantGuard'

export default function Chat() {
  const [question, setQuestion] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const messagesRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const { data: chatData, isPending: chatPending } = useQuery({
    queryKey: ['chat'],
    queryFn: async () => {
      if (!messagesRef.current.length) return null
      const lastUserMessage =
        messagesRef.current[messagesRef.current.length - 1]
      if (!lastUserMessage || lastUserMessage.role !== 'user') return null
      return api.chat(lastUserMessage.content)
    },
    enabled: messagesRef.current.length > 0,
    retry: false,
  })

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || streaming) return

    const userMessage = question.trim()
    setQuestion('')
    messagesRef.current.push({ role: 'user', content: userMessage })
    setStreaming(true)

    try {
      const response = await api.chat(userMessage)
      messagesRef.current.push({
        role: 'assistant',
        content: response.answer,
      })
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Something went wrong'
      messagesRef.current.push({
        role: 'assistant',
        content: `Error: ${errorMessage}`,
      })
    } finally {
      setStreaming(false)
    }
  }

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messagesRef.current])

  return (
    <TenantGuard>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold text-neutral-900">Chat</h2>
          <p className="text-neutral-600 mt-1">Ask questions about your documents</p>
        </header>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Messages */}
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            {messagesRef.current.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  {msg.role === 'user' ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-1l.21 1.79c.13.58.21 1.17.21 1.79 0 4.08-3.05 7.44-7 7.93z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  )}
                </div>
                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-xl rounded-tr-none p-3 text-sm'
                      : 'bg-neutral-100 text-neutral-900 rounded-xl rounded-tl-none p-3 text-sm prose-chat'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownParser content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
                <div className="bg-neutral-100 text-neutral-900 rounded-xl rounded-tl-none p-3 text-sm animate-pulse">
                  <span className="w-3 h-3 rounded-full bg-neutral-500 inline-block mr-1"></span>Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-neutral-200 bg-white">
            <form onSubmit={sendMessage} className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                disabled={streaming}
              />
              <button
                type="submit"
                disabled={!question.trim() || streaming}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {streaming ? 'Sending...' : 'Ask'}
              </button>
            </form>
          </div>
        </div>

        {chatData?.sources.length && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Sources
            </h3>
            <div className="flex gap-2 flex-wrap">
              {chatData.sources.map((source) => (
                <SourceCitation key={source.ref} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
    </TenantGuard>
  )
}
