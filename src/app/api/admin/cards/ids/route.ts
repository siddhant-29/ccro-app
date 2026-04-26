export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('card_rewards')
    .select('card_id')
    .order('card_id')

  return Response.json({
    card_ids: ((data ?? []) as { card_id: string }[]).map(r => r.card_id),
  })
}
