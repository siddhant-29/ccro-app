import { NextRequest, NextResponse } from 'next/server'
import { registerWebhook } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const host = req.headers.get('host') ?? req.nextUrl.host
  const webhookUrl = `https://${host}/api/telegram/webhook`

  const success = await registerWebhook(webhookUrl)

  if (success) {
    return NextResponse.json({
      ok: true,
      message: 'Webhook registered successfully',
      url: webhookUrl,
    })
  } else {
    return NextResponse.json({
      ok: false,
      message: 'Failed — check TELEGRAM_BOT_TOKEN env var',
    }, { status: 500 })
  }
}
