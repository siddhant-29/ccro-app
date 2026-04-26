'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { NewsPostCard } from '@/components/NewsPostCard'
import { NEWS_TAGS } from '@/types/news'
import type { NewsPost, NewsSeverity } from '@/types/news'

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function buildPreview(
  headline: string,
  severity: NewsSeverity | '',
  affectedCards: string[],
  affectedCardNames: string[],
  existingPost: NewsPost | null,
): NewsPost {
  return {
    id:                    existingPost?.id ?? 'preview',
    headline:              headline || 'Post headline',
    summary:               '',
    analysis:              '',
    primary_source_url:    '',
    primary_source_name:   '',
    secondary_source_url:  null,
    secondary_source_name: null,
    severity:              (severity as NewsSeverity) || 'informational',
    affected_cards:        affectedCards,
    affected_country:      'IN',
    tags:                  [],
    status:                existingPost?.status ?? 'draft',
    published_at:          null,
    created_at:            existingPost?.created_at ?? new Date().toISOString(),
    view_count:            0,
    is_read:               false,
    affected_card_names:   affectedCardNames,
  }
}

const SEVERITY_OPTIONS: { value: NewsSeverity; label: string; icon: string; desc: string }[] = [
  { value: 'critical',      label: 'Critical',   icon: '🔴', desc: 'Major devaluation or benefit cut'  },
  { value: 'important',     label: 'Important',  icon: '🟠', desc: 'Significant change worth knowing'  },
  { value: 'informational', label: 'Info',        icon: '🟢', desc: 'Minor update or new feature'       },
]

function GuardrailRow({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div className={`flex items-start gap-2 text-sm ${ok === false ? 'text-red-500' : ok === true ? 'text-emerald-600' : 'text-amber-600'}`}>
      <span className="flex-shrink-0">{ok === true ? '✅' : '⚠️'}</span>
      <span>{label}</span>
    </div>
  )
}

