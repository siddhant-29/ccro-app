export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) return NextResponse.json({ count: 0 })

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('news_posts')
      .select('id')
      .eq('status', 'published')

    if (postsError || !posts || posts.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const allIds = (posts as { id: string }[]).map(p => p.id)

    const { data: reads } = await supabaseAdmin
      .from('news_post_reads')
      .select('post_id')
      .eq('user_id', authData.user.id)
      .in('post_id', allIds)

    const count = Math.max(0, allIds.length - ((reads ?? []).length))
    return NextResponse.json({ count })
  } catch (err) {
    console.error('[api/news/unread-count] error:', err)
    return NextResponse.json({ count: 0 })
  }
}
