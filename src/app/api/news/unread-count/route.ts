export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ count: 0 })

  const { data: posts } = await supabaseAdmin
    .from('news_posts')
    .select('id')
    .eq('status', 'published')

  const allIds = ((posts ?? []) as { id: string }[]).map(p => p.id)
  if (allIds.length === 0) return Response.json({ count: 0 })

  const { data: reads } = await supabaseAdmin
    .from('news_post_reads')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', allIds)

  const count = Math.max(0, allIds.length - ((reads ?? []).length))
  return Response.json({ count })
}
