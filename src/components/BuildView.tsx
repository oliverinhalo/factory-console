import { useState } from 'react';
import type { Client } from '../lib/github';
import { authAvailable, signIn, submitIdea, type Viewer } from '../lib/auth';
import { EMPTY_BRIEF, renderBrief, toLines, validate, type Brief } from '../lib/brief';
import { appendToQueue } from '../lib/queue';

interface Props {
  client: Client;
  viewer: Viewer | null;
  onConnect: () => void;
  onChanged: () => void;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  children: React.ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label className="block font-medium" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-sm text-[var(--text-muted)]">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const INPUT =
  'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3';

/**
 * Say what you want precisely enough that the factory cannot build something
 * else. The must-have list is the point: the pipeline treats it as a contract.
 */
export function BuildView({ client, viewer, onConnect, onChanged }: Props) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [mustHave, setMustHave] = useState('');
  const [niceToHave, setNiceToHave] = useState('');
  const [exclude, setExclude] = useState('');
  const [notes, setNotes] = useState('');
  const [buildNext, setBuildNext] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    number: number;
    approved: boolean;
    position?: number | undefined;
  } | null>(null);

  const brief: Brief = {
    ...EMPTY_BRIEF,
    name,
    purpose,
    mustHave: toLines(mustHave),
    niceToHave: toLines(niceToHave),
    exclude: toLines(exclude),
    notes,
  };
  const problems = validate(brief);
  const errorFor = (field: keyof Brief) =>
    touched ? problems.find((p) => p.field === field)?.message : undefined;

  const viaWorker = authAvailable && viewer !== null;
  const canSubmit = viaWorker || client.canWrite;
  const isAdmin = !authAvailable ? client.canWrite : viewer?.admin === true;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (problems.length > 0 || busy) return;
    setBusy(true);
    setProblem(null);
    const body = renderBrief(brief, buildNext && isAdmin);
    try {
      if (viaWorker) {
        const result = await submitIdea(brief.name.trim(), body);
        setSent({ number: result.number, approved: result.approved });
        if (result.approved && buildNext) await client.addLabel(result.number, 'next');
      } else {
        const issue = await client.createIssue(brief.name.trim(), body, [
          'idea',
          'approved',
          ...(buildNext ? ['next'] : []),
        ]);
        setSent({ number: issue.number, approved: true });
      }
      // The issue is where it is discussed; the queue is what the factory reads.
      let position: number | undefined;
      if (isAdmin && client.canWrite) {
        try {
          ({ position } = await appendToQueue(client, {
            title: brief.name.trim(),
            source: 'console',
            brief: {
              purpose: brief.purpose.trim(),
              mustHave: brief.mustHave,
              niceToHave: brief.niceToHave,
              exclude: brief.exclude,
              notes: brief.notes.trim(),
            },
          }));
          setSent((s) => (s ? { ...s, position } : s));
        } catch {
          setProblem(
            'Filed as an issue, but could not be added to the queue — add it by hand.',
          );
        }
      }
      setName('');
      setPurpose('');
      setMustHave('');
      setNiceToHave('');
      setExclude('');
      setNotes('');
      setTouched(false);
      onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not send that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="build-heading">
        <h2 id="build-heading" className="text-[length:var(--t-lg)] font-semibold">
          Build this
        </h2>
        <p className="mt-1 max-w-prose text-[var(--text-muted)] text-pretty">
          The <strong className="font-medium text-[var(--text)]">must have</strong> list is a
          contract. The factory has to build every item on it, and if one genuinely cannot be
          done it has to say so on the issue with its reasoning — it is not allowed to quietly
          drop it or build something adjacent instead.
        </p>

        <form className="mt-5 space-y-5" onSubmit={submit} noValidate>
          <Field id="b-name" label="What is it called?" error={errorFor('name')}>
            <input
              id="b-name"
              className={`${INPUT} min-h-11`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shift swap planner"
              maxLength={120}
              aria-invalid={Boolean(errorFor('name'))}
            />
          </Field>

          <Field
            id="b-purpose"
            label="Who is it for, and what does it do for them?"
            hint="One sentence. Name a real person in a real situation, not “users”."
            error={errorFor('purpose')}
          >
            <textarea
              id="b-purpose"
              className={`${INPUT} min-h-20 resize-y py-2`}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="A nurse swapping a shift sees whose rota it actually fits, without a group chat."
              maxLength={600}
              aria-invalid={Boolean(errorFor('purpose'))}
            />
          </Field>

          <Field
            id="b-must"
            label="It must do these"
            hint="One per line. These cannot be cut — if something matters, it belongs here and nowhere else."
            error={errorFor('mustHave')}
          >
            <textarea
              id="b-must"
              className={`${INPUT} min-h-28 resize-y py-2 font-mono text-sm`}
              value={mustHave}
              onChange={(e) => setMustHave(e.target.value)}
              placeholder={
                'Import a rota from a CSV\nShow who is free for a given shift\nWork on a phone'
              }
              maxLength={3000}
              aria-invalid={Boolean(errorFor('mustHave'))}
            />
          </Field>

          <Field
            id="b-nice"
            label="Nice to have"
            hint="One per line. Cut first if the run runs short — so put nothing here that you would mind losing."
          >
            <textarea
              id="b-nice"
              className={`${INPUT} min-h-20 resize-y py-2 font-mono text-sm`}
              value={niceToHave}
              onChange={(e) => setNiceToHave(e.target.value)}
              placeholder={'Export the agreed swap as a file'}
              maxLength={3000}
            />
          </Field>

          <Field
            id="b-exclude"
            label="Do not include"
            hint="One per line. Stops effort going somewhere you do not want it."
          >
            <textarea
              id="b-exclude"
              className={`${INPUT} min-h-20 resize-y py-2 font-mono text-sm`}
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder={'Accounts or sign-in\nAnything that emails people'}
              maxLength={3000}
            />
          </Field>

          <Field
            id="b-notes"
            label="Anything else"
            hint="Platform, how it should feel, something to imitate or avoid."
          >
            <textarea
              id="b-notes"
              className={`${INPUT} min-h-20 resize-y py-2`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mobile first — it gets used standing up on a ward."
              maxLength={2000}
            />
          </Field>

          {isAdmin ? (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={buildNext}
                onChange={(e) => setBuildNext(e.target.checked)}
              />
              <span>
                <span className="font-medium">Build this next</span>
                <span className="block text-sm text-[var(--text-muted)]">
                  Skips scoring — the next run that starts an app builds this one.
                </span>
              </span>
            </label>
          ) : null}

          {touched && problems.length > 0 ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problems.length === 1
                ? 'One thing is missing above.'
                : `${problems.length} things are missing above.`}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {canSubmit ? (
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Sending…' : isAdmin ? 'Send it to the factory' : 'Submit for approval'}
              </button>
            ) : authAvailable ? (
              <button
                type="button"
                onClick={signIn}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)]"
              >
                Sign in to send this
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)]"
              >
                Connect to send this
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              {showPreview ? 'Hide' : 'Show'} exactly what the factory will read
            </button>

            {sent ? (
              <p role="status" className="text-sm text-[var(--success)]">
                {sent.approved
                  ? sent.position
                    ? `Sent as #${sent.number}, queued at position ${sent.position}.`
                    : `Sent as #${sent.number}.`
                  : `Submitted as #${sent.number} — it needs approval first.`}
              </p>
            ) : null}
          </div>

          {problem ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problem}
            </p>
          ) : null}
        </form>
      </section>

      {showPreview ? (
        <section aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="text-[length:var(--t-lg)] font-semibold">
            What the factory will read
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Word for word. If it does not say what you mean, change it above.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 font-mono text-sm whitespace-pre-wrap">
            {renderBrief(brief, buildNext && isAdmin)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
