import { describe, expect, it, vi } from 'vitest';
import { checkpointProblems, errorMessages, failedSteps, runProblems } from './problems';
import type { Client, RawRun } from './github';
import type { Checkpoint } from './types';

describe('failedSteps', () => {
  it('names only the steps that failed', () => {
    expect(
      failedSteps([
        {
          name: 'publish',
          steps: [
            { name: 'Check out', conclusion: 'success' },
            { name: 'Push the app', conclusion: 'failure' },
            { name: 'Deploy', conclusion: 'skipped' },
          ],
        },
      ]),
    ).toEqual(['Push the app']);
  });

  it('copes with a job that reports no steps', () => {
    expect(failedSteps([{ name: 'x' }])).toEqual([]);
  });
});

describe('errorMessages', () => {
  it('prefers failures over warnings', () => {
    expect(
      errorMessages([
        { annotation_level: 'warning', message: 'just a warning' },
        { annotation_level: 'failure', message: 'the real reason' },
      ]),
    ).toEqual(['the real reason']);
  });

  it('falls back to warnings when nothing failed outright', () => {
    expect(errorMessages([{ annotation_level: 'warning', message: 'token missing' }])).toEqual([
      'token missing',
    ]);
  });

  it('deduplicates the same message repeated across jobs', () => {
    expect(
      errorMessages([
        { annotation_level: 'failure', message: '403 denied' },
        { annotation_level: 'failure', message: '403 denied' },
      ]),
    ).toEqual(['403 denied']);
  });

  it('caps the list so one noisy run cannot flood the page', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      annotation_level: 'failure',
      message: `e${i}`,
    }));
    expect(errorMessages(many)).toHaveLength(4);
  });

  it('ignores annotations with no message', () => {
    expect(errorMessages([{ annotation_level: 'failure', message: null }])).toEqual([]);
  });
});

describe('checkpointProblems', () => {
  const cp = (over: Partial<Checkpoint>): Checkpoint => ({
    slug: 'trainyard',
    week: 1,
    status: 'in_progress',
    started: '2026-10-11T10:00:00Z',
    updated: '2026-10-11T11:00:00Z',
    last_completed_phase: 'gate',
    next_action: '',
    decisions: [],
    blockers: [],
    live_url: null,
    ...over,
  });

  it('surfaces each blocker a run recorded', () => {
    const out = checkpointProblems([cp({ blockers: ['403 on dispatch', 'no camera'] })]);
    expect(out).toHaveLength(2);
    expect(out[0]?.detail).toBe('403 on dispatch');
    expect(out[0]?.title).toContain('trainyard');
  });

  it('reports nothing when nothing is blocked', () => {
    expect(checkpointProblems([cp({})])).toEqual([]);
  });
});

describe('runProblems', () => {
  const run = (over: Partial<RawRun>): RawRun => ({
    id: 1,
    name: 'Run factory now',
    status: 'completed',
    conclusion: 'failure',
    created_at: '2026-10-11T10:00:00Z',
    html_url: 'https://github.com/x/y/actions/runs/1',
    ...over,
  });

  const client = (over: Partial<Client> = {}) =>
    ({
      canWrite: true,
      jobs: vi.fn().mockResolvedValue([
        {
          id: 9,
          name: 'run',
          conclusion: 'failure',
          steps: [{ name: 'Run the factory', conclusion: 'failure' }],
        },
      ]),
      annotations: vi.fn().mockResolvedValue([
        {
          annotation_level: 'failure',
          message: 'Could not fetch an OIDC token.',
          title: null,
        },
      ]),
      ...over,
    }) as unknown as Client;

  it('ignores successful and skipped runs', async () => {
    const out = await runProblems(client(), [
      run({ conclusion: 'success' }),
      run({ conclusion: 'skipped' }),
    ]);
    expect(out).toEqual([]);
  });

  it('reports the failing step and the printed reason', async () => {
    const [p] = await runProblems(client(), [run({})]);
    expect(p?.detail).toContain('Failed at: Run the factory');
    expect(p?.detail).toContain('OIDC');
    expect(p?.runId).toBe(1);
  });

  it('still reports a failure whose detail cannot be fetched', async () => {
    const broken = client({ jobs: vi.fn().mockRejectedValue(new Error('403')) });
    const [p] = await runProblems(broken, [run({})]);
    expect(p?.detail).toMatch(/No reason was recorded/);
  });

  it('caps how many failures it reports', async () => {
    const runs = Array.from({ length: 9 }, (_, i) => run({ id: i + 1 }));
    expect(await runProblems(client(), runs)).toHaveLength(5);
  });

  it('skips the costly detail lookup for anonymous viewers', async () => {
    const jobs = vi.fn();
    const anon = client({ canWrite: false, jobs });
    const [p] = await runProblems(anon, [run({})]);
    // Still reported — just without the two extra API calls per failure, which
    // would exhaust the 60-per-hour anonymous budget.
    expect(p?.title).toContain('failure');
    expect(p?.url).toContain('/actions/runs/1');
    expect(p?.detail).toMatch(/Sign in to see why/);
    expect(jobs).not.toHaveBeenCalled();
  });

  it('treats a cancelled run as a problem too', async () => {
    const [p] = await runProblems(client(), [run({ conclusion: 'cancelled' })]);
    expect(p?.title).toContain('cancelled');
  });
});
