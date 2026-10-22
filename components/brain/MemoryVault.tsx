import { SourceImports, SourceAssets } from './SourceImports';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  brainRequest,
  BrainMemory,
  BrainPage,
  BrainRevision,
  BrainSource,
  BrainDocument
} from '../../services/brainService';
import './vault.css';
const types = [
  'instruction',
  'identity',
  'career',
  'project',
  'preference',
  'decision',
  'fact',
  'other'
];
const statuses = ['candidate', 'confirmed', 'rejected', 'disputed'];
type Tab = 'overview' | 'memories' | 'timeline' | 'sources' | 'legacy';
export function MemoryVault() {
  const { language } = useTranslation();
  const zh = language.startsWith('zh');
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Record<string, number | string | null>>({});
  const [rows, setRows] = useState<BrainMemory[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sources, setSources] = useState<BrainSource[]>([]);
  const [sourceNext, setSourceNext] = useState<string | null>(null);
  const [documents, setDocuments] = useState<BrainDocument[]>([]);
  const [docNext, setDocNext] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [newAnchors, setNewAnchors] = useState<BrainMemory['sourceAnchors']>([]);
  const [selected, setSelected] = useState<BrainMemory | null>(null);
  const [statement, setStatement] = useState('');
  const [editType, setEditType] = useState('fact');
  const [editStatus, setEditStatus] = useState('candidate');
  const [sensitivity, setSensitivity] = useState('normal');
  const [eventAt, setEventAt] = useState('');
  const [tags, setTags] = useState('');
  const [reason, setReason] = useState('');
  const [revisions, setRevisions] = useState<BrainRevision[]>([]);
  const [revisionNext, setRevisionNext] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<BrainDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'VAULT_REQUEST_FAILED');
    } finally {
      setBusy(false);
    }
  };
  const load = useCallback(
    async (cursor?: string) => {
      const qs = new URLSearchParams({ limit: '30' });
      for (const [k, v] of Object.entries({
        query,
        type,
        reviewStatus: status,
        source,
        from,
        to,
        cursor
      }))
        if (v) qs.set(k, v);
      const page = await brainRequest<BrainPage<BrainMemory>>('/memories?' + qs);
      setRows((old) => (cursor ? [...old, ...page.items] : page.items));
      setNext(page.nextCursor);
    },
    [query, type, status, source, from, to]
  );
  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([
      brainRequest<Record<string, number>>('/stats'),
      brainRequest<BrainPage<BrainSource>>('/sources')
    ]);
    setStats(s);
    setSources(p.items);
    setSourceNext(p.nextCursor);
    await load();
  }, [load]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active)
        refresh().catch((e) => {
          if (active) setNotice(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  const choose = async (m: BrainMemory | null) => {
    setSelected(m);
    setNewAnchors([]);
    setStatement(m?.statement || '');
    setEditType(m?.type || 'fact');
    setEditStatus(m?.reviewStatus || 'candidate');
    setSensitivity(m?.sensitivity || 'normal');
    setEventAt(m?.eventAt?.slice(0, 10) || '');
    setTags(m?.tags?.join(', ') || '');
    setReason('');
    setEditing(true);
    setEvidence(null);
    setRevisions([]);
    setRevisionNext(null);
    if (m) {
      const p = await brainRequest<BrainPage<BrainRevision>>('/memories/' + m._id + '/revisions');
      setRevisions(p.items);
      setRevisionNext(p.nextCursor);
    }
  };
  const save = async () => {
    const data = {
      statement,
      ...(!selected && newAnchors.length ? { sourceAnchors: newAnchors } : {}),
      type: editType,
      reviewStatus: editStatus,
      sensitivity,
      eventAt: eventAt || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      reason,
      ...(selected ? { expectedRevision: selected.revision } : {})
    };
    const m = await brainRequest<BrainMemory>('/memories' + (selected ? '/' + selected._id : ''), {
      method: selected ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
    await refresh();
    await choose(m);
    setNotice(tr('已保存，并追加版本记录。', 'Saved with a new revision.'));
  };
  const showDocuments = async (id: string, cursor?: string) => {
    const p = await brainRequest<BrainPage<BrainDocument>>(
      '/documents?source=' + id + (cursor ? '&cursor=' + cursor : '')
    );
    setSelectedSource(id);
    setDocuments((old) => (cursor ? [...old, ...p.items] : p.items));
    setDocNext(p.nextCursor);
  };
  const tabs: [Tab, string][] = [
    ['overview', tr('总览', 'Overview')],
    ['memories', tr('记忆', 'Memories')],
    ['timeline', tr('时间线 / 项目', 'Timeline / Projects')],
    ['sources', tr('来源', 'Sources')],
    ['legacy', 'Legacy Chats']
  ];
  const dated = [...rows].sort((a, b) => (a.eventAt || '9999').localeCompare(b.eventAt || '9999'));
  return (
    <section className="memory-vault" aria-label="Personal Memory Vault">
      <header className="vault-head">
        <div>
          <p className="vault-eyebrow">ORION / PERSONAL ARCHIVE</p>
          <h1>Personal Memory Vault</h1>
          <p>
            {tr(
              '原始资料属于你。检索、修订与恢复，无须 AI。',
              'Your sources, evidence and history. Search, edit and recover without AI.'
            )}
          </p>
        </div>
        <span className="vault-badge">{tr('私有 · 可追溯', 'PRIVATE · TRACEABLE')}</span>
      </header>
      <nav aria-label={tr('记忆库导航', 'Vault navigation')}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {notice && (
        <p className="vault-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'overview' && (
        <>
          <div className="vault-stats">
            {[
              ['memories', tr('记忆', 'Memories')],
              ['sources', tr('来源', 'Sources')],
              ['documents', tr('原始文档', 'Documents')],
              ['candidates', tr('待确认', 'To review')]
            ].map(([key, label]) => (
              <article key={key}>
                <strong>{stats[key] ?? '—'}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <article className="vault-panel">
            <h2>{tr('从资料到证据', 'From sources to evidence')}</h2>
            <p>
              {tr(
                '原文与结构化记忆分别保存。修改只追加历史，未知日期不会被补造。',
                'Original documents and editable memories are separate. Changes append history; unknown dates remain unknown.'
              )}
            </p>
            <button
              onClick={() => {
                setTab('memories');
                void run(() => choose(null));
              }}
            >
              {tr('新增记忆', 'New memory')}
            </button>
          </article>
        </>
      )}
      {(tab === 'memories' || tab === 'timeline') && (
        <>
          <form
            className="vault-filters"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => load());
            }}
          >
            <input
              aria-label={tr('搜索记忆', 'Search memories')}
              placeholder={tr('搜索中文或 English…', 'Search Chinese or English…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{tr('所有类别', 'All types')}</option>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="Review status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{tr('所有状态', 'All statuses')}</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Source filter"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">{tr('所有来源', 'All sources')}</option>
              {sources.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.provider} / {s.originalFilename || s._id.slice(-6)}
                </option>
              ))}
            </select>
            <label>
              {tr('从', 'From')}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              {tr('至', 'To')}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button disabled={busy}>{tr('搜索', 'Search')}</button>
            <button type="button" onClick={() => void run(() => choose(null))}>
              {tr('新增记忆', 'New memory')}
            </button>
          </form>
          <div className="vault-columns">
            <div className="vault-list">
              {(tab === 'timeline' ? dated : rows).map((m) => (
                <button
                  className="vault-card"
                  key={m._id}
                  onClick={() => void run(() => choose(m))}
                >
                  <span>
                    {m.type} · {m.reviewStatus} · v{m.revision}
                  </span>
                  <p>{m.statement}</p>
                  <small>
                    {m.eventAt
                      ? new Date(m.eventAt).toLocaleDateString()
                      : tr('事件日期未知', 'Event date unknown')}{' '}
                    · {m.tags.join(' / ')}
                  </small>
                </button>
              ))}
              {!rows.length && (
                <p>
                  {tr(
                    '没有符合条件的记忆。可以手动录入或导入原始资料。',
                    'No matching memories. Add a memory or import original sources.'
                  )}
                </p>
              )}
              {next && (
                <button onClick={() => void run(() => load(next))}>
                  {tr('加载更多', 'Load more')}
                </button>
              )}
            </div>
            {editing && (
              <aside className="vault-panel">
                <h2>
                  {selected ? tr('修订记忆', 'Revise memory') : tr('手动记忆', 'Manual memory')}
                </h2>
                <form
                  className="vault-editor"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(save);
                  }}
                >
                  <label>
                    {tr('记忆正文', 'Statement')}
                    <textarea
                      aria-label="Statement"
                      value={statement}
                      onChange={(e) => setStatement(e.target.value)}
                      maxLength={20000}
                      required
                      rows={6}
                    />
                  </label>
                  <label>
                    {tr('类别', 'Type')}
                    <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                      {types.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr('确认状态', 'Review status')}
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      {statuses.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr('敏感级别', 'Sensitivity')}
                    <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
                      {['normal', 'sensitive', 'restricted'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr('事件日期（未知可留空）', 'Event date (leave unknown blank)')}
                    <input
                      type="date"
                      value={eventAt}
                      onChange={(e) => setEventAt(e.target.value)}
                    />
                  </label>
                  <label>
                    {tr('标签（逗号分隔）', 'Tags (comma separated)')}
                    <input value={tags} onChange={(e) => setTags(e.target.value)} />
                  </label>
                  <label>
                    {tr('修改原因', 'Reason')}
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={1000}
                    />
                  </label>
                  <div className="vault-actions">
                    <button disabled={busy}>{tr('保存并记录版本', 'Save revision')}</button>
                    <button type="button" onClick={() => setEditing(false)}>
                      {tr('取消', 'Cancel')}
                    </button>
                  </div>
                </form>
                {selected && (
                  <>
                    <h3>{tr('证据', 'Evidence')}</h3>
                    {selected.sourceAnchors.map((a) => (
                      <button
                        key={a.documentId}
                        onClick={() =>
                          void run(async () =>
                            setEvidence(
                              await brainRequest<BrainDocument>('/documents/' + a.documentId)
                            )
                          )
                        }
                      >
                        {a.quote || a.documentId}
                      </button>
                    ))}
                    {evidence && (
                      <article>
                        <p>
                          {evidence.role} · {evidence.externalConversationId} ·{' '}
                          {evidence.externalMessageId}
                        </p>
                        <pre>{evidence.rawText}</pre>
                      </article>
                    )}
                    <h3>{tr('版本历史', 'Revision history')}</h3>
                    {revisions.map((r) => (
                      <details key={r._id}>
                        <summary>
                          v{r.revisionNumber} · {r.action} · {new Date(r.editedAt).toLocaleString()}
                        </summary>
                        <pre>{r.after.statement}</pre>
                        <p>{r.reason}</p>
                        <button
                          onClick={() => {
                            setStatement(r.after.statement);
                            setReason('Restore text from revision ' + r.revisionNumber);
                          }}
                        >
                          {tr('将此正文放入编辑器', 'Use this text in editor')}
                        </button>
                      </details>
                    ))}
                    {revisionNext && (
                      <button
                        onClick={() =>
                          void run(async () => {
                            const p = await brainRequest<BrainPage<BrainRevision>>(
                              '/memories/' + selected._id + '/revisions?cursor=' + revisionNext
                            );
                            setRevisions((r) => [...r, ...p.items]);
                            setRevisionNext(p.nextCursor);
                          })
                        }
                      >
                        {tr('更多历史', 'More history')}
                      </button>
                    )}
                    <button
                      className="vault-danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            tr(
                              '归档这条记忆？可以在版本历史和备份中找回。',
                              'Archive this memory? Its history remains in your backup.'
                            )
                          )
                        )
                          void run(async () => {
                            await brainRequest('/memories/' + selected._id, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                expectedRevision: selected.revision,
                                archived: true,
                                reason: 'User archived'
                              })
                            });
                            setEditing(false);
                            await refresh();
                          });
                      }}
                    >
                      {tr('归档记忆', 'Archive memory')}
                    </button>
                  </>
                )}
              </aside>
            )}
          </div>
        </>
      )}
      {tab === 'sources' && <SourceImports zh={zh} onCommitted={refresh} />}
      {tab === 'sources' && (
        <div className="vault-columns">
          <div className="vault-list">
            {sources.map((s) => (
              <button
                className="vault-card"
                key={s._id}
                onClick={() => void run(() => showDocuments(s._id))}
              >
                <span>
                  {s.provider} · {s.status}
                </span>
                <p>{s.originalFilename || tr('手动来源', 'Manual source')}</p>
                <small>SHA256 {s.originalSha256}</small>
              </button>
            ))}
            {sourceNext && (
              <button
                onClick={() =>
                  void run(async () => {
                    const p = await brainRequest<BrainPage<BrainSource>>(
                      '/sources?cursor=' + sourceNext
                    );
                    setSources((s) => [...s, ...p.items]);
                    setSourceNext(p.nextCursor);
                  })
                }
              >
                {tr('更多来源', 'More sources')}
              </button>
            )}
          </div>
          <div className="vault-panel">
            {selectedSource && <SourceAssets sourceId={selectedSource} zh={zh} />}
            {documents.map((d) => (
              <details key={d._id}>
                <summary>
                  {d.role || 'document'} · {d.externalConversationId} · {d.externalMessageId}
                </summary>
                <pre>{d.rawText}</pre>
                <button
                  onClick={() =>
                    void run(async () => {
                      await choose(null);
                      setStatement(d.rawText.slice(0, 20000));
                      setNewAnchors([{ documentId: d._id, quote: d.rawText.slice(0, 20000) }]);
                      setTab('memories');
                    })
                  }
                >
                  {tr('从此证据新建候选记忆', 'Create candidate from this evidence')}
                </button>
                <p>
                  {JSON.stringify(d.rawTimestamp ?? tr('原始日期未知', 'Original date unknown'))}
                </p>
              </details>
            ))}
            {docNext && (
              <button onClick={() => void run(() => showDocuments(selectedSource, docNext))}>
                {tr('更多文档', 'More documents')}
              </button>
            )}
          </div>
        </div>
      )}
      {tab === 'legacy' && <LegacyReader zh={zh} />}
    </section>
  );
}
function LegacyReader({ zh }: { zh: boolean }) {
  const [sessions, setSessions] = useState<{ _id: string; title: string; sessionId: string }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<
    {
      _id: string;
      content: string;
      images?: string[];
      user?: { displayName?: string };
      createdDate?: string;
    }[]
  >([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async (c?: string) => {
    const p = await brainRequest<BrainPage<{ _id: string; title: string; sessionId: string }>>(
      '/legacy/conversations' + (c ? '?cursor=' + c : '')
    );
    setSessions((old) => (c ? [...old, ...p.items] : p.items));
    setCursor(p.nextCursor);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const read = async (id: string, c?: string) => {
    const p = await brainRequest<BrainPage<(typeof messages)[number]>>(
      '/legacy/messages?sessionId=' + encodeURIComponent(id) + (c ? '&cursor=' + c : '')
    );
    setSelected(id);
    setMessages((old) => (c ? [...old, ...p.items] : p.items));
    setNext(p.nextCursor);
  };
  return (
    <div className="vault-panel">
      <h2>Legacy Chats · {zh ? '只读' : 'Read only'}</h2>
      <p>
        {zh
          ? '原有资料保留。图片仅显示引用，不自动请求外部地址。'
          : 'Original records are retained. Image references never load external URLs automatically.'}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="vault-columns">
        <div>
          {sessions.map((s) => (
            <button
              className="vault-card"
              key={s._id}
              onClick={() => read(s.sessionId).catch((e) => setError(e.message))}
            >
              {s.title}
            </button>
          ))}
          {cursor && (
            <button onClick={() => load(cursor).catch((e) => setError(e.message))}>
              {zh ? '更多会话' : 'More sessions'}
            </button>
          )}
        </div>
        <div>
          {messages.map((m) => (
            <article key={m._id}>
              <small>
                {m.user?.displayName} · {m.createdDate || ''}
              </small>
              <pre>{m.content}</pre>
              {m.images?.map((image, i) => (
                <pre key={i}>
                  {zh ? '未验证图片引用：' : 'Unverified image reference: '}
                  {image}
                </pre>
              ))}
            </article>
          ))}
          {next && (
            <button onClick={() => read(selected, next).catch((e) => setError(e.message))}>
              {zh ? '更多消息' : 'More messages'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
