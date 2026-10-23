import { KnowledgeOverview } from './KnowledgeOverview';
import { SyncConnections } from './SyncConnections';
import {
  Archive,
  BookOpen,
  CalendarDays,
  Database,
  History,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  X
} from 'lucide-react';
import { BackupRestore } from './BackupRestore';
import { DocumentSearch } from './DocumentSearch';
import { SourceImports, SourceAssets } from './SourceImports';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  brainRequest,
  BrainMemory,
  BrainPage,
  BrainRevision,
  BrainSource,
  BrainDocument,
  BrainDashboard
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
const tabIcons = {
  overview: LayoutGrid,
  connections: Link2,
  memories: BookOpen,
  timeline: CalendarDays,
  sources: Database,
  backup: Archive,
  legacy: History
};
const statuses = ['candidate', 'confirmed', 'rejected', 'disputed'];
type Tab = 'connections' | 'overview' | 'memories' | 'timeline' | 'sources' | 'backup' | 'legacy';
export function MemoryVault() {
  const { language } = useTranslation();
  const zh = language.startsWith('zh');
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<BrainDashboard | null>(null);
  const [rows, setRows] = useState<BrainMemory[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState(false);
  const [unknownDates, setUnknownDates] = useState(false);
  const requestSequence = useRef(0);
  const historySequence = useRef(0);
  const editorRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const run = async (fn: () => Promise<unknown>) => {
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
      const sequence = ++requestSequence.current;
      const qs = new URLSearchParams({ limit: '30' });
      if (archived) qs.set('archived', 'true');
      if (tab === 'timeline') qs.set(unknownDates ? 'undated' : 'timeline', 'true');
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
      setLoading(true);
      try {
        const page = query
          ? await brainRequest<BrainPage<BrainMemory>>('/search', {
              method: 'POST',
              body: JSON.stringify({ kind: 'memories', ...Object.fromEntries(qs) })
            })
          : await brainRequest<BrainPage<BrainMemory>>('/memories?' + qs);
        if (sequence !== requestSequence.current) return;
        setRows((old) => (cursor ? [...old, ...page.items] : page.items));
        setNext(page.nextCursor);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [query, type, status, source, from, to, tab, archived, unknownDates]
  );
  const loadDashboard = useCallback(async () => {
    setDashboard(await brainRequest<BrainDashboard>('/dashboard'));
  }, []);
  const refreshMetadata = useCallback(async () => {
    const [, p] = await Promise.all([
      loadDashboard(),
      brainRequest<BrainPage<BrainSource>>('/sources')
    ]);
    setSources(p.items);
    setSourceNext(p.nextCursor);
  }, [loadDashboard]);
  const refresh = useCallback(async () => {
    await Promise.all([refreshMetadata(), load()]);
  }, [refreshMetadata, load]);
  useEffect(() => {
    let active = true;
    const invalidate = () => {
      ++requestSequence.current;
    };
    invalidate();
    setRows([]);
    setNext(null);
    setLoading(true);
    const timer = setTimeout(() => {
      if (active)
        load().catch((e) => {
          if (active) setNotice(e.message);
        });
    }, 250);
    return () => {
      active = false;
      invalidate();
      clearTimeout(timer);
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    void refreshMetadata().catch((e) => {
      if (active) setNotice(e.message);
    });
    const update = () => {
      if (document.visibilityState === 'visible') void loadDashboard().catch(() => {});
    };
    const timer = setInterval(update, 20000);
    window.addEventListener('focus', update);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refreshMetadata, loadDashboard]);
  const labels: Record<string, [string, string]> = {
    instruction: ['相处方式', 'Instructions'],
    identity: ['关于我', 'Identity'],
    career: ['职业与学习', 'Career'],
    project: ['项目', 'Projects'],
    preference: ['偏好', 'Preferences'],
    decision: ['决定', 'Decisions'],
    fact: ['知识', 'Facts'],
    other: ['其他', 'Other'],
    candidate: ['待确认', 'To review'],
    confirmed: ['已确认', 'Confirmed'],
    rejected: ['已排除', 'Rejected'],
    disputed: ['有待核实', 'Disputed'],
    normal: ['普通', 'Normal'],
    sensitive: ['敏感', 'Sensitive'],
    restricted: ['严格私密', 'Restricted']
  };
  const labelFor = (value: string) => (labels[value] ? tr(...labels[value]) : value);
  const dirty =
    editing &&
    (statement !== (selected?.statement || '') ||
      editType !== (selected?.type || 'fact') ||
      editStatus !== (selected?.reviewStatus || 'candidate') ||
      sensitivity !== (selected?.sensitivity || 'normal') ||
      eventAt !== (selected?.eventAt?.slice(0, 10) || '') ||
      tags !== (selected?.tags?.join(', ') || '') ||
      !!reason);
  const mayDiscard = () =>
    !dirty || window.confirm(tr('放弃未保存的修改？', 'Discard unsaved changes?'));
  const closeEditor = () => {
    if (saving || !mayDiscard()) return;
    ++historySequence.current;
    setEditing(false);
  };
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (!editing || (tab !== 'memories' && tab !== 'timeline')) return;
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 900px)').matches)
        editorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      editorRef.current?.querySelector('textarea')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, selected?._id, tab]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target))
        menuRef.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.removeAttribute('open');
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const choose = async (m: BrainMemory | null, force = false) => {
    if (!force && (saving || !mayDiscard())) return false;
    const sequence = ++historySequence.current;

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
    setHistoryLoading(!!m);
    if (m) {
      try {
        const p = await brainRequest<BrainPage<BrainRevision>>('/memories/' + m._id + '/revisions');
        if (sequence === historySequence.current) {
          setRevisions(p.items);
          setRevisionNext(p.nextCursor);
        }
      } catch (e) {
        if (sequence === historySequence.current)
          setNotice(e instanceof Error ? e.message : 'HISTORY_LOAD_FAILED');
      } finally {
        if (sequence === historySequence.current) setHistoryLoading(false);
      }
    }
    return true;
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
    setSaving(true);
    try {
      const m = await brainRequest<BrainMemory>(
        '/memories' + (selected ? '/' + selected._id : ''),
        {
          method: selected ? 'PATCH' : 'POST',
          body: JSON.stringify(data)
        }
      );
      await choose(m, true);
      const results = await Promise.allSettled([refresh()]);
      setNotice(
        results.some((r) => r.status === 'rejected')
          ? tr(
              '已保存。列表刷新失败，请重新搜索。',
              'Saved. List refresh failed; search again to reload.'
            )
          : tr('已保存，并追加版本记录。', 'Saved with a new revision.')
      );
    } finally {
      setSaving(false);
    }
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
    ['overview', tr('知识全景', 'Overview')],
    ['memories', tr('知识卡片', 'Memories')],
    ['connections', tr('连接', 'AI Sync')],
    ['timeline', tr('时间线 / 项目', 'Timeline / Projects')],
    ['sources', tr('来源', 'Sources')],
    ['backup', tr('备份与恢复', 'Backup & Restore')],
    ['legacy', 'Legacy Chats']
  ];
  const dated = [...rows].sort((a, b) => (a.eventAt || '9999').localeCompare(b.eventAt || '9999'));
  return (
    <section className="memory-vault" aria-label="Personal Memory Vault">
      <header className="vault-head">
        <div className="vault-heading">
          <span className="vault-emblem" aria-hidden="true">
            <Database />
          </span>
          <div>
            <p className="vault-eyebrow">CAPTAIN’S CABIN / SECOND BRAIN</p>
            <h1>{tr('个人知识库', 'Personal Knowledge')}</h1>
          </div>
        </div>
      </header>
      <nav aria-label={tr('记忆库导航', 'Vault navigation')}>
        {tabs
          .filter(([key]) => ['overview', 'memories', 'connections'].includes(key))
          .map(([key, label]) => {
            const Icon = tabIcons[key];
            return (
              <button
                key={key}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => {
                  setTab(key);
                  setNotice('');
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            );
          })}
        <details className="vault-tools-menu" ref={menuRef}>
          <summary>
            <MoreHorizontal aria-hidden="true" />
            {tr('资料与备份', 'More')}
          </summary>
          <div>
            {tabs
              .filter(([key]) => !['overview', 'memories', 'connections'].includes(key))
              .map(([key, label]) => {
                const Icon = tabIcons[key];
                return (
                  <button
                    key={key}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={(event) => {
                      setTab(key);
                      setNotice('');
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
          </div>
        </details>
      </nav>
      {notice && (
        <p className="vault-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'overview' && (
        <KnowledgeOverview
          dashboard={dashboard}
          onNew={() => {
            setTab('memories');
            void run(() => choose(null));
          }}
          onFilter={(value) => {
            setType(value);
            setQuery('');
            setStatus('');
            setSource('');
            setFrom('');
            setTo('');
            setArchived(false);
            setTab('memories');
          }}
          onOpen={(memory) => {
            setTab('memories');
            void run(() => choose(memory));
          }}
        />
      )}
      {tab === 'connections' && (
        <SyncConnections
          onChanged={() => {
            void run(refreshMetadata);
          }}
        />
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
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </select>
            <details className="vault-advanced-filters">
              <summary>{tr('更多筛选', 'Filters')}</summary>
              <div>
                <select
                  aria-label="Review status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{tr('所有状态', 'All statuses')}</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {labelFor(s)}
                    </option>
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
              </div>
            </details>
            <button type="submit" disabled={loading || busy}>
              {tr('搜索', 'Search')}
            </button>
            {(query || type || status || source || from || to || archived || unknownDates) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setType('');
                  setStatus('');
                  setSource('');
                  setFrom('');
                  setTo('');
                  setArchived(false);
                  setUnknownDates(false);
                }}
              >
                {tr('重置', 'Reset')}
              </button>
            )}
            <button type="button" onClick={() => void run(() => choose(null))}>
              {tr('新增记忆', 'New memory')}
            </button>
          </form>
          <label className="vault-check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            {tr('查看已归档记忆（可恢复）', 'Show archived memories (recoverable)')}
          </label>
          {tab === 'timeline' && (
            <label className="vault-check">
              <input
                type="checkbox"
                checked={unknownDates}
                onChange={(e) => setUnknownDates(e.target.checked)}
              />
              {tr('单独查看未知日期', 'Show unknown dates separately')}
            </label>
          )}
          <div className="vault-columns vault-memory-columns">
            <div className="vault-list" aria-busy={loading}>
              {(tab === 'timeline' ? dated : rows).map((m) => (
                <button
                  className={
                    'vault-card' + (editing && selected?._id === m._id ? ' is-selected' : '')
                  }
                  aria-pressed={editing && selected?._id === m._id}
                  disabled={saving}
                  key={m._id}
                  onClick={() => void run(() => choose(m))}
                >
                  <span>
                    {labelFor(m.type)} · {labelFor(m.reviewStatus)} · v{m.revision}
                  </span>
                  <p>{m.statement}</p>
                  <small>
                    {m.eventAt
                      ? new Date(m.eventAt).toLocaleDateString(language, { timeZone: 'UTC' })
                      : tr('事件日期未知', 'Event date unknown')}{' '}
                    {m.tags.length ? '· ' + m.tags.join(' / ') : ''}
                  </small>
                </button>
              ))}
              {loading && (
                <p className="vault-list-state" role="status">
                  {tr('加载中…', 'Loading…')}
                </p>
              )}
              {!loading && !rows.length && (
                <p>
                  {tr(
                    '没有符合条件的记忆。可以手动录入或导入原始资料。',
                    'No matching memories. Add a memory or import original sources.'
                  )}
                </p>
              )}
              {next && (
                <button disabled={loading || busy} onClick={() => void run(() => load(next))}>
                  {tr('加载更多', 'Load more')}
                </button>
              )}
            </div>
            {editing && (
              <aside
                className="vault-panel vault-editor-panel"
                ref={editorRef}
                aria-label={tr('记忆编辑器', 'Memory editor')}
              >
                <div className="vault-editor-heading">
                  <h2>
                    {selected ? tr('编辑记忆', 'Revise memory') : tr('新增记忆', 'Manual memory')}
                  </h2>
                  <button
                    type="button"
                    className="vault-icon-button"
                    disabled={saving}
                    aria-label={tr('关闭编辑器', 'Close editor')}
                    onClick={closeEditor}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  className="vault-editor"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(save);
                  }}
                >
                  <fieldset disabled={saving} className="vault-editor-fields">
                    <label className="vault-field-wide">
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
                          <option key={t} value={t}>
                            {labelFor(t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr('确认状态', 'Review status')}
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                        {statuses.map((t) => (
                          <option key={t} value={t}>
                            {labelFor(t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr('敏感级别', 'Sensitivity')}
                      <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
                        {['normal', 'sensitive', 'restricted'].map((t) => (
                          <option key={t} value={t}>
                            {labelFor(t)}
                          </option>
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
                  </fieldset>
                  <div className="vault-actions">
                    <button type="submit" disabled={saving || !statement.trim()}>
                      {saving ? tr('保存中…', 'Saving…') : tr('保存', 'Save revision')}
                    </button>
                    <button type="button" disabled={saving} onClick={closeEditor}>
                      {tr('取消', 'Cancel')}
                    </button>
                  </div>
                </form>
                {selected && (
                  <>
                    <h3>{tr('证据', 'Evidence')}</h3>
                    {selected.sourceAnchors.map((a) => (
                      <button
                        key={a.documentId + (a.start ?? a.quote ?? '')}
                        onClick={() =>
                          void run(async () => {
                            const sequence = historySequence.current;
                            const document = await brainRequest<BrainDocument>(
                              '/documents/' + a.documentId
                            );
                            if (sequence === historySequence.current) setEvidence(document);
                          })
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
                    {historyLoading && <p role="status">{tr('加载版本…', 'Loading revisions…')}</p>}
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
                            const sequence = historySequence.current;
                            const p = await brainRequest<BrainPage<BrainRevision>>(
                              '/memories/' + selected._id + '/revisions?cursor=' + revisionNext
                            );
                            if (sequence !== historySequence.current) return;
                            setRevisions((r) => [...r, ...p.items]);
                            setRevisionNext(p.nextCursor);
                          })
                        }
                      >
                        {tr('更多历史', 'More history')}
                      </button>
                    )}
                    {selected.deletedAt ? (
                      <button
                        onClick={() =>
                          void run(async () => {
                            const restored = await brainRequest<BrainMemory>(
                              '/memories/' + selected._id,
                              {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  expectedRevision: selected.revision,
                                  archived: false,
                                  reason: 'User restored archive'
                                })
                              }
                            );
                            await choose(restored, true);
                            await refresh();
                          })
                        }
                      >
                        {tr('恢复已归档记忆', 'Restore archived memory')}
                      </button>
                    ) : (
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
                    )}
                  </>
                )}
              </aside>
            )}
          </div>
        </>
      )}
      {tab === 'backup' && <BackupRestore zh={zh} onRestored={refresh} />}
      {tab === 'sources' && (
        <DocumentSearch
          zh={zh}
          onCandidate={(d) =>
            void run(async () => {
              if (!(await choose(null))) return;
              setStatement(d.rawText.slice(0, 20000));
              setNewAnchors([{ documentId: d._id, quote: d.rawText.slice(0, 20000) }]);
              setTab('memories');
            })
          }
        />
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
            {selectedSource && (
              <SourceAssets
                sourceId={selectedSource}
                zh={zh}
                originalFilename={sources.find((s) => s._id === selectedSource)?.originalFilename}
              />
            )}
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
