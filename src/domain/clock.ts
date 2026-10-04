/** Language-independent time formatting. */

/** `M:SS` under an hour, `H:MM:SS` from one hour. Negative input shows as zero. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  if (h === 0) return `${m}:${ss}`;
  return `${h}:${String(m).padStart(2, '0')}:${ss}`;
}

/** Whole hours and remaining whole minutes. */
export function hoursMinutes(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
