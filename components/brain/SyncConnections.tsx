import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { brainRequest, type BrainConnection } from '../../services/brainService';
type Config = { mcpUrl: string; openapiUrl: string; apiBaseUrl: string };
const agreement = {
  zh: '当我明确提供值得长期保存的个人事实、偏好、项目进展或纠正时，先搜索 Orion 知识库，再调用同步工具新增或修订。保留日期、来源和不确定性，不把临时猜测当成事实。只有工具返回成功后，才告诉我已同步；失败时明确告知没有保存。不要把密码、密钥或验证码写入知识库。',
  en: 'When I explicitly provide a durable personal fact, preference, project update or correction, search my Orion knowledge first, then use the sync tool to add or revise it. Preserve dates, sources and uncertainty. Do not save guesses, passwords, keys or verification codes. Say a memory was synced only after the tool succeeds; report failures honestly.'
};
export function SyncConnections({ onChanged }: { onChanged: () => void }) {
  const { language } = useTranslation(),
    zh = language.startsWith('zh');
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [items, setItems] = useState<BrainConnection[]>([]),
    [configuration, setConfiguration] = useState<Config | null>(null);
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState('');
  const [label, setLabel] = useState('ChatGPT'),
    [write, setWrite] = useState(true),
    [copied, setCopied] = useState('');
  const refresh = useCallback(async () => {
    const r = await brainRequest<{ items: BrainConnection[]; configuration: Config }>(
      '/connections'
    );
    setItems(r.items);
    setConfiguration(r.configuration);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setNotice(e.message));
  }, [refresh]);
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
      setCopied(key);
    } catch {
      setNotice(tr('复制未获浏览器许可，请手动选择复制。', 'Select and copy the text manually.'));
    }
  };
  const create = async () => {
    const r = await brainRequest<{ token: string }>('/connections', {
      method: 'POST',
      body: JSON.stringify({
        label,
        provider: 'chatgpt',
        scopes: write ? ['memory:read', 'memory:write'] : ['memory:read'],
        expiresInDays: 30
      })
    });
    setToken(r.token);
    await refresh();
    onChanged();
  };
  const active = (provider: string) =>
    items.filter(
      (i) => i.provider === provider && !i.revokedAt && +new Date(i.expiresAt) > Date.now()
    );
  return (
    <div className="knowledge-connections">
      <div className="knowledge-intro">
        <div>
          <p className="knowledge-kicker">
            {tr('让知识随对话积累', 'Keep the context. Change the model.')}
          </p>
          <h2>{tr('连接你平时使用的 AI', 'Connect the AI you already use')}</h2>
          <p>
            {tr(
              '授权一次，让聊天中值得留下的信息进入你的知识库。',
              'Authorize a connection to keep useful facts and preferences from your conversations.'
            )}
          </p>
        </div>
        <ShieldCheck size={29} />
      </div>
      <p className="knowledge-sync-boundary">
        {tr(
          '工具被调用并成功写入时才会同步；平台内置 Memory 的后台变化不会自动通知 Orion。',
          'Sync happens when an authorized tool call succeeds. Background changes to a platform’s built-in memory do not notify Orion automatically.'
        )}
      </p>
      {notice && (
        <p role="status" className="vault-notice">
          {notice}
        </p>
      )}
      <div className="knowledge-provider-grid">
        {[
          {
            key: 'chatgpt',
            name: 'ChatGPT',
            letter: 'G',
            guide: tr(
              '在支持自定义 MCP 的 ChatGPT 账号中添加连接并授权。也可使用下方 GPT Actions 接口。',
              'Add a custom MCP connection where your ChatGPT account supports it, or use the GPT Actions option below.'
            )
          },
          {
            key: 'claude',
            name: 'Claude',
            letter: 'C',
            guide: tr(
              '在 Connectors 中添加自定义连接器，粘贴下面的地址，再用 Orion 登录授权。',
              'Add a custom connector in Connectors, paste this URL, then sign in to Orion to authorize it.'
            )
          }
        ].map((p) => (
          <article key={p.key} className={'knowledge-provider knowledge-provider-' + p.key}>
            <div className="knowledge-provider-top">
              <span className="knowledge-provider-letter">{p.letter}</span>
              <span
                className={
                  'knowledge-connection-state ' +
                  (active(p.key).some((c) => c.lastUsedAt) ? 'is-connected' : '')
                }
              >
                {active(p.key).some((c) => c.lastUsedAt)
                  ? tr('已使用连接', 'Connection used')
                  : active(p.key).length
                    ? tr('等待首次调用', 'Awaiting first use')
                    : tr('尚未连接', 'Not connected')}
              </span>
            </div>
            <h3>{p.name}</h3>
            <p>{p.guide}</p>
            <label className="knowledge-url-label">
              MCP URL
              <input
                readOnly
                value={configuration?.mcpUrl || ''}
                aria-label={p.name + ' MCP URL'}
              />
            </label>
            <button
              onClick={() => void copy(configuration?.mcpUrl || '', p.key)}
              disabled={!configuration}
            >
              {copied === p.key ? <Check size={16} /> : <Copy size={16} />}
              {tr('复制连接地址', 'Copy connector URL')}
            </button>
            <a
              href={p.key === 'claude' ? 'https://claude.ai' : 'https://chatgpt.com'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tr('前往', 'Open')} {p.name} <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
      <article className="knowledge-agreement">
        <div className="knowledge-panel-heading">
          <div>
            <h3>{tr('给 AI 的同步约定', 'Your memory sync instruction')}</h3>
            <p>
              {tr(
                '放进自定义指令或项目说明，并在可用的连接中启用 Orion。',
                'Add this to your instructions and enable Orion in conversations that support the connection.'
              )}
            </p>
          </div>
          <button onClick={() => void copy(zh ? agreement.zh : agreement.en, 'instruction')}>
            <Copy size={16} />
            {tr('复制', 'Copy')}
          </button>
        </div>
        <p className="knowledge-agreement-text">{zh ? agreement.zh : agreement.en}</p>
      </article>
      <details className="knowledge-api-details">
        <summary>
          <KeyRound size={17} />
          {tr('GPT Actions / 独立 API 密钥', 'GPT Actions / dedicated API key')}
        </summary>
        <div>
          <p>
            {tr(
              '在自定义 GPT 的 Actions 中导入 OpenAPI，并设置 API Key → Bearer。密钥只显示一次，仅有你授予的知识权限，有效期 30 天。',
              'Import the OpenAPI URL into your custom GPT Actions and choose API Key → Bearer. The key is shown once, expires in 30 days and grants only the memory scopes below.'
            )}
          </p>
          <label className="knowledge-url-label">
            OpenAPI URL
            <input readOnly value={configuration?.openapiUrl || ''} aria-label="OpenAPI URL" />
          </label>
          <div className="knowledge-key-form">
            <label>
              {tr('连接名称', 'Connection name')}
              <input
                aria-label="Connection name"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="vault-check">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
              {tr('允许读取并更新知识', 'Allow reading and updating knowledge')}
            </label>
            <button disabled={busy || !label.trim()} onClick={() => void run(create)}>
              <KeyRound size={16} />
              {tr('创建独立密钥', 'Create dedicated key')}
            </button>
          </div>
          {token && (
            <div className="knowledge-key-once">
              <p>
                {tr(
                  '请现在保存。关闭后无法再次查看。',
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
              <button onClick={() => void copy(token, 'key')}>
                <Copy size={16} />
                {copied === 'key' ? tr('已复制', 'Copied') : tr('复制密钥', 'Copy key')}
              </button>
              <button onClick={() => setToken('')}>{tr('已保存，关闭', 'Saved, close')}</button>
            </div>
          )}
        </div>
      </details>
      <div className="knowledge-panel-heading">
        <h3>{tr('连接与最近同步', 'Connections and latest syncs')}</h3>
        <button disabled={busy} onClick={() => void run(refresh)}>
          <RefreshCw size={16} />
          {tr('刷新', 'Refresh')}
        </button>
      </div>
      <div className="knowledge-connection-list">
        {items.map((c) => (
          <article key={c._id}>
            <Link2 size={19} />
            <div>
              <strong>{c.label}</strong>
              <p>
                {c.revokedAt
                  ? tr('已撤销', 'Revoked')
                  : c.lastWriteAt
                    ? tr('最近写入：', 'Last write: ') +
                      new Date(c.lastWriteAt).toLocaleString(language)
                    : tr('尚未写入知识', 'No knowledge written yet')}
              </p>
              <small>
                {c.scopes.includes('memory:write')
                  ? tr('读取与更新', 'Read and update')
                  : tr('只读', 'Read only')}{' '}
                · {tr('到期', 'Expires')} {new Date(c.expiresAt).toLocaleDateString(language)}
              </small>
            </div>
            {!c.revokedAt && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await brainRequest('/connections/' + c._id, { method: 'DELETE' });
                    await refresh();
                    onChanged();
                  })
                }
              >
                <Unplug size={16} />
                {tr('撤销', 'Revoke')}
              </button>
            )}
          </article>
        ))}
        {!items.length && (
          <p className="knowledge-empty-line">
            {tr(
              '暂无连接。连接后，这里会显示真实的调用与同步时间。',
              'No connections yet. Actual use and write times appear here after a connection is used.'
            )}
          </p>
        )}
      </div>
    </div>
  );
}
