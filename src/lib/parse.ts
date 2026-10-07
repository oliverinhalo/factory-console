/**
 * Parsers for the factory's human-readable files.
 *
 * The idea bank is Markdown on purpose — a person edits it, and the agent appends
 * to it. That makes it the source of truth, and makes this a parser rather than a
 * schema. It is written to never throw: a malformed line is skipped, not fatal.
 */
import type { Idea, LedgerApp } from './types';

const IDEA_LINE = /^-\s+\*\*(.+?)\*\*\s+—\s+(.*?)\s*(?:\*\((.+?)\)\*)?\s*$/;
const HEADING = /^###\s+(.+?)\s*$/;

/** Ideas from `factory/ideas/idea-bank.md`, tagged with their section heading. */
export function parseIdeaBank(markdown: string): Idea[] {
  const out: Idea[] = [];
  let section = 'Uncategorised';

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    if (heading?.[1]) {
      section = heading[1];
      continue;
    }
    const match = IDEA_LINE.exec(line);
    if (!match) continue;
    const [, name, description, category] = match;
    if (!name || !description) continue;
    out.push({
      name,
      description: description
        .replace(/\s*✅.*$/, '')
        .replace(/\s*✗.*$/, '')
        .trim(),
      category: category ?? section.toLowerCase(),
      state: /✅/.test(line) ? 'done' : 'queued',
    });
  }
  return out;
}

/** Group a list of ideas by category, largest group first. */
export function groupByCategory(ideas: Idea[]): Array<[string, Idea[]]> {
  const map = new Map<string, Idea[]>();
  for (const idea of ideas) {
    const list = map.get(idea.category);
    if (list) list.push(idea);
    else map.set(idea.category, [idea]);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export function matches(idea: Idea, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query.toLowerCase();
  return (
    idea.name.toLowerCase().includes(needle) ||
    idea.description.toLowerCase().includes(needle) ||
    idea.category.toLowerCase().includes(needle)
  );
}

/** Weeks elapsed since the factory started, 1-based and never below 1. */
export function weeksElapsed(started: string, now = new Date()): number {
  const start = new Date(`${started}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return 1;
  const weeks = Math.floor((now.getTime() - start) / 604_800_000) + 1;
  return Math.max(1, weeks);
}

/**
 * Whole weeks finished since the start — what pace should be judged against.
 * Week 1 is in progress on day one, so nothing is owed yet and the factory is
 * not "1 behind".
 */
export function weeksCompleted(started: string, now = new Date()): number {
  const start = new Date(`${started}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 604_800_000));
}

export function meanScore(apps: LedgerApp[]): number | null {
  if (apps.length === 0) return null;
  const total = apps.reduce((sum, app) => sum + app.score, 0);
  return Math.round((total / apps.length) * 10) / 10;
}

/** "3 days ago", "in 2 hours" — short, and correct about the past and future. */
export function relative(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const delta = then - now.getTime();
  const abs = Math.abs(delta);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
  ];
  let divisor = 1000;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [size, name] of units) {
    if (abs >= size) {
      divisor = size;
      unit = name;
    }
  }
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  return formatter.format(Math.round(delta / divisor), unit);
}

/**
 * Next fire time for the factory routines: Mondays 07:43 and Tue–Sun 07:17,
 * Europe/London. Approximated in the viewer's locale — close enough to answer
 * "when does it next run", which is all this is for.
 */
export function nextRun(now = new Date()): { at: Date; kind: 'weekly' | 'daily' } {
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const isMonday = day.getDay() === 1;
    const at = new Date(day);
    at.setHours(isMonday ? 7 : 7, isMonday ? 43 : 17, 0, 0);
    if (at.getTime() > now.getTime()) {
      return { at, kind: isMonday ? 'weekly' : 'daily' };
    }
  }
  return { at: now, kind: 'daily' };
}
