import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF, renderBrief, toLines, validate, type Brief } from './brief';

const full: Brief = {
  name: 'Shift swap planner',
  purpose: 'A nurse swapping a shift sees whose rota it actually fits.',
  mustHave: ['Import a rota from CSV', 'Show who is free for a given shift'],
  niceToHave: ['Export the agreed swap'],
  exclude: ['Accounts', 'Anything that emails people'],
  notes: 'Mobile first — it is used on a ward.',
};

describe('toLines', () => {
  it('splits one per line and trims', () => {
    expect(toLines(' a \n\n b ')).toEqual(['a', 'b']);
  });
  it('strips list markers people paste in', () => {
    expect(toLines('- a\n* b\n• c')).toEqual(['a', 'b', 'c']);
  });
  it('returns nothing for blank input', () => {
    expect(toLines('   \n  ')).toEqual([]);
  });
});

describe('validate', () => {
  it('accepts a complete brief', () => {
    expect(validate(full)).toEqual([]);
  });
  it('requires a name', () => {
    expect(validate({ ...full, name: 'ab' }).map((p) => p.field)).toContain('name');
  });
  it('requires a purpose long enough to mean something', () => {
    expect(validate({ ...full, purpose: 'a tool' }).map((p) => p.field)).toContain('purpose');
  });
  it('requires at least one must-have, since that is the contract', () => {
    expect(validate({ ...full, mustHave: [] }).map((p) => p.field)).toContain('mustHave');
  });
  it('reports every problem at once rather than one at a time', () => {
    expect(validate(EMPTY_BRIEF)).toHaveLength(3);
  });
  it('does not require nice-to-haves, exclusions or notes', () => {
    expect(validate({ ...full, niceToHave: [], exclude: [], notes: '' })).toEqual([]);
  });
});

describe('renderBrief', () => {
  const body = renderBrief(full, true);

  it('puts the must-haves under a heading the pipeline looks for', () => {
    expect(body).toContain('## Must have — do not cut these');
    expect(body).toContain('- Import a rota from CSV');
  });

  it('states plainly that must-haves may not be dropped silently', () => {
    expect(body).toMatch(/contract, not a\nsuggestion/);
    expect(body).toMatch(/Never drop a must-have\nsilently/);
  });

  it('tells the factory to split across runs rather than cut', () => {
    expect(body).toMatch(/across\nconsecutive runs rather than cutting any/);
  });

  it('says when it is pinned as next', () => {
    expect(body).toContain('marked `next`');
    expect(renderBrief(full, false)).toContain('Queued, not pinned');
  });

  it('keeps empty sections present, so silence is explicit', () => {
    const sparse = renderBrief({ ...full, niceToHave: [], exclude: [] }, false);
    expect(sparse).toContain('## Nice to have — cut these first if the run runs short');
    expect(sparse).toContain('_none given_');
  });

  it('omits the notes heading when there are no notes', () => {
    expect(renderBrief({ ...full, notes: '' }, false)).not.toContain('## Notes');
  });
});
