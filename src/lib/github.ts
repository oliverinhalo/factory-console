/**
 * GitHub API client.
 *
 * Reading a public factory repository needs no credentials, so the dashboard
 * works the moment the page loads. A token is required only to write — adding an
 * idea or sending an instruction — and for reading a private repository.
 *
 * When supplied, the token is kept in this browser's localStorage and sent only
 * to api.github.com. Nothing from the repository is baked into this page.
 */

const API = 'https://api.github.com';
const TOKEN_KEY = 'factory-console:token';
const REPO_KEY = 'factory-console:repo';

export const DEFAULT_REPO = 'oliverinhalo/Claude';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the token still works for this session via the in-memory client */
  }
}

export function readRepo(): string {
  try {
    return localStorage.getItem(REPO_KEY) ?? DEFAULT_REPO;
  } catch {
    return DEFAULT_REPO;
  }
}

export function writeRepo(repo: string): void {
  try {
    localStorage.setItem(REPO_KEY, repo);
  } catch {
    /* nothing useful to do */
  }
}

export class NeedsTokenError extends Error {
  constructor() {
    super('Connect a GitHub token to do that.');
    this.name = 'NeedsTokenError';
  }
}

async function request<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    throw new GitHubError('That token was rejected. It may be expired or revoked.', 401);
  }
  if (res.status === 403) {
    throw new GitHubError(
      token
        ? 'The token is missing a permission for this action, or you have hit the rate limit.'
        : 'GitHub rate-limited this browser. Connect a token to raise the limit.',
      403,
    );
  }
  if (res.status === 409) {
    throw new GitHubError('Someone else changed this first — reload and try again.', 409);
  }
  if (res.status === 404) {
    throw new GitHubError(
      token
        ? 'Not found. Either the path is wrong or the token cannot see this repository.'
        : 'Not found. If this repository is private, connect a token to read it.',
      404,
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { message?: string }).message ?? '';
    } catch {
      /* no JSON body */
    }
    throw new GitHubError(detail || `GitHub returned ${res.status}.`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Encode UTF-8 text as base64, which the Contents API requires. */
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode a base64 payload that may contain multi-byte UTF-8. */
function decodeBase64(data: string): string {
  const binary = atob(data.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface Client {
  repo: string;
  /** False when browsing anonymously: reads work, writes do not. */
  canWrite: boolean;
  whoami(): Promise<{ login: string; avatar: string }>;
  file(path: string): Promise<string | null>;
  /** Content plus the blob sha, which a write must quote to avoid clobbering. */
  fileWithSha(path: string): Promise<{ content: string | null; sha: string | null }>;
  /** Commit a file. A stale sha is rejected by GitHub rather than overwriting. */
  writeFile(
    path: string,
    content: string,
    sha: string | null,
    message: string,
  ): Promise<string>;
  dir(path: string): Promise<string[]>;
  issues(label: string, state?: 'open' | 'closed' | 'all'): Promise<RawIssue[]>;
  createIssue(title: string, body: string, labels: string[]): Promise<RawIssue>;
  closeIssue(number: number): Promise<void>;
  addLabel(number: number, label: string): Promise<void>;
  runs(limit?: number): Promise<RawRun[]>;
  dispatch(workflow: string, inputs?: Record<string, string>): Promise<void>;
  /** Jobs of one run, with their steps — tells you which step failed. */
  jobs(runId: number): Promise<RawJob[]>;
  /** The ::error:: and ::warning:: messages a job emitted. */
  annotations(jobId: number): Promise<RawAnnotation[]>;
  /** "active" | "disabled_manually" | "disabled_inactivity" */
  workflowState(workflow: string): Promise<string | null>;
  setWorkflowEnabled(workflow: string, enabled: boolean): Promise<void>;
  cancelRun(runId: number): Promise<void>;
  rerunRun(runId: number): Promise<void>;
}

export interface RawIssue {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  state: 'open' | 'closed';
  html_url: string;
  comments: number;
  labels: Array<{ name: string } | string>;
  user?: { login: string } | null;
}

export interface RawRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

export interface RawJob {
  id: number;
  name: string;
  conclusion: string | null;
  steps?: Array<{ name: string; conclusion: string | null }>;
}

export interface RawAnnotation {
  annotation_level: string | null;
  message: string | null;
  title: string | null;
}

export function createClient(token: string | null, repo: string): Client {
  const base = `/repos/${repo}`;
  const requireToken = () => {
    if (!token) throw new NeedsTokenError();
  };
  return {
    repo,
    canWrite: token !== null,

    async whoami() {
      requireToken();
      const u = await request<{ login: string; avatar_url: string }>(token, '/user');
      return { login: u.login, avatar: u.avatar_url };
    },

    async file(path) {
      try {
        const res = await request<{ content?: string; encoding?: string }>(
          token,
          `${base}/contents/${path}`,
        );
        if (!res.content) return null;
        return decodeBase64(res.content);
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) return null;
        throw error;
      }
    },

    async fileWithSha(path) {
      try {
        const res = await request<{ content?: string; sha?: string }>(
          token,
          `${base}/contents/${path}`,
        );
        return {
          content: res.content ? decodeBase64(res.content) : null,
          sha: res.sha ?? null,
        };
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404)
          return { content: null, sha: null };
        throw error;
      }
    },

    async writeFile(path, content, sha, message) {
      requireToken();
      // Quoting the sha makes this a compare-and-set: if a factory run changed
      // the file since it was read, GitHub returns 409 and the caller refetches
      // rather than silently discarding the other side's edit.
      const res = await request<{ content: { sha: string } }>(
        token,
        `${base}/contents/${path}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: encodeBase64(content),
            ...(sha ? { sha } : {}),
            branch: 'main',
          }),
        },
      );
      return res.content.sha;
    },

    async dir(path) {
      try {
        const res = await request<Array<{ name: string; type: string }>>(
          token,
          `${base}/contents/${path}`,
        );
        return res.filter((e) => e.type === 'file').map((e) => e.name);
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) return [];
        throw error;
      }
    },

    async issues(label, state = 'open') {
      return request<RawIssue[]>(
        token,
        `${base}/issues?labels=${encodeURIComponent(label)}&state=${state}&per_page=100`,
      );
    },

    async createIssue(title, body, labels) {
      requireToken();
      return request<RawIssue>(token, `${base}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title, body, labels }),
      });
    },

    async closeIssue(number) {
      requireToken();
      await request(token, `${base}/issues/${number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
    },

    async addLabel(number, label) {
      requireToken();
      await request(token, `${base}/issues/${number}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels: [label] }),
      });
    },

    async runs(limit = 10) {
      const res = await request<{ workflow_runs: RawRun[] }>(
        token,
        `${base}/actions/runs?per_page=${limit}`,
      );
      return res.workflow_runs;
    },

    async dispatch(workflow, inputs = {}) {
      requireToken();
      await request(token, `${base}/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: 'main', inputs }),
      });
    },

    async jobs(runId) {
      const res = await request<{ jobs: RawJob[] }>(
        token,
        `${base}/actions/runs/${runId}/jobs`,
      );
      return res.jobs;
    },

    async annotations(jobId) {
      // An Actions job is also a check run, so its annotations carry the
      // ::error:: lines the workflow printed — the actual reason, not just
      // "a step failed".
      try {
        return await request<RawAnnotation[]>(token, `${base}/check-runs/${jobId}/annotations`);
      } catch {
        return [];
      }
    },

    async workflowState(workflow) {
      try {
        const res = await request<{ state: string }>(
          token,
          `${base}/actions/workflows/${workflow}`,
        );
        return res.state;
      } catch {
        return null;
      }
    },

    async setWorkflowEnabled(workflow, enabled) {
      requireToken();
      await request(
        token,
        `${base}/actions/workflows/${workflow}/${enabled ? 'enable' : 'disable'}`,
        {
          method: 'PUT',
        },
      );
    },

    async cancelRun(runId) {
      requireToken();
      await request(token, `${base}/actions/runs/${runId}/cancel`, { method: 'POST' });
    },

    async rerunRun(runId) {
      requireToken();
      await request(token, `${base}/actions/runs/${runId}/rerun`, { method: 'POST' });
    },
  };
}
