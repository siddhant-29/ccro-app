import { supabaseAdmin } from '@/lib/supabase'
import { CardEditForm } from './CardEditForm'

export const dynamic = 'force-dynamic'

export default async function CardAdminPage({
  params,
}: {
  params: { cardId: string }
}) {
  const { cardId } = params
  const isNew = cardId === 'new'

  const [cardResult, countriesResult, earnRatesResult, partnersResult] = await Promise.allSettled([
    isNew
      ? Promise.resolve({ data: null })
      : supabaseAdmin.from('card_rewards').select('*').eq('card_id', cardId).single(),
    supabaseAdmin.from('countries').select('code, name').order('name'),
    isNew
      ? Promise.resolve({ data: [] })
      : supabaseAdmin.from('earn_rates').select('*').eq('card_id', cardId).is('effective_to', null),
    isNew
      ? Promise.resolve({ data: [] })
      : supabaseAdmin.from('transfer_partners').select('*').eq('card_id', cardId).is('effective_to', null),
  ])

  const card =
    cardResult.status === 'fulfilled'
      ? (cardResult.value.data as Record<string, unknown> | null)
      : null

  const countriesRaw =
    countriesResult.status === 'fulfilled' ? countriesResult.value.data : null
  const countries = (countriesRaw && countriesRaw.length > 0
    ? countriesRaw
    : [{ code: 'IN', name: 'India' }]) as { code: string; name: string }[]

  const earnRates =
    earnRatesResult.status === 'fulfilled'
      ? (earnRatesResult.value.data ?? [])
      : []

  const transferPartners =
    partnersResult.status === 'fulfilled'
      ? (partnersResult.value.data ?? [])
      : []

  return (
    <CardEditForm
      isNew={isNew}
      cardId={cardId}
      initialData={card}
      countries={countries}
      earnRates={earnRates as Record<string, unknown>[]}
      transferPartners={transferPartners as Record<string, unknown>[]}
    />
  )
}
