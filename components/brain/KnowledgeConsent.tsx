import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Check, Link2, LockKeyhole } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import type { User } from '../../types';
import { API_BASE_URL } from '../../services/core';
import { brainRequest } from '../../services/brainService';
import './vault.css';
type Authorization = {
  clientName: string;
  redirectOrigin: string;
  scopes: string[];
  expiresAt: string;
};
export function KnowledgeConsent({
  user,
  loading,
  onLogin
}: {
  user: User | null;
  loading: boolean;
  onLogin: () => void;
}) {
  const { language } = useTranslation(),
    zh = language.startsWith('zh'),
    tr = (cn: string, en: string) => (zh ? cn : en);
  const [params] = useSearchParams(),
    request = params.get('request') || '';
  const [info, setInfo] = useState<Authorization | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [write, setWrite] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(API_BASE_URL + '/brain/sync/authorization/' + encodeURIComponent(request), {
      credentials: 'omit',
      cache: 'no-store'
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('AUTHORIZATION_EXPIRED');
        return r.json() as Promise<Authorization>;
      })
      .then((data) => {
        if (active) setInfo(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  const decide = async (allow: boolean) => {
    setBusy(true);
    setError('');
    try {
      const scopes = (info?.scopes || []).filter((s) => s !== 'memory:write' || write);
      const result = await brainRequest<{ redirectUrl: string }>('/connections/authorize', {
        method: 'POST',
        body: JSON.stringify({ request, allow, scopes })
      });
      const target = new URL(result.redirectUrl);
      if (target.protocol !== 'https:' || target.origin !== info?.redirectOrigin)
        throw new Error('REDIRECT_REJECTED');
      window.location.replace(target.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AUTHORIZATION_FAILED');
      setBusy(false);
    }
  };
  return (
    <section className="memory-vault knowledge-consent">
      <Helmet>
        <title>{tr('授权知识连接', 'Connect personal knowledge')}</title>
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <article>
        <div className="knowledge-consent-icon">
          <Link2 size={29} />
        </div>
        <p className="vault-eyebrow">ORION · PERSONAL KNOWLEDGE</p>
        <h1>{tr('把你的知识，连接到日常对话', 'Bring your knowledge into the conversation')}</h1>
        {info && (
          <>
            <h2>{info.clientName}</h2>
            <p>
              {tr(
                '正在请求访问你的 Orion 个人知识库。',
                'is requesting access to your Orion personal knowledge.'
              )}
            </p>
            <div className="knowledge-consent-permissions">
              {info.scopes.includes('memory:read') && (
                <p>
                  <Check size={17} />
                  {tr('检索并读取你的知识', 'Search and read your knowledge')}
                </p>
              )}
              {info.scopes.includes('memory:write') && (
                <label>
                  <input
                    type="checkbox"
                    checked={write}
                    onChange={(e) => setWrite(e.target.checked)}
                  />
                  {tr(
                    '允许新增和修订知识，保留来源与版本',
                    'Allow additions and corrections, with sources and revision history'
                  )}
                </label>
              )}
              <p>
                <LockKeyhole size={17} />
                {tr(
                  '不授予其他模块权限；可随时撤销连接',
                  'No access to other Orion modules. Revoke the connection at any time.'
                )}
              </p>
            </div>
            <p className="knowledge-consent-callback">
              {tr('授权后返回：', 'Return to: ')}
              {info.redirectOrigin}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="vault-notice">
            {error === 'AUTHORIZATION_EXPIRED'
              ? tr(
                  '连接请求已过期，请从 AI 客户端重新发起。',
                  'This request expired. Start the connection again in your AI client.'
                )
              : error}
          </p>
        )}
        {loading ? (
          <p role="status">{tr('正在检查登录…', 'Checking your sign-in…')}</p>
        ) : !user ? (
          <button className="knowledge-primary" onClick={onLogin} disabled={!info}>
            {tr('登录 Orion 后授权', 'Sign in to Orion to continue')}
            <ArrowRight size={17} />
          </button>
        ) : (
          info && (
            <>
              <p className="knowledge-consent-account">
                {tr('使用账户：', 'Signed in as: ')}
                {user.email || user.displayName}
              </p>
              <div className="knowledge-consent-actions">
                <button
                  disabled={busy || !!error}
                  onClick={() => void decide(true)}
                  className="knowledge-primary"
                >
                  {tr('允许连接', 'Allow connection')}
                  <ArrowRight size={17} />
                </button>
                <button disabled={busy} onClick={() => void decide(false)}>
                  {tr('取消', 'Cancel')}
                </button>
              </div>
            </>
          )
        )}
      </article>
    </section>
  );
}
