import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Simple ping — just read from card_rewards
  const { count } = await supabaseAdmin
    .from('card_rewards')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    ok: true,
    cards: count,
    timestamp: new Date().toISOString(),
  })
}
