export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>

  const cardId = body.card_id
  if (!cardId || typeof cardId !== 'string') {
    return Response.json({ error: 'card_id is required.' }, { status: 400 })
  }

  // Validate uniqueness
  const { data: existing } = await supabaseAdmin
    .from('card_rewards')
    .select('card_id')
    .eq('card_id', cardId)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: `card_id "${cardId}" already exists.` }, { status: 409 })
  }

  // Split changedFields from insert payload
  const insertData = Object.fromEntries(
    Object.entries(body).filter(([k]) => k !== 'changedFields')
  )

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('card_rewards')
    .insert({ ...insertData, last_refreshed_at: now })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('card_data_versions').insert({
    card_id: cardId,
    field_name: 'bulk_update',
    new_value: insertData,
    source: 'manual',
    changed_by: admin.id,
  })

  return Response.json({ ok: true })
}
