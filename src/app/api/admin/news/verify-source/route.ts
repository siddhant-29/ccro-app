export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

async function fetchPage(url: string): Promise<{ title: string; html: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CCROBot/1.0)' },
    })
    const html = await res.text()
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return { title: match?.[1]?.trim() ?? '', html }
  } catch {
    return { title: '', html: '' }
  } finally {
    clearTimeout(timeout)
  }
}

function hasPlagiarism(summary: string, html: string): boolean {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()

  const words = summary.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length < 10) return false

  for (let i = 0; i <= words.length - 10; i++) {
    const phrase = words.slice(i, i + 10).join(' ')
    if (text.includes(phrase)) return true
  }
  return false
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { primary_url, secondary_url, summary } = await req.json() as {
    primary_url?: string
    secondary_url?: string
    summary?: string
  }

  const [primary, secondary] = await Promise.all([
    primary_url   ? fetchPage(primary_url)   : Promise.resolve({ title: '', html: '' }),
    secondary_url ? fetchPage(secondary_url) : Promise.resolve({ title: '', html: '' }),
  ])

  const plagiarism_detected = summary && primary.html
    ? hasPlagiarism(summary, primary.html)
    : false

  return Response.json({
    primary_title:      primary.title,
    secondary_title:    secondary.title,
    plagiarism_detected,
  })
}
