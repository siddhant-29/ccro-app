export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

type ConvRow = {
  role: string
  content: { text?: string } | string | null
  created_at: string
}

function extractText(content: ConvRow['content']): string {
  if (typeof content === 'string') return content
  return content?.text ?? ''
}

function truncate(str: string, max: number): string {
  const s = str.trim()
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ conversations: [] })

  const { data } = await supabaseAdmin
    .from('conversations')
    .select('role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200)

  const turns = (data ?? []) as ConvRow[]

  // Build conversation entries: each user turn + the following assistant turn
  const userTurns = turns.filter(t => t.role === 'user')
  const conversations = userTurns.map(ut => {
    const assistantTurn = turns.find(
      t => t.role === 'assistant' && t.created_at > ut.created_at
    )
    const title = truncate(extractText(ut.content), 60) || 'Untitled'
    const preview = assistantTurn
      ? truncate(extractText(assistantTurn.content), 90)
      : '…'
    const ageMs = Date.now() - new Date(ut.created_at).getTime()
    return {
      id: ut.created_at,
      title,
      preview,
      created_at: ut.created_at,
      recent: ageMs < 24 * 3_600_000,
    }
  })

  // Newest first
  conversations.reverse()

  return Response.json({ conversations })
}