export default function NewsPostEditorPage() {
  const params  = useParams()
  const router  = useRouter()
  const postId  = params.postId as string
  const isNew   = postId === 'new'

  const [headline,      setHeadline]      = useState('')
  const [summary,       setSummary]       = useState('')
  const [analysis,      setAnalysis]      = useState('')
  const [primaryUrl,    setPrimaryUrl]    = useState('')
  const [primaryName,   setPrimaryName]   = useState('')
  const [secondaryUrl,  setSecondaryUrl]  = useState('')
  const [secondaryName, setSecondaryName] = useState('')
  const [severity,      setSeverity]      = useState<NewsSeverity | ''>('')
  const [affectedCards, setAffectedCards] = useState<string[]>([])
  const [tags,          setTags]          = useState<string[]>([])

  const [saving,          setSaving]          = useState(false)
  const [publishing,      setPublishing]      = useState(false)
  const [apiError,        setApiError]        = useState('')
  const [verifying,       setVerifying]       = useState(false)
  const [verifiedTitles,  setVerifiedTitles]  = useState<{ primary?: string; secondary?: string }>({})
  const [plagiarismOk,    setPlagiarismOk]    = useState<boolean | null>(null)
  const [availableCards,  setAvailableCards]  = useState<{ card_id: string; card_name: string }[]>([])
  const [existingPost,    setExistingPost]    = useState<NewsPost | null>(null)
  const [showCardSelect,  setShowCardSelect]  = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/news/${postId}`)
        .then(r => r.json())
        .then(({ post }: { post: NewsPost }) => {
          if (!post) return
          setExistingPost(post)
          setHeadline(post.headline)
          setSummary(post.summary)
          setAnalysis(post.analysis)
          setPrimaryUrl(post.primary_source_url)
          setPrimaryName(post.primary_source_name)
          setSecondaryUrl(post.secondary_source_url ?? '')
          setSecondaryName(post.secondary_source_name ?? '')
          setSeverity(post.severity)
          setAffectedCards(post.affected_cards ?? [])
          setTags(post.tags ?? [])
        })
        .catch(console.error)
    }
  }, [isNew, postId])

  useEffect(() => {
    fetch('/api/admin/news/cards')
      .then(r => r.json())
      .then(({ cards }: { cards: { card_id: string; card_name: string }[] }) => setAvailableCards(cards ?? []))
      .catch(console.error)
  }, [])

  const summaryWords  = countWords(summary)
  const analysisWords = countWords(analysis)
  const totalWords    = summaryWords + analysisWords
  const analysisRatio = totalWords > 0 ? analysisWords / totalWords : 0

  const guardrails = {
    ratio:     analysisRatio >= 0.6,
    plagiarism: plagiarismOk !== false,
    hasCards:  affectedCards.length > 0,
    hasSeverity: severity !== '',
  }
  const allGuardrailsPass = Object.values(guardrails).every(Boolean)

  const canSave    = headline.trim().length > 0 && summary.trim().length > 0
  const canPublish = canSave && !!analysis.trim() && !!primaryUrl.trim() && !!primaryName.trim() && allGuardrailsPass

  const affectedCardNames = affectedCards.map(id => availableCards.find(c => c.card_id === id)?.card_name ?? id)
  const previewPost = buildPreview(headline, severity, affectedCards, affectedCardNames, existingPost)

  async function handleVerify() {
    if (!primaryUrl) return
    setVerifying(true)
    setApiError('')
    try {
      const res  = await fetch('/api/admin/news/verify-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_url: primaryUrl, secondary_url: secondaryUrl || undefined, summary }),
      })
      const data = await res.json() as { primary_title?: string; secondary_title?: string; plagiarism_detected?: boolean }
      setVerifiedTitles({ primary: data.primary_title, secondary: data.secondary_title })
      setPlagiarismOk(!data.plagiarism_detected)
    } catch {
      setApiError('Could not verify sources.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSave(targetStatus: 'draft' | 'published') {
    if (targetStatus === 'draft') setSaving(true)
    else setPublishing(true)
    setApiError('')

    const payload: Record<string, unknown> = {
      headline, summary, analysis,
      primary_source_url:    primaryUrl,
      primary_source_name:   primaryName,
      secondary_source_url:  secondaryUrl  || null,
      secondary_source_name: secondaryName || null,
      severity, affected_cards: affectedCards,
      affected_country: 'IN', tags, status: targetStatus,
    }

    try {
      let res: Response

      if (isNew) {
        res = await fetch('/api/admin/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else if (targetStatus === 'published' && existingPost?.status !== 'published') {
        await fetch(`/api/admin/news/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        res = await fetch(`/api/admin/news/${postId}/publish`, { method: 'POST' })
      } else {
        res = await fetch(`/api/admin/news/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json() as { post?: NewsPost; error?: string }
      if (data.error) { setApiError(data.error); return }

      if (data.post) setExistingPost(data.post)

      if (targetStatus === 'published') {
        router.push('/admin/news')
      } else if (isNew && data.post?.id) {
        router.push(`/admin/news/${data.post.id}`)
      }
    } catch {
      setApiError('Save failed. Please try again.')
    } finally {
      setSaving(false)
      setPublishing(false)
    }
  }

  async function handleArchive() {
    if (typeof window === 'undefined') return
    if (!existingPost?.id) return
    if (!window.confirm('Archive this post? Users won\'t see it anymore.')) return
    const res = await fetch(`/api/admin/news/${postId}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/news')
  }

  function toggleCard(cardId: string) {
    setAffectedCards(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId])
  }

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  return (
    <div className="pb-24">
      <div className="mb-6">
        <Link href="/admin/news" className="text-sm text-stone-500 hover:text-stone-700">← Back to posts</Link>
        <h1 className="text-xl font-semibold text-stone-900 mt-1">{isNew ? 'New post' : 'Edit post'}</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Form ── */}
        <div className="flex-1 space-y-5">

          {/* Content */}
          <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
            <h2 className="font-semibold text-stone-800">Content</h2>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-stone-700">Headline <span className="text-red-500">*</span></label>
                <span className={`text-xs ${headline.length > 100 ? 'text-red-500' : 'text-stone-400'}`}>{headline.length}/120</span>
              </div>
              <input
                type="text"
                value={headline}
                onChange={e => setHeadline(e.target.value.slice(0, 120))}
                placeholder="Axis Magnus devalues rewards from 12X to 8X on dining"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-stone-700">Summary <span className="text-red-500">*</span></label>
                <span className="text-xs text-stone-400">{summaryWords} words</span>
              </div>
              <p className="text-xs text-stone-400 mb-1.5">Plain factual summary in your own words. NO verbatim quotes from sources. 50–150 words ideal.</p>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={4}
                placeholder="Axis Bank has announced changes to the Magnus credit card's reward rate…"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-stone-700">What this means for you <span className="text-red-500">*</span></label>
                <span className="text-xs text-stone-400">{analysisWords} words</span>
              </div>
              <p className="text-xs text-stone-400 mb-1.5">Tactical guidance for your users. This is the value-add.</p>
              <textarea
                value={analysis}
                onChange={e => setAnalysis(e.target.value)}
                rows={5}
                placeholder="If you currently earn 12X on dining using Magnus, you'll effectively see a 33% drop…"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
              />
              {totalWords > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${analysisRatio >= 0.6 ? 'bg-emerald-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.round(analysisRatio * 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${analysisRatio >= 0.6 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.round(analysisRatio * 100)}% analysis{analysisRatio < 0.6 ? ' — needs ≥ 60%' : ''}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Attribution */}
          <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-semibold text-stone-800">Attribution</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Primary source URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={primaryUrl}
                  onChange={e => { setPrimaryUrl(e.target.value); setPlagiarismOk(null); setVerifiedTitles(v => ({ ...v, primary: undefined })) }}
                  placeholder="https://axisbank.com/announcement"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {verifiedTitles.primary && (
                  <p className="mt-1 text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-2 py-1 truncate">&quot;{verifiedTitles.primary}&quot;</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Source name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={primaryName}
                  onChange={e => setPrimaryName(e.target.value)}
                  placeholder="Axis Bank announcement"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Secondary source URL</label>
                <input
                  type="url"
                  value={secondaryUrl}
                  onChange={e => { setSecondaryUrl(e.target.value); setVerifiedTitles(v => ({ ...v, secondary: undefined })) }}
                  placeholder="https://technofino.in/axis-magnus-devaluation"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {verifiedTitles.secondary && (
                  <p className="mt-1 text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-2 py-1 truncate">&quot;{verifiedTitles.secondary}&quot;</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Secondary source name</label>
                <input
                  type="text"
                  value={secondaryName}
                  onChange={e => setSecondaryName(e.target.value)}
                  placeholder="TechnoFino"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={!primaryUrl || verifying}
              className="text-sm bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 px-4 py-2 rounded-xl transition-colors font-medium"
            >
              {verifying ? 'Verifying…' : '🔗 Verify links'}
            </button>
          </section>

          {/* Categorization */}
          <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
            <h2 className="font-semibold text-stone-800">Categorization</h2>

            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Severity <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      severity === opt.value
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <div className="text-sm font-medium text-stone-800">{opt.label}</div>
                    <div className="text-xs text-stone-400 leading-tight mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Affected cards <span className="text-red-500">*</span></label>
              <button
                onClick={() => setShowCardSelect(v => !v)}
                className="text-sm bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl hover:border-stone-300 transition-colors"
              >
                {affectedCards.length === 0 ? 'Select cards…' : `${affectedCards.length} card${affectedCards.length !== 1 ? 's' : ''} selected`}
              </button>
              {affectedCards.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {affectedCardNames.map((name, i) => (
                    <span
                      key={affectedCards[i]}
                      onClick={() => toggleCard(affectedCards[i])}
                      className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      {name} ×
                    </span>
                  ))}
                </div>
              )}
              {showCardSelect && (
                <div className="mt-2 border border-stone-200 rounded-xl bg-white max-h-48 overflow-y-auto">
                  {availableCards.length === 0 ? (
                    <p className="text-sm text-stone-400 px-3 py-2">Loading cards…</p>
                  ) : availableCards.map(card => (
                    <label key={card.card_id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={affectedCards.includes(card.card_id)}
                        onChange={() => toggleCard(card.card_id)}
                        className="accent-amber-600"
                      />
                      <span className="text-sm text-stone-700">{card.card_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {NEWS_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      tags.includes(tag)
                        ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    {tag.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Guardrails */}
          <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
            <h2 className="font-semibold text-stone-800">Editorial guardrails</h2>
            <p className="text-xs text-stone-400">All must pass before publishing.</p>
            <GuardrailRow
              ok={totalWords > 0 ? guardrails.ratio : null}
              label={`Analysis ≥ 60% of total content${totalWords > 0 ? ` (${Math.round(analysisRatio * 100)}%)` : ''}`}
            />
            <GuardrailRow
              ok={plagiarismOk}
              label={
                plagiarismOk === null
                  ? 'No verbatim match with source — click Verify links to check'
                  : plagiarismOk
                  ? 'No verbatim match with source'
                  : '10+ consecutive words match found in source — rewrite summary'
              }
            />
            <GuardrailRow ok={affectedCards.length > 0 ? true : null} label="At least 1 affected card selected" />
            <GuardrailRow ok={severity ? true : null} label="Severity selected" />
          </section>

          {apiError && <p className="text-sm text-red-500 px-1">{apiError}</p>}
        </div>

        {/* ── Right: Preview ── */}
        <div className="lg:w-[360px] lg:flex-shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Live preview</h2>
            <NewsPostCard post={previewPost} variant="user" />
            {(headline || summary || analysis) && (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Detail view</p>
                {headline && <p className="font-bold text-stone-900 text-base leading-snug">{headline}</p>}
                {summary && <p className="text-sm text-stone-600 leading-relaxed">{summary}</p>}
                {analysis && (
                  <>
                    <hr className="border-stone-100" />
                    <p className="text-xs font-semibold text-stone-500">💡 What this means for you</p>
                    <p className="text-sm text-stone-600 leading-relaxed">{analysis}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 z-50">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/admin/news" className="text-sm text-stone-500 hover:text-stone-700 px-3 py-2">
            Cancel
          </Link>
          <button
            onClick={() => handleSave('draft')}
            disabled={!canSave || saving}
            className="text-sm bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={!canPublish || publishing}
            className="text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            {publishing ? 'Publishing…' : 'Publish now'}
          </button>
          {existingPost?.status === 'published' && (
            <button
              onClick={handleArchive}
              className="text-sm text-red-500 hover:text-red-700 px-3 py-2 transition-colors ml-auto"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
