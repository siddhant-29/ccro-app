/**
 * POST /api/telegram/setup
 *
 * One-shot endpoint to register the webhook URL with Telegram.
 * Call once after each deployment:
 *   curl -X POST https://<your-domain>/api/telegram/setup \
 *        -H "Content-Type: application/json" \
 *        -d '{"url":"https://<your-domain>/api/telegram/webhook"}'
 *
 * Protected by CRON_SECRET so only infra can call it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setWebhook } from '@/lib/telegram/bot';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  const { url } = (await req.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ ok: false, error: 'missing url' }, { status: 400 });
  }

  await setWebhook(url);
  return NextResponse.json({ ok: true, webhook: url });
}
