// ─── Board time helpers ───

/** Convert "HH:MM" → minutes-since-00:00. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes-since-00:00 → "HH:MM". */
export function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Board view window — default 05:00 → 20:00 covers the seeded scenario. */
export const BOARD_START_HHMM = '05:00';
export const BOARD_END_HHMM   = '20:00';

/** Pixels per minute at 1× (desktop density). */
export const PX_PER_MINUTE = 1.8;

/** Board body width for given window + density. */
export function boardBodyWidth(start = BOARD_START_HHMM, end = BOARD_END_HHMM): number {
  return (hhmmToMinutes(end) - hhmmToMinutes(start)) * PX_PER_MINUTE;
}

/** Left-offset in px for HH:MM within the board. */
export function leftForTime(hhmm: string, start = BOARD_START_HHMM): number {
  return (hhmmToMinutes(hhmm) - hhmmToMinutes(start)) * PX_PER_MINUTE;
}

/** Width in px for a duration between two HH:MM times. */
export function widthForSpan(startHHMM: string, endHHMM: string): number {
  return Math.max(44, (hhmmToMinutes(endHHMM) - hhmmToMinutes(startHHMM)) * PX_PER_MINUTE);
}

/** Array of hour marks across the board (inclusive of end). */
export function hourMarks(start = BOARD_START_HHMM, end = BOARD_END_HHMM): string[] {
  const out: string[] = [];
  const startMin = hhmmToMinutes(start);
  const endMin = hhmmToMinutes(end);
  for (let m = startMin; m <= endMin; m += 60) {
    out.push(minutesToHHMM(m));
  }
  return out;
}
