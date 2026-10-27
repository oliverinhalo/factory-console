import { signIn, signOut, type Viewer } from '../lib/auth';

interface Props {
  viewer: Viewer | null;
  available: boolean;
  onSignedOut: () => void;
}

/** Who you are, in the header. Compact on purpose — it is not the point of the page. */
export function SignIn({ viewer, available, onSignedOut }: Props) {
  if (!available) return null;

  if (!viewer) {
    return (
      <button
        type="button"
        onClick={signIn}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
      >
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
        title={viewer.email || viewer.login}
      >
        {viewer.avatar ? (
          <img src={viewer.avatar} alt="" width={24} height={24} className="rounded-full" />
        ) : null}
        <span className="hidden sm:inline">@{viewer.login}</span>
        {viewer.admin ? (
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-text)]">
            admin
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => {
          signOut();
          onSignedOut();
        }}
        className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
      >
        Sign out
      </button>
    </div>
  );
}
