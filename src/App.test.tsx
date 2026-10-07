import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

const LEDGER = { started: '2026-10-07', target: 52, apps: [] };

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('ledger.json')) return ok({ content: b64(JSON.stringify(LEDGER)) });
      if (url.includes('idea-bank.md')) return ok({ content: b64('# Idea bank\n') });
      if (url.includes('/actions/runs')) return ok({ workflow_runs: [] });
      return ok([]);
    }),
  );
});

describe('App', () => {
  it('shows the dashboard without a token, because reads need none', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /factory console/i }),
    ).toBeInTheDocument();
  });

  it('says it is browsing anonymously and offers to connect', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    expect(screen.getByText(/browsing anonymously/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument();
  });

  it('replaces the send button with a connect prompt when it cannot write', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    await userEvent.click(screen.getByRole('button', { name: 'Control' }));
    expect(screen.getByRole('button', { name: /connect to send this/i })).toBeInTheDocument();
  });

  it('opens the setup screen on request and can back out of it', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    await userEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /connect your factory/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /factory console/i }),
      ).toBeInTheDocument(),
    );
  });

  it('keeps Connect disabled until the token and repo both look plausible', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    await userEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    const submit = await screen.findByRole('button', { name: /^connect$/i });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^token$/i), 'github_pat_11ABCDEFG0123456789');
    expect(submit).toBeEnabled();
  });

  it('never renders the token as readable text', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    await userEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByLabelText(/^token$/i)).toHaveAttribute('type', 'password');
  });

  it('renders exactly one h1 and a main landmark', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /factory console/i });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
