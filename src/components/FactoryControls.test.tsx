import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactoryControls } from './FactoryControls';
import type { Client } from '../lib/github';
import type { Run } from '../lib/types';

const client = (over: Partial<Client> = {}) =>
  ({
    repo: 'o/r',
    canWrite: true,
    setWorkflowEnabled: vi.fn().mockResolvedValue(undefined),
    cancelRun: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as unknown as Client;

const running: Run = {
  id: 42,
  name: 'Run factory now',
  status: 'in_progress',
  conclusion: null,
  createdAt: new Date().toISOString(),
  url: 'https://github.com/o/r/actions/runs/42',
};

describe('FactoryControls', () => {
  it('says it is running on schedule when active', () => {
    render(
      <FactoryControls
        client={client()}
        canAct
        scheduleState="active"
        running={null}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/running on schedule/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause scheduled runs/i })).toBeInTheDocument();
  });

  it('says it is paused and offers to resume', () => {
    render(
      <FactoryControls
        client={client()}
        canAct
        scheduleState="disabled_manually"
        running={null}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/paused — no scheduled runs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume scheduled runs/i })).toBeInTheDocument();
  });

  it('pausing disables the workflow', async () => {
    const setWorkflowEnabled = vi.fn().mockResolvedValue(undefined);
    render(
      <FactoryControls
        client={client({ setWorkflowEnabled })}
        canAct
        scheduleState="active"
        running={null}
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /pause scheduled runs/i }));
    expect(setWorkflowEnabled).toHaveBeenCalledWith('run-factory.yml', false);
  });

  it('resuming re-enables it', async () => {
    const setWorkflowEnabled = vi.fn().mockResolvedValue(undefined);
    render(
      <FactoryControls
        client={client({ setWorkflowEnabled })}
        canAct
        scheduleState="disabled_manually"
        running={null}
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /resume scheduled runs/i }));
    expect(setWorkflowEnabled).toHaveBeenCalledWith('run-factory.yml', true);
  });

  it('only offers to stop a run while one is in flight', async () => {
    const cancelRun = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <FactoryControls
        client={client({ cancelRun })}
        canAct
        scheduleState="active"
        running={null}
        onChanged={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /stop the run/i })).not.toBeInTheDocument();

    rerender(
      <FactoryControls
        client={client({ cancelRun })}
        canAct
        scheduleState="active"
        running={running}
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /stop the run/i }));
    expect(cancelRun).toHaveBeenCalledWith(42);
  });

  it('hides the controls when it cannot act', () => {
    render(
      <FactoryControls
        client={client()}
        canAct={false}
        scheduleState="active"
        running={null}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/connect or sign in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
  });

  it('reports a failure rather than silently doing nothing', async () => {
    const setWorkflowEnabled = vi.fn().mockRejectedValue(new Error('403 forbidden'));
    render(
      <FactoryControls
        client={client({ setWorkflowEnabled })}
        canAct
        scheduleState="active"
        running={null}
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /pause scheduled runs/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/403 forbidden/);
  });
});
