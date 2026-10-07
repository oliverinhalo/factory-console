import { describe, expect, it } from 'vitest';
import {
  groupByCategory,
  matches,
  meanScore,
  nextRun,
  parseIdeaBank,
  relative,
  weeksCompleted,
  weeksElapsed,
} from './parse';
import type { LedgerApp } from './types';

const BANK = `
# Idea bank

### Calculators
- **Freelance rate floor** — a freelancer finds the rate that covers tax. *(finance-tool)*
- **Split the bill properly** — a group splits by what each ate. *(calculator)*

### Converters
- **Cron in English** — a developer reads cron in plain language. *(developer-tool)*
- **Shipped one** — already built. ✅ some-slug *(converter)*
not an idea line
- malformed without bold
`;

describe('parseIdeaBank', () => {
  it('reads every well-formed idea', () => {
    expect(parseIdeaBank(BANK)).toHaveLength(4);
  });

  it('keeps the name, description and category', () => {
    const [first] = parseIdeaBank(BANK);
    expect(first?.name).toBe('Freelance rate floor');
    expect(first?.description).toMatch(/covers tax/);
    expect(first?.category).toBe('finance-tool');
  });

  it('marks shipped ideas and strips the marker from the description', () => {
    const shipped = parseIdeaBank(BANK).find((i) => i.name === 'Shipped one');
    expect(shipped?.state).toBe('done');
    expect(shipped?.description).not.toMatch(/✅/);
  });

  it('skips malformed lines instead of throwing', () => {
    expect(() => parseIdeaBank(BANK)).not.toThrow();
    expect(parseIdeaBank(BANK).map((i) => i.name)).not.toContain('malformed without bold');
  });

  it('survives an empty file', () => {
    expect(parseIdeaBank('')).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('orders the largest group first', () => {
    const groups = groupByCategory([
      { name: 'a', description: '', category: 'x' },
      { name: 'b', description: '', category: 'y' },
      { name: 'c', description: '', category: 'y' },
    ]);
    expect(groups[0]?.[0]).toBe('y');
    expect(groups[0]?.[1]).toHaveLength(2);
  });
});

describe('matches', () => {
  const idea = {
    name: 'Cron in English',
    description: 'plain language',
    category: 'developer-tool',
  };
  it('matches an empty query', () => expect(matches(idea, '  ')).toBe(true));
  it('matches on name, ignoring case', () => expect(matches(idea, 'CRON')).toBe(true));
  it('matches on description', () => expect(matches(idea, 'plain')).toBe(true));
  it('matches on category', () => expect(matches(idea, 'developer')).toBe(true));
  it('rejects a miss', () => expect(matches(idea, 'zebra')).toBe(false));
});

describe('meanScore', () => {
  const app = (score: number): LedgerApp => ({
    week: 1,
    slug: 's',
    name: 'n',
    category: 'c',
    repo: 'o/r',
    url: 'https://x',
    shipped: '2026-01-01',
    score,
  });
  it('is null with no apps', () => expect(meanScore([])).toBeNull());
  it('rounds to one decimal', () => expect(meanScore([app(7), app(8)])).toBe(7.5));
  it('handles a single app', () => expect(meanScore([app(6.25)])).toBe(6.3));
});

describe('weeksElapsed', () => {
  it('is 1 on the first day', () => {
    expect(weeksElapsed('2026-10-07', new Date('2026-10-07T12:00:00Z'))).toBe(1);
  });
  it('advances a week at a time', () => {
    expect(weeksElapsed('2026-10-07', new Date('2026-10-21T12:00:00Z'))).toBe(3);
  });
  it('never returns less than 1, even for a future start', () => {
    expect(weeksElapsed('2027-01-01', new Date('2026-10-07T12:00:00Z'))).toBe(1);
  });
  it('does not throw on a malformed date', () => {
    expect(weeksElapsed('not-a-date')).toBe(1);
  });
});

describe('weeksCompleted', () => {
  it('is 0 on day one, so nothing is owed yet', () => {
    expect(weeksCompleted('2026-10-07', new Date('2026-10-07T12:00:00Z'))).toBe(0);
  });
  it('is still 0 six days in', () => {
    expect(weeksCompleted('2026-10-07', new Date('2026-10-13T12:00:00Z'))).toBe(0);
  });
  it('becomes 1 after a full week', () => {
    expect(weeksCompleted('2026-10-07', new Date('2026-10-14T12:00:00Z'))).toBe(1);
  });
  it('never goes negative for a future start', () => {
    expect(weeksCompleted('2027-01-01', new Date('2026-10-07T12:00:00Z'))).toBe(0);
  });
  it('does not throw on a malformed date', () => {
    expect(weeksCompleted('nonsense')).toBe(0);
  });
});

describe('relative', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  it('describes the past', () => {
    expect(relative('2026-10-05T12:00:00Z', now)).toMatch(/2 days ago/);
  });
  it('describes the future', () => {
    expect(relative('2026-10-09T12:00:00Z', now)).toMatch(/in 2 days/);
  });
  it('does not throw on rubbish', () => {
    expect(relative('nonsense', now)).toBe('unknown');
  });
});

describe('nextRun', () => {
  it('always returns a time in the future', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(nextRun(now).at.getTime()).toBeGreaterThan(now.getTime());
  });
  it('labels a Monday run as the weekly one', () => {
    // Sunday evening: the next fire is Monday.
    const sunday = new Date('2026-10-11T20:00:00');
    expect(nextRun(sunday).kind).toBe('weekly');
  });
});
