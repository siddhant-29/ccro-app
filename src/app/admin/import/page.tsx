'use client'

// KAN-134: Bulk card import — JSON + CSV with preview, validation, audit log

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

type RowStatus = 'valid' | 'update' | 'error'

type PreviewRow = {
  raw: Record<string, unknown>
  card_id: string
  card_name: string
  issuer: string
  country_code: string
  card_type: string
  annual_fee: number | null
  status: RowStatus
  errorMsg?: string
}

type ImportResult = {
  imported: number
  updated: number
  errors: { card_id: string; error: string }[]
}

// ── Validation (mirrors server-side) ──────────────────────────────────────

const VALID_COUNTRIES = ['IN', 'US', 'GB', 'AE']
const VALID_CARD_TYPES = ['points', 'cashback', 'hybrid']

function validateRow(raw: Record<string, unknown>): PreviewRow {
  const card_id    = String(raw.card_id    ?? '').trim()
  const card_name  = String(raw.card_name  ?? '').trim()
  const issuer     = String(raw.issuer     ?? '').trim()
  const country_code = String(raw.country_code ?? 'IN').trim() || 'IN'
  const card_type  = String(raw.card_type  ?? 'points').trim() || 'points'

  const rawFee = raw.annual_fee_amount
  const annual_fee =
    rawFee != null && rawFee !== ''
      ? Number(rawFee)
      : null

  const base: Omit<PreviewRow, 'status' | 'errorMsg'> = {
    raw, card_id, card_name, issuer, country_code, card_type, annual_fee,
  }

  if (!card_id || !/^[a-z0-9_]+$/.test(card_id)) {
    return { ...base, status: 'error', errorMsg: 'card_id invalid (lowercase letters, digits, _ only)' }
  }
  if (!card_name) {
    return { ...base, status: 'error', errorMsg: 'card_name is required' }
  }
  if (!issuer) {
    return { ...base, status: 'error', errorMsg: 'issuer is required' }
  }
  if (!VALID_COUNTRIES.includes(country_code)) {
    return { ...base, status: 'error', errorMsg: `country_code must be ${VALID_COUNTRIES.join(' | ')}` }
  }
  if (!VALID_CARD_TYPES.includes(card_type)) {
    return { ...base, status: 'error', errorMsg: `card_type must be ${VALID_CARD_TYPES.join(' | ')}` }
  }
  if (annual_fee !== null && (isNaN(annual_fee) || annual_fee < 0)) {
    return { ...base, status: 'error', errorMsg: 'annual_fee_amount must be >= 0' }
  }

  return { ...base, status: 'valid' }
}

// ── CSV parser ─────────────────────────────────────────────────────────────

