export type PeriodSubmission = {
  period_id: string
  owner_email?: string | null
  company_name?: string | null
  submitted_at: string // ISO string
}

const KEY = 'taxmate_period_submissions'

export function listSubmissions(): PeriodSubmission[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as PeriodSubmission[]) : []
  } catch {
    return []
  }
}

export function upsertSubmission(
  submission: Omit<PeriodSubmission, 'submitted_at'> & { submitted_at?: string },
): PeriodSubmission {
  const next: PeriodSubmission = {
    ...submission,
    submitted_at: submission.submitted_at ?? new Date().toISOString(),
  }

  const all = listSubmissions()
  const idx = all.findIndex(
    (s) => s.period_id === next.period_id && (s.owner_email ?? '') === (next.owner_email ?? ''),
  )
  if (idx >= 0) all[idx] = { ...all[idx], ...next }
  else all.unshift(next)

  localStorage.setItem(KEY, JSON.stringify(all))
  return next
}

export function isPeriodSubmitted(periodId: string, ownerEmail?: string | null): boolean {
  return listSubmissions().some(
    (s) => s.period_id === periodId && (!ownerEmail || !s.owner_email || s.owner_email === ownerEmail),
  )
}

export function periodIdToRange(periodId: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-Q([1-6])$/.exec(periodId)
  if (!m) return null
  const year = Number(m[1])
  const q = Number(m[2])
  const mapping: Record<number, [number, number]> = {
    1: [0, 1],
    2: [2, 3],
    3: [4, 5],
    4: [6, 7],
    5: [8, 9],
    6: [10, 11],
  }
  const [startMonth, endMonth] = mapping[q]
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

