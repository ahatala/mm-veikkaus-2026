// Shared normalization helpers. `key` is diacritic- and case-insensitive so that team/player names
// match across spelling variants (e.g. "Julian Alvarez" vs "Julián Álvarez", "Vinícius Júnior").
export const norm = (s?: string | null): string => (s ?? '').trim()

export const key = (s?: string | null): string =>
  norm(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
