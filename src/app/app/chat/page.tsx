'use client'

// KAN-56–65: EP7 AI Chat Interface | KAN-123/127: layout + animations

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRequireAuth } from '@/hooks/useAuth'
import { useCards } from '@/hooks/useCards'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { getDynamicHomeQuestions } from '@/lib/suggested-queries'
import { BottomNav } from '@/components/BottomNav'
import { createBrowserClient } from '@/lib/supabase'

export default function ChatPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const { data: cards } = useCards(user?.id)
  const { messages, isLoading, historyLoaded, sendMessage, stopStreaming, loadHistory } = useChat()

  const [input, setInput] = useState('')
  const [showHome, setShowHome] = useState(true)
  const [homeQuestions, setHomeQuestions] = useState<string[]>([])
  const [isFirstSession, setIsFirstSession] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Stable card list for question generation
  const cardList = useMemo(
    () => (cards ?? []).map(c => ({
      id: c.card_id,
      name: c.card_rewards?.card_name ?? c.card_id,
    })),
    [cards]
  )

  // Time-aware greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName =
    ((user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined)
      ?.split(' ')[0] ?? 'there'

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // After history loads: if there are existing messages, show them (not chips)
  useEffect(() => {
    if (historyLoaded && messages.length > 0) {
      setShowHome(false)
    }
  }, [historyLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise questions when cards first load
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

  // Listen for home-reset — regenerate questions on every Home tab tap
  useEffect(() => {
    function onHomeReset() {
      setShowHome(true)
      setHomeQuestions(getDynamicHomeQuestions(cardList, null))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('ccro:home-reset', onHomeReset)
    return () => window.removeEventListener('ccro:home-reset', onHomeReset)
  }, [cardList])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  if (typeof window === 'undefined') return null

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col">

      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold leading-none">CC</span>
          </div>
          <span className="font-semibold text-stone-900 text-sm">Rewards Advisor</span>
        </div>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {!historyLoaded ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-12 bg-stone-100 rounded-2xl animate-pulse w-52" />
              </div>
            ))}
          </div>
        ) : showHome ? (
          isFirstSession ? (
            <FirstSessionWelcome
              firstName={firstName}
              cardList={cardList}
              homeQuestions={homeQuestions}
              onSend={handleSend}
            />
          ) : (
            <WelcomeState
              greeting={greeting}
              firstName={firstName}
              homeQuestions={homeQuestions}
              onSend={handleSend}
            />
          )
        ) : (
          <div className="space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
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

// ── Sub-components ───────────────────────────────────────────────────────

function FirstSessionWelcome({
  firstName,
  cardList,
  homeQuestions,
  onSend,
}: {
  firstName: string
  cardList: { id: string; name: string }[]
  homeQuestions: string[]
  onSend: (q: string) => void
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <div className="text-3xl mb-3">👋</div>
        <h1 className="text-xl font-semibold text-stone-900 mb-1">
          Welcome to CCRO{firstName && firstName !== 'there' ? `, ${firstName}` : ''}!
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

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {homeQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSend(q)}
            className="w-full text-left px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 hover:border-amber-300 hover:bg-amber-50 active:scale-95 transition-all duration-150 leading-snug"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function WelcomeState({
  greeting,
  firstName,
  homeQuestions,
  onSend,
}: {
  greeting: string
  firstName: string
  homeQuestions: string[]
  onSend: (q: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mb-5">
        <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold leading-none">CC</span>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-stone-900 mb-1">
        {greeting}, {firstName} 👋
      </h2>
      <p className="text-stone-500 text-sm mb-7">What can I help you with today?</p>
      <div className="grid grid-cols-1 gap-3 w-full max-w-lg mx-auto">
        {homeQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSend(q)}
            className="w-full text-left px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 hover:border-amber-300 hover:bg-amber-50 active:scale-95 transition-all duration-150 leading-snug"
          >
            {q}
          </button>
        ))}
      </div>
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
    <div className="space-y-1">
      {content.split('\n').map((line, i) => (
        <MarkdownLine key={i} line={line} />
      ))}
    </div>
  )
}

function MarkdownLine({ line }: { line: string }) {
  if (line === '') return <div className="h-1.5" />
  if (line.startsWith('### ')) return <h3 className="font-semibold text-sm mt-1.5">{parseInline(line.slice(4))}</h3>
  if (line.startsWith('## '))  return <h2 className="font-semibold text-sm mt-2">{parseInline(line.slice(3))}</h2>
  if (line.startsWith('# '))   return <h1 className="font-semibold text-sm mt-2">{parseInline(line.slice(2))}</h1>

  if (line.startsWith('- ') || line.startsWith('* ')) {
    return (
      <div className="flex gap-1.5 items-start">
        <span className="mt-2 w-1.5 h-1.5 bg-stone-400 rounded-full flex-shrink-0" />
        <span className="text-sm leading-relaxed">{parseInline(line.slice(2))}</span>
      </div>
    )
  }

  const numberedMatch = line.match(/^(\d+)\.\s(.*)$/)
  if (numberedMatch) {
    return (
      <div className="text-sm leading-relaxed">
        <span className="text-stone-500 mr-1">{numberedMatch[1]}.</span>
        {parseInline(numberedMatch[2])}
      </div>
    )
  }

  return <p className="text-sm leading-relaxed">{parseInline(line)}</p>
}

function parseInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">{part.slice(1, -1)}</code>
        }
        return part
      })}
    </>
  )
}
