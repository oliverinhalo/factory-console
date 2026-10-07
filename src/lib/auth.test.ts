import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureSessionFromUrl, readSession } from './auth';

function at(hash: string) {
  history.replaceState(null, '', `/factory-console/${hash}`);
}

describe('captureSessionFromUrl', () => {
  beforeEach(() => {
    localStorage.clear();
    at('');
  });

  it('does nothing when there is no fragment', () => {
    expect(captureSessionFromUrl()).toEqual({});
    expect(readSession()).toBeNull();
  });

  it('stores a session handed back in the fragment', () => {
    at('#session=abc.def');
    captureSessionFromUrl();
    expect(readSession()).toBe('abc.def');
  });

  it('strips the fragment so the session is not left in the address bar', () => {
    at('#session=abc.def');
    captureSessionFromUrl();
    expect(window.location.hash).toBe('');
  });

  it('surfaces an error the Worker reported', () => {
    at('#error=Sign-in%20expired.');
    expect(captureSessionFromUrl().error).toBe('Sign-in expired.');
    expect(readSession()).toBeNull();
  });

  it('ignores an unrelated fragment', () => {
    at('#main');
    expect(captureSessionFromUrl()).toEqual({});
    expect(window.location.hash).toBe('#main');
  });

  it('does not throw when storage is unavailable', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('SecurityError');
    };
    at('#session=abc.def');
    expect(() => captureSessionFromUrl()).not.toThrow();
    Storage.prototype.setItem = original;
  });

  it('reads back null rather than throwing when storage is blocked', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('SecurityError');
    };
    expect(readSession()).toBeNull();
    Storage.prototype.getItem = original;
  });
});

describe('auth availability', () => {
  it('reports unavailable when no API base is configured', async () => {
    vi.resetModules();
    const mod = await import('./auth');
    expect(mod.authAvailable).toBe(import.meta.env.VITE_API_BASE ? true : false);
  });
});
