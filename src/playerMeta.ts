// Per-participant demographics, used only for the optional Standings filter.
export type Age = 'adult' | 'kid'
export type Gender = 'm' | 'f'
export interface PlayerMeta { age: Age; gender: Gender }

export const PLAYER_META: Record<string, PlayerMeta> = {
  Julle: { age: 'adult', gender: 'm' },
  Eikku: { age: 'adult', gender: 'm' },
  Niina: { age: 'adult', gender: 'f' },
  Rasmus: { age: 'kid', gender: 'm' },
  Aaron: { age: 'kid', gender: 'm' },
  Dee: { age: 'adult', gender: 'm' },
  Pasi: { age: 'adult', gender: 'm' },
  Jone: { age: 'kid', gender: 'm' },
  Paula: { age: 'adult', gender: 'f' },
  Elmo: { age: 'kid', gender: 'm' },
  Elias: { age: 'kid', gender: 'm' },
  Oliver: { age: 'kid', gender: 'm' },
  Otso: { age: 'kid', gender: 'm' },
  'Tomi&Kasper': { age: 'kid', gender: 'm' },
}
