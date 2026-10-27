import { useState } from 'react';
import type { Client } from '../lib/github';
import { relative } from '../lib/parse';
import type { Problem } from '../lib/types';

interface Props {
  problems: Problem[];
  client: Client;
  canAct: boolean;
  onChanged: () => void;
}

const LABEL: Record<Problem['kind'], string> = {
  run: 'Run failed',
  blocker: 'Blocked',
  checkpoint: 'Bad state',
};

/** Every failure the console can see, with the reason it printed. */
export function ProblemsView({ problems, client, canAct, onChanged }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rerun(runId: number) {
    setBusy(runId);
    setError(null);
    try {
      await client.rerunRun(runId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not re-run that.');
    } finally {
      setBusy(null);
    }
  }

  if (problems.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-8 text-center">
        <p className="font-medium">Nothing is broken</p>
        <p className="mx-auto mt-2 max-w-sm text-[var(--text-muted)] text-pretty">
          Failed runs, and anything a run reported itself blocked on, appear here with the
          reason it printed — so you do not have to go digging in a log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[length:var(--t-lg)] font-semibold">
          Problems{' '}
          <span className="font-normal text-[var(--text-faint)] tnum">({problems.length})</span>
        </h2>
        <p className="mt-1 text-[var(--text-muted)]">
          Newest first. A blocker means a run stopped and said why, rather than failing.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {problems.map((problem, index) => (
          <li
            key={`${problem.kind}-${problem.runId ?? index}-${problem.when}`}
            className="rounded-[var(--radius-lg)] border border-[var(--danger)] bg-[var(--surface-raised)] p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded-full border border-[var(--danger)] px-2 py-0.5 text-sm text-[var(--danger)]">
                {LABEL[problem.kind]}
              </span>
              <span className="font-medium">{problem.title}</span>
              <span className="ml-auto text-sm text-[var(--text-faint)]">
                {relative(problem.when)}
              </span>
            </div>

            <pre className="mt-3 overflow-x-auto rounded-[var(--radius)] bg-[var(--surface-sunken)] p-3 font-mono text-sm whitespace-pre-wrap">
              {problem.detail}
            </pre>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {problem.url ? (
                <a
                  className="text-sm underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full log ↗
                </a>
              ) : null}
              {problem.runId !== undefined && canAct ? (
                <button
                  type="button"
                  disabled={busy === problem.runId}
                  onClick={() => void rerun(problem.runId as number)}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm transition-colors duration-[var(--dur-state)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                >
                  {busy === problem.runId ? 'Starting…' : 'Run it again'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
