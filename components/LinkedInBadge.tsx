import React from 'react';

const LINKEDIN_URL = 'https://nz.linkedin.com/in/sam-y-54828a140';

export const LinkedInBadge: React.FC = () => {
  return (
    <div className="linkedin-badge-wrapper flex w-full justify-center py-6">
      <a
        href={LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/75 px-5 py-3 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#0a66c2]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
        aria-label="Open Sam Yao on LinkedIn"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a66c2] text-white">
          <i className="fab fa-linkedin-in text-lg" aria-hidden="true"></i>
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Sam Yao
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            View LinkedIn profile
          </span>
        </span>
        <i
          className="fas fa-arrow-up-right-from-square ml-2 text-xs text-slate-400 transition group-hover:text-[#0a66c2]"
          aria-hidden="true"
        ></i>
      </a>
    </div>
  );
};
