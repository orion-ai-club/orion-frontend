import { JobReport } from './JobReport';
import React, { useEffect, useState } from 'react';
import { brainRequest, brainDownload, BrainJob, BrainPage } from '../../services/brainService';
export function BackupRestore({
  zh,
  onRestored
}: {
  zh: boolean;
  onRestored: () => Promise<void>;
}) {
  const tr = (cn: string, en: string) => (zh ? cn : en);
  const [passphrase, setPassphrase] = useState('');
  const [plain, setPlain] = useState(false);
  const [exports, setExports] = useState<BrainJob[]>([]);
  const [exportCursor, setExportCursor] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restore, setRestore] = useState<BrainJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = async (cursor?: string) => {
    const p = await brainRequest<BrainPage<BrainJob>>(
      '/exports' + (cursor ? '?cursor=' + cursor : '')
    );
    setExports((old) => (cursor ? [...old, ...p.items] : p.items));
    setExportCursor(p.nextCursor);
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
      setNotice(e instanceof Error ? e.message : 'BACKUP_FAILED');
    } finally {
      setPassphrase('');
      setRestoreKey('');
      setBusy(false);
    }
  };
  return (
    <div className="vault-columns">
      <article className="vault-panel">
        <h2>{tr('自有备份', 'Portable backup')}</h2>
        <p>
          {tr(
            '包含原包、原文、附件、全部版本、manifest 和 SHA-256。默认加密，口令不保存。口令丢失将无法恢复，请在离线安全位置保管。',
            'Includes original packages, documents, assets, complete revisions, manifest and SHA-256. Encrypted by default; the passphrase is never saved. A lost passphrase makes recovery impossible. Store it safely offline.'
          )}
        </p>
        <form
          className="vault-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await brainRequest('/exports', {
                method: 'POST',
                body: JSON.stringify(plain ? { unencrypted: true } : { passphrase })
              });
              await load();
              setNotice(
                tr('备份已生成并校验，请下载。', 'Backup created and verified. Download it below.')
              );
            });
          }}
        >
          {!plain && (
            <label>
              {tr('加密口令（至少 12 个字符）', 'Passphrase (12+ characters)')}
              <input
                aria-label="Backup passphrase"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={1024}
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </label>
          )}
          <label className="vault-check">
            <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} />
            {tr(
              '我明确选择未加密 ZIP，仅用于可信环境迁移。',
              'I explicitly choose a plaintext ZIP for migration in a trusted environment.'
            )}
          </label>
          <button disabled={busy}>{tr('生成并校验备份', 'Create & verify backup')}</button>
        </form>
        {exports.map((job) => (
          <article key={job._id}>
            <p>
              {job.state} · {job._id.slice(-8)} ·{' '}
              {(job.preview as { encrypted?: boolean })?.encrypted ? 'AES-256-GCM' : 'ZIP'}
            </p>
            {job.errorSummary && <p>{job.errorSummary}</p>}
            {job.state === 'complete' && (
              <button
                onClick={() =>
                  void run(() =>
                    brainDownload(
                      '/exports/' + job._id + '/download',
                      'orion-vault.' +
                        ((job.preview as { encrypted?: boolean })?.encrypted ? 'orion' : 'zip')
                    )
                  )
                }
              >
                {tr('下载备份', 'Download backup')}
              </button>
            )}
          </article>
        ))}
        {exportCursor && (
          <button onClick={() => void run(() => load(exportCursor))}>
            {tr('更早的备份', 'Earlier backups')}
          </button>
        )}
        <h3>{tr('独立离线工具', 'Standalone offline tools')}</h3>
        <p>
          Node.js 22+ · Python 3 ·{' '}
          {tr('不需要 npm、Orion、模型或云服务', 'No npm, Orion, model or cloud service')}
        </p>
        <div className="vault-actions">
          {['brain-vault.mjs', 'crypto.mjs', 'archive.py', 'README.md'].map((name) => (
            <button
              key={name}
              onClick={() => void run(() => brainDownload('/recovery-tools/' + name, name))}
            >
              {name}
            </button>
          ))}
        </div>
        <pre>
          node brain-vault.mjs verify backup.orion --passphrase-file /secure/key.txt{'\n'}node
          brain-vault.mjs restore backup.orion --passphrase-file /secure/key.txt --output
          ./recovered-vault
        </pre>
      </article>
      <article className="vault-panel">
        <h2>{tr('验证与恢复', 'Verify & restore')}</h2>
        <p>
          {tr(
            '先解密并验证所有文件、条数、owner、证据和版本链。任何现有记录冲突都会阻止整个恢复，不覆盖数据。',
            'Decrypt and verify every file, count, owner, evidence link and revision chain. Any conflict blocks the entire restore; existing data is never overwritten.'
          )}
        </p>
        <form
          className="vault-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!restoreFile) throw new Error('FILE_REQUIRED');
              if (restoreFile.size > 128 * 1024 * 1024) throw new Error('ARCHIVE_MAX_128_MIB');
              const body = new FormData();
              body.set('file', restoreFile);
              body.set('passphrase', restoreKey);
              setRestore(
                await brainRequest<BrainJob>('/restore/preview', { method: 'POST', body })
              );
            });
          }}
        >
          <label>
            {tr('选择备份包（最大 128 MiB）', 'Backup archive (max 128 MiB)')}
            <input
              aria-label="Restore file"
              type="file"
              accept=".orion,.zip"
              required
              onChange={(e) => {
                setRestoreFile(e.target.files?.[0] || null);
                setRestore(null);
              }}
            />
          </label>
          <label>
            {tr('解密口令（未加密 ZIP 可留空）', 'Passphrase (blank for plaintext ZIP)')}
            <input
              aria-label="Restore passphrase"
              type="password"
              autoComplete="off"
              maxLength={1024}
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
            />
          </label>
          <button disabled={busy || !restoreFile}>
            {tr('校验并预览恢复', 'Verify & preview restore')}
          </button>
        </form>
        {restore && (
          <div>
            <h3>{restore.state}</h3>
            <JobReport job={restore} zh={zh} />
            {restore.state === 'preview' && (
              <button
                disabled={busy || Boolean(restore.counts?.conflicts)}
                onClick={() =>
                  void run(async () => {
                    setRestore(
                      await brainRequest<BrainJob>('/restore/commit', {
                        method: 'POST',
                        body: JSON.stringify({ jobId: restore._id })
                      })
                    );
                    await onRestored();
                  })
                }
              >
                {tr('确认非破坏性恢复', 'Confirm additive restore')}
              </button>
            )}
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
      </article>
    </div>
  );
}
