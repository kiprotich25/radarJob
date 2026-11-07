import { parse as parseDomain } from 'tldts';
import { toUnicode } from 'punycode/';

export const MAX_URL_LENGTH = 2048;

export type UrlValidationErrorCode =
  | 'empty'
  | 'too_long'
  | 'malformed'
  | 'unsupported_protocol'
  | 'missing_host'
  | 'local_address'
  | 'invalid_host';

export interface NormalizedUrl {
  /** Canonical URL: lower-case ASCII (punycode) host, default port and fragment removed, credentials stripped. */
  normalized: string;
  /** scheme://host/path — safe to display and store. No query string, fragment or credentials. */
  displayUrl: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  unicodeHostname: string;
  registeredDomain: string | null;
  publicSuffix: string | null;
  isIp: boolean;
  port: number | null;
  pathname: string;
  hasQuery: boolean;
  /** True when the submitted URL contained "user:pass@" — a known phishing trick. */
  hadCredentials: boolean;
  /** Raw submitted text contained an explicit scheme. */
  hadExplicitScheme: boolean;
}

export type UrlValidationResult =
  { ok: true; value: NormalizedUrl } | { ok: false; code: UrlValidationErrorCode; message: string };

const MESSAGES: Record<UrlValidationErrorCode, string> = {
  empty: 'Paste a job link to analyze.',
  too_long: `That link is too long. Links must be under ${MAX_URL_LENGTH} characters.`,
  malformed: "That doesn't look like a valid web address. Check for typos and try again.",
  unsupported_protocol: 'Only web links that start with http:// or https:// can be analyzed.',
  missing_host: 'The link is missing a website address.',
  local_address: 'Local, private or internal addresses cannot be analyzed.',
  invalid_host: 'The website address in this link is not valid.',
};

const fail = (code: UrlValidationErrorCode): UrlValidationResult => ({
  ok: false,
  code,
  message: MESSAGES[code],
});

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function safeToUnicode(host: string): string {
  try {
    return toUnicode(host);
  } catch {
    return host;
  }
}

/**
 * Validate and normalize a user-supplied job link.
 * Used by both the browser (instant feedback) and the API (authoritative check).
 * This function never fetches or opens the URL.
 */
export function validateAndNormalizeUrl(raw: unknown): UrlValidationResult {
  if (typeof raw !== 'string') return fail('empty');
  const trimmed = raw.trim();
  if (!trimmed) return fail('empty');
  if (trimmed.length > MAX_URL_LENGTH) return fail('too_long');
  // Reject control characters and whitespace inside the URL.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) return fail('malformed');

  const hadExplicitScheme = SCHEME_RE.test(trimmed) && !/^[^:/]+:\d+(\/|$)/.test(trimmed);
  let candidate = trimmed;
  if (hadExplicitScheme) {
    const scheme = trimmed.slice(0, trimmed.indexOf(':')).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return fail('unsupported_protocol');
  } else {
    if (trimmed.startsWith('//')) candidate = `https:${trimmed}`;
    else candidate = `https://${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fail('malformed');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fail('unsupported_protocol');

  let hostname = url.hostname.toLowerCase();
  if (!hostname) return fail('missing_host');
  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

  const isIpv6 = hostname.startsWith('[');
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isIp = isIpv6 || isIpv4;

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home.arpa')
  ) {
    return fail('local_address');
  }
  if (isIpv4 && isPrivateIPv4(hostname)) return fail('local_address');
  if (isIpv6) {
    const inner = hostname.slice(1, -1);
    if (
      inner === '::1' ||
      inner === '::' ||
      /^f[cd]/.test(inner) ||
      /^fe[89ab]/.test(inner) ||
      inner.startsWith('::ffff:')
    ) {
      return fail('local_address');
    }
  }
  if (!isIp) {
    if (!hostname.includes('.')) return fail('invalid_host');
    if (hostname.length > 253) return fail('invalid_host');
    const labels = hostname.split('.');
    if (labels.some((l) => l.length === 0 || l.length > 63)) return fail('invalid_host');
    if (!labels.every((l) => /^[a-z0-9_-]+$/.test(l))) return fail('invalid_host');
    if (/^\d+$/.test(labels[labels.length - 1])) return fail('invalid_host');
  }

  const parsed = isIp ? null : parseDomain(hostname, { allowPrivateDomains: false });
  const registeredDomain = parsed?.domain ?? null;
  const publicSuffix = parsed?.publicSuffix ?? null;

  const hadCredentials = Boolean(url.username || url.password);
  url.username = '';
  url.password = '';
  url.hash = '';
  url.hostname = hostname;

  const port = url.port ? Number(url.port) : null;
  const pathname = url.pathname || '/';
  const unicodeHostname = isIp ? hostname : safeToUnicode(hostname);
  const hostForDisplay = port ? `${unicodeHostname}:${port}` : unicodeHostname;
  const displayPath = pathname.length > 160 ? `${pathname.slice(0, 157)}...` : pathname;

  return {
    ok: true,
    value: {
      normalized: url.toString(),
      displayUrl: `${url.protocol}//${hostForDisplay}${displayPath}`,
      protocol: url.protocol as 'http:' | 'https:',
      hostname,
      unicodeHostname,
      registeredDomain,
      publicSuffix,
      isIp,
      port,
      pathname,
      hasQuery: url.search.length > 1,
      hadCredentials,
      hadExplicitScheme,
    },
  };
}

/** Convert an ASCII (punycode) domain to Unicode for display, tolerating bad input. */
export function domainToUnicode(domain: string): string {
  return safeToUnicode(domain);
}
