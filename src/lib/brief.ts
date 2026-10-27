/**
 * A build brief: what you want, stated precisely enough that the factory cannot
 * reasonably build something else.
 *
 * The first app shipped with its audio half silently cut, because the request was
 * one line and the agent decided the scope on its own. A brief separates what is
 * **required** from what is merely wanted, and the pipeline is instructed to treat
 * must-haves as a contract — if one cannot be met it must say so on the issue
 * before building, not quietly drop it.
 */

export interface Brief {
  name: string;
  /** Who it is for and what job it does for them. */
  purpose: string;
  /** Non-negotiable. The factory may not drop these silently. */
  mustHave: string[];
  /** Wanted, may be cut if the run runs short. */
  niceToHave: string[];
  /** Explicitly unwanted — stops effort going somewhere you do not value. */
  exclude: string[];
  /** Anything else: platform, look, a product to imitate or avoid. */
  notes: string;
}

export const EMPTY_BRIEF: Brief = {
  name: '',
  purpose: '',
  mustHave: [],
  niceToHave: [],
  exclude: [],
  notes: '',
};

/** One per line, trimmed, blanks dropped. */
export function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export interface BriefProblem {
  field: keyof Brief;
  message: string;
}

/** What is missing before this is a brief rather than a wish. */
export function validate(brief: Brief): BriefProblem[] {
  const problems: BriefProblem[] = [];
  if (brief.name.trim().length < 3) {
    problems.push({ field: 'name', message: 'Give it a name.' });
  }
  if (brief.purpose.trim().length < 15) {
    problems.push({
      field: 'purpose',
      message: 'Say who it is for and what it does for them — one sentence is enough.',
    });
  }
  if (brief.mustHave.length === 0) {
    problems.push({
      field: 'mustHave',
      message: 'List at least one thing it must do. This is the part the factory cannot cut.',
    });
  }
  return problems;
}

/**
 * The issue body. The headings are a contract the pipeline reads, so they are
 * fixed — `factory/scripts/inbox.sh` and the skill both rely on "Must have"
 * meaning non-negotiable.
 */
export function renderBrief(brief: Brief, buildNext: boolean): string {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '_none given_';

  return [
    '## What it is for',
    '',
    brief.purpose.trim(),
    '',
    '## Must have — do not cut these',
    '',
    list(brief.mustHave),
    '',
    '## Nice to have — cut these first if the run runs short',
    '',
    list(brief.niceToHave),
    '',
    '## Do not include',
    '',
    list(brief.exclude),
    '',
    ...(brief.notes.trim() ? ['## Notes', '', brief.notes.trim(), ''] : []),
    '---',
    '',
    '**Rules for this build.** The *Must have* list is a contract, not a',
    'suggestion. Build every item on it. If one genuinely cannot be done —',
    'it needs a paid service, it cannot work client-side, or it cannot fit in',
    'one run alongside the others — say so in a comment on this issue with your',
    'reasoning *before* building, and build the rest. Never drop a must-have',
    'silently, and never substitute a different idea for this one.',
    '',
    'If the must-haves together are too large for one run, build them across',
    'consecutive runs rather than cutting any: ship what is complete, keep the',
    'checkpoint open, and say on this issue what remains.',
    '',
    buildNext
      ? '**This is marked `next`: it is the app for the next run that starts one.**'
      : 'Queued, not pinned — the next run scores it against its own candidates.',
    '',
    '_Filed from the Factory Console._',
  ].join('\n');
}
