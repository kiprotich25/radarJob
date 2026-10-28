import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiClientError, NETWORK_MESSAGE, OFFLINE_MESSAGE } from './api';
import { fixtureReport } from './fixtures';

const setOnline = (v: boolean) => vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(v);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('refuses to send when the browser is offline and never calls fetch', async () => {
    setOnline(false);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(api.startAnalysis('https://a.example.com')).rejects.toMatchObject({
      kind: 'offline',
      message: OFFLINE_MESSAGE,
    });
    expect(f).not.toHaveBeenCalled();
  });

  it('maps a network failure to a "could not be completed" error, not a result', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.getReport('x')).rejects.toMatchObject({
      kind: 'network',
      message: NETWORK_MESSAGE,
    });
  });

  it('treats a non-JSON 5xx from the proxy as the backend being unreachable', async () => {
    setOnline(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })),
    );
    await expect(api.getReport('x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('surfaces API error messages', async () => {
    setOnline(true);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(400, {
            error: {
              code: 'invalid_url.local_address',
              message: 'Local addresses cannot be analyzed.',
            },
          }),
        ),
    );
    const e = await api.startAnalysis('http://localhost').catch((x) => x);
    expect(e).toBeInstanceOf(ApiClientError);
    expect(e).toMatchObject({ kind: 'http', status: 400, code: 'invalid_url.local_address' });
  });

  it('rejects responses that do not match the contract', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { id: 1, verdict: 'safe' })));
    await expect(api.getReport('x')).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('parses a valid report', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, fixtureReport())));
    expect((await api.getReport('x')).assessment?.category).toBe('no_significant_threats');
  });
});
