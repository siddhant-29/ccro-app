'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRequireAuth } from '@/hooks/useAuth'
import { useCards } from '@/hooks/useCards'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { getDynamicHomeQuestions } from '@/lib/suggested-queries'
import { BottomNav } from '@/components/BottomNav'
import { createBrowserClient } from '@/lib/supabase'

// ── Greeting helpers (outside component — pure, no closures) ─────────────────

const SUBTITLES = [
  'What can I help you with today?',
  'How can I help you maximise your rewards?',
  "Your cards, optimised. What's the question?",
  'Ask me anything about your cards.',
]

function greetingPool(name: string | null) {
  return {
    morning: [
      `Good morning${name ? `, ${name}` : ''}! ☀️`,
      `Morning${name ? `, ${name}` : ''}! Ready to make the most of your rewards?`,
      `Good morning${name ? `, ${name}` : ''}! What are we optimising today?`,
    ],
    afternoon: [
      `Good afternoon${name ? `, ${name}` : ''}! 👋`,
      `Hey${name ? ` ${name}` : ''}! How can I help with your cards today?`,
      `Good afternoon${name ? `, ${name}` : ''}! Planning a trip or checking points?`,
    ],
    evening: [
      `Good evening${name ? `, ${name}` : ''}! 🌆`,
      `Evening${name ? `, ${name}` : ''}! What's on your rewards radar today?`,
      `Good evening${name ? `, ${name}` : ''}! Let's put those points to work.`,
    ],
    night: [
      `Hey${name ? ` ${name}` : ''}! 🌙`,
      `Up late${name ? `, ${name}` : ''}? Let's make it worth your while.`,
      `Good evening${name ? `, ${name}` : ''}! Night owl rewards planning?`,
    ],
  }
}

function getDailyGreeting(pool: string[]): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime()
  const dayOfYear = Math.floor((Date.now() - start) / 86400000)
  return pool[dayOfYear % pool.length] ?? pool[0] ?? ''
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

