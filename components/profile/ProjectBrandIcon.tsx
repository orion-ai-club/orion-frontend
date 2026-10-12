import React, { useEffect, useState } from 'react';
import type { PortfolioProject } from '../../types';
import { safeExternalUrl } from '../../utils/security';

interface ProjectBrandIconProps {
  project: PortfolioProject;
  title: string;
  size?: 'card' | 'detail';
}

function getIconCandidates(project: PortfolioProject): string[] {
  const candidates: string[] = [];
  const uploadedIcon = safeExternalUrl(project.iconImage);
  if (uploadedIcon) candidates.push(uploadedIcon);

  // Older portfolio entries predate iconImage. Prefer their own site's
  // favicon over an unrelated cover screenshot or a broken-image placeholder.
  const demo = safeExternalUrl(project.demoUrl);
  if (demo) {
    try {
      const url = new URL(demo);
      const isRepository = /^(www\.)?(github\.com|gitlab\.com|bitbucket\.org)$/i.test(url.hostname);
      if (url.protocol === 'https:' && !isRepository) {
        const favicon = new URL('/favicon.ico', url.origin).href;
        if (!candidates.includes(favicon)) candidates.push(favicon);
      }
    } catch {
      // An invalid demo URL should not break the portfolio.
    }
  }

  return candidates;
}

export const ProjectBrandIcon: React.FC<ProjectBrandIconProps> = ({
  project,
  title,
  size = 'card'
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = getIconCandidates(project);

  useEffect(() => {
    setSourceIndex(0);
  }, [project.iconImage, project.demoUrl]);

  const image = sources[sourceIndex];
  const isDetail = size === 'detail';

  return (
    <div
      className={
        isDetail
          ? 'flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white text-3xl font-black text-primary-700 shadow-lg shadow-slate-900/15 dark:border-slate-600'
          : 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-lg font-black text-primary-700 shadow-sm dark:border-slate-600'
      }
    >
      {image ? (
        <img
          key={image}
          src={image}
          alt={`${title} logo`}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-contain ${isDetail ? 'p-2.5' : 'p-1.5'}`}
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <span
          aria-label={`${title} logo unavailable`}
          className="flex h-full w-full items-center justify-center bg-primary-50 text-primary-700"
        >
          {(title.trim().charAt(0) || 'P').toUpperCase()}
        </span>
      )}
    </div>
  );
};
