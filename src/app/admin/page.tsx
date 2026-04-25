import { supabaseAdmin } from '@/lib/supabase'
import { AdminDashboardClient } from './AdminDashboardClient'

export const dynamic = 'force-dynamic'

export type AdminCardRow = {
  card_id: string
  card_name: string
  issuer: string
  tier: string | null
  card_type: string | null
  last_refreshed_at: string | null
  availability_status: string | null
  country_code: string
  freshnessClass: string
}

function freshnessClass(lastRefreshed: string | null): string {
  if (!lastRefreshed) return 'bg-red-50'
  const days = (Date.now() - new Date(lastRefreshed).getTime()) / 86_400_000
  if (days <= 30) return 'bg-green-50'
  if (days <= 60) return 'bg-amber-50'
  return 'bg-red-50'
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { country?: string }
}) {
  const selectedCountry = searchParams.country ?? 'IN'
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { data: rawCards } = await supabaseAdmin
    .from('card_rewards')
    .select('card_id, card_name, issuer, tier, card_type, last_refreshed_at, availability_status, country_code')
    .eq('country_code', selectedCountry)
    .order('card_name')

  const { data: countriesData } = await supabaseAdmin
    .from('countries')
    .select('code, name')
    .order('name')

  const { count: staleCount } = await supabaseAdmin
    .from('card_rewards')
    .select('*', { count: 'exact', head: true })
    .eq('country_code', selectedCountry)
    .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${thirtyDaysAgo}`)

  const { count: proposalsCount } = await supabaseAdmin
    .from('change_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const cards: AdminCardRow[] = ((rawCards ?? []) as Omit<AdminCardRow, 'freshnessClass'>[]).map(c => ({
    ...c,
    freshnessClass: freshnessClass(c.last_refreshed_at),
  }))

  const countries = (countriesData && countriesData.length > 0
    ? countriesData
    : [{ code: 'IN', name: 'India' }]) as { code: string; name: string }[]

  return (
    <AdminDashboardClient
      cards={cards}
      countries={countries}
      selectedCountry={selectedCountry}
      stats={{
        total: cards.length,
        stale: staleCount ?? 0,
        proposals: proposalsCount ?? 0,
      }}
    />
  )
}
