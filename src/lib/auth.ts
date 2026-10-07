/**
 * Sign-in against the console's auth Worker.
 *
 * The Worker, not this page, holds the credential that can write to the factory —
 * so a visitor never handles a token, and admin status is decided from their
 * *verified* GitHub email rather than anything the browser claims.
 *
 * When VITE_API_BASE is unset the Worker is not deployed; the console falls back
 * to the paste-a-token path so it keeps working.
 */

const SESSION_KEY = 'factory-console:session';

export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
export const authAvailable = API_BASE.length > 0;

export interface Viewer {
  login: string;
  name: string;
  avatar: string;
  email: string;
  admin: boolean;
}

export function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: sign-in lasts only this page view */
  }
}

/**
 * The Worker returns the session in the URL fragment — fragments are never sent
 * to a server, so it cannot land in a log or a Referer header. Take it, store it,
 * and clean the address bar so it is not left in history or copied by accident.
 */
export function captureSessionFromUrl(): { error?: string } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const session = params.get('session');
  const error = params.get('error');
  if (session || error) {
    if (session) writeSession(session);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return error ? { error } : {};
}

export function signIn(): void {
  window.location.href = `${API_BASE}/auth/login`;
}

export function signOut(): void {
  writeSession(null);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readSession();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    writeSession(null);
    throw new Error('Your sign-in expired. Sign in again.');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The server returned ${res.status}.`);
  return body as T;
}

/** The signed-in viewer, or null when not signed in or the Worker is unreachable. */
export async function whoAmI(): Promise<Viewer | null> {
  if (!authAvailable || !readSession()) return null;
  try {
    return await call<Viewer>('/auth/me');
  } catch {
    return null;
  }
}

export const submitIdea = (name: string, detail: string) =>
  call<{ number: number; url: string; approved: boolean }>('/api/ideas', {
    method: 'POST',
    body: JSON.stringify({ name, detail }),
  });

export const submitRequest = (text: string) =>
  call<{ number: number; url: string }>('/api/requests', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

export const approveIdea = (issue: number) =>
  call<{ ok: true }>(`/api/ideas/${issue}/approve`, { method: 'POST' });

export const rejectIdea = (issue: number, reason: string) =>
  call<{ ok: true }>(`/api/ideas/${issue}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
