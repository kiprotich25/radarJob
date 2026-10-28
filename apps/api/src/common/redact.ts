/**
 * Remove personal data from text before it leaves RadarJob (to an AI provider)
 * or is stored. Amounts such as "KES 1,500" are preserved because they are
 * evidence; phone numbers, emails, long digit runs (IDs, accounts) are not.
 */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?254|\b0)[\s-]?(?:7|1)\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, '[phone]')
    .replace(/\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, '[phone]')
    .replace(/\b\d{9,}\b/g, '[number]')
    .replace(/\b\d{7,8}\b(?![,.]\d)/g, '[number]');
}

/** Strip control characters and collapse whitespace. */
export function cleanText(text: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = text
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/** Hostname-only representation for logs. Never log full URLs (queries can hold tokens). */
export function logSafeHost(hostname: string | undefined | null): string {
  return hostname ? hostname.slice(0, 120) : 'unknown';
}
