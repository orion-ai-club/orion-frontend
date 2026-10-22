import { API_BASE_URL } from './core';
export interface BrainMemory {
  _id: string;
  sourceId: string;
  statement: string;
  type: string;
  reviewStatus: string;
  sensitivity: string;
  revision: number;
  eventAt?: string;
  updatedAt?: string;
  tags: string[];
  sourceAnchors: { documentId: string; quote?: string; start?: number; end?: number }[];
}
export interface BrainDocument {
  _id: string;
  sourceId: string;
  rawText: string;
  role?: string;
  rawTimestamp?: unknown;
  externalConversationId?: string;
  externalMessageId?: string;
  parentId?: string;
  assetIds?: string[];
  metadata?: unknown;
}
export interface BrainSource {
  _id: string;
  provider: string;
  originalFilename?: string;
  status?: string;
  originalSha256: string;
  metadata?: unknown;
}
export interface BrainPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface BrainRevision {
  _id: string;
  revisionNumber: number;
  action: string;
  editedAt: string;
  reason?: string;
  before?: BrainMemory;
  after: BrainMemory;
}
export interface BrainJob {
  _id: string;
  state: string;
  counts?: Record<string, number>;
  preview?: unknown;
  errorSummary?: string;
}
export async function brainRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Brain-Request', '1');
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(API_BASE_URL + '/brain' + path, {
    ...options,
    credentials: 'include',
    headers,
    cache: 'no-store'
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'VAULT_REQUEST_FAILED');
  }
  return response.json() as Promise<T>;
}
export async function brainDownload(path: string, filename: string) {
  const response = await fetch(API_BASE_URL + '/brain' + path, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('DOWNLOAD_FAILED');
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
