export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'

type CardImportRow = Record<string, unknown>

const VALID_COUNTRIES = new Set(['IN', 'US', 'GB', 'AE'])
const VALID_CARD_TYPES = new Set(['points', 'cashback', 'hybrid'])

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) return null
  return user
}

function validateCard(
  raw: unknown,
): { error: string } | { data: Record<string, unknown> } {
  if (!raw || typeof raw !== 'object') return { error: 'Not an object' }
  const c = raw as Record<string, unknown>

  const cardId = c.card_id
  if (!cardId || typeof cardId !== 'string' || !/^[a-z0-9_]+$/.test(cardId)) {
    return { error: 'card_id is required and must match /^[a-z0-9_]+$/' }
  }
  if (!c.card_name || typeof c.card_name !== 'string' || !(c.card_name as string).trim()) {
    return { error: 'card_name is required' }
  }
  if (!c.issuer || typeof c.issuer !== 'string' || !(c.issuer as string).trim()) {
    return { error: 'issuer is required' }
  }

  const country = (c.country_code as string | undefined) || 'IN'
  if (!VALID_COUNTRIES.has(country)) {
    return { error: `country_code must be one of: ${Array.from(VALID_COUNTRIES).join(', ')}` }
  }

  const cardType = (c.card_type as string | undefined) || 'points'
  if (!VALID_CARD_TYPES.has(cardType)) {
    return { error: `card_type must be one of: ${Array.from(VALID_CARD_TYPES).join(', ')}` }
  }

  if (c.annual_fee_amount != null && c.annual_fee_amount !== '') {
    const fee = Number(c.annual_fee_amount)
    if (!Number.isFinite(fee) || fee < 0) {
      return { error: 'annual_fee_amount must be a number >= 0' }
    }
  }

  const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null)

  return {
    data: {
      card_id:             cardId,
      card_name:           (c.card_name as string).trim(),
      issuer:              (c.issuer as string).trim(),
      country_code:        country,
      card_type:           cardType,
      card_network:        c.card_network ?? null,
      tier:                c.tier ?? null,
      annual_fee_amount:   num(c.annual_fee_amount),
      joining_fee_amount:  num(c.joining_fee_amount),
      forex_markup_pct:    num(c.forex_markup_pct),
      lounge_dom_per_year: num(c.lounge_dom_per_year),
      lounge_intl_per_year:num(c.lounge_intl_per_year),
      upi_supported:       Boolean(c.upi_supported),
      availability_status: (c.availability_status as string | undefined) ?? 'active',
      source_url:          c.source_url ?? null,
      last_refreshed_at:   new Date().toISOString(),
    },
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { cards?: unknown[] }
  try {
    body = await req.json() as { cards?: unknown[] }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawCards = Array.isArray(body.cards) ? body.cards : []
  if (rawCards.length === 0) {
    return Response.json({ error: 'No cards provided' }, { status: 400 })
  }

  const validated: { cardId: string; data: Record<string, unknown> }[] = []
  const errors: { card_id: string; error: string }[] = []

  for (const raw of rawCards) {
    const result = validateCard(raw)
    if ('error' in result) {
      const id = (raw as CardImportRow)?.card_id
      errors.push({ card_id: String(id ?? 'unknown'), error: result.error })
    } else {
      validated.push({ cardId: result.data.card_id as string, data: result.data })
    }
  }

  if (validated.length === 0) {
    return Response.json({ imported: 0, updated: 0, errors })
  }

  // Determine which card_ids already exist (batch)
  const cardIds = validated.map(v => v.cardId)
  const { data: existing } = await supabaseAdmin
    .from('card_rewards')
    .select('card_id')
    .in('card_id', cardIds)

  const existingSet = new Set(
    ((existing ?? []) as { card_id: string }[]).map(r => r.card_id)
  )

  let imported = 0
  let updated = 0

  for (const { cardId, data } of validated) {
    const isUpdate = existingSet.has(cardId)

    const { error: upsertError } = await supabaseAdmin
      .from('card_rewards')
      .upsert(data, { onConflict: 'card_id' })

    if (upsertError) {
      errors.push({ card_id: cardId, error: upsertError.message })
      continue
    }

    // Audit log — non-critical, ignore failures
    await supabaseAdmin.from('card_data_versions').insert({
      card_id:    cardId,
      field_name: 'bulk_import',
      new_value:  data,
      source:     'manual',
      changed_by: admin.id,
      notes:      'Bulk import via admin panel',
    })

    if (isUpdate) updated++
    else imported++
  }

  return Response.json({ imported, updated, errors })
}
