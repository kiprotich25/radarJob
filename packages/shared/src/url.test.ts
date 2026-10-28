import { describe, expect, it } from 'vitest';
import { validateAndNormalizeUrl, MAX_URL_LENGTH } from './url';

const ok = (input: string) => {
  const r = validateAndNormalizeUrl(input);
  if (!r.ok) throw new Error(`expected ok for ${input}: ${r.code}`);
  return r.value;
};
const code = (input: unknown) => {
  const r = validateAndNormalizeUrl(input);
  return r.ok ? 'ok' : r.code;
};

describe('validateAndNormalizeUrl', () => {
  it('accepts https URLs and extracts the registered domain', () => {
    const v = ok('https://Careers.Example.co.ke/jobs/123?ref=wa#apply');
    expect(v.hostname).toBe('careers.example.co.ke');
    expect(v.registeredDomain).toBe('example.co.ke');
    expect(v.publicSuffix).toBe('co.ke');
    expect(v.hasQuery).toBe(true);
    expect(v.displayUrl).toBe('https://careers.example.co.ke/jobs/123');
    expect(v.normalized).toBe('https://careers.example.co.ke/jobs/123?ref=wa');
  });

  it('adds https:// when the scheme is missing', () => {
    const v = ok('example.com/jobs');
    expect(v.normalized).toBe('https://example.com/jobs');
    expect(v.hadExplicitScheme).toBe(false);
  });

  it('treats host:port without scheme as a host', () => {
    expect(ok('example.com:8080/x').port).toBe(8080);
  });

  it('rejects empty, non-string and overly long input', () => {
    expect(code('')).toBe('empty');
    expect(code('   ')).toBe('empty');
    expect(code(undefined)).toBe('empty');
    expect(code(`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`)).toBe('too_long');
  });

  it('rejects unsupported protocols', () => {
    expect(code('javascript:alert(1)')).toBe('unsupported_protocol');
    expect(code('ftp://example.com/file')).toBe('unsupported_protocol');
    expect(code('data:text/html,hi')).toBe('unsupported_protocol');
    expect(code('file:///etc/passwd')).toBe('unsupported_protocol');
  });

  it('rejects malformed input and whitespace inside URLs', () => {
    expect(code('https://exa mple.com')).toBe('malformed');
    expect(code('https://')).toBe('malformed');
  });

  it('rejects local, private and single-label hosts', () => {
    expect(code('http://localhost:3000')).toBe('local_address');
    expect(code('http://127.0.0.1/admin')).toBe('local_address');
    expect(code('http://10.0.0.5/')).toBe('local_address');
    expect(code('http://192.168.1.1/')).toBe('local_address');
    expect(code('http://169.254.169.254/latest/meta-data')).toBe('local_address');
    expect(code('http://[::1]/')).toBe('local_address');
    expect(code('http://intranet/')).toBe('invalid_host');
    expect(code('http://printer.local/')).toBe('local_address');
  });

  it('flags and strips embedded credentials', () => {
    const v = ok('https://employer.example.com@evil.example.net/login');
    expect(v.hadCredentials).toBe(true);
    expect(v.hostname).toBe('evil.example.net');
    expect(v.normalized).not.toContain('@');
  });

  it('converts internationalized domain names to punycode and back for display', () => {
    const v = ok('https://safarіcom.example.com/'); // Cyrillic "і"
    expect(v.hostname.startsWith('xn--')).toBe(true);
    expect(v.unicodeHostname).toBe('safarіcom.example.com');
  });

  it('marks public IP hosts', () => {
    const v = ok('http://203.0.113.10/jobs');
    expect(v.isIp).toBe(true);
    expect(v.registeredDomain).toBeNull();
  });
});
