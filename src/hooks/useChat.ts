'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatError } from '@/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
  error?: ChatError
  stopped?: boolean
}

interface UseChatResult {
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (content: string) => Promise<void>
  stopStreaming: () => void
  loadHistory: () => Promise<void>
  loadConversationById: (convId: string) => Promise<boolean>
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/chat')
      if (!res.ok) return
      const { messages: history } = await res.json() as {
        messages: Array<{ role: string; content: string; created_at: string }>
      }
      if (Array.isArray(history) && history.length > 0) {
        setMessages(history.map(m => ({
          id: crypto.randomUUID(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at,
        })))
      }
    } catch {
      // Non-fatal — start with empty history
    } finally {
      setHistoryLoaded(true)
    }
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.trim() }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({})) as { error?: ChatError }
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: errBody.error ?? { type: 'unknown', message: 'Request failed.' } }
            : m
        ))
        return
      }

      const reader = res.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const chunk = JSON.parse(raw) as { type: string; content?: string; error?: ChatError }
            if (chunk.type === 'token' && chunk.content) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + chunk.content } : m
              ))
            } else if (chunk.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ))
            } else if (chunk.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false, error: chunk.error } : m
              ))
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } catch (err) {
      const stopped = err instanceof Error && err.name === 'AbortError'
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, isStreaming: false, ...(stopped ? { stopped: true } : { error: { type: 'unknown', message: 'Connection lost.' } }) }
          : m
      ))
    } finally {
      readerRef.current = null
      setIsLoading(false)
    }
  }, [isLoading])

  const stopStreaming = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.isStreaming) {
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, isStreaming: false, stopped: true } : m
        )
      }
      return prev
    })
    setIsLoading(false)
  }, [])

  const loadConversationById = useCallback(async (convId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/chat/history?conversationId=${encodeURIComponent(convId)}`)
      if (!res.ok) return false
      const { messages: history } = await res.json() as {
        messages?: Array<{ role: string; content: string; created_at: string }>
      }
      if (!Array.isArray(history) || history.length === 0) return false
      setMessages(history.map(m => ({
        id: crypto.randomUUID(),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.created_at,
      })))
      return true
    } catch (err) {
      console.error('[useChat] loadConversationById error:', err)
      return false
    }
  }, [])

  return { messages, isLoading, sendMessage, stopStreaming, loadHistory, loadConversationById }
}
