import { fetchClient } from './core';

type CommentRoute = 'legacy' | 'worker';
type PendingComment = {
  version: 2;
  key: string;
  workerCanary: boolean;
  route: CommentRoute;
};
const pendingKeys = new Map<string, PendingComment>();
const inFlight = new Map<string, Promise<unknown>>();
const completedKeys = new Set<string>();
const UNKNOWN_ROUTE =
  'Previous comment routing cannot be determined. Check the thread before starting a new operation.';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function canaryRequested(actorId: string): boolean {
  try {
    return (
      !localStorage.getItem('googleInfo') &&
      (storage()?.getItem('orion:comment-worker-canary:' + actorId) === '1' ||
        new URLSearchParams(window.location.search).get('comment_worker_canary') === '1')
    );
  } catch {
    return false;
  }
}

function savedOperation(slot: string): PendingComment | undefined {
  let saved: string | null = null;
  try {
    saved = storage()?.getItem(slot) ?? null;
  } catch {
    // An in-memory pending operation still works when storage is blocked.
  }
  if (!saved) return;
  let record;
  try {
    record = JSON.parse(saved);
  } catch {
    throw new Error(UNKNOWN_ROUTE);
  }
  if (
    !record ||
    typeof record.key !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(record.key) ||
    typeof record.workerCanary !== 'boolean'
  )
    throw new Error(UNKNOWN_ROUTE);
  if (completedKeys.has(record.key)) return;
  if (record.version === 2 && ['legacy', 'worker'].includes(record.route)) return record;
  // Normal v1 requests never opted into Worker. Never renegotiate their keys.
  if (record.version === undefined && record.workerCanary === false) {
    return { version: 2, key: record.key, workerCanary: false, route: 'legacy' };
  }
  // A v1 manual canary has no recorded backend; guessing could duplicate a write.
  throw new Error(UNKNOWN_ROUTE);
}

/** Retain both backend and key after uncertain outcomes; never auto-retry POST. */
export async function mutateComment<T>(
  actorId: string,
  endpoint: string,
  input: unknown
): Promise<T> {
  const body = JSON.stringify(input);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([actorId, endpoint, body]))
  );
  const slot =
    'orion:comment-write:' +
    Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const active = inFlight.get(slot);
  if (active) return active as Promise<T>;

  const operation = (async () => {
    const workerCanary = canaryRequested(actorId);
    let pending = pendingKeys.get(slot) ?? savedOperation(slot);
    if (pending && pending.workerCanary !== workerCanary) {
      throw new Error(
        'Previous comment outcome is unknown. Restore the original comment routing before retrying.'
      );
    }
    if (!pending) {
      // This read has no side effects. Failure blocks the write, rather than
      // guessing a backend. Only new operations negotiate a route.
      const policy = await fetchClient<{ version: number; route: CommentRoute }>(
        '/comments/write-policy',
        { headers: workerCanary ? { 'x-orion-comment-write-canary': '1' } : {} }
      );
      if (policy?.version !== 2 || !['legacy', 'worker'].includes(policy.route)) {
        throw new Error('Comment routing unavailable. Try again before sending.');
      }
      pending = { version: 2, key: crypto.randomUUID(), workerCanary, route: policy.route };
    }
    pendingKeys.set(slot, pending);
    try {
      storage()?.setItem(slot, JSON.stringify(pending));
    } catch {
      // Only the digest, UUID and routing metadata are stored; never comment text.
    }
    const headers: Record<string, string> = {
      'Idempotency-Key': pending.key,
      'x-orion-comment-write-route': pending.route
    };
    if (pending.workerCanary) headers['x-orion-comment-write-canary'] = '1';
    const result = await fetchClient<T>(endpoint, { method: 'POST', body, headers });
    pendingKeys.delete(slot);
    completedKeys.add(pending.key);
    try {
      storage()?.removeItem(slot);
    } catch {
      // completedKeys prevents replay of a stale record in this page.
    }
    return result;
  })();
  // Includes negotiation, so concurrent submissions share the GET and the POST.
  inFlight.set(slot, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(slot);
  }
}
