export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function getAuthedUser() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PATCH(
  req: Request,
  { params }: { params: { cardId: string } }
) {
  const user = await getAuthedUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let balance: number
  try {
    const body = await req.json() as { balance?: unknown }
    balance = Number(body?.balance)
    if (!Number.isFinite(balance) || balance < 0) throw new Error()
  } catch {
    return Response.json({ error: 'Invalid balance value.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_cards')
    .update({
      current_points_balance: Math.round(balance),
      balance_last_updated: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('card_id', params.cardId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { cardId: string } }
) {
  const user = await getAuthedUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership before deleting
  const { data: existing } = await supabaseAdmin
    .from('user_cards')
    .select('id')
    .eq('user_id', user.id)
    .eq('card_id', params.cardId)
    .maybeSingle()

  if (!existing) {
    return Response.json({ error: 'Card not found.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('user_cards')
    .delete()
    .eq('user_id', user.id)
    .eq('card_id', params.cardId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
