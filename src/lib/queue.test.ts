import { describe, expect, it } from 'vitest';
import {
  addItem,
  editItem,
  EMPTY_QUEUE,
  move,
  moveToTop,
  parseQueue,
  removeItem,
  sameQueue,
  serialiseQueue,
  type Queue,
} from './queue';

const q = (...titles: string[]): Queue => ({
  version: 1,
  items: titles.map((t, i) => ({ id: `id${i}`, title: t, source: 'console' as const })),
});
const order = (queue: Queue) => queue.items.map((i) => i.title);

describe('parseQueue', () => {
  it('reads a well-formed queue', () => {
    expect(parseQueue(JSON.stringify(q('a', 'b'))).items).toHaveLength(2);
  });
  it('treats a missing file as an empty queue', () => {
    expect(parseQueue(null)).toEqual(EMPTY_QUEUE);
  });
  it('treats unparseable JSON as empty rather than throwing', () => {
    expect(parseQueue('{{{ not json')).toEqual(EMPTY_QUEUE);
  });
  it('drops entries missing an id or title instead of rendering blanks', () => {
    const raw = JSON.stringify({ version: 1, items: [{ id: 'a' }, { id: 'b', title: 'ok' }] });
    expect(parseQueue(raw).items.map((i) => i.title)).toEqual(['ok']);
  });
  it('survives items being absent entirely', () => {
    expect(parseQueue('{"version":1}').items).toEqual([]);
  });
});

describe('order operations', () => {
  it('moves an item down', () => {
    expect(order(move(q('a', 'b', 'c'), 'id0', 1))).toEqual(['b', 'a', 'c']);
  });
  it('moves an item up', () => {
    expect(order(move(q('a', 'b', 'c'), 'id2', -1))).toEqual(['a', 'c', 'b']);
  });
  it('does nothing at the top', () => {
    expect(order(move(q('a', 'b'), 'id0', -1))).toEqual(['a', 'b']);
  });
  it('does nothing at the bottom', () => {
    expect(order(move(q('a', 'b'), 'id1', 1))).toEqual(['a', 'b']);
  });
  it('ignores an unknown id', () => {
    expect(order(move(q('a', 'b'), 'nope', 1))).toEqual(['a', 'b']);
  });
  it('promotes to the front, which is what "build this next" means', () => {
    expect(order(moveToTop(q('a', 'b', 'c'), 'id2'))).toEqual(['c', 'a', 'b']);
  });
  it('leaves a queue alone when the top item is promoted', () => {
    expect(order(moveToTop(q('a', 'b'), 'id0'))).toEqual(['a', 'b']);
  });
  it('never mutates the queue it was given', () => {
    const original = q('a', 'b');
    move(original, 'id0', 1);
    expect(order(original)).toEqual(['a', 'b']);
  });
});

describe('add, remove and edit', () => {
  it('appends to the end, so adding never jumps the order', () => {
    const out = addItem(q('a'), { title: 'b', source: 'bank' });
    expect(order(out)).toEqual(['a', 'b']);
  });
  it('gives every item a distinct id', () => {
    let out = EMPTY_QUEUE;
    for (let i = 0; i < 50; i += 1) out = addItem(out, { title: `x${i}`, source: 'console' });
    expect(new Set(out.items.map((i) => i.id)).size).toBe(50);
  });
  it('removes by id', () => {
    expect(order(removeItem(q('a', 'b', 'c'), 'id1'))).toEqual(['a', 'c']);
  });
  it('removing something absent is harmless', () => {
    expect(order(removeItem(q('a'), 'nope'))).toEqual(['a']);
  });
  it('edits a title without disturbing the order', () => {
    const out = editItem(q('a', 'b'), 'id0', { title: 'renamed' });
    expect(order(out)).toEqual(['renamed', 'b']);
  });
  it('edits a brief, which is how a bank idea becomes a real instruction', () => {
    const out = editItem(q('a'), 'id0', {
      brief: { purpose: 'for nurses', mustHave: ['import CSV'] },
    });
    expect(out.items[0]?.brief?.mustHave).toEqual(['import CSV']);
  });
});

describe('serialiseQueue', () => {
  it('stamps the time it was written', () => {
    const out = serialiseQueue(q('a'), new Date('2026-10-27T12:00:00Z'));
    expect(JSON.parse(out).updated).toBe('2026-10-27T12:00:00.000Z');
  });
  it('round-trips through the parser', () => {
    const original = addItem(q('a'), { title: 'b', source: 'issue', issue: 4 });
    expect(parseQueue(serialiseQueue(original)).items.map((i) => i.title)).toEqual(['a', 'b']);
  });
  it('ends with a newline, so the file is not committed malformed', () => {
    expect(serialiseQueue(q('a')).endsWith('\n')).toBe(true);
  });
});

describe('sameQueue', () => {
  it('ignores the timestamp and compares the order', () => {
    expect(sameQueue({ ...q('a', 'b'), updated: 'x' }, { ...q('a', 'b'), updated: 'y' })).toBe(
      true,
    );
  });
  it('sees a reorder as a change', () => {
    expect(sameQueue(q('a', 'b'), move(q('a', 'b'), 'id0', 1))).toBe(false);
  });
});
