import { fetchClient } from './core';

type PendingComment = { key: string; workerCanary: boolean };
const pendingKeys = new Map<string, PendingComment>();
const inFlight = new Map<string, Promise<unknown>>();
const completedKeys = new Set<string>();

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Keep an uncertain operation's key across retries; never retry a write automatically. */
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

  let workerCanary = false;
  try {
    workerCanary =
      storage()?.getItem('orion:comment-worker-canary:' + actorId) === '1' &&
      !localStorage.getItem('googleInfo');
  } catch {
    // Opt-in is disabled when browser preferences cannot be read.
  }
  let pending = pendingKeys.get(slot);
  if (!pending) {
    try {
      const saved = storage()?.getItem(slot);
      const record = saved ? JSON.parse(saved) : null;
      if (
        record &&
        /^[a-f0-9-]{36}$/i.test(record.key) &&
        typeof record.workerCanary === 'boolean' &&
        !completedKeys.has(record.key)
      )
        pending = record;
    } catch {
      // Keep retries stable in memory if browser storage is unavailable.
    }
    pending ??= { key: crypto.randomUUID(), workerCanary };
    pendingKeys.set(slot, pending);
    try {
      storage()?.setItem(slot, JSON.stringify(pending));
    } catch {
      // No comment text or user data is stored, only the digest and UUID.
    }
  }
  if (pending.workerCanary !== workerCanary)
    throw new Error(
      'Previous comment outcome is unknown. Restore the original comment routing before retrying.'
    );
  const operationKey = pending.key;
  const operation = (async () => {
    const headers: Record<string, string> = { 'Idempotency-Key': operationKey };
    // Google-only identity is still owned by Cloud Run. Never strip its auth
    // carrier to force a Worker path. The server gate remains authoritative.
    if (pending.workerCanary) headers['x-orion-comment-write-canary'] = '1';
    const result = await fetchClient<T>(endpoint, { method: 'POST', body, headers });
    pendingKeys.delete(slot);
    completedKeys.add(operationKey);
    try {
      storage()?.removeItem(slot);
    } catch {
      // A stale stored key must not replay a confirmed operation in this page.
    }
    return result;
  })();
  inFlight.set(slot, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(slot);
  }
}
