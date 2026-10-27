import { useEffect, useState } from 'react';
import type { Client } from '../lib/github';
import {
  editItem,
  move,
  moveToTop,
  parseQueue,
  removeItem,
  sameQueue,
  serialiseQueue,
  type Queue,
  type QueueItem,
} from '../lib/queue';
import { toLines } from '../lib/brief';

const PATH = 'factory/state/queue.json';

interface Props {
  client: Client;
  canEdit: boolean;
  onChanged: () => void;
}

const INPUT =
  'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3';

function Editor({
  item,
  onSave,
  onCancel,
}: {
  item: QueueItem;
  onSave: (patch: Partial<QueueItem>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [purpose, setPurpose] = useState(item.brief?.purpose ?? '');
  const [mustHave, setMustHave] = useState((item.brief?.mustHave ?? []).join('\n'));
  const [exclude, setExclude] = useState((item.brief?.exclude ?? []).join('\n'));

  return (
    <form
      className="mt-3 space-y-3 border-t border-[var(--border)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title: title.trim() || item.title,
          brief: {
            ...item.brief,
            purpose: purpose.trim(),
            mustHave: toLines(mustHave),
            exclude: toLines(exclude),
          },
        });
      }}
    >
      <div>
        <label className="block text-sm font-medium" htmlFor={`t-${item.id}`}>
          Name
        </label>
        <input
          id={`t-${item.id}`}
          className={`${INPUT} mt-1 min-h-11`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor={`p-${item.id}`}>
          Who it is for, and what it does
        </label>
        <textarea
          id={`p-${item.id}`}
          className={`${INPUT} mt-1 min-h-16 resize-y py-2`}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={600}
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor={`m-${item.id}`}>
          It must do these{' '}
          <span className="font-normal text-[var(--text-faint)]">
            one per line — cannot be cut
          </span>
        </label>
        <textarea
          id={`m-${item.id}`}
          className={`${INPUT} mt-1 min-h-20 resize-y py-2 font-mono text-sm`}
          value={mustHave}
          onChange={(e) => setMustHave(e.target.value)}
          maxLength={3000}
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor={`x-${item.id}`}>
          Do not include
        </label>
        <textarea
          id={`x-${item.id}`}
          className={`${INPUT} mt-1 min-h-16 resize-y py-2 font-mono text-sm`}
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          maxLength={3000}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The order the factory builds things in. Position 1 is next.
 *
 * Saves are explicit rather than per-click: a reorder is usually several moves,
 * and committing each one would make the history unreadable and multiply the
 * chance of colliding with a run.
 */
export function QueueView({ client, canEdit, onChanged }: Props) {
  const [loaded, setLoaded] = useState<Queue | null>(null);
  const [draft, setDraft] = useState<Queue | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { content, sha: fileSha } = await client.fileWithSha(PATH);
        if (!live) return;
        const queue = parseQueue(content);
        setLoaded(queue);
        setDraft(queue);
        setSha(fileSha);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not read the queue.');
      }
    })();
    return () => {
      live = false;
    };
  }, [client]);

  const dirty = loaded !== null && draft !== null && !sameQueue(loaded, draft);

  function apply(fn: (q: Queue) => Queue) {
    setDraft((current) => (current ? fn(current) : current));
    setSaved(false);
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = serialiseQueue(draft);
      const newSha = await client.writeFile(
        PATH,
        body,
        sha,
        `queue: reorder to ${draft.items.length} item(s)`,
      );
      setSha(newSha);
      setLoaded(draft);
      setSaved(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the queue.');
    } finally {
      setBusy(false);
    }
  }

  if (error && draft === null) {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-lg)] border border-[var(--danger)] p-4 text-[var(--danger)]"
      >
        {error}
      </p>
    );
  }

  if (draft === null) {
    return (
      <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]" />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[length:var(--t-lg)] font-semibold">What gets built, in order</h2>
        <p className="mt-1 max-w-prose text-[var(--text-muted)] text-pretty">
          The next run builds number 1, then removes it from this list. Reorder, edit or remove
          anything here — nothing is built until you save.
        </p>
      </div>

      {draft.items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-8 text-center">
          <p className="font-medium">The queue is empty</p>
          <p className="mx-auto mt-2 max-w-sm text-[var(--text-muted)] text-pretty">
            Add something from <strong className="font-medium text-[var(--text)]">Build</strong>{' '}
            to describe your own, or from{' '}
            <strong className="font-medium text-[var(--text)]">Ideas</strong> to pull one out of
            the bank. With the queue empty, a run picks its own idea.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {draft.items.map((item, index) => (
            <li
              key={item.id}
              className={`rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] p-4 ${
                index === 0 ? 'border-[var(--accent)]' : 'border-[var(--border)]'
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tnum ${
                    index === 0
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    <span className="sr-only">Position {index + 1}: </span>
                    {item.title}
                    {index === 0 ? (
                      <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-sm font-normal text-[var(--accent-text)]">
                        next
                      </span>
                    ) : null}
                  </p>
                  {item.brief?.purpose ? (
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {item.brief.purpose}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-[var(--text-faint)]">
                    {item.source === 'bank'
                      ? 'from the idea bank'
                      : item.source === 'issue'
                        ? `issue #${item.issue}`
                        : 'yours'}
                    {item.brief?.mustHave?.length
                      ? ` · ${item.brief.mustHave.length} must-have${item.brief.mustHave.length === 1 ? '' : 's'}`
                      : ' · no brief yet'}
                  </p>
                </div>

                {canEdit ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${item.title} up`}
                      disabled={index === 0}
                      onClick={() => apply((q) => move(q, item.id, -1))}
                      className="min-h-11 min-w-11 rounded-[var(--radius)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.title} down`}
                      disabled={index === draft.items.length - 1}
                      onClick={() => apply((q) => move(q, item.id, 1))}
                      className="min-h-11 min-w-11 rounded-[var(--radius)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => apply((q) => moveToTop(q, item.id))}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30"
                    >
                      Build next
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(editing === item.id ? null : item.id)}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                    >
                      {editing === item.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => apply((q) => removeItem(q, item.id))}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              {editing === item.id && canEdit ? (
                <Editor
                  item={item}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) => {
                    apply((q) => editItem(q, item.id, patch));
                    setEditing(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {canEdit ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] py-3">
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => void save()}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirty ? 'Save the order' : 'Saved'}
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                setDraft(loaded);
                setEditing(null);
              }}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm text-[var(--text-muted)]"
            >
              Discard changes
            </button>
          ) : null}
          {dirty ? (
            <p className="text-sm text-[var(--text-muted)]">Not saved yet.</p>
          ) : saved ? (
            <p role="status" className="text-sm text-[var(--success)]">
              Saved. The next run follows this order.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[var(--text-muted)]">Connect or sign in to change the order.</p>
      )}
    </div>
  );
}
