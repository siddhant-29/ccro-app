export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

export async function PATCH(
  req: Request,
  { params }: { params: { cardId: string } }
) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>

  // Split changedFields from the card update payload
  const changedFields = body.changedFields as Record<string, unknown> | undefined
  const updateData = Object.fromEntries(
    Object.entries(body).filter(([k]) => k !== 'changedFields')
  )

  const now = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('card_rewards')
    .update({ ...updateData, last_refreshed_at: now })
    .eq('card_id', params.cardId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (changedFields && Object.keys(changedFields).length > 0) {
    await supabaseAdmin.from('card_data_versions').insert({
      card_id: params.cardId,
      field_name: 'bulk_update',
      new_value: changedFields,
      source: 'manual',
      changed_by: admin.id,
    })
  }

  return Response.json({ ok: true })
}
