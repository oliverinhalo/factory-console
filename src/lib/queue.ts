/**
 * The build queue: an explicit, ordered list of what the factory builds next.
 *
 * Before this there was no order — one issue could be pinned `next` and
 * everything else was scored afresh each run, so "what is coming after that?"
 * had no answer. Position 1 is now simply the next thing built.
 *
 * Every operation returns a new queue rather than mutating, so the UI can
 * compare, and so a failed write never leaves the page showing an order the
 * repository does not have.
 */
import type { Brief } from './brief';

export type QueueSource = 'console' | 'bank' | 'issue';

export interface QueueItem {
  id: string;
  title: string;
  source: QueueSource;
  issue?: number;
  addedAt?: string;
  brief?: Partial<Brief>;
}

export interface Queue {
  version: 1;
  updated?: string;
  items: QueueItem[];
}

export const EMPTY_QUEUE: Queue = { version: 1, items: [] };

/** Tolerant of a missing, empty or malformed file — the queue is never fatal. */
export function parseQueue(raw: string | null): Queue {
  if (!raw || !raw.trim()) return EMPTY_QUEUE;
  try {
    const parsed = JSON.parse(raw) as Partial<Queue>;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      version: 1,
      ...(parsed.updated ? { updated: parsed.updated } : {}),
      items: items.filter(
        (i): i is QueueItem =>
          typeof i === 'object' &&
          i !== null &&
          typeof i.id === 'string' &&
          typeof i.title === 'string',
      ),
    };
  } catch {
    return EMPTY_QUEUE;
  }
}

export function serialiseQueue(queue: Queue, now = new Date()): string {
  return `${JSON.stringify({ ...queue, updated: now.toISOString() }, null, 2)}\n`;
}

/** Ids are generated here so two items added in the same second never collide. */
export function newId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

export function addItem(
  queue: Queue,
  item: Omit<QueueItem, 'id' | 'addedAt'>,
  now = new Date(),
): Queue {
  return {
    ...queue,
    items: [...queue.items, { ...item, id: newId(), addedAt: now.toISOString() }],
  };
}

export function removeItem(queue: Queue, id: string): Queue {
  return { ...queue, items: queue.items.filter((i) => i.id !== id) };
}

/** Move by one place. Out-of-range moves are a no-op, not an error. */
export function move(queue: Queue, id: string, direction: -1 | 1): Queue {
  const index = queue.items.findIndex((i) => i.id === id);
  if (index === -1) return queue;
  const target = index + direction;
  if (target < 0 || target >= queue.items.length) return queue;
  const items = [...queue.items];
  const a = items[index] as QueueItem;
  const b = items[target] as QueueItem;
  items[index] = b;
  items[target] = a;
  return { ...queue, items };
}

export function moveToTop(queue: Queue, id: string): Queue {
  const item = queue.items.find((i) => i.id === id);
  if (!item) return queue;
  return { ...queue, items: [item, ...queue.items.filter((i) => i.id !== id)] };
}

export function editItem(
  queue: Queue,
  id: string,
  patch: Partial<Omit<QueueItem, 'id'>>,
): Queue {
  return {
    ...queue,
    items: queue.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  };
}

/** True when the two queues would produce the same build order and content. */
export function sameQueue(a: Queue, b: Queue): boolean {
  return JSON.stringify(a.items) === JSON.stringify(b.items);
}

/**
 * Append to the stored queue in one read-modify-write.
 *
 * Shared by the Build form and the idea bank so "add to queue" means the same
 * thing from either, and so the compare-and-set sha handling lives in one place.
 */
export async function appendToQueue(
  client: {
    fileWithSha: (path: string) => Promise<{ content: string | null; sha: string | null }>;
    writeFile: (
      path: string,
      content: string,
      sha: string | null,
      message: string,
    ) => Promise<string>;
  },
  item: Omit<QueueItem, 'id' | 'addedAt'>,
): Promise<{ position: number }> {
  const path = 'factory/state/queue.json';
  const { content, sha } = await client.fileWithSha(path);
  const next = addItem(parseQueue(content), item);
  await client.writeFile(path, serialiseQueue(next), sha, `queue: add ${item.title}`);
  return { position: next.items.length };
}
