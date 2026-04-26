export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

export async function POST(
  _req: Request,
  { params }: { params: { postId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Insert; ignore duplicate (post already read)
  await supabaseAdmin
    .from('news_post_reads')
    .insert({
      post_id: params.postId,
      user_id: user.id,
      read_at: new Date().toISOString(),
    })

  return Response.json({ ok: true })
}
