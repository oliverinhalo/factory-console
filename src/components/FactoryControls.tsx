import { useState } from 'react';
import type { Client } from '../lib/github';
import type { Run } from '../lib/types';

interface Props {
  client: Client;
  canAct: boolean;
  /** "active", "disabled_manually", "disabled_inactivity", or null if unknown. */
  scheduleState: string | null;
  /** A run currently in flight, if any. */
  running: Run | null;
  onChanged: () => void;
}

const WORKFLOW = 'run-factory.yml';

/** Stop, start, and interrupt — the controls that were only in the Actions tab. */
export function FactoryControls({ client, canAct, scheduleState, running, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paused = scheduleState !== null && scheduleState !== 'active';

  async function act(what: string, fn: () => Promise<unknown>) {
    setBusy(what);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="controls-heading"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="controls-heading" className="text-[length:var(--t-lg)] font-semibold">
          The factory
        </h2>
        <p className="text-sm">
          {running ? (
            <span className="flex items-center gap-2 text-[var(--accent)]">
              <span className="inline-block size-2 animate-pulse rounded-full bg-[var(--accent)]" />
              running now
            </span>
          ) : paused ? (
            <span className="text-[var(--danger)]">paused — no scheduled runs</span>
          ) : scheduleState === 'active' ? (
            <span className="text-[var(--text-muted)]">running on schedule</span>
          ) : (
            <span className="text-[var(--text-faint)]">schedule state unknown</span>
          )}
        </p>
      </div>

      {!canAct ? (
        <p className="mt-2 text-[var(--text-muted)]">
          Connect or sign in to control the factory.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void act('schedule', () => client.setWorkflowEnabled(WORKFLOW, paused))
              }
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)] disabled:opacity-50"
            >
              {busy === 'schedule'
                ? 'Changing…'
                : paused
                  ? 'Resume scheduled runs'
                  : 'Pause scheduled runs'}
            </button>

            {running ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act('cancel', () => client.cancelRun(running.id))}
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
              >
                {busy === 'cancel' ? 'Stopping…' : 'Stop the run'}
              </button>
            ) : null}

            {running ? (
              <a
                className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                href={running.url}
                target="_blank"
                rel="noreferrer"
              >
                Watch it ↗
              </a>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-[var(--text-faint)] text-pretty">
            {paused
              ? 'Pausing only stops the schedule. You can still start a run yourself above.'
              : 'Pausing stops the Monday and daily runs. On-demand runs still work.'}
          </p>

          {error ? (
            <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
