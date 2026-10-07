import type { FactoryData } from '../lib/useFactory';
import type { Client } from '../lib/github';
import { meanScore, nextRun, relative, weeksCompleted, weeksElapsed } from '../lib/parse';
import { RunNow } from './RunNow';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-[length:var(--t-2xl)] leading-none font-semibold tnum">{value}</p>
      {sub ? <p className="mt-1.5 text-sm text-[var(--text-faint)]">{sub}</p> : null}
    </div>
  );
}

export function Overview({
  data,
  client,
  canRun,
}: {
  data: FactoryData;
  client: Client;
  canRun: boolean;
}) {
  const { ledger, checkpoints, requests, submitted, pending } = data;
  const shipped = ledger.apps.length;
  const week = weeksElapsed(ledger.started);
  const mean = meanScore(ledger.apps);
  const next = nextRun();
  const active = checkpoints.find((c) => c.status === 'in_progress');
  // Judged against weeks finished, not the week in progress.
  const pace = shipped - weeksCompleted(ledger.started);

  return (
    <div className="space-y-8">
      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="sr-only">
          Progress
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Shipped"
            value={`${shipped}`}
            sub={`of ${ledger.target} · week ${week}`}
          />
          <Stat
            label="Pace"
            value={pace === 0 ? 'on track' : pace > 0 ? `+${pace}` : `${pace}`}
            sub={pace < 0 ? `${Math.abs(pace)} behind schedule` : 'apps vs weeks elapsed'}
          />
          <Stat
            label="Mean score"
            value={mean === null ? '—' : `${mean}`}
            sub="out of 10, self-assessed"
          />
          <Stat
            label="Next run"
            value={relative(next.at.toISOString()).replace('in ', '')}
            sub={`${next.kind === 'weekly' ? 'new app' : 'continuation'} · ${next.at.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
          />
        </div>

        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
            role="progressbar"
            aria-valuenow={shipped}
            aria-valuemin={0}
            aria-valuemax={ledger.target}
            aria-label={`${shipped} of ${ledger.target} apps shipped`}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-[var(--dur-enter)]"
              style={{ width: `${Math.max(1, (shipped / ledger.target) * 100)}%` }}
            />
          </div>
        </div>
      </section>

      <RunNow client={client} canRun={canRun} />

      <section aria-labelledby="now-heading">
        <h2 id="now-heading" className="text-[length:var(--t-lg)] font-semibold">
          Right now
        </h2>
        {active ? (
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--surface-raised)] p-4">
            <p className="flex flex-wrap items-center gap-2">
              <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
              <span className="font-medium">{active.slug}</span>
              <span className="text-[var(--text-muted)]">
                week {active.week} · finished phase{' '}
                <strong className="font-medium text-[var(--text)]">
                  {active.last_completed_phase ?? 'none'}
                </strong>
              </span>
            </p>
            <p className="mt-2 text-[var(--text-muted)]">
              Next: {active.next_action || 'not recorded'}
            </p>
            <p className="mt-2 text-sm text-[var(--text-faint)]">
              Updated {relative(active.updated)}
            </p>
            {active.blockers.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-[var(--danger)]">
                {active.blockers.map((b) => (
                  <li key={b}>Blocked: {b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-[var(--text-muted)]">
            {shipped === 0
              ? 'Nothing has run yet. The first app is built on the next scheduled run — no action needed from you.'
              : 'No run in progress. The factory is idle until its next scheduled run.'}
          </p>
        )}
      </section>

      {submitted.length > 0 || pending.length > 0 ? (
        <section aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="text-[length:var(--t-lg)] font-semibold">
            In the queue
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Ideas waiting for a run. Manage them on the Ideas tab.
          </p>
          <ul className="mt-3 space-y-2">
            {[...submitted, ...pending].map((idea) => (
              <li
                key={idea.issue}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <span className="font-medium">{idea.name}</span>
                {idea.state === 'pending' ? (
                  <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-sm text-[var(--text-muted)]">
                    awaiting your approval
                  </span>
                ) : idea.state === 'next' ? (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-sm text-[var(--accent-text)]">
                    build next
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-sm text-[var(--text-muted)]">
                    approved
                  </span>
                )}
                <span className="ml-auto text-sm text-[var(--text-faint)]">
                  {idea.createdAt ? relative(idea.createdAt) : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {requests.length > 0 ? (
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-[length:var(--t-lg)] font-semibold">
            Waiting to be picked up
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            The next run reads these before it does anything else.
          </p>
          <ul className="mt-3 space-y-2">
            {requests.map((r) => (
              <li
                key={r.number}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <p className="font-medium">{r.title}</p>
                <p className="mt-0.5 text-sm text-[var(--text-faint)]">
                  sent {relative(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.warnings.length > 0 ? (
        <section aria-labelledby="warnings-heading">
          <h2 id="warnings-heading" className="text-[length:var(--t-lg)] font-semibold">
            Notes
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
            {data.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
