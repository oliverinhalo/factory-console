import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunNow } from './RunNow';
import type { Client } from '../lib/github';

const makeClient = (dispatch = vi.fn().mockResolvedValue(undefined)) =>
  ({ repo: 'oliverinhalo/Claude', canWrite: true, dispatch }) as unknown as Client;

describe('RunNow', () => {
  it('tells you when the next scheduled run is, so "now" has a baseline', () => {
    render(<RunNow client={makeClient()} canRun />);
    expect(screen.getByText(/otherwise in/i)).toBeInTheDocument();
  });

  it('asks you to connect rather than showing a button that cannot work', () => {
    render(<RunNow client={makeClient()} canRun={false} />);
    expect(screen.getByText(/connect or sign in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start a run/i })).not.toBeInTheDocument();
  });

  it('defaults to carrying on rather than starting something new', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<RunNow client={makeClient(dispatch)} canRun />);
    await userEvent.click(screen.getByRole('button', { name: /start a run/i }));
    expect(dispatch).toHaveBeenCalledWith('run-factory.yml', { mode: 'continue', focus: '' });
  });

  it('passes the chosen mode and focus through', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<RunNow client={makeClient(dispatch)} canRun />);
    await userEvent.click(screen.getByRole('radio', { name: /build a new app/i }));
    await userEvent.type(screen.getByLabelText(/anything specific/i), 'Build issue #2');
    await userEvent.click(screen.getByRole('button', { name: /start a run/i }));
    expect(dispatch).toHaveBeenCalledWith('run-factory.yml', {
      mode: 'new-app',
      focus: 'Build issue #2',
    });
  });

  it('confirms it started, with a link to watch it', async () => {
    render(<RunNow client={makeClient()} canRun />);
    await userEvent.click(screen.getByRole('button', { name: /start a run/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/started/i);
    expect(screen.getByRole('link', { name: /watch it/i })).toHaveAttribute(
      'href',
      expect.stringContaining('run-factory.yml'),
    );
  });

  it('explains a 404 as the likely missing workflow rather than a bare error', async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error('Not found. 404'));
    render(<RunNow client={makeClient(dispatch)} canRun />);
    await userEvent.click(screen.getByRole('button', { name: /start a run/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/default branch yet/i);
  });
});
