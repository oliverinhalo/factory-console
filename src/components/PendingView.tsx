import { useState } from 'react';
import { approveIdea, rejectIdea, type Viewer } from '../lib/auth';
import { relative } from '../lib/parse';
import type { Idea } from '../lib/types';

interface Props {
  pending: Idea[];
  viewer: Viewer | null;
  onChanged: () => void;
}

/**
 * Ideas submitted by someone who is not an admin. The factory is instructed never
 * to build one of these, so nothing happens until a decision is made here.
 */
export function PendingView({ pending, viewer, onChanged }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  async function act(issue: number, decide: () => Promise<unknown>) {
    setBusy(issue);
    setProblem(null);
    try {
      await decide();
      setRejecting(null);
      setReason('');
      onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That did not go through.');
    } finally {
      setBusy(null);
    }
  }

  if (!viewer?.admin) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6">
        <p className="font-medium">Admins only</p>
        <p className="mt-2 max-w-prose text-[var(--text-muted)] text-pretty">
          {viewer
            ? `You are signed in as @${viewer.login}, which is not an admin account. Submitted ideas are reviewed by the factory's owner.`
            : 'Sign in with an admin account to review submitted ideas.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[length:var(--t-lg)] font-semibold">Awaiting your approval</h2>
        <p className="mt-1 max-w-prose text-[var(--text-muted)] text-pretty">
          Ideas other people submitted. The factory will not touch any of these until you
          approve one — and an approved idea goes into the next run's scoring alongside its own
          candidates.
        </p>
      </div>

      {problem ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {problem}
        </p>
      ) : null}

      {pending.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-8 text-center">
          <p className="font-medium">Nothing waiting</p>
          <p className="mx-auto mt-2 max-w-sm text-[var(--text-muted)] text-pretty">
            When someone submits an idea it appears here. Nothing reaches the factory without
            passing through this screen first.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((idea) => (
            <li
              key={idea.issue}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{idea.name}</p>
                  {idea.description ? (
                    <p className="mt-1 text-[var(--text-muted)] text-pretty">
                      {idea.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-[var(--text-faint)]">
                    {idea.submittedBy ? `from @${idea.submittedBy} · ` : ''}
                    {idea.createdAt ? relative(idea.createdAt) : 'recently'}
                    {idea.issue !== undefined ? ` · #${idea.issue}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === idea.issue}
                    onClick={() =>
                      void act(idea.issue as number, () => approveIdea(idea.issue as number))
                    }
                    className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === idea.issue ? 'Working…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === idea.issue}
                    onClick={() =>
                      setRejecting(rejecting === idea.issue ? null : (idea.issue as number))
                    }
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>

              {rejecting === idea.issue ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act(idea.issue as number, () =>
                      rejectIdea(idea.issue as number, reason),
                    );
                  }}
                >
                  <div className="min-w-48 flex-1">
                    <label
                      className="block text-sm font-medium"
                      htmlFor={`reason-${idea.issue}`}
                    >
                      Why not?{' '}
                      <span className="font-normal text-[var(--text-faint)]">
                        Optional — it is posted on the thread
                      </span>
                    </label>
                    <input
                      id={`reason-${idea.issue}`}
                      className="mt-1.5 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy === idea.issue}
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--danger)] px-4 text-sm text-[var(--danger)] disabled:opacity-50"
                  >
                    Decline and close
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
