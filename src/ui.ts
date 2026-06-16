import type { Breakdown } from './scoring/types'

// Category labels (Finnish) + the order they're shown in breakdowns.
export const CATEGORIES: { key: keyof Breakdown; label: string }[] = [
  { key: 'groupMatches', label: 'Alkulohko-ottelut' },
  { key: 'groupTop2', label: 'Lohkon Top 2' },
  { key: 'quarterfinalists', label: 'Top 8 – puolivälierät' },
  { key: 'semifinalists', label: 'Top 4 – semifinaalit' },
  { key: 'finalists', label: 'Finalistit' },
  { key: 'champion', label: 'Mestari' },
  { key: 'goldenBoot', label: 'Kultakenkä' },
  { key: 'specialQuestions', label: 'Erikoiskysymykset' },
]

export function formatUpdated(iso: string | null): string {
  if (!iso) return 'ei päivitetty'
  try {
    return new Date(iso).toLocaleString('fi-FI', {
      timeZone: 'Europe/Helsinki', day: 'numeric', month: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' (Suomen aikaa)'
  } catch {
    return iso
  }
}

// "+3" style point labels.
export const pts = (n: number): string => (n > 0 ? `+${n}` : '0')
