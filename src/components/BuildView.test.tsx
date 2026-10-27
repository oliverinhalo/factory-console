import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildView } from './BuildView';
import type { Client } from '../lib/github';

vi.mock('../lib/auth', () => ({
  authAvailable: false,
  signIn: vi.fn(),
  submitIdea: vi.fn(),
}));

const createIssue = vi.fn();
const client = (canWrite = true) =>
  ({ repo: 'o/r', canWrite, createIssue, addLabel: vi.fn() }) as unknown as Client;

beforeEach(() => {
  createIssue
    .mockReset()
    .mockResolvedValue({ number: 7, url: 'https://github.com/o/r/issues/7' });
});

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/what is it called/i), 'Shift swap planner');
  await userEvent.type(
    screen.getByLabelText(/who is it for/i),
    'A nurse swapping a shift sees whose rota it fits.',
  );
  await userEvent.type(screen.getByLabelText(/it must do these/i), 'Import a rota from CSV');
}

describe('BuildView', () => {
  it('refuses to send a brief with no must-haves, and says what is missing', async () => {
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await userEvent.type(screen.getByLabelText(/what is it called/i), 'Something');
    await userEvent.click(screen.getByRole('button', { name: /send it to the factory/i }));
    expect(createIssue).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one thing it must do/i)).toBeInTheDocument();
  });

  it('sends the brief with the must-have marked as uncuttable', async () => {
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: /send it to the factory/i }));
    expect(createIssue).toHaveBeenCalledTimes(1);
    const [title, body, labels] = createIssue.mock.calls[0] as [string, string, string[]];
    expect(title).toBe('Shift swap planner');
    expect(body).toContain('## Must have — do not cut these');
    expect(body).toContain('- Import a rota from CSV');
    expect(body).toMatch(/contract, not a\nsuggestion/);
    expect(labels).toContain('approved');
  });

  it('pins it as next by default, and lets that be turned off', async () => {
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await fillValid();
    await userEvent.click(screen.getByRole('checkbox', { name: /build this next/i }));
    await userEvent.click(screen.getByRole('button', { name: /send it to the factory/i }));
    const [, body, labels] = createIssue.mock.calls[0] as [string, string, string[]];
    expect(labels).not.toContain('next');
    expect(body).toContain('Queued, not pinned');
  });

  it('shows the exact text the factory will read', async () => {
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await fillValid();
    await userEvent.click(
      screen.getByRole('button', { name: /show exactly what the factory/i }),
    );
    // The button carries the same words, so query by role to stay unambiguous.
    expect(
      screen.getByRole('heading', { name: /what the factory will read/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Must have — do not cut these/)).toBeInTheDocument();
  });

  it('carries exclusions through, so unwanted work is explicit', async () => {
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await fillValid();
    await userEvent.type(screen.getByLabelText(/do not include/i), 'Accounts or sign-in');
    await userEvent.click(screen.getByRole('button', { name: /send it to the factory/i }));
    const [, body] = createIssue.mock.calls[0] as [string, string];
    expect(body).toContain('## Do not include');
    expect(body).toContain('- Accounts or sign-in');
  });

  it('asks you to connect rather than offering a button that cannot work', () => {
    render(
      <BuildView
        client={client(false)}
        viewer={null}
        onConnect={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /connect to send this/i })).toBeInTheDocument();
  });

  it('surfaces a failure instead of appearing to succeed', async () => {
    createIssue.mockRejectedValue(new Error('GitHub refused that.'));
    render(
      <BuildView client={client()} viewer={null} onConnect={() => {}} onChanged={() => {}} />,
    );
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: /send it to the factory/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/GitHub refused that/);
  });
});
