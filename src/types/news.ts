export type NewsSeverity = 'critical' | 'important' | 'informational'
export type NewsStatus = 'draft' | 'published' | 'archived'

export const NEWS_TAGS = [
  'devaluation',
  'new_card',
  'milestone_change',
  'offer',
  'partnership',
  'regulatory',
  'fee_change',
] as const

export type NewsTag = (typeof NEWS_TAGS)[number]

export interface NewsPost {
  id: string
  headline: string
  summary: string
  analysis: string
  primary_source_url: string
  primary_source_name: string
  secondary_source_url: string | null
  secondary_source_name: string | null
  severity: NewsSeverity
  affected_cards: string[]
  affected_country: string
  tags: string[]
  status: NewsStatus
  published_at: string | null
  created_at: string
  view_count: number
  is_read?: boolean
  affected_card_names?: string[]
}
