// Guards against football-data's free tier occasionally getting "stuck" reporting a match as
// IN_PLAY/PAUSED long after it actually ended. No match runs anywhere near this long, so a match
// still flagged in-play this far past kickoff is treated as finished (using its current score)
// rather than shown as perpetually "live".
const STALE_MS = 3.5 * 60 * 60 * 1000 // 3.5 h after kickoff

export function isStaleLive(m, now) {
  if (m.status !== 'IN_PLAY' && m.status !== 'PAUSED') return false
  if (!m.utcDate) return false // no kickoff time -> can't judge; leave as-is
  return now - Date.parse(m.utcDate) > STALE_MS
}

/** Finished for real, or stuck-in-play past the window with a score to use. */
export function effectivelyFinished(m, now) {
  return (m.finished || isStaleLive(m, now)) && m.homeScore != null && m.awayScore != null
}

/** Genuinely in play right now (and not a stale/stuck status). */
export function isLiveNow(m, now) {
  return (m.status === 'IN_PLAY' || m.status === 'PAUSED') && !isStaleLive(m, now)
}