function csvLine(line: string): string[] {
  const values: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      values.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  values.push(cur)
  return values.map(v => v.trim())
}

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = csvLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = csvLine(line)
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusCell({ row }: { row: PreviewRow }) {
  if (row.status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
        ✓ New
      </span>
    )
  }
  if (row.status === 'update') {
    return (
      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
        ↑ Update
      </span>
    )
  }
  return (
    <div>
      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
        ✗ Error
      </span>
      {row.errorMsg && (
        <p className="text-red-500 text-xs mt-0.5 max-w-[160px]">{row.errorMsg}</p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab]         = useState<'json' | 'csv'>('json')
  const [jsonText, setJsonText] = useState('')
  const [csvFile, setCsvFile]   = useState<File | null>(null)
  const [rows, setRows]         = useState<PreviewRow[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)

  async function handlePreview() {
    setParseError(null)
    setRows(null)
    setPreviewing(true)
    try {
      // 1. Parse input
      let rawRows: Record<string, unknown>[]
      if (tab === 'json') {
        if (!jsonText.trim()) throw new Error('Paste JSON before previewing.')
        const parsed: unknown = JSON.parse(jsonText)
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects.')
        rawRows = parsed as Record<string, unknown>[]
      } else {
        if (!csvFile) throw new Error('Select a CSV file first.')
        const text = await csvFile.text()
        rawRows = parseCSV(text)
        if (rawRows.length === 0) throw new Error('CSV has no data rows.')
      }

      // 2. Client-side validation
      const validated = rawRows.map(validateRow)

      // 3. Mark existing card_ids as 'update'
      try {
        const res = await fetch('/api/admin/cards/ids')
        if (res.ok) {
          const { card_ids } = await res.json() as { card_ids: string[] }
          const existingSet = new Set(card_ids)
          for (const row of validated) {
            if (row.status === 'valid' && existingSet.has(row.card_id)) {
              row.status = 'update'
            }
          }
        }
      } catch {
        // Non-fatal — proceed without update detection
      }

      setRows(validated)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Parse failed.')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!rows) return
    const valid = rows.filter(r => r.status === 'valid' || r.status === 'update')
    if (valid.length === 0) return

    setImporting(true)
    setParseError(null)
    try {
      const res = await fetch('/api/admin/cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: valid.map(r => r.raw) }),
      })
      const data = await res.json() as ImportResult
      setResult(data)
    } catch {
      setParseError('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  function handleReset() {
    setRows(null)
    setResult(null)
    setJsonText('')
    setCsvFile(null)
    setParseError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validCount  = rows?.filter(r => r.status === 'valid').length  ?? 0
  const updateCount = rows?.filter(r => r.status === 'update').length ?? 0
  const errorCount  = rows?.filter(r => r.status === 'error').length  ?? 0
  const importable  = validCount + updateCount

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-white text-stone-900 shadow-sm'
        : 'text-stone-500 hover:text-stone-700'
    }`

  // ── Post-import result screen ────────────────────────────────────────────
  if (result) {
    const hasErrors = result.errors.length > 0
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-stone-400 hover:text-stone-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-stone-900">Import Cards</h1>
        </div>

        <div className={`border rounded-xl p-5 ${hasErrors ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`font-semibold text-base ${hasErrors ? 'text-amber-800' : 'text-green-800'}`}>
            {!hasErrors ? '✓' : '⚠'} Imported {result.imported}, updated {result.updated}
            {hasErrors ? `, ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}` : ''}
          </p>
          {hasErrors && (
            <ul className="mt-3 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-amber-700">
                  <span className="font-mono font-medium">{e.card_id}</span>: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium bg-white border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-700 transition-colors"
          >
            Import more
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ── Main import screen ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-stone-400 hover:text-stone-600 text-sm">← Dashboard</Link>
        <h1 className="text-xl font-semibold text-stone-900">Import Cards</h1>
      </div>

      {/* Tabs */}
      <div className="bg-stone-100 p-1 rounded-xl flex gap-1 w-fit">
        <button className={tabCls(tab === 'json')} onClick={() => { setTab('json'); handleReset() }}>JSON</button>
        <button className={tabCls(tab === 'csv')}  onClick={() => { setTab('csv');  handleReset() }}>CSV</button>
      </div>

      {/* Input area */}
      {tab === 'json' ? (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Paste an array of card objects. Required fields: <code className="bg-stone-100 px-1 rounded">card_id</code>, <code className="bg-stone-100 px-1 rounded">card_name</code>, <code className="bg-stone-100 px-1 rounded">issuer</code>.
          </p>
          <textarea
            value={jsonText}
            onChange={e => { setJsonText(e.target.value); setRows(null); setParseError(null) }}
            placeholder={'[\n  {\n    "card_id": "hdfc_infinia",\n    "card_name": "HDFC Infinia",\n    "issuer": "HDFC Bank",\n    "country_code": "IN",\n    "card_type": "points",\n    "annual_fee_amount": 12500\n  }\n]'}
            className="w-full h-64 font-mono text-xs bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            CSV headers:{' '}
            <code className="bg-stone-100 px-1 rounded text-xs">
              card_id, card_name, issuer, country_code, card_type, card_network, annual_fee_amount, joining_fee_amount, forex_markup_pct, lounge_dom_per_year, lounge_intl_per_year, upi_supported, availability_status, source_url, tier
            </code>
          </p>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-amber-400 bg-stone-50 transition-colors">
            <svg className="w-8 h-8 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm text-stone-500">
              {csvFile ? csvFile.name : 'Click to upload .csv file'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setCsvFile(f)
                setRows(null)
                setParseError(null)
              }}
            />
          </label>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{parseError}</p>
      )}

      {/* Preview button */}
      {!rows && (
        <button
          onClick={handlePreview}
          disabled={previewing || (tab === 'json' ? !jsonText.trim() : !csvFile)}
          className="px-5 py-2 text-sm font-medium bg-stone-800 hover:bg-stone-900 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-lg transition-colors"
        >
          {previewing ? 'Parsing…' : 'Preview'}
        </button>
      )}

      {/* Preview table */}
      {rows && rows.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  {['Status', 'card_id', 'card_name', 'issuer', 'country', 'card_type', 'annual_fee'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-stone-500 px-3 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-stone-100 last:border-0 ${
                      row.status === 'error' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5"><StatusCell row={row} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-stone-700">{row.card_id || <span className="text-stone-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-stone-900">{row.card_name || <span className="text-stone-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-stone-600">{row.issuer || <span className="text-stone-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-stone-600">{row.country_code}</td>
                    <td className="px-3 py-2.5 text-stone-600 capitalize">{row.card_type}</td>
                    <td className="px-3 py-2.5 text-stone-600 tabular-nums">
                      {row.annual_fee != null ? row.annual_fee.toLocaleString('en-IN') : <span className="text-stone-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary + actions */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-stone-600">
              {validCount > 0 && <span className="text-green-700 font-medium">{validCount} to import</span>}
              {validCount > 0 && (updateCount > 0 || errorCount > 0) && ', '}
              {updateCount > 0 && <span className="text-blue-700 font-medium">{updateCount} to update</span>}
              {updateCount > 0 && errorCount > 0 && ', '}
              {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium bg-white border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-700 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importable === 0}
                className="px-5 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-lg transition-colors"
              >
                {importing ? 'Importing…' : `Import ${importable} card${importable !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
          No rows found in the input.
        </p>
      )}

    </div>
  )
}
