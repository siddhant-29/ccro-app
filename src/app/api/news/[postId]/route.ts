export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: { postId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select('*')
    .eq('id', params.postId)
    .eq('status', 'published')
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })

  // Increment view count (fire and forget)
  void supabaseAdmin
    .from('news_posts')
    .update({ view_count: ((data as Record<string, unknown>).view_count as number ?? 0) + 1 })
    .eq('id', params.postId)

  // Read status
  const { data: read } = await supabaseAdmin
    .from('news_post_reads')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', params.postId)
    .maybeSingle()

  // Card names
  const cardIds = ((data as Record<string, unknown>).affected_cards as string[]) ?? []
  const cardNameMap: Record<string, string> = {}
  if (cardIds.length > 0) {
    const { data: cards } = await supabaseAdmin
      .from('card_rewards')
      .select('card_id, card_name')
      .in('card_id', cardIds)
    for (const c of (cards ?? []) as { card_id: string; card_name: string }[]) {
      cardNameMap[c.card_id] = c.card_name
    }
  }

  return Response.json({
    post: {
      ...data,
      is_read: !!read,
      affected_card_names: cardIds.map(id => cardNameMap[id] ?? id),
    },
  })
}
