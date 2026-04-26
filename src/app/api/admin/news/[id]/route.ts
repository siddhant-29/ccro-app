export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })

  const cardIds = (data as Record<string, unknown> & { affected_cards?: string[] }).affected_cards ?? []
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
      affected_card_names: cardIds.map(id => cardNameMap[id] ?? id),
    },
  })
}

const PATCHABLE = [
  'headline', 'summary', 'analysis',
  'primary_source_url', 'primary_source_name',
  'secondary_source_url', 'secondary_source_name',
  'severity', 'affected_cards', 'affected_country', 'tags', 'status',
]

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const update: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (key in body) update[key] = body[key]
  }

  if (!Object.keys(update).length) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ post: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('news_posts')
    .update({ status: 'archived' })
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
