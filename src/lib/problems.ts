/**
 * Turning failures into something readable.
 *
 * Until now a failed run was visible only as a red tick in the Actions tab, with
 * the reason buried in a log. These helpers pull out the step that failed and the
 * `::error::` messages the workflow printed, so the console can say what actually
 * went wrong.
 */
import type { Client, RawRun } from './github';
import type { Checkpoint, Problem } from './types';

/** The failing steps of a run, named. */
export function failedSteps(
  jobs: Array<{ name: string; steps?: Array<{ name: string; conclusion: string | null }> }>,
): string[] {
  return jobs.flatMap((job) =>
    (job.steps ?? []).filter((step) => step.conclusion === 'failure').map((step) => step.name),
  );
}

/** Deduplicated, trimmed error text; warnings only if there are no errors. */
export function errorMessages(
  annotations: Array<{ annotation_level: string | null; message: string | null }>,
): string[] {
  const pick = (level: string) =>
    annotations
      .filter((a) => a.annotation_level === level && a.message)
      .map((a) => (a.message as string).trim())
      .filter(Boolean);
  const errors = pick('failure');
  const chosen = errors.length > 0 ? errors : pick('warning');
  return [...new Set(chosen)].slice(0, 4);
}

/** A blocker a run recorded in its checkpoint is a problem the owner should see. */
export function checkpointProblems(checkpoints: Checkpoint[]): Problem[] {
  const out: Problem[] = [];
  for (const cp of checkpoints) {
    for (const blocker of cp.blockers ?? []) {
      out.push({
        kind: 'blocker',
        title: `${cp.slug} is blocked`,
        detail: blocker,
        when: cp.updated,
      });
    }
  }
  return out;
}

/**
 * Failed runs, each with the step that failed and the reason it printed.
 * Best-effort: a run whose detail cannot be fetched is still reported, because a
 * failure with no explanation is still a failure worth seeing.
 */
export async function runProblems(client: Client, runs: RawRun[]): Promise<Problem[]> {
  // Unauthenticated GitHub allows 60 requests an hour per IP, and the reason for
  // a failure costs two more calls each. Anonymous viewers get the failure
  // without the detail rather than a rate-limited page with nothing on it.
  const withDetail = client.canWrite;

  const failed = runs
    .filter(
      (r) =>
        r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'skipped',
    )
    .slice(0, 5);

  const out: Problem[] = [];
  for (const run of failed) {
    let detail = '';
    if (!withDetail) {
      out.push({
        kind: 'run',
        title: `${run.name} ${run.conclusion ?? 'failed'}`,
        detail:
          'Sign in to see why — reading the reason costs API calls anonymous viewers do not have.',
        when: run.created_at,
        url: run.html_url,
        runId: run.id,
      });
      continue;
    }
    try {
      const jobs = await client.jobs(run.id);
      const steps = failedSteps(jobs);
      const messages = (
        await Promise.all(
          jobs.filter((j) => j.conclusion === 'failure').map((j) => client.annotations(j.id)),
        )
      ).flat();
      const reasons = errorMessages(messages);
      detail = [steps.length > 0 ? `Failed at: ${steps.join(', ')}` : '', ...reasons]
        .filter(Boolean)
        .join('\n');
    } catch {
      detail = '';
    }
    out.push({
      kind: 'run',
      title: `${run.name} ${run.conclusion ?? 'failed'}`,
      detail: detail || 'No reason was recorded. Open the run log.',
      when: run.created_at,
      url: run.html_url,
      runId: run.id,
    });
  }
  return out;
}
