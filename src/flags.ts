// Canonical Finnish team name -> ISO 3166-1 alpha-2 code (UK nations use flagcdn's gb-sct / gb-eng).
const FIN_TO_ISO: Record<string, string> = {
  Meksiko: 'mx', 'Etelä-Afrikka': 'za', 'Etelä-Korea': 'kr', Tšekki: 'cz', Kanada: 'ca',
  Sveitsi: 'ch', Qatar: 'qa', 'Bosnia-Hertsegovina': 'ba', Brasilia: 'br', Marokko: 'ma',
  Skotlanti: 'gb-sct', Haiti: 'ht', Yhdysvallat: 'us', Australia: 'au', Paraguay: 'py',
  Turkki: 'tr', Saksa: 'de', Ecuador: 'ec', Norsunluurannikko: 'ci', 'Curaçao': 'cw',
  Hollanti: 'nl', Japani: 'jp', Tunisia: 'tn', Ruotsi: 'se', Belgia: 'be', Iran: 'ir',
  Egypti: 'eg', 'Uusi-Seelanti': 'nz', Espanja: 'es', Uruguay: 'uy', 'Saudi-Arabia': 'sa',
  'Kap Verde': 'cv', Ranska: 'fr', Senegal: 'sn', Norja: 'no', Irak: 'iq', Argentiina: 'ar',
  Itävalta: 'at', Algeria: 'dz', Jordania: 'jo', Portugali: 'pt', Kolumbia: 'co',
  Uzbekistan: 'uz', 'Kongon DR': 'cd', Englanti: 'gb-eng', Kroatia: 'hr', Ghana: 'gh', Panama: 'pa',
}

export const flagCode = (team: string): string | null => FIN_TO_ISO[team] ?? null
export const flagUrl = (team: string): string => {
  const code = FIN_TO_ISO[team]
  return code ? `https://flagcdn.com/${code}.svg` : ''
}
