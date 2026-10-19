/**
 * Human-friendly countdown to a round's deadline, e.g. "Closes in 4 days",
 * "Closes in 6h", "Closes in 45m". Pure and clock-injectable (`now` defaults to
 * the current time) so it can be unit-tested against a fixed clock. Once the
 * deadline has passed it reads "Closed"; under a minute it reads "Closing soon".
 *
 * FEAT-003 shows OPEN rounds only; the deadline here is display-only urgency
 * (auto-closing at the deadline is FEAT-004).
 */
export function formatCountdown(deadlineIso: string, now: Date = new Date()): string {
  const remainingMs = new Date(deadlineIso).getTime() - now.getTime();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) {
    return 'Closed';
  }

  const minutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    return `Closes in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (hours >= 1) {
    return `Closes in ${hours}h`;
  }
  if (minutes >= 1) {
    return `Closes in ${minutes}m`;
  }
  return 'Closing soon';
}

/**
 * The last day as a ticking clock (FEAT-018): "Closes in 05:42:09". Only meaningful under
 * 24 hours — the caller decides when; past the deadline it reads "Closed" like the above.
 */
export function formatClock(deadlineIso: string, now: number = Date.now()): string {
  const remainingMs = new Date(deadlineIso).getTime() - now;
  if (Number.isNaN(remainingMs) || remainingMs <= 0) {
    return 'Closed';
  }
  const total = Math.floor(remainingMs / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Closes in ${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
