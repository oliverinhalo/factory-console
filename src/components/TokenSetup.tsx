import { useState } from 'react';
import { DEFAULT_REPO } from '../lib/github';

interface Props {
  onSubmit: (token: string, repo: string) => void;
  error?: string | undefined;
  initialRepo?: string;
  /** Present when the viewer can already browse and is only connecting to write. */
  onCancel?: (() => void) | undefined;
}

const PERMISSIONS = [
  ['Contents', 'Read-only', 'reads the ledger, idea bank and run checkpoints'],
  ['Issues', 'Read and write', 'lets you add ideas and send requests from this page'],
  ['Actions', 'Read and write', 'shows run activity and lets you trigger a publish'],
  ['Metadata', 'Read-only', 'selected automatically'],
] as const;

/**
 * First-run screen. The factory repository is private, so the console needs a
 * token to read it. Said plainly, with the exact permissions, because a
 * mis-scoped token is the likeliest reason this page fails.
 */
export function TokenSetup({ onSubmit, error, initialRepo = DEFAULT_REPO, onCancel }: Props) {
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState(initialRepo);
  const valid = token.trim().length > 20 && /^[\w.-]+\/[\w.-]+$/.test(repo.trim());

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-[length:var(--t-2xl)] leading-tight font-semibold tracking-tight">
        Connect your factory
      </h1>
      <p className="mt-3 max-w-prose text-[var(--text-muted)] text-pretty">
        Your factory repository is private, so this page needs a token to read it. The token is
        stored in this browser only and is sent nowhere except
        <code className="mx-1 font-mono text-sm">api.github.com</code>. Nothing private is ever
        published to this page.
      </p>

      <ol className="mt-8 space-y-5">
        <li>
          <p className="font-medium">
            <span className="mr-2 text-[var(--text-faint)] tnum">1</span>
            Open the token page
          </p>
          <a
            className="mt-2 ml-7 inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            github.com/settings/personal-access-tokens/new ↗
          </a>
        </li>

        <li>
          <p className="font-medium">
            <span className="mr-2 text-[var(--text-faint)] tnum">2</span>
            Set <em>Resource owner</em> to your account, and under <em>Repository access</em>{' '}
            choose <em>Only select repositories</em> →{' '}
            <code className="font-mono text-sm">{repo}</code>
          </p>
        </li>

        <li>
          <p className="font-medium">
            <span className="mr-2 text-[var(--text-faint)] tnum">3</span>
            Under <em>Repository permissions</em>, set these four
          </p>
          <div className="mt-3 ml-7 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-sunken)] text-left text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Permission</th>
                  <th className="px-3 py-2 font-medium">Set to</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Why</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(([name, level, why]) => (
                  <tr key={name} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2">{level}</td>
                    <td className="hidden px-3 py-2 text-[var(--text-muted)] sm:table-cell">
                      {why}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </li>

        <li>
          <p className="font-medium">
            <span className="mr-2 text-[var(--text-faint)] tnum">4</span>
            Generate the token, copy it, and paste it here
          </p>
        </li>
      </ol>

      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSubmit(token.trim(), repo.trim());
        }}
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="repo">
            Factory repository
          </label>
          <input
            id="repo"
            className="mt-1.5 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-sm"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="token">
            Token
          </label>
          <input
            id="token"
            type="password"
            className="mt-1.5 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-sm"
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <p className="mt-1.5 text-sm text-[var(--text-faint)]">
            Stored in this browser. Never sent anywhere but GitHub.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!valid}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Connect
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm"
            >
              Back
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
