import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemsView } from './ProblemsView';
import type { Client } from '../lib/github';
import type { Problem } from '../lib/types';

const client = (over: Partial<Client> = {}) =>
  ({
    repo: 'o/r',
    canWrite: true,
    rerunRun: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as unknown as Client;

const runFailure: Problem = {
  kind: 'run',
  title: 'Run factory now failure',
  detail: 'Failed at: Run the factory\nCould not fetch an OIDC token.',
  when: new Date().toISOString(),
  url: 'https://github.com/o/r/actions/runs/5',
  runId: 5,
};

const blocker: Problem = {
  kind: 'blocker',
  title: 'trainyard is blocked',
  detail: 'publish.sh dispatch returned 403 Resource not accessible by integration',
  when: new Date().toISOString(),
};

describe('ProblemsView', () => {
  it('explains the empty state rather than showing a blank page', () => {
    render(<ProblemsView problems={[]} client={client()} canAct onChanged={() => {}} />);
    expect(screen.getByText(/nothing is broken/i)).toBeInTheDocument();
  });

  it('shows the actual reason, not just that something failed', () => {
    render(
      <ProblemsView problems={[runFailure]} client={client()} canAct onChanged={() => {}} />,
    );
    expect(screen.getByText(/Could not fetch an OIDC token/)).toBeInTheDocument();
    expect(screen.getByText(/Failed at: Run the factory/)).toBeInTheDocument();
  });

  it('distinguishes a blocker from a failure', () => {
    render(<ProblemsView problems={[blocker]} client={client()} canAct onChanged={() => {}} />);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText(/403 Resource not accessible/)).toBeInTheDocument();
  });

  it('links to the full log for a failed run', () => {
    render(
      <ProblemsView problems={[runFailure]} client={client()} canAct onChanged={() => {}} />,
    );
    expect(screen.getByRole('link', { name: /full log/i })).toHaveAttribute(
      'href',
      'https://github.com/o/r/actions/runs/5',
    );
  });

  it('can re-run a failed run', async () => {
    const rerunRun = vi.fn().mockResolvedValue(undefined);
    render(
      <ProblemsView
        problems={[runFailure]}
        client={client({ rerunRun })}
        canAct
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /run it again/i }));
    expect(rerunRun).toHaveBeenCalledWith(5);
  });

  it('offers no re-run for a blocker, which has no run to repeat', () => {
    render(<ProblemsView problems={[blocker]} client={client()} canAct onChanged={() => {}} />);
    expect(screen.queryByRole('button', { name: /run it again/i })).not.toBeInTheDocument();
  });

  it('hides the re-run button when it cannot act', () => {
    render(
      <ProblemsView
        problems={[runFailure]}
        client={client()}
        canAct={false}
        onChanged={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /run it again/i })).not.toBeInTheDocument();
  });

  it('counts the problems in its heading', () => {
    render(
      <ProblemsView
        problems={[runFailure, blocker]}
        client={client()}
        canAct
        onChanged={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /problems \(2\)/i })).toBeInTheDocument();
  });
});
