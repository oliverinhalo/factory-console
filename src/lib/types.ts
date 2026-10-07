/** Shapes the console reads out of the factory repository. */

export interface LedgerApp {
  week: number;
  slug: string;
  name: string;
  category: string;
  sentence?: string;
  repo: string;
  url: string;
  host?: string;
  shipped: string;
  score: number;
  signature_detail?: string;
  paid_tier_hypothesis?: string;
  notes?: string;
}

export interface Ledger {
  started: string;
  target: number;
  apps: LedgerApp[];
}

export interface Checkpoint {
  slug: string;
  week: number;
  status: 'in_progress' | 'complete' | string;
  started: string;
  updated: string;
  last_completed_phase: string | null;
  next_action: string;
  decisions: string[];
  blockers: string[];
  live_url: string | null;
}

export interface Idea {
  name: string;
  description: string;
  category: string;
  /** Present when the idea came from a GitHub issue rather than the bank. */
  issue?: number;
  state?: 'queued' | 'next' | 'done' | 'pending';
  createdAt?: string;
  /** GitHub login of whoever filed it, when it came from an issue. */
  submittedBy?: string;
}

export interface Request {
  number: number;
  title: string;
  body: string;
  createdAt: string;
  state: 'open' | 'closed';
  url: string;
  comments: number;
}

export interface Run {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
}

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };
