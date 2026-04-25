'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

type CardFormData = {
  card_id: string
  card_name: string
  issuer: string
  country_code: string
  tier: string
  card_type: string
  card_network: string
  availability_status: string
  // Fees
  annual_fee_amount: string
  joining_fee_amount: string
  fee_waiver_threshold: string
  // Benefits
  forex_markup_pct: string
  lounge_dom_per_year: string
  lounge_intl_per_year: string
  upi_supported: boolean
  welcome_benefit_amount: string
  welcome_benefit_desc: string
  renewal_benefit_amount: string
  renewal_benefit_desc: string
  // Source
  source_url: string
  refresh_status: string
}

type Props = {
  isNew: boolean
  cardId: string
  initialData: Record<string, unknown> | null
  countries: { code: string; name: string }[]
  earnRates: Record<string, unknown>[]
  transferPartners: Record<string, unknown>[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_FORM: CardFormData = {
  card_id: '', card_name: '', issuer: '', country_code: 'IN',
  tier: '', card_type: '', card_network: '', availability_status: 'active',
  annual_fee_amount: '', joining_fee_amount: '', fee_waiver_threshold: '',
  forex_markup_pct: '', lounge_dom_per_year: '', lounge_intl_per_year: '',
  upi_supported: false, welcome_benefit_amount: '', welcome_benefit_desc: '',
  renewal_benefit_amount: '', renewal_benefit_desc: '',
  source_url: '', refresh_status: 'manual',
}

function dbToForm(db: Record<string, unknown>): CardFormData {
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    card_id:               s(db.card_id),
    card_name:             s(db.card_name),
    issuer:                s(db.issuer),
    country_code:          s(db.country_code) || 'IN',
    tier:                  s(db.tier),
    card_type:             s(db.card_type),
    card_network:          s(db.card_network),
    availability_status:   s(db.availability_status) || 'active',
    annual_fee_amount:     s(db.annual_fee_amount),
    joining_fee_amount:    s(db.joining_fee_amount),
    fee_waiver_threshold:  s(db.fee_waiver_threshold),
    forex_markup_pct:      s(db.forex_markup_pct),
    lounge_dom_per_year:   s(db.lounge_dom_per_year),
    lounge_intl_per_year:  s(db.lounge_intl_per_year),
    upi_supported:         Boolean(db.upi_supported),
    welcome_benefit_amount: s(db.welcome_benefit_amount),
    welcome_benefit_desc:  s(db.welcome_benefit_desc),
    renewal_benefit_amount: s(db.renewal_benefit_amount),
    renewal_benefit_desc:  s(db.renewal_benefit_desc),
    source_url:            s(db.source_url),
    refresh_status:        s(db.refresh_status) || 'manual',
  }
}

function formToDb(f: CardFormData): Record<string, unknown> {
  const n = (s: string) => s.trim() === '' ? null : Number(s)
  return {
    card_id:               f.card_id,
    card_name:             f.card_name,
    issuer:                f.issuer,
    country_code:          f.country_code,
    tier:                  f.tier || null,
    card_type:             f.card_type || null,
    card_network:          f.card_network || null,
    availability_status:   f.availability_status || null,
    annual_fee_amount:     n(f.annual_fee_amount),
    joining_fee_amount:    n(f.joining_fee_amount),
    fee_waiver_threshold:  n(f.fee_waiver_threshold),
    forex_markup_pct:      n(f.forex_markup_pct),
    lounge_dom_per_year:   n(f.lounge_dom_per_year),
    lounge_intl_per_year:  n(f.lounge_intl_per_year),
    upi_supported:         f.upi_supported,
    welcome_benefit_amount: n(f.welcome_benefit_amount),
    welcome_benefit_desc:  f.welcome_benefit_desc || null,
    renewal_benefit_amount: n(f.renewal_benefit_amount),
    renewal_benefit_desc:  f.renewal_benefit_desc || null,
    source_url:            f.source_url || null,
    refresh_status:        f.refresh_status || null,
  }
}

function changedFields(
  current: CardFormData,
  original: Record<string, unknown> | null,
): Record<string, unknown> {
  const cur = formToDb(current)
  if (!original) return cur
  const diff: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(cur)) {
    if (JSON.stringify(v) !== JSON.stringify(original[k] ?? null)) diff[k] = v
  }
  return diff
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
      <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-stone-700">
        {label}
        {hint && <span className="ml-1 text-stone-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 ' +
  'placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const selectCls = inputCls

// ── Main component ─────────────────────────────────────────────────────────

export function CardEditForm({
  isNew, cardId, initialData, countries, earnRates, transferPartners,
}: Props) {
  const router = useRouter()
  const [form, setForm] = useState<CardFormData>(
    initialData ? dbToForm(initialData) : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof CardFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.card_name.trim() || !form.issuer.trim()) {
      setError('Card name and issuer are required.')
      return
    }
    if (isNew && !form.card_id.trim()) {
      setError('Card ID is required.')
      return
    }

    setSaving(true)
    setError(null)

    const diff = changedFields(form, initialData)
    const payload = { ...formToDb(form), changedFields: diff }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cards' : `/api/admin/cards/${cardId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Save failed.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (isNew) router.push(`/admin/cards/${form.card_id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const title = isNew ? 'New Card' : `Edit: ${form.card_name || cardId}`

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-stone-400 hover:text-stone-600 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
      </div>

      {/* 1. IDENTITY */}
      <SectionCard title="Identity">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Card ID" hint="(slug, e.g. hdfc_infinia)">
            <input
              className={inputCls}
              value={form.card_id}
              onChange={e => set('card_id', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              disabled={!isNew}
              placeholder="hdfc_infinia"
            />
          </Field>
          <Field label="Card Name *">
            <input
              className={inputCls}
              value={form.card_name}
              onChange={e => set('card_name', e.target.value)}
              placeholder="HDFC Infinia"
            />
          </Field>
          <Field label="Issuer *">
            <input
              className={inputCls}
              value={form.issuer}
              onChange={e => set('issuer', e.target.value)}
              placeholder="HDFC Bank"
            />
          </Field>
          <Field label="Country">
            <select className={selectCls} value={form.country_code} onChange={e => set('country_code', e.target.value)}>
              {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Tier">
            <select className={selectCls} value={form.tier} onChange={e => set('tier', e.target.value)}>
              <option value="">— Select —</option>
              <option value="entry">Entry</option>
              <option value="mid_premium">Mid-Premium</option>
              <option value="premium">Premium</option>
              <option value="super_premium">Super Premium</option>
              <option value="hnw">HNW</option>
            </select>
          </Field>
          <Field label="Card Type">
            <select className={selectCls} value={form.card_type} onChange={e => set('card_type', e.target.value)}>
              <option value="">— Select —</option>
              <option value="points">Points</option>
              <option value="cashback">Cashback</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </Field>
          <Field label="Card Network">
            <select className={selectCls} value={form.card_network} onChange={e => set('card_network', e.target.value)}>
              <option value="">— Select —</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="rupay">RuPay</option>
              <option value="amex">Amex</option>
              <option value="diners">Diners</option>
            </select>
          </Field>
          <Field label="Availability Status">
            <select className={selectCls} value={form.availability_status} onChange={e => set('availability_status', e.target.value)}>
              <option value="active">Active</option>
              <option value="invite_only">Invite Only</option>
              <option value="discontinued">Discontinued</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* 2. FEES */}
      <SectionCard title="Fees">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Annual Fee">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.annual_fee_amount}
              onChange={e => set('annual_fee_amount', e.target.value)}
              placeholder="10000"
            />
          </Field>
          <Field label="Joining Fee">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.joining_fee_amount}
              onChange={e => set('joining_fee_amount', e.target.value)}
              placeholder="10000"
            />
          </Field>
          <Field label="Fee Waiver Threshold">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.fee_waiver_threshold}
              onChange={e => set('fee_waiver_threshold', e.target.value)}
              placeholder="1000000"
            />
          </Field>
        </div>
      </SectionCard>

      {/* 3. BENEFITS */}
      <SectionCard title="Benefits">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Forex Markup %">
            <input
              type="number" min="0" step="0.01"
              className={inputCls}
              value={form.forex_markup_pct}
              onChange={e => set('forex_markup_pct', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Domestic Lounge / yr" hint="(9999 = unlimited)">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.lounge_dom_per_year}
              onChange={e => set('lounge_dom_per_year', e.target.value)}
              placeholder="9999"
            />
          </Field>
          <Field label="Intl Lounge / yr" hint="(9999 = unlimited)">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.lounge_intl_per_year}
              onChange={e => set('lounge_intl_per_year', e.target.value)}
              placeholder="9999"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.upi_supported}
            onChange={e => set('upi_supported', e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-stone-700">UPI supported</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Welcome Benefit Amount">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.welcome_benefit_amount}
              onChange={e => set('welcome_benefit_amount', e.target.value)}
              placeholder="10000"
            />
          </Field>
          <Field label="Welcome Benefit Description">
            <input
              className={inputCls}
              value={form.welcome_benefit_desc}
              onChange={e => set('welcome_benefit_desc', e.target.value)}
              placeholder="10,000 reward points on first spend"
            />
          </Field>
          <Field label="Renewal Benefit Amount">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.renewal_benefit_amount}
              onChange={e => set('renewal_benefit_amount', e.target.value)}
              placeholder="5000"
            />
          </Field>
          <Field label="Renewal Benefit Description">
            <input
              className={inputCls}
              value={form.renewal_benefit_desc}
              onChange={e => set('renewal_benefit_desc', e.target.value)}
              placeholder="5,000 reward points on renewal"
            />
          </Field>
        </div>
      </SectionCard>

      {/* 4. SOURCE TRACKING */}
      <SectionCard title="Source Tracking">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Source URL">
            <input
              type="url"
              className={inputCls}
              value={form.source_url}
              onChange={e => set('source_url', e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Refresh Status">
            <select className={selectCls} value={form.refresh_status} onChange={e => set('refresh_status', e.target.value)}>
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* Save bar */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Saved ✓
          </span>
        )}
      </div>

      {/* Read-only: earn rates */}
      {!isNew && (
        <>
          <SectionCard title="Earn Rates (read-only)">
            {earnRates.length === 0 ? (
              <p className="text-sm text-stone-400">No earn rates found for this card.</p>
            ) : (
              <pre className="text-xs bg-stone-50 border border-stone-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(earnRates, null, 2)}
              </pre>
            )}
          </SectionCard>

          <SectionCard title="Transfer Partners (read-only)">
            {transferPartners.length === 0 ? (
              <p className="text-sm text-stone-400">No transfer partners found for this card.</p>
            ) : (
              <pre className="text-xs bg-stone-50 border border-stone-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(transferPartners, null, 2)}
              </pre>
            )}
          </SectionCard>
        </>
      )}

    </div>
  )
}
