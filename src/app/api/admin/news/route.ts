export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

type PostRow = {
  id: string
  status: string
  severity: string
  affected_cards: string[]
  tags: string[]
  [key: string]: unknown
}

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const severity = searchParams.get('severity')
  const card     = searchParams.get('card')

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let posts = (data ?? []) as PostRow[]
  if (status)   posts = posts.filter(p => p.status   === status)
  if (severity) posts = posts.filter(p => p.severity === severity)
  if (card)     posts = posts.filter(p => (p.affected_cards ?? []).includes(card))

  // Join card names
  const allCardIds = Array.from(new Set(posts.flatMap(p => p.affected_cards ?? [])))
  const cardNameMap: Record<string, string> = {}
  if (allCardIds.length > 0) {
    const { data: cards } = await supabaseAdmin
      .from('card_rewards')
      .select('card_id, card_name')
      .in('card_id', allCardIds)
    for (const c of (cards ?? []) as { card_id: string; card_name: string }[]) {
      cardNameMap[c.card_id] = c.card_name
    }
  }

  const enriched = posts.map(p => ({
    ...p,
    affected_card_names: (p.affected_cards ?? []).map(id => cardNameMap[id] ?? id),
  }))

  const drafts = posts.filter(p => p.status === 'draft').length
  return Response.json({ posts: enriched, stats: { drafts_pending: drafts } })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const now = new Date().toISOString()

  const insert: Record<string, unknown> = {
    headline:              body.headline,
    summary:               body.summary,
    analysis:              body.analysis,
    primary_source_url:    body.primary_source_url,
    primary_source_name:   body.primary_source_name,
    secondary_source_url:  body.secondary_source_url  ?? null,
    secondary_source_name: body.secondary_source_name ?? null,
    severity:              body.severity,
    affected_cards:        body.affected_cards  ?? [],
    affected_country:      body.affected_country ?? 'IN',
    tags:                  body.tags ?? [],
    status:                body.status ?? 'draft',
    view_count:            0,
  }

  if (insert.status === 'published') {
    insert.published_at = now
  }

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .insert(insert)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ post: data })
}
