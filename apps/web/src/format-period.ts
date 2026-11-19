const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A reporting period in words: "1 November 2025 – 31 December 2025". Dates are ISO (`YYYY-MM-DD`). */
export function formatPeriod(period: { start: string; end: string }): string {
  return `${dateFormat.format(new Date(period.start))} – ${dateFormat.format(new Date(period.end))}`;
}
