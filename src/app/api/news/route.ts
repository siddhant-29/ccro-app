export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

type PostRow = {
  id: string
  severity: string
  tags: string[]
  affected_cards: string[]
  published_at: string | null
  [key: string]: unknown
}

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ posts: [] })

  const { searchParams } = new URL(req.url)
  const filter  = searchParams.get('filter')
  const country = searchParams.get('country') ?? 'IN'

  const { data: postsRaw, error } = await supabaseAdmin
    .from('news_posts')
    .select('*')
    .eq('status', 'published')
    .eq('affected_country', country)
    .order('published_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ posts: [] })

  let posts = (postsRaw ?? []) as PostRow[]

  if (filter === 'critical') {
    posts = posts.filter(p => p.severity === 'critical')
  } else if (filter === 'this_week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    posts = posts.filter(p => (p.published_at ?? '') >= weekAgo)
  } else if (filter === 'devaluations') {
    posts = posts.filter(p => (p.tags ?? []).includes('devaluation'))
  } else if (filter === 'for_you') {
    const { data: userCards } = await supabaseAdmin
      .from('user_cards')
      .select('card_id')
      .eq('user_id', user.id)
    const userCardIds = new Set(((userCards ?? []) as { card_id: string }[]).map(c => c.card_id))
    posts = posts.filter(p => (p.affected_cards ?? []).some(id => userCardIds.has(id)))
  }

  // Read status
  const postIds = posts.map(p => p.id).filter(Boolean)
  const readIds = new Set<string>()
  if (postIds.length > 0) {
    const { data: reads } = await supabaseAdmin
      .from('news_post_reads')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)
    for (const r of (reads ?? []) as { post_id: string }[]) readIds.add(r.post_id)
  }

  // Card names
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
    is_read: readIds.has(p.id),
    affected_card_names: (p.affected_cards ?? []).map(id => cardNameMap[id] ?? id),
  }))

  return Response.json({ posts: enriched })
}
