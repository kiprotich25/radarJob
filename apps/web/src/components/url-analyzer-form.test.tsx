import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UrlAnalyzerForm } from './url-analyzer-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

describe('UrlAnalyzerForm', () => {
  it('shows validation errors without calling the API', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<UrlAnalyzerForm />);
    await userEvent.type(screen.getByLabelText('Job link to check'), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: /analyze link/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/http:\/\/ or https:\/\//);
    expect(f).not.toHaveBeenCalled();
  });

  it('disables verification and explains why when offline', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    render(<UrlAnalyzerForm />);
    expect(screen.getByRole('button', { name: /analyze link/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      "You're offline. Connect to the internet to verify this job link.",
    );
  });

  it('starts an analysis and navigates to the report', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'abc', status: 'running' }), { status: 202 }),
        ),
    );
    render(<UrlAnalyzerForm />);
    await userEvent.type(screen.getByLabelText('Job link to check'), 'jobs.example-test.com/apply');
    await userEvent.click(screen.getByRole('button', { name: /analyze link/i }));
    expect(push).toHaveBeenCalledWith('/report/abc');
  });

  it('reports a backend outage honestly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<UrlAnalyzerForm />);
    await userEvent.type(
      screen.getByLabelText('Job link to check'),
      'https://jobs.example-test.com',
    );
    await userEvent.click(screen.getByRole('button', { name: /analyze link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be completed/);
    expect(push).not.toHaveBeenCalled();
  });
});
