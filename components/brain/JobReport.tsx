import React from 'react';
import { BrainJob } from '../../services/brainService';
const labels: Record<string, [string, string]> = {
  documents: ['原始文档', 'Documents'],
  added: ['新增', 'New'],
  duplicates: ['重复', 'Duplicates'],
  conflicts: ['冲突', 'Conflicts'],
  identical: ['一致', 'Identical'],
  missingAssets: ['附件字节缺失', 'Missing asset bytes'],
  assets: ['附件', 'Assets'],
  absentFromIncludedConversations: ['本次对话中未出现', 'Absent in included conversations'],
  memories: ['记忆', 'Memories'],
  sources: ['来源', 'Sources'],
  revisions: ['修订版本', 'Revisions']
};
export function JobReport({ job, zh }: { job: BrainJob; zh: boolean }) {
  const preview = job.preview as
    | {
        warnings?: string[];
        missingAssets?: string[] | number;
        archiveCounts?: Record<string, number>;
        formatVersion?: string;
      }
    | undefined;
  const counts = Object.entries(job.counts || {}).filter(([key]) => labels[key]);
  return (
    <div className="vault-job-report">
      <dl>
        {counts.map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key][zh ? 0 : 1]}</dt>
            <dd>{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      {preview?.archiveCounts && (
        <p>
          {zh ? '备份覆盖：' : 'Archive coverage: '}
          {Object.entries(preview.archiveCounts)
            .map(([key, value]) => (labels[key]?.[zh ? 0 : 1] || key) + ' ' + value)
            .join(' · ')}
        </p>
      )}
      {preview?.formatVersion && (
        <p>
          {zh ? '适配器版本：' : 'Adapter version: '}
          {preview.formatVersion}
        </p>
      )}
      {Boolean(preview?.warnings?.length) && (
        <ul>
          {preview!.warnings!.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {Array.isArray(preview?.missingAssets) && preview.missingAssets.length > 0 && (
        <details>
          <summary>{zh ? '查看缺失附件引用' : 'Review missing attachment references'}</summary>
          {preview.missingAssets.map((a, i) => (
            <pre key={i}>{a}</pre>
          ))}
        </details>
      )}
      {typeof preview?.missingAssets === 'number' && preview.missingAssets > 0 && (
        <p>
          {zh ? '备份明确标记的缺失附件：' : 'Explicitly missing assets in this backup: '}
          {preview.missingAssets}
        </p>
      )}
    </div>
  );
}