function ChatPageInner() {
  const { user, loading: authLoading } = useRequireAuth()
  const { data: cards } = useCards(user?.id)
  const { messages, isLoading, sendMessage, stopStreaming } = useChat()
  const router = useRouter()

  const [input,              setInput]              = useState('')
  const [showHome,           setShowHome]           = useState(true)
  const [homeQuestions,      setHomeQuestions]      = useState<string[]>([])
  const [isFirstSession,     setIsFirstSession]     = useState(false)
  const [greeting,           setGreeting]           = useState('')
  const [subtitle,           setSubtitle]           = useState('What can I help you with today?')
  const searchParams                                 = useSearchParams()
  const conversationId                              = searchParams.get('conversationId')
  const [historyMessages,    setHistoryMessages]    = useState<HistoryMessage[]>([])
  const [isLoadingHistory,   setIsLoadingHistory]   = useState(false)
  const [restoredMessages,   setRestoredMessages]   = useState<HistoryMessage[]>([])
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Stable card list for question generation
  const cardList = useMemo(
    () => (cards ?? []).map(c => ({
      id: c.card_id,
      name: c.card_rewards?.card_name ?? c.card_id,
    })),
    [cards]
  )

  // Name with fallback chain
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ||
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    null

  // Greeting — runs client-side only to prevent SSR/client hydration mismatch
  useEffect(() => {
    const hour  = new Date().getHours()
    const pools = greetingPool(firstName)
    const pool  =
      hour >= 5  && hour < 12 ? pools.morning
      : hour >= 12 && hour < 17 ? pools.afternoon
      : hour >= 17 && hour < 21 ? pools.evening
      : pools.night
    setGreeting(getDailyGreeting(pool))
    setSubtitle(getDailyGreeting(SUBTITLES))
  }, [firstName])

  // Restore previous conversation from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('credpo_active_chat')
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (Date.now() - parsed.lastUpdated > 86400000) {
        sessionStorage.removeItem('credpo_active_chat')
        return
      }
      const msgs: HistoryMessage[] = parsed.messages ?? []
      if (msgs.length > 0) setRestoredMessages(msgs)
    } catch {}
  }, [])

  // Persist completed messages to sessionStorage whenever they change
  useEffect(() => {
    const completed = messages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    if (completed.length > 0) {
      sessionStorage.setItem('credpo_active_chat', JSON.stringify({
        messages: completed,
        lastUpdated: Date.now(),
      }))
    }
  }, [messages])

  // Load all messages when viewing a past conversation
  useEffect(() => {
    if (!conversationId || !user) return
    const supabase = createBrowserClient()
    setIsLoadingHistory(true)
    supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setHistoryMessages(
            (data as Array<{ role: string; content: unknown }>).map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: typeof msg.content === 'string'
                ? msg.content
                : (msg.content as { text?: string } | null)?.text ?? '',
            }))
          )
        }
        setIsLoadingHistory(false)
      })
  }, [conversationId, user])

  // Pre-filled query from news detail "Ask CREDPO" CTA
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const q = sp.get('q')
    if (q) {
      setShowHome(false)
      setIsFirstSession(false)
      window.history.replaceState({}, '', '/app/chat')
      void sendMessage(q)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise questions client-side — getDynamicHomeQuestions uses Math.random()
  // which would cause hydration errors #418/#423 if called during server render
  useEffect(() => {
    if (cards !== undefined) {
      setHomeQuestions(getDynamicHomeQuestions(cardList, null))
    }
  }, [cardList]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect first session — zero conversations means welcome screen
  useEffect(() => {
    if (!user) return
    const supabase = createBrowserClient()
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => {
        const forceFirstSession = new URLSearchParams(window.location.search).get('first') === 'true'
        setIsFirstSession(forceFirstSession || (count ?? 0) === 0)
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for home-reset — regenerate questions and clear active chat on Home tab tap
  useEffect(() => {
    function onHomeReset() {
      setShowHome(true)
      setRestoredMessages([])
      sessionStorage.removeItem('credpo_active_chat')
      setHomeQuestions(getDynamicHomeQuestions(cardList, null))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('ccro:home-reset', onHomeReset)
    return () => window.removeEventListener('ccro:home-reset', onHomeReset)
  }, [cardList])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleNewChat() {
    setRestoredMessages([])
    setShowHome(true)
    sessionStorage.removeItem('credpo_active_chat')
  }

  function handleSend(directMsg?: string) {
    const msg = (directMsg ?? input).trim()
    if (!msg || isLoading) return
    setShowHome(false)
    setIsFirstSession(false)
    if (!directMsg) {
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }
    void sendMessage(msg)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  // History mode — read-only view of a past conversation
  if (conversationId) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex flex-col">
        <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/app/history')}
            className="text-stone-500 hover:text-stone-700 text-sm flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm text-stone-400">Past conversation</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-4 pb-16">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-stone-400 text-sm animate-pulse">Loading…</div>
            </div>
          ) : historyMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-stone-400 text-sm">No messages found</div>
            </div>
          ) : (
            historyMessages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={{ id: String(i), role: msg.role, content: msg.content, timestamp: '' }}
              />
            ))
          )}
        </div>

        <div className="flex-shrink-0 bg-amber-50 border-t border-amber-100 px-4 py-3 text-center">
          <p className="text-xs text-stone-500">
            Viewing past conversation ·{' '}
            <button
              onClick={() => {
                sessionStorage.removeItem('credpo_active_chat')
                window.dispatchEvent(new CustomEvent('ccro:home-reset'))
                router.replace('/app/chat')
              }}
              className="text-amber-600 font-medium hover:text-amber-700 transition-colors"
            >
              Start new chat
            </button>
          </p>
        </div>

        <BottomNav />
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col">

      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold leading-none">CP</span>
          </div>
          <span className="font-semibold text-stone-900 text-sm">CREDPO</span>
        </div>
        {(messages.length > 0 || restoredMessages.length > 0) && (
          <button
            onClick={handleNewChat}
            className="ml-auto text-xs text-stone-400 hover:text-amber-600 border border-stone-200 hover:border-amber-300 rounded-lg px-3 py-1.5 bg-white transition-colors"
          >
            + New chat
          </button>
        )}
      </header>

      {/* Card pills */}
      {cards && cards.length > 0 && (
        <div className="flex-shrink-0 bg-white border-b border-stone-100 px-4 py-2 flex gap-2 overflow-x-auto">
          {cards.map(card => (
            <span
              key={card.id}
              className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            >
              {card.card_rewards?.card_name ?? card.card_id}
            </span>
          ))}
        </div>
      )}

      {/* Messages / Home */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {messages.length > 0 ? (
          // Active conversation from useChat hook
          <div className="space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ) : restoredMessages.length > 0 ? (
          // Previous conversation restored from sessionStorage (tab navigation return)
          <div className="space-y-4">
            {restoredMessages.map((msg, i) => (
              <MessageBubble
                key={`restored-${i}`}
                message={{ id: `restored-${i}`, role: msg.role, content: msg.content } as ChatMessage}
              />
            ))}
          </div>
        ) : isFirstSession ? (
          <FirstSessionWelcome
            firstName={firstName}
            cardList={cardList}
            homeQuestions={homeQuestions}
            onSend={handleSend}
          />
        ) : (
          <WelcomeState
            greeting={greeting}
            subtitle={subtitle}
            firstName={firstName}
            homeQuestions={homeQuestions}
            onSend={handleSend}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-white border-t border-stone-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your rewards…"
            rows={1}
            disabled={isLoading && !messages.some(m => m.isStreaming)}
            className="flex-1 resize-none bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent overflow-hidden"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          {isLoading ? (
            <button
              onClick={stopStreaming}
              className="w-10 h-10 flex-shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all duration-100 active:scale-95"
              aria-label="Stop streaming"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="w-10 h-10 flex-shrink-0 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl flex items-center justify-center transition-all duration-100 active:scale-95"
              aria-label="Send"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionChips({
  homeQuestions,
  onSend,
  maxWidth = 'max-w-sm',
}: {
  homeQuestions: string[]
  onSend: (q: string) => void
  maxWidth?: string
}) {
  return (
    <div className={`flex flex-col gap-3 w-full ${maxWidth}`}>
      {homeQuestions.length === 0
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))
        : homeQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onSend(q)}
              className="w-full text-left px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 hover:border-amber-300 hover:bg-amber-50 active:scale-95 transition-all duration-150 leading-snug"
            >
              {q}
            </button>
          ))}
    </div>
  )
}

function FirstSessionWelcome({
  firstName,
  cardList,
  homeQuestions,
  onSend,
}: {
  firstName: string | null
  cardList: { id: string; name: string }[]
  homeQuestions: string[]
  onSend: (q: string) => void
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <div className="text-3xl mb-3">👋</div>
        <h1 className="text-xl font-semibold text-stone-900 mb-1">
          Welcome to CREDPO{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-sm text-stone-400 leading-relaxed">
          Your AI-powered credit card rewards advisor
        </p>
      </div>

      {cardList.length > 0 && (
        <div className="w-full max-w-sm bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-2">Your registered cards</p>
          <div className="flex flex-col gap-1">
            {cardList.map(card => (
              <div key={card.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-sm text-stone-700">{card.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-stone-500 text-center">Here&apos;s what I can help you with today:</p>

      <QuestionChips homeQuestions={homeQuestions} onSend={onSend} />
    </div>
  )
}

function WelcomeState({
  greeting,
  subtitle,
  firstName,
  homeQuestions,
  onSend,
}: {
  greeting: string
  subtitle: string
  firstName: string | null
  homeQuestions: string[]
  onSend: (q: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mb-5">
        <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold leading-none">CP</span>
        </div>
      </div>
      <h1 suppressHydrationWarning className="text-xl font-semibold text-stone-900 mb-1">
        {greeting || `Hey${firstName ? ` ${firstName}` : ''}! 👋`}
      </h1>
      <p suppressHydrationWarning className="text-stone-500 text-sm mb-7">{subtitle}</p>
      <QuestionChips homeQuestions={homeQuestions} onSend={onSend} maxWidth="max-w-lg" />
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeSlideUp`}>
      <div className={`max-w-[85%] ${
        isUser
          ? 'bg-amber-600 text-white rounded-2xl rounded-br-md px-4 py-2.5'
          : 'bg-white border border-stone-200 text-stone-900 rounded-2xl rounded-bl-md px-4 py-3'
      }`}>
        {!isUser && message.isStreaming && message.content === '' ? (
          <TypingIndicator />
        ) : isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {message.stopped && (
          <p className="text-xs text-stone-400 mt-1.5 italic">Stopped</p>
        )}
        {message.error && (
          <p className="text-xs text-red-500 mt-1.5">{message.error.message}</p>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 py-0.5 items-center">
      {[0, 150, 300].map(delay => (
        <div
          key={delay}
          className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:      ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em:     ({ children }) => <em>{children}</em>,
        code:   ({ children }) => <code className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">{children}</code>,
        pre:    ({ children }) => <pre className="bg-stone-100 rounded-lg p-3 overflow-x-auto text-xs font-mono my-1">{children}</pre>,
        h1:     ({ children }) => <h1 className="font-semibold text-sm mt-2">{children}</h1>,
        h2:     ({ children }) => <h2 className="font-semibold text-sm mt-2">{children}</h2>,
        h3:     ({ children }) => <h3 className="font-semibold text-sm mt-1.5">{children}</h3>,
        ul:     ({ children }) => <ul className="space-y-0.5 my-0.5">{children}</ul>,
        ol:     ({ children }) => <ol className="space-y-0.5 my-0.5">{children}</ol>,
        li:     ({ children }) => (
          <div className="flex gap-1.5 items-start">
            <span className="mt-2 w-1.5 h-1.5 bg-stone-400 rounded-full flex-shrink-0" />
            <span className="text-sm leading-relaxed">{children}</span>
          </div>
        ),
        hr: () => <hr className="border-stone-200 my-2" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-sm border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-stone-50">{children}</thead>,
        tr:    ({ children }) => <tr className="border-b border-stone-200">{children}</tr>,
        th:    ({ children }) => <th className="text-left px-2 py-1.5 font-semibold text-stone-700 text-xs">{children}</th>,
        td:    ({ children }) => <td className="px-2 py-1.5 text-stone-700 text-xs">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  )
}
