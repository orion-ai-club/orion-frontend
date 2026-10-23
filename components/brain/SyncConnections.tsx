import { Check, Copy, KeyRound, Link2, RefreshCw, Unplug } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { brainRequest, type BrainConnection } from '../../services/brainService';

type Config = { mcpUrl: string; openapiUrl: string; apiBaseUrl: string };
export function SyncConnections({ onChanged }: { onChanged: () => void }) {
  const { language } = useTranslation(),
    zh = language.startsWith('zh');
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [items, setItems] = useState<BrainConnection[]>([]);
  const [configuration, setConfiguration] = useState<Config | null>(null);
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false),
    [token, setToken] = useState('');
  const [label, setLabel] = useState('ChatGPT'),
    [provider, setProvider] = useState('chatgpt');
  const [write, setWrite] = useState(true),
    [copied, setCopied] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useCallback(async () => {
    const r = await brainRequest<{ items: BrainConnection[]; configuration: Config }>(
      '/connections'
    );
    setItems(r.items);
    setConfiguration(r.configuration);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setNotice(e.message));
  }, [refresh]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await operation();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'CONNECTION_FAILED');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      clearTimeout(copyTimer.current);
      setCopied(key);
      copyTimer.current = setTimeout(() => setCopied(''), 2000);
    } catch {
      setNotice(tr('请选中地址手动复制。', 'Select the text to copy manually.'));
    }
  };
  const create = async () => {
    const r = await brainRequest<{ token: string }>('/connections', {
      method: 'POST',
      body: JSON.stringify({
        label: label.trim(),
        provider,
        scopes: write ? ['memory:read', 'memory:write'] : ['memory:read'],
        expiresInDays: 30
      })
    });
    setToken(r.token);
    await refresh();
    onChanged();
  };
  const active = (key: string) =>
    items.filter((i) => i.provider === key && !i.revokedAt && +new Date(i.expiresAt) > Date.now());
  return (
    <div className="knowledge-connections">
      <div className="knowledge-panel-heading knowledge-settings-heading">
        <h2>{tr('连接管理', 'Connections')}</h2>
        <button disabled={busy} onClick={() => void run(refresh)}>
          <RefreshCw size={16} />
          {tr('刷新', 'Refresh')}
        </button>
      </div>
      {notice && (
        <p role="status" className="vault-notice">
          {notice}
        </p>
      )}
      <div className="knowledge-provider-grid">
        {[
          { key: 'chatgpt', name: 'ChatGPT', letter: 'G' },
          { key: 'claude', name: 'Claude', letter: 'C' }
        ].map((p) => {
          const connections = active(p.key);
          const lastWrite = connections
            .map((c) => c.lastWriteAt)
            .filter((v): v is string => !!v)
            .sort()
            .at(-1);
          return (
            <article key={p.key} className={'knowledge-provider knowledge-provider-' + p.key}>
              <span className="knowledge-provider-letter">{p.letter}</span>
              <div>
                <h3>{p.name}</h3>
                <p>
                  {lastWrite
                    ? tr('最近同步 ', 'Last sync ') + new Date(lastWrite).toLocaleString(language)
                    : tr('暂无同步记录', 'No syncs yet')}
                </p>
              </div>
              <span
                className={
                  'knowledge-connection-state ' +
                  (connections.some((c) => c.lastUsedAt) ? 'is-connected' : '')
                }
              >
                {!loaded
                  ? '…'
                  : connections.some((c) => c.lastUsedAt)
                    ? tr('已连接', 'Connected')
                    : connections.length
                      ? tr('待首次使用', 'Awaiting first use')
                      : tr('未连接', 'Not connected')}
              </span>
            </article>
          );
        })}
      </div>
      <article className="vault-panel knowledge-endpoints">
        <label className="knowledge-url-label">
          MCP URL
          <span className="knowledge-copy-field">
            <input
              readOnly
              value={configuration?.mcpUrl || ''}
              aria-label="MCP URL"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              aria-label={tr('复制 MCP 地址', 'Copy MCP URL')}
              disabled={!configuration}
              onClick={() => void copy(configuration?.mcpUrl || '', 'mcp')}
            >
              {copied === 'mcp' ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied === 'mcp' ? tr('已复制', 'Copied') : tr('复制', 'Copy')}</span>
            </button>
          </span>
        </label>
        <details className="knowledge-api-schema">
          <summary>OpenAPI</summary>
          <label className="knowledge-url-label">
            OpenAPI URL
            <span className="knowledge-copy-field">
              <input
                readOnly
                value={configuration?.openapiUrl || ''}
                aria-label="OpenAPI URL"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                disabled={!configuration}
                aria-label={tr('复制 OpenAPI 地址', 'Copy OpenAPI URL')}
                onClick={() => void copy(configuration?.openapiUrl || '', 'schema')}
              >
                {copied === 'schema' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </span>
          </label>
        </details>
      </article>
      <div className="knowledge-panel-heading knowledge-settings-heading">
        <h3>
          {tr('已授权连接', 'Authorized connections')}{' '}
          <span className="knowledge-count">{items.length}</span>
        </h3>
      </div>
      <div className="knowledge-connection-list">
        {items.map((c) => {
          const expired = +new Date(c.expiresAt) <= Date.now();
          return (
            <article key={c._id} className={c.revokedAt || expired ? 'is-inactive' : ''}>
              <Link2 size={19} />
              <div>
                <strong>{c.label}</strong>
                <p>
                  {c.revokedAt
                    ? tr('已撤销', 'Revoked')
                    : expired
                      ? tr('已过期', 'Expired')
                      : c.lastWriteAt
                        ? tr('最近写入：', 'Last write: ') +
                          new Date(c.lastWriteAt).toLocaleString(language)
                        : tr('尚未写入知识', 'No knowledge written yet')}
                </p>
                <small>
                  {c.provider === 'chatgpt'
                    ? 'ChatGPT'
                    : c.provider === 'claude'
                      ? 'Claude'
                      : tr('其他', 'Other')}{' '}
                  ·{' '}
                  {c.scopes.includes('memory:write')
                    ? tr('读取与更新', 'Read and update')
                    : tr('只读', 'Read only')}{' '}
                  · {tr('到期 ', 'Expires ')}
                  {new Date(c.expiresAt).toLocaleDateString(language)}
                </small>
              </div>
              {!c.revokedAt && !expired && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        tr(
                          '撤销此连接？之后需要重新授权。',
                          'Revoke this connection? It will need to be authorized again.'
                        )
                      )
                    )
                      return;
                    void run(async () => {
                      await brainRequest('/connections/' + c._id, { method: 'DELETE' });
                      await refresh();
                      onChanged();
                    });
                  }}
                >
                  <Unplug size={16} />
                  {tr('撤销', 'Revoke')}
                </button>
              )}
            </article>
          );
        })}
        {!items.length && (
          <p className="knowledge-empty-line">
            {loaded ? tr('暂无授权连接', 'No authorized connections') : tr('加载中…', 'Loading…')}
          </p>
        )}
      </div>
      <details className="knowledge-api-details">
        <summary>
          <KeyRound size={17} />
          {tr('新建 API 密钥', 'New API key')}
        </summary>
        <div>
          <form
            className="knowledge-key-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(create);
            }}
          >
            <label>
              {tr('应用', 'Application')}
              <select
                aria-label="Connection provider"
                value={provider}
                onChange={(e) => {
                  const next = e.target.value;
                  setProvider(next);
                  if (['ChatGPT', 'Claude', 'API'].includes(label))
                    setLabel(next === 'chatgpt' ? 'ChatGPT' : next === 'claude' ? 'Claude' : 'API');
                }}
              >
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
                <option value="other">{tr('其他', 'Other')}</option>
              </select>
            </label>
            <label>
              {tr('名称', 'Connection name')}
              <input
                aria-label="Connection name"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </label>
            <label className="vault-check">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
              {tr('允许更新知识', 'Allow updating knowledge')}
            </label>
            <button type="submit" disabled={busy || !!token || !label.trim()}>
              <KeyRound size={16} />
              {tr('创建密钥', 'Create dedicated key')}
            </button>
          </form>
          <p className="knowledge-key-caption">
            {tr('有效期 30 天 · 密钥仅显示一次', 'Valid for 30 days · Key shown once')}
          </p>
          {token && (
            <div className="knowledge-key-once">
              <p>
                {tr(
                  '请保存密钥，关闭后无法再次查看。',
                  'Save this key now. It will not be shown again.'
                )}
              </p>
              <input
                readOnly
                value={token}
                aria-label="New connection key"
                type="password"
                autoComplete="off"
              />
              <div className="vault-actions">
                <button onClick={() => void copy(token, 'key')}>
                  {copied === 'key' ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied === 'key' ? tr('已复制', 'Copied') : tr('复制密钥', 'Copy key')}
                </button>
                <button onClick={() => setToken('')}>{tr('已保存，关闭', 'Saved, close')}</button>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
