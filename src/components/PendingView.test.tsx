import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingView } from './PendingView';
import type { Idea } from '../lib/types';
import type { Viewer } from '../lib/auth';

const approveIdea = vi.fn();
const rejectIdea = vi.fn();
vi.mock('../lib/auth', () => ({
  approveIdea: (...args: unknown[]) => approveIdea(...args),
  rejectIdea: (...args: unknown[]) => rejectIdea(...args),
}));

const admin: Viewer = {
  login: 'jacob',
  name: 'Jacob',
  avatar: '',
  email: 'jacobelilevy@gmail.com',
  admin: true,
};
const guest: Viewer = {
  ...admin,
  login: 'someone',
  email: 'someone@example.net',
  admin: false,
};

const PENDING: Idea[] = [
  {
    name: 'Shift swap planner',
    description: 'A nurse swapping shifts sees whose rota it fits.',
    category: 'yours',
    issue: 12,
    state: 'pending',
    createdAt: new Date().toISOString(),
    submittedBy: 'someone',
  },
];

beforeEach(() => {
  approveIdea.mockReset().mockResolvedValue({ ok: true });
  rejectIdea.mockReset().mockResolvedValue({ ok: true });
});

describe('PendingView', () => {
  it('refuses to show the queue to a non-admin', () => {
    render(<PendingView pending={PENDING} viewer={guest} onChanged={() => {}} />);
    expect(screen.getByText(/admins only/i)).toBeInTheDocument();
    expect(screen.queryByText('Shift swap planner')).not.toBeInTheDocument();
  });

  it('refuses to show the queue when nobody is signed in', () => {
    render(<PendingView pending={PENDING} viewer={null} onChanged={() => {}} />);
    expect(screen.getByText(/sign in with an admin account/i)).toBeInTheDocument();
  });

  it('lists a pending idea with who submitted it', () => {
    render(<PendingView pending={PENDING} viewer={admin} onChanged={() => {}} />);
    expect(screen.getByText('Shift swap planner')).toBeInTheDocument();
    expect(screen.getByText(/from @someone/)).toBeInTheDocument();
  });

  it('approves on the issue number, and tells the caller to reload', async () => {
    const onChanged = vi.fn();
    render(<PendingView pending={PENDING} viewer={admin} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(approveIdea).toHaveBeenCalledWith(12);
    expect(onChanged).toHaveBeenCalled();
  });

  it('asks for a reason before declining, and passes it on', async () => {
    render(<PendingView pending={PENDING} viewer={admin} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /^decline$/i }));
    await userEvent.type(screen.getByLabelText(/why not/i), 'Too close to week 3.');
    await userEvent.click(screen.getByRole('button', { name: /decline and close/i }));
    expect(rejectIdea).toHaveBeenCalledWith(12, 'Too close to week 3.');
  });

  it('surfaces a failure instead of silently doing nothing', async () => {
    approveIdea.mockRejectedValue(new Error('GitHub refused that.'));
    render(<PendingView pending={PENDING} viewer={admin} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/GitHub refused that/);
  });

  it('explains the empty queue rather than showing a blank panel', () => {
    render(<PendingView pending={[]} viewer={admin} onChanged={() => {}} />);
    expect(screen.getByText(/nothing waiting/i)).toBeInTheDocument();
  });
});
