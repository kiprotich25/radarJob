export function formatDateTime(iso: string | undefined): string {
  if (!iso) return 'unknown time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown time';
  return d.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleDateString('en-KE', { dateStyle: 'medium' });
}

export function describeAge(days: number | undefined): string {
  if (days === undefined) return 'Unknown';
  if (days < 1) return 'Less than a day';
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 730) return `About ${Math.round(days / 30)} months`;
  return `About ${Math.floor(days / 365)} years`;
}
