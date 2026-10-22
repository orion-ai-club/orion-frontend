import { JobReport } from './JobReport';
import React, { useEffect, useState } from 'react';
import { brainRequest, BrainJob, BrainPage, brainDownload } from '../../services/brainService';
export function SourceImports({
  zh,
  onCommitted
}: {
  zh: boolean;
  onCommitted: () => Promise<void>;
}) {
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [provider, setProvider] = useState('chatgpt');
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<BrainJob | null>(null);
  const [jobs, setJobs] = useState<BrainJob[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = async (c?: string) => {
    const p = await brainRequest<BrainPage<BrainJob>>('/imports' + (c ? '?cursor=' + c : ''));
    setJobs((old) => (c ? [...old, ...p.items] : p.items));
    setCursor(p.nextCursor);
  };
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'IMPORT_FAILED');
    } finally {
      setBusy(false);
    }
  };
  const preview = async () => {
    if (!file) throw new Error('FILE_REQUIRED');
    if (file.size > 25 * 1024 * 1024) throw new Error('FILE_MAX_25_MIB');
    const body = new FormData();
    body.set('provider', provider);
    body.set('file', file);
    setJob(await brainRequest<BrainJob>('/imports', { method: 'POST', body }));
    await load();
  };
  return (
    <article className="vault-panel">
      <h2>{tr('导入与覆盖检查', 'Import & coverage review')}</h2>
      <p>
        {tr(
          '原始文件先归档，预览后再提交。ZIP 最大 25 MiB，展开 100 MiB、2000 个文件、单条文档 128000 字符。不会调用模型或读取外部图片。Claude 官方格式待真实脱敏样本验证，默认只归档原包。',
          'Original files are retained; review before commit. ZIP max 25 MiB; expanded max 100 MiB / 2000 files; document max 128000 characters. No model calls or remote image fetches. Claude parsing awaits a validated redacted fixture and defaults to raw archival.'
        )}
      </p>
      <form
        className="vault-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void run(preview);
        }}
      >
        <label>
          {tr('来源类型', 'Provider')}
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude (raw archive / experimental adapter)</option>
            <option value="manual">Memory / Markdown / text (unverified)</option>
            <option value="other">JSON schemaVersion 1 / Markdown</option>
          </select>
        </label>
        <label>
          {tr('选择文件', 'Choose file')}
          <input
            type="file"
            accept=".zip,.json,.md,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button disabled={busy || !file}>{tr('生成导入预览', 'Preview import')}</button>
      </form>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setJob(await brainRequest<BrainJob>('/legacy/preview', { method: 'POST', body: '{}' }));
            await load();
          })
        }
      >
        {tr('预览已批准数据集中的旧聊天', 'Preview legacy chats in approved dataset')}
      </button>
      <p>
        {tr(
          '旧聊天扫描默认关闭，需管理员批准数据集后配置启用。不会执行删除或自动抓取 R2 图片。',
          'Legacy scanning is disabled until an administrator enables an approved dataset. It never deletes records or automatically fetches R2 images.'
        )}
      </p>
      {notice && <p role="status">{notice}</p>}
      {job && (
        <div>
          <h3>
            {tr('本次任务', 'Current job')} · {job.state}
          </h3>
          <JobReport job={job} zh={zh} />
          {job.errorSummary && <p>{job.errorSummary}</p>}
          {job.state !== 'complete' && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setJob(
                    await brainRequest<BrainJob>('/imports/' + job._id + '/commit', {
                      method: 'POST',
                      body: '{}'
                    })
                  );
                  await onCommitted();
                  await load();
                })
              }
            >
              {job.state === 'unsupported'
                ? tr('仅归档原包（不声称已解析）', 'Archive original only (unsupported)')
                : tr('确认并非破坏性提交', 'Confirm additive import')}
            </button>
          )}
        </div>
      )}
      <details>
        <summary>{tr('已有任务 / 重试', 'Existing jobs / retry')}</summary>
        {jobs.map((j) => (
          <button key={j._id} onClick={() => setJob(j)}>
            {j.state} · {j._id.slice(-8)} · {JSON.stringify(j.counts)}
          </button>
        ))}
        {cursor && (
          <button onClick={() => void run(() => load(cursor))}>
            {tr('更多任务', 'More jobs')}
          </button>
        )}
      </details>
    </article>
  );
}
export function SourceAssets({
  sourceId,
  zh,
  originalFilename
}: {
  sourceId: string;
  zh: boolean;
  originalFilename?: string;
}) {
  const [assets, setAssets] = useState<
    { _id: string; originalName: string; availability: string }[]
  >([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setAssets([]);
    setNext(null);
    setError('');
    brainRequest<BrainPage<(typeof assets)[number]>>('/sources/' + sourceId + '/assets')
      .then((p) => {
        setAssets(p.items);
        setNext(p.nextCursor);
      })
      .catch((e) => setError(e.message));
  }, [sourceId]);
  return (
    <div>
      <h3>{zh ? '原包与附件' : 'Original & attachments'}</h3>
      <button
        onClick={() =>
          brainDownload(
            '/sources/' + sourceId + '/original',
            originalFilename || 'original-source.bin'
          ).catch((e) => setError(e.message))
        }
      >
        {zh ? '下载原始文件' : 'Download original file'}
      </button>
      {assets.map((a) => (
        <p key={a._id}>
          {a.originalName} · {a.availability}{' '}
          {a.availability === 'available' && (
            <button
              onClick={() =>
                brainDownload(
                  '/assets/' + a._id,
                  a.originalName.split('/').pop() || 'asset.bin'
                ).catch((e) => setError(e.message))
              }
            >
              {zh ? '下载' : 'Download'}
            </button>
          )}
        </p>
      ))}
      {next && (
        <button
          onClick={() =>
            brainRequest<BrainPage<(typeof assets)[number]>>(
              '/sources/' + sourceId + '/assets?cursor=' + next
            )
              .then((p) => {
                setAssets((a) => [...a, ...p.items]);
                setNext(p.nextCursor);
              })
              .catch((e) => setError(e.message))
          }
        >
          {zh ? '更多附件' : 'More assets'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
