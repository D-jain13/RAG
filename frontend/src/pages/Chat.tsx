import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../api/client'
import type { ChatHistoryMessage, Source } from '../api/client'
import { MarkdownParser } from '../components/MarkdownParser'
import { SourceCitation } from '../components/SourceCitation'
import { TenantGuard } from '../components/TenantGuard'
import { useTenantId } from '../hooks/useTenant'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  error?: boolean
  question?: string
  streaming?: boolean
}

const SUGGESTIONS = [
  'Summarize the key points across my documents',
  'What are the main topics covered?',
  'List any deadlines, dates or numbers mentioned',
]

const Sparkle = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" strokeLinecap="round" />
  </svg>
)

// Completed turns only: no errors, nothing still streaming, no question left unanswered
function toHistory(msgs: Message[]): ChatHistoryMessage[] {
  const done = msgs.filter((m) => !m.error && !m.streaming && m.content)
  return done
    .filter((m, i) => m.role === 'assistant' || done[i + 1]?.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong'
}

export default function Chat() {
  const tenantId = useTenantId()
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nextId = useRef(1)

  const abortRef = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  // Pending covers the whole stream; "thinking" is only the wait before the first token
  const lastMsg = messages[messages.length - 1]
  const thinking = pending && !(lastMsg?.role === 'assistant' && lastMsg.streaming)

  // New workspace = new conversation
  useEffect(() => {
    abortRef.current?.abort()
    setMessages([])
  }, [tenantId])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [question])

  const run = async (q: string, prior: Message[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    const id = nextId.current++
    let created = false
    const patch = (fn: (m: Message) => Message) =>
      setMessages((all) => all.map((x) => (x.id === id ? fn(x) : x)))
    const ensure = () => {
      if (created) return
      created = true
      setMessages((all) => [...all, { id, role: 'assistant', content: '', streaming: true }])
    }

    setPending(true)
    try {
      await api.chatStream(
        q,
        {
          onSources: (sources) => {
            ensure()
            patch((m) => ({ ...m, sources }))
          },
          onToken: (t) => {
            ensure()
            patch((m) => ({ ...m, content: m.content + t }))
          },
        },
        controller.signal,
        toHistory(prior),
      )
      if (created) patch((m) => ({ ...m, streaming: false }))
    } catch (err) {
      if (controller.signal.aborted) return
      const failure: Message = { id, role: 'assistant', content: errorText(err), error: true, question: q }
      if (created) patch(() => failure)
      else setMessages((all) => [...all, failure])
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setPending(false)
      }
    }
  }

  const ask = (text: string) => {
    const q = text.trim()
    if (!q || pending) return
    setQuestion('')
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', content: q }])
    run(q, messages)
  }

  const retry = (msg: Message) => {
    if (!msg.question) return
    setMessages((m) => m.filter((x) => x.id !== msg.id))
    // everything before the failed question is its history
    run(msg.question, messages.slice(0, messages.findIndex((x) => x.id === msg.id)))
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(question)
    }
  }

  return (
    <TenantGuard>
      <div className="mx-auto flex h-[calc(100vh-10.5rem)] min-h-[460px] max-w-3xl flex-col">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Chat</h2>
            <p className="mt-1 text-sm text-slate-500">Ask questions about your documents</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={pending}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              New chat
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 && !pending && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                  <Sparkle />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">How can I help?</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Answers are grounded in the documents of your active workspace, with sources.
                </p>
                <div className="mt-6 flex w-full max-w-md flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="group flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                    <Sparkle />
                  </div>
                  <div className="min-w-0 flex-1">
                    {msg.error ? (
                      <div className="rounded-2xl rounded-tl-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <p>{msg.content}</p>
                        <button
                          type="button"
                          onClick={() => retry(msg)}
                          disabled={pending}
                          className="mt-2 text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl rounded-tl-md bg-slate-50 px-4 py-1 text-sm text-slate-800 ring-1 ring-slate-100">
                          <MarkdownParser content={msg.content} />
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              Sources
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.sources.map((s) => (
                                <SourceCitation key={s.ref} source={s} />
                              ))}
                            </div>
                          </div>
                        )}
                        {!msg.streaming && (
                        <button
                          type="button"
                          onClick={() => copy(msg.content)}
                          className="mt-2 text-[11px] font-medium text-slate-400 opacity-0 transition hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                        >
                          Copy
                        </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ),
            )}

            {thinking && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <Sparkle />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                  <span className="ml-2 text-xs text-slate-400">Searching your documents…</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(question)
            }}
            className="border-t border-slate-100 bg-white p-3 sm:p-4"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
              <textarea
                ref={inputRef}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={2000}
                placeholder="Ask a question about your documents…"
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none! placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!question.trim() || pending}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-400">
              Enter to send · Shift+Enter for a new line
            </p>
          </form>
        </div>
      </div>
    </TenantGuard>
  )
}