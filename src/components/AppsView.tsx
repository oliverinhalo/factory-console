import type { LedgerApp } from '../lib/types';
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

export function AppsView({ apps }: { apps: LedgerApp[] }) {
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
