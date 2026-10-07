import { useState } from 'react';
import type { Client } from '../lib/github';
import { authAvailable, signIn, submitRequest, type Viewer } from '../lib/auth';
import { relative } from '../lib/parse';
import type { Request, Run } from '../lib/types';

interface Props {
  client: Client;
  requests: Request[];
  runs: Run[];
  reports: string[];
  viewer: Viewer | null;
  onConnect: () => void;
  onChanged: () => void;
}

const EXAMPLES = [
  'Rebuild last week’s app with a proper dark mode.',
  'Stop building developer tools for a while — do something for parents.',
  'Add CSV export to every app that produces a table.',
  'The scores feel generous. Be harsher in the ledger.',
];

function conclusionTone(run: Run): string {
  if (run.status !== 'completed') return 'var(--text-muted)';
  return run.conclusion === 'success' ? 'var(--success)' : 'var(--danger)';
}

export function ControlView({
  client,
  requests,
  runs,
  reports,
  viewer,
  onConnect,
  onChanged,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  // An instruction steers the whole factory, so unlike an idea it is admin-only.
  const viaWorker = authAvailable && viewer?.admin === true;
  const canSend = viaWorker || (!authAvailable && client.canWrite);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      let number: number;
      if (viaWorker) {
        number = (await submitRequest(body)).number;
      } else {
        const firstLine = body.split('\n')[0] ?? body;
        number = (
          await client.createIssue(
            firstLine.slice(0, 100),
            [
              body,
              '',
              '---',
              'Sent from the Factory Console. The next run reads open issues labelled',
              '`request` before anything else, acts on them, and closes them with a reply.',
            ].join('\n'),
            ['request'],
          )
        ).number;
      }
      setSent(number);
      setText('');
      onChanged();
    } catch (error) {
      setProblem(
        error instanceof Error
          ? `Could not send that: ${error.message}`
          : 'Could not send that.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="tell-heading">
        <h2 id="tell-heading" className="text-[length:var(--t-lg)] font-semibold">
          Tell the factory what to do
        </h2>
        <p className="mt-1 max-w-prose text-[var(--text-muted)] text-pretty">
          Write it as you would say it. The next run reads these before anything else, does the
          work, and replies on the thread. This replaces having to open a chat.
        </p>

        <form className="mt-4 space-y-3" onSubmit={send}>
          <label className="sr-only" htmlFor="request">
            Your instruction
          </label>
          <textarea
            id="request"
            className="min-h-32 w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2"
            placeholder="Anything — change what it builds, how it builds, or what to fix."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={8000}
          />
          <div className="flex flex-wrap items-center gap-3">
            {canSend ? (
              <button
                type="submit"
                disabled={!text.trim() || busy}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            ) : authAvailable && !viewer ? (
              <button
                type="button"
                onClick={signIn}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
              >
                Sign in to send instructions
              </button>
            ) : authAvailable && viewer && !viewer.admin ? (
              <p className="text-sm text-[var(--text-muted)]">
                Only an admin can send instructions. You can still submit an idea on the Ideas
                tab.
              </p>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
              >
                Connect to send this
              </button>
            )}
            {sent !== null ? (
              <p role="status" className="text-sm text-[var(--success)]">
                Sent as #{sent}. It is picked up on the next run.
              </p>
            ) : null}
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problem}
            </p>
          ) : null}
        </form>

        <div className="mt-4">
          <p className="text-sm text-[var(--text-faint)]">For example:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {requests.length > 0 ? (
        <section aria-labelledby="outstanding-heading">
          <h2 id="outstanding-heading" className="text-[length:var(--t-lg)] font-semibold">
            Outstanding instructions
          </h2>
          <ul className="mt-3 space-y-2">
            {requests.map((r) => (
              <li
                key={r.number}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <a
                    className="text-sm text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.comments > 0
                      ? `${r.comments} repl${r.comments === 1 ? 'y' : 'ies'} ↗`
                      : 'open ↗'}
                  </a>
                </div>
                <p className="mt-0.5 text-sm text-[var(--text-faint)]">
                  sent {relative(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-[length:var(--t-lg)] font-semibold">
          Recent activity
        </h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-[var(--text-muted)]">
            No workflow runs yet, or the token has no Actions permission.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--surface-raised)] px-4 py-3"
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: conclusionTone(run) }}
                  aria-hidden="true"
                />
                <span className="font-medium">{run.name}</span>
                <span className="text-sm" style={{ color: conclusionTone(run) }}>
                  {run.status === 'completed' ? (run.conclusion ?? 'done') : run.status}
                </span>
                <span className="ml-auto text-sm text-[var(--text-faint)]">
                  {relative(run.createdAt)}
                </span>
                <a
                  className="text-sm text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
                  href={run.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  logs ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="text-[length:var(--t-lg)] font-semibold">
          Run reports
        </h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-[var(--text-muted)]">
            Each completed run writes one: what it built, what it cut, what broke, and an honest
            score. The first appears after the first run.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {reports.map((name) => (
              <li key={name}>
                <a
                  className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--accent)]"
                  href={`https://github.com/${client.repo}/blob/main/factory/state/reports/${name}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {name.replace(/\.md$/, '')} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
