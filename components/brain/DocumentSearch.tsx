import React, { useState } from 'react';
import { brainRequest, BrainDocument, BrainPage } from '../../services/brainService';
export function DocumentSearch({
  zh,
  onCandidate
}: {
  zh: boolean;
  onCandidate: (d: BrainDocument) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BrainDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const search = async (c?: string) => {
    try {
      const p = await brainRequest<BrainPage<BrainDocument>>('/search', {
        method: 'POST',
        body: JSON.stringify({ kind: 'documents', query, ...(c ? { cursor: c } : {}) })
      });
      setItems((old) => (c ? [...old, ...p.items] : p.items));
      setCursor(p.nextCursor);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SEARCH_FAILED');
    }
  };
  return (
    <article className="vault-panel">
      <h2>{zh ? '检索原始资料' : 'Search original documents'}</h2>
      <form
        className="vault-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          aria-label="Search original documents"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={zh ? '中英文原文检索，无须模型' : 'Search source text without a model'}
        />
        <button>{zh ? '检索原文' : 'Search documents'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {items.map((d) => (
        <details key={d._id}>
          <summary>
            {d.role || 'document'} · {d.externalConversationId} · {d.externalMessageId}
          </summary>
          <pre>{d.rawText}</pre>
          <p>
            {zh ? '原始时间 / 父节点：' : 'Original timestamp / parent: '}
            {JSON.stringify(d.rawTimestamp ?? null)} / {d.parentId || '—'}
          </p>
          <button onClick={() => onCandidate(d)}>
            {zh ? '从此证据新建候选记忆' : 'Create candidate from this evidence'}
          </button>
        </details>
      ))}
      {cursor && (
        <button onClick={() => void search(cursor)}>{zh ? '更多原文' : 'More documents'}</button>
      )}
    </article>
  );
}
