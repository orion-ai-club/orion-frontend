import { fetchClient } from './core';

const WRITE_KEY_PREFIX = 'orion:article-write:';
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

type PendingWrite = { key: string; startedAt: number };

async function fingerprint(method: string, path: string, body: string): Promise<string> {
  // Store only a digest of the article payload in sessionStorage; never store
  // journal content or privileged details in plaintext.
  const bytes = new TextEncoder().encode(method + '\n' + path + '\n' + body);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export async function mutateArticle<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  input?: unknown
): Promise<T> {
  const body = input === undefined ? '' : JSON.stringify(input);
  const slot = WRITE_KEY_PREFIX + (await fingerprint(method, endpoint, body));
  let storage = getStorage();
  let record: PendingWrite | null = null;
  try {
    const previous = storage?.getItem(slot);
    if (previous) {
      const parsed = JSON.parse(previous) as Partial<PendingWrite>;
      if (
        typeof parsed.key === 'string' &&
        typeof parsed.startedAt === 'number' &&
        Date.now() - parsed.startedAt < RETRY_WINDOW_MS
      ) {
        record = { key: parsed.key, startedAt: parsed.startedAt };
      }
    }
  } catch {
    // Browsers that restrict storage still get a unique key per invocation.
  }
  if (!record) record = { key: crypto.randomUUID(), startedAt: Date.now() };
  try {
    storage?.setItem(slot, JSON.stringify(record));
  } catch {
    storage = null;
  }

  // On rejected, aborted or timed-out requests, execution exits here before
  // clearing the key. Retrying that action retrieves the same transaction.
  const response = await fetchClient<T>(endpoint, {
    method,
    ...(body ? { body } : {}),
    headers: { 'X-Idempotency-Key': record.key }
  });
  // Only confirmed success frees the UUID for a future intentional mutation.
  try {
    storage?.removeItem(slot);
  } catch {
    storage = null;
  }
  return response;
}
