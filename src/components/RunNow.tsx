import { useState } from 'react';
import type { Client } from '../lib/github';
import { nextRun, relative } from '../lib/parse';

interface Props {
  client: Client;
  canRun: boolean;
}

/**
 * Starts a factory run on demand instead of waiting for the schedule.
 *
 * It dispatches a GitHub Actions workflow rather than talking to Claude directly:
 * a static page has no way to start an agent, and the workflow is where the
 * subscription token safely lives.
 */
export function RunNow({ client, canRun }: Props) {
  const [mode, setMode] = useState<'continue' | 'new-app'>('continue');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const next = nextRun();

  async function start() {
    setBusy(true);
    setProblem(null);
    try {
      await client.dispatch('run-factory.yml', { mode, focus: focus.trim() });
      setStarted(true);
      setFocus('');
    } catch (error) {
      setProblem(
        error instanceof Error ? `Could not start it: ${error.message}` : 'Could not start it.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="run-heading"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="run-heading" className="text-[length:var(--t-lg)] font-semibold">
          Run it now
        </h2>
        <p className="text-sm text-[var(--text-faint)]">
          otherwise {relative(next.at.toISOString())}
        </p>
      </div>

      {!canRun ? (
        <p className="mt-2 text-[var(--text-muted)] text-pretty">
          Connect or sign in to start a run from here.
        </p>
      ) : started ? (
        <div className="mt-3">
          <p role="status" className="text-[var(--success)]">
            Started. It runs on GitHub and takes a while — apps appear here as they ship.
          </p>
          <a
            className="mt-2 inline-block text-sm underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
            href={`https://github.com/${client.repo}/actions/workflows/run-factory.yml`}
            target="_blank"
            rel="noreferrer"
          >
            Watch it ↗
          </a>
          <button
            type="button"
            onClick={() => setStarted(false)}
            className="mt-2 ml-4 text-sm text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
          >
            Start another
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-sm font-medium">What should it do?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['continue', 'Carry on', 'Finish or polish what is already going'],
                  ['new-app', 'Build a new app', 'Start the next one from the queue'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors duration-[var(--dur-state)] ${
                    mode === value
                      ? 'border-[var(--accent)] text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="run-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="sr-only"
                  />
                  <span className="font-medium">{label}</span>
                  <span className="block text-[var(--text-faint)]">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium" htmlFor="run-focus">
              Anything specific?{' '}
              <span className="font-normal text-[var(--text-faint)]">Optional</span>
            </label>
            <input
              id="run-focus"
              className="mt-1.5 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3"
              placeholder="Build issue #2, or: make last week's app faster"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={400}
            />
          </div>

          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start a run'}
          </button>

          {problem ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problem}
              {/\b404\b|Not found/i.test(problem)
                ? ' — the run-factory workflow may not be on the default branch yet.'
                : ''}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
