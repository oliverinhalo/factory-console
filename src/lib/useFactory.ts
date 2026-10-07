import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client } from './github';
import { GitHubError } from './github';
import { parseIdeaBank } from './parse';
import type { Checkpoint, Idea, Ledger, LoadState, Request, Run } from './types';

export interface FactoryData {
  ledger: Ledger;
  bank: Idea[];
  submitted: Idea[];
  pending: Idea[];
  requests: Request[];
  checkpoints: Checkpoint[];
  reports: string[];
  runs: Run[];
  /** Paths that could not be read, so the UI can say what is missing. */
  warnings: string[];
}

const EMPTY_LEDGER: Ledger = {
  started: new Date().toISOString().slice(0, 10),
  target: 52,
  apps: [],
};

function safeJson<T>(raw: string | null, fallback: T, label: string, warnings: string[]): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    warnings.push(`${label} is not valid JSON and was ignored.`);
    return fallback;
  }
}

/** Load everything the console shows, tolerating any individual piece being absent. */
export function useFactory(client: Client | null) {
  const [state, setState] = useState<LoadState<FactoryData>>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  // A refresh must not unmount the view: doing so throws away whatever the
  // person was looking at, including the confirmation of what they just sent.
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (!client) return;
    if (hasData.current) setRefreshing(true);
    else setState({ status: 'loading' });
    const warnings: string[] = [];

    try {
      const [ledgerRaw, bankRaw, runFiles, reportFiles] = await Promise.all([
        client.file('factory/state/ledger.json'),
        client.file('factory/ideas/idea-bank.md'),
        client.dir('factory/state/run'),
        client.dir('factory/state/reports'),
      ]);

      const ledger = safeJson<Ledger>(ledgerRaw, EMPTY_LEDGER, 'ledger.json', warnings);
      if (ledgerRaw === null) warnings.push('No ledger found yet — nothing has shipped.');

      const checkpoints: Checkpoint[] = [];
      for (const name of runFiles.filter((f) => f.endsWith('.json'))) {
        const raw = await client.file(`factory/state/run/${name}`);
        const parsed = safeJson<Checkpoint | null>(raw, null, name, warnings);
        if (parsed) checkpoints.push(parsed);
      }

      // Issues and workflow runs are optional: a token without those permissions
      // should still show a working dashboard rather than an error page.
      let submitted: Idea[] = [];
      let pending: Idea[] = [];
      let requests: Request[] = [];
      let runs: Run[] = [];

      try {
        const raw = await client.issues('idea', 'open');
        const labelsOf = (issue: (typeof raw)[number]) =>
          issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
        const asIdea = (issue: (typeof raw)[number]): Idea => {
          const labels = labelsOf(issue);
          return {
            name: issue.title,
            description: (issue.body ?? '').split('\n')[0] ?? '',
            category: 'yours',
            issue: issue.number,
            state: labels.includes('pending-approval')
              ? 'pending'
              : labels.includes('next')
                ? 'next'
                : 'queued',
            createdAt: issue.created_at,
            ...(issue.user?.login ? { submittedBy: issue.user.login } : {}),
          };
        };
        // Pending ideas are listed separately: the factory is told never to build
        // one, so showing them beside approved ideas would misrepresent the queue.
        const all = raw.map(asIdea);
        submitted = all.filter((i) => i.state !== 'pending');
        pending = all.filter((i) => i.state === 'pending');
      } catch (error) {
        if (client.canWrite) {
          warnings.push(
            error instanceof GitHubError && error.status === 403
              ? 'Your ideas could not be read — the token has no Issues permission.'
              : 'Your submitted ideas could not be loaded.',
          );
        }
      }

      try {
        const raw = await client.issues('request', 'open');
        requests = raw.map((issue) => ({
          number: issue.number,
          title: issue.title,
          body: issue.body ?? '',
          createdAt: issue.created_at,
          state: issue.state,
          url: issue.html_url,
          comments: issue.comments,
        }));
      } catch {
        /* already warned above when issues are unreadable */
      }

      try {
        runs = (await client.runs(12)).map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion,
          createdAt: r.created_at,
          url: r.html_url,
        }));
      } catch {
        if (client.canWrite) {
          warnings.push('Workflow activity is hidden — the token has no Actions permission.');
        }
      }

      hasData.current = true;
      setState({
        status: 'ready',
        data: {
          ledger,
          bank: bankRaw ? parseIdeaBank(bankRaw) : [],
          submitted,
          pending,
          requests,
          checkpoints,
          reports: reportFiles
            .filter((f) => f.endsWith('.md'))
            .sort()
            .reverse(),
          runs,
          warnings,
        },
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Something went wrong loading the factory.',
      });
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, refreshing, reload: load };
}
