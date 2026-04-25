'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AdminCardRow } from './page'

type Props = {
  cards: AdminCardRow[]
  countries: { code: string; name: string }[]
  selectedCountry: string
  stats: { total: number; stale: number; proposals: number }
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function statusBadge(status: string | null) {
  const s = status ?? 'unknown'
  const cls =
    s === 'active'        ? 'bg-green-100 text-green-700' :
    s === 'invite_only'   ? 'bg-blue-100 text-blue-700' :
    s === 'discontinued'  ? 'bg-red-100 text-red-700' :
                            'bg-stone-100 text-stone-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {s.replace('_', ' ')}
    </span>
  )
}

export function AdminDashboardClient({ cards, countries, selectedCountry, stats }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? cards.filter(c =>
        c.card_name.toLowerCase().includes(search.toLowerCase()) ||
        c.issuer.toLowerCase().includes(search.toLowerCase())
      )
    : cards

  return (
    <div className="space-y-6">

      {/* Title + add button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Admin dashboard</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage card rewards data.</p>
        </div>
        <Link
          href="/admin/cards/new"
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Card
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total cards',        value: stats.total,     warn: false },
          { label: 'Need refresh',       value: stats.stale,     warn: stats.stale > 0 },
          { label: 'Pending proposals',  value: stats.proposals, warn: stats.proposals > 0 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-stone-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${s.warn ? 'text-amber-600' : 'text-stone-900'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={selectedCountry}
          onChange={e => router.push(`/admin?country=${e.target.value}`)}
          className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {countries.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by name or issuer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              {['Card Name', 'Issuer', 'Tier', 'Card Type', 'Last Refreshed', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-stone-500 px-4 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-400 text-sm">
                  No cards found.
                </td>
              </tr>
            )}
            {filtered.map(card => (
              <tr key={card.card_id} className={`border-b border-stone-100 last:border-0 ${card.freshnessClass}`}>
                <td className="px-4 py-3 font-medium text-stone-900">{card.card_name}</td>
                <td className="px-4 py-3 text-stone-600">{card.issuer}</td>
                <td className="px-4 py-3 text-stone-600 capitalize">{card.tier?.replace('_', ' ') ?? '—'}</td>
                <td className="px-4 py-3 text-stone-600 capitalize">{card.card_type ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{relativeDate(card.last_refreshed_at)}</td>
                <td className="px-4 py-3">{statusBadge(card.availability_status)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/cards/${card.card_id}`}
                    className="text-amber-600 hover:text-amber-700 font-medium text-xs"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
