const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400], ['hour', 3_600], ['minute', 60], ['second', 1]];

/** "5 minutes ago" style wording; plain language beats timestamps for most readers. */
export const timeAgo = (iso: string | null, now: number): string => {
  if (!iso) return 'time unknown';
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Number.isNaN(seconds)) return 'time unknown';
  if (Math.abs(seconds) < 5) return 'just now';
  const [unit, size] = UNITS.find(([, span]) => Math.abs(seconds) >= span) ?? ['second', 1];
  return RELATIVE.format(Math.round(seconds / size), unit);
};

export const formatCount = (value: number | null): string =>
  value === null ? '—' : new Intl.NumberFormat('en').format(value);

export const isToday = (iso: string | null, now: number): boolean =>
  !!iso && new Date(iso).toDateString() === new Date(now).toDateString();
