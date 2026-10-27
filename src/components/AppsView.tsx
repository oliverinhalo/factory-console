import { useState } from 'react';
import type { LedgerApp } from '../lib/types';
import type { Client } from '../lib/github';
import { relative } from '../lib/parse';

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 8 ? 'var(--success)' : score >= 6 ? 'var(--text-muted)' : 'var(--danger)';
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-sm tnum"
      style={{ color: tone, borderColor: tone }}
      title="Self-assessed against the quality bar"
    >
      {score}/10
    </span>
  );
}

/** Ask for a change to an app that already shipped. */
function Improve({ app, client }: { app: LedgerApp; client: Client }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.dispatch('run-factory.yml', {
        mode: 'continue',
        focus: `Improve the shipped app "${app.name}" (slug ${app.slug}, repo ${app.repo}, live at ${app.url}). The owner asked for: ${text.trim()}. Clone its repo, make the change, re-run its gate, redeploy, and update its ledger score and notes honestly.`,
      });
      setDone(true);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="mt-3 text-sm text-[var(--success)]">
        Asked for. It is picked up by the run that just started.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--accent)]"
        >
          Change something about this
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor={`improve-${app.slug}`}>
            What should change?
          </label>
          <textarea
            id={`improve-${app.slug}`}
            className="min-h-20 w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The confidence bars jump around — smooth them. And add the audio half."
            maxLength={2000}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={() => void send()}
              className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] disabled:opacity-40"
            >
              {busy ? 'Starting…' : 'Start a run for this'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AppsView({
  apps,
  client,
  canAct,
}: {
  apps: LedgerApp[];
  client: Client;
  canAct: boolean;
}) {
  if (apps.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-8 text-center">
        <p className="font-medium">No apps yet</p>
        <p className="mx-auto mt-2 max-w-sm text-[var(--text-muted)] text-pretty">
          The first one is built on the next scheduled run and appears here automatically, with
          its live link. You do not need to do anything.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {[...apps].reverse().map((app) => (
        <li
          key={app.slug}
          className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-faint)] tnum">Week {app.week}</p>
              <h3 className="text-[length:var(--t-lg)] leading-tight font-semibold">
                {app.name}
              </h3>
            </div>
            <ScorePill score={app.score} />
          </div>

          {app.sentence ? (
            <p className="mt-2 flex-1 text-[var(--text-muted)] text-pretty">{app.sentence}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[var(--text-muted)]">
              {app.category}
            </span>
            <span className="text-[var(--text-faint)]">
              shipped {relative(`${app.shipped}T12:00:00Z`)}
            </span>
          </div>

          {canAct ? <Improve app={app} client={client} /> : null}

          <div className="mt-4 flex gap-2">
            <a
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
              href={app.url}
              target="_blank"
              rel="noreferrer"
            >
              Open app ↗
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)]"
              href={`https://github.com/${app.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              Code
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
