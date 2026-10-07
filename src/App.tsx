import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { TokenSetup } from './components/TokenSetup';
import { Overview } from './components/Overview';
import { AppsView } from './components/AppsView';
import { IdeasView } from './components/IdeasView';
import { ControlView } from './components/ControlView';
import { PendingView } from './components/PendingView';
import { SignIn } from './components/SignIn';
import { authAvailable, captureSessionFromUrl, whoAmI, type Viewer } from './lib/auth';
import { createClient, readRepo, readToken, writeRepo, writeToken } from './lib/github';
import { useFactory } from './lib/useFactory';

const BASE_TABS = ['Overview', 'Apps', 'Ideas', 'Control'] as const;
type Tab = (typeof BASE_TABS)[number] | 'Pending';

export function App() {
  const [token, setToken] = useState<string | null>(readToken);
  const [repo, setRepo] = useState<string>(readRepo);
  const [tab, setTab] = useState<Tab>('Overview');
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  // The Worker hands the session back in the fragment on return from GitHub.
  useEffect(() => {
    const { error } = captureSessionFromUrl();
    if (error) setSignInError(error);
    void whoAmI().then(setViewer);
  }, []);

  const [wantsToken, setWantsToken] = useState(false);
  // Reading a public repo needs no token, so the dashboard loads straight away.
  // A token is required only to write, or to read a private repository.
  const client = useMemo(() => createClient(token, repo), [token, repo]);
  const { state, refreshing, reload } = useFactory(client);

  const pendingCount =
    state.status === 'ready' && viewer?.admin ? state.data.pending.length : 0;
  const tabs: Tab[] = viewer?.admin ? [...BASE_TABS, 'Pending'] : [...BASE_TABS];

  const connect = useCallback((nextToken: string, nextRepo: string) => {
    writeToken(nextToken);
    writeRepo(nextRepo);
    setRepo(nextRepo);
    setToken(nextToken);
    setWantsToken(false);
  }, []);

  const disconnect = useCallback(() => {
    writeToken(null);
    setToken(null);
  }, []);

  // A rejected token, an unreadable private repo, or an explicit request to
  // connect all lead to the one screen that fixes it.
  if (
    wantsToken ||
    (state.status === 'error' && /rejected|cannot see|private|Not found/i.test(state.message))
  ) {
    return (
      <>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TokenSetup
          onSubmit={connect}
          initialRepo={repo}
          {...(state.status === 'error' ? { error: state.message } : {})}
          {...(wantsToken ? { onCancel: () => setWantsToken(false) } : {})}
        />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 py-6">
          <div>
            <h1 className="text-[length:var(--t-xl)] leading-none font-semibold tracking-tight">
              Factory Console
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--text-faint)]">{repo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SignIn
              viewer={viewer}
              available={authAvailable}
              onSignedOut={() => {
                setViewer(null);
                void reload();
              }}
            />
            <button
              type="button"
              onClick={() => void reload()}
              disabled={state.status === 'loading' || refreshing}
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {state.status === 'loading' || refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <ThemeToggle />
          </div>
        </header>

        <nav
          aria-label="Sections"
          className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border)]"
        >
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-current={tab === name ? 'page' : undefined}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors duration-[var(--dur-state)] ${
                tab === name
                  ? 'border-[var(--accent)] text-[var(--text)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {name}
              {name === 'Pending' && pendingCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs text-[var(--accent-text)] tnum">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {signInError ? (
          <p
            role="alert"
            className="mt-4 rounded-[var(--radius)] border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {signInError}
          </p>
        ) : null}

        <main id="main" className="flex-1 py-8">
          {state.status === 'loading' || state.status === 'idle' ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading the factory">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)]"
                />
              ))}
            </div>
          ) : state.status === 'error' ? (
            <div
              role="alert"
              className="rounded-[var(--radius-lg)] border border-[var(--danger)] p-5"
            >
              <p className="font-medium text-[var(--danger)]">Could not load the factory</p>
              <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)]"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm"
                >
                  Use a different token
                </button>
              </div>
            </div>
          ) : tab === 'Pending' ? (
            <PendingView
              pending={state.data.pending}
              viewer={viewer}
              onChanged={() => void reload()}
            />
          ) : tab === 'Overview' ? (
            <Overview
              data={state.data}
              client={client}
              canRun={client.canWrite || viewer?.admin === true}
            />
          ) : tab === 'Apps' ? (
            <AppsView apps={state.data.ledger.apps} />
          ) : tab === 'Ideas' ? (
            <IdeasView
              bank={state.data.bank}
              submitted={state.data.submitted}
              client={client}
              viewer={viewer}
              onConnect={() => setWantsToken(true)}
              onChanged={() => void reload()}
            />
          ) : (
            <ControlView
              client={client}
              viewer={viewer}
              onConnect={() => setWantsToken(true)}
              requests={state.data.requests}
              runs={state.data.runs}
              reports={state.data.reports}
              onChanged={() => void reload()}
            />
          )}
        </main>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <span>
            {client.canWrite
              ? 'Your token stays in this browser.'
              : 'Browsing anonymously — connect to add ideas or send instructions.'}
          </span>
          <a
            className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
          >
            Factory repo ↗
          </a>
          <button
            type="button"
            onClick={client.canWrite ? disconnect : () => setWantsToken(true)}
            className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
          >
            {client.canWrite ? 'Disconnect' : 'Connect'}
          </button>
        </footer>
      </div>
    </>
  );
}
