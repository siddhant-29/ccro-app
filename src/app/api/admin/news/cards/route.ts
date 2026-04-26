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
    .select('card_id, card_name')
    .eq('country_code', 'IN')
    .eq('availability_status', 'active')
    .order('card_name')

  return Response.json({ cards: (data ?? []) as { card_id: string; card_name: string }[] })
}
