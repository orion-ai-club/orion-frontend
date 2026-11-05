import React, { useRef, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { PageView } from '../types';
import { createPortal } from 'react-dom';
import { LikeButton } from './LikeButton';
import { LinkedInBadge } from './LinkedInBadge';

// --- Star Compass Component ---
const StarCompass = () => {
  const [rotation, setRotation] = useState(0);
  const compassRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!compassRef.current) return;
    const rect = compassRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle in radians
    const radians = Math.atan2(e.clientX - centerX, -(e.clientY - centerY));
    // Convert to degrees
    const degree = radians * (180 / Math.PI);
    setRotation(degree);
  };

  return (
    <div className="bg-[#0b0f19] dark:bg-slate-950/40 rounded-3xl p-8 border border-slate-800/80 shadow-2xl relative max-w-sm mx-auto select-none">
      <div
        ref={compassRef}
        onMouseMove={handleMouseMove}
        className="relative w-64 h-64 md:w-72 md:h-72 mx-auto group cursor-crosshair"
      >
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-700/50 dark:border-slate-800/60 opacity-60 group-hover:opacity-100 transition-opacity"></div>
        <div className="absolute inset-2 rounded-full border border-dashed border-primary-500/30 group-hover:border-primary-500/60 transition-colors animate-[spin_60s_linear_infinite]"></div>

        {/* Labels */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-slate-500">
          N
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-slate-500">
          S
        </div>
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
          W
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
          E
        </div>

        {/* Rotating Needle Container */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-100 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Needle */}
          <div className="relative w-8 h-full">
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[60px] border-b-primary-500 drop-shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[60px] border-t-slate-700"></div>
            {/* Center Cap */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 dark:bg-white rounded-full border-2 border-primary-500 z-10"></div>
          </div>
        </div>

        {/* Hover Label */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono text-primary-500 uppercase tracking-widest whitespace-nowrap">
          Interstellar Compass
        </div>
      </div>
    </div>
  );
};

interface ResumeViewProps {
  onNavigate: (page: PageView) => void;
}

export const ResumeView: React.FC<ResumeViewProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [showSpecs, setShowSpecs] = useState(false);

  const sections = t.resume.websiteIntro.sections as any;
  const aboutCards = [
    {
      label: t.resume.aboutCard1Label,
      title: t.resume.aboutCard1Title,
      body: t.resume.aboutP1,
      icon: 'fa-bullseye'
    },
    {
      label: t.resume.aboutCard2Label,
      title: t.resume.aboutCard2Title,
      body: t.resume.aboutP2,
      icon: 'fa-layer-group'
    },
    {
      label: t.resume.aboutCard3Label,
      title: t.resume.aboutCard3Title,
      body: t.resume.aboutP3,
      icon: 'fa-compass'
    }
  ];

  return (
    <div className="container mx-auto px-6 py-12 pt-20 max-w-5xl animate-fade-in relative z-10">
      {/* 1. Header & Identity */}
      <div className="mb-10 text-center">
        <div className="inline-block p-3 rounded-full bg-gradient-to-tr from-primary-400 to-primary-600 mb-4 shadow-[0_0_20px_rgba(var(--color-primary-500),0.25)]">
          <i className="fas fa-user-astronaut text-2xl text-white"></i>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
          Sam <span className="text-primary-500">Yao</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-light max-w-3xl mx-auto leading-relaxed mb-2">
          {t.resume.bio}
        </p>
        <p className="text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-3xl mx-auto">
          {t.resume.credentials}
        </p>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 text-slate-400">
          <span className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
            <i className="fas fa-map-marker-alt text-primary-500"></i> {t.resume.basedIn}
          </span>
          <span className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
            <i className="fas fa-code text-primary-500"></i> Full Stack
          </span>
          <span className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
            <i className="fas fa-chart-line text-primary-500"></i> Trader
          </span>
        </div>

        {/* About Sam - concise, editorial introduction */}
        {t.resume.aboutP1 && (
          <section className="mx-auto mt-10 text-left" aria-labelledby="about-sam-title">
            <div className="relative overflow-hidden rounded-[2rem] border border-primary-100/80 bg-white/70 p-6 shadow-[0_28px_80px_-55px_rgba(79,70,229,.38)] backdrop-blur-xl dark:border-primary-400/15 dark:bg-slate-950/60 dark:shadow-[0_28px_90px_-55px_rgba(0,0,0,.95)] md:p-9">
              <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-primary-300/20 blur-3xl dark:bg-primary-400/10"></div>
              <div className="relative grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
                <div>
                  <p className="mb-3 font-mono text-[10px] font-black uppercase tracking-[.3em] text-primary-600 dark:text-primary-400">
                    {t.resume.aboutEyebrow}
                  </p>
                  <h2
                    id="about-sam-title"
                    className="font-serif text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-4xl"
                  >
                    {t.resume.aboutTitle}
                  </h2>
                  <p className="mt-4 text-lg font-light leading-8 text-slate-600 dark:text-slate-300">
                    {t.resume.aboutSubtitle}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {['React & TypeScript', 'Node.js & Cloud', 'Product ownership'].map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-[11px] font-bold text-primary-700 dark:border-primary-400/15 dark:bg-primary-400/5 dark:text-primary-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-primary-100/80 dark:divide-slate-800">
                  {aboutCards.map((card, index) => (
                    <article
                      key={card.label}
                      className="group grid grid-cols-[2.5rem_1fr] gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 transition group-hover:bg-primary-600 group-hover:text-white dark:bg-slate-900 dark:text-primary-400 dark:group-hover:bg-primary-400 dark:group-hover:text-slate-950">
                        <i className={`fas ${card.icon}`}></i>
                      </span>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[9px] font-black uppercase tracking-[.18em] text-primary-500 dark:text-primary-500">
                            0{index + 1}
                          </span>
                          <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                            {card.title}
                          </h3>
                        </div>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {card.body}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="relative mt-7 flex items-center justify-between border-t border-primary-100/80 pt-5 dark:border-slate-800">
                <p className="text-xs text-slate-400">
                  Auckland · Open to software engineering opportunities
                </p>
                <LikeButton />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 2. Site Introduction / Features Grid (REDESIGNED BENTO GRID) */}
      <div className="mb-24 relative">
        {/* Section Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
          <div className="px-4 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {t.resume.siteIntro.title}
            </h2>
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* CARD 1: JOURNAL */}
          <div
            onClick={() => onNavigate(PageView.BLOG)}
            className="group relative flex flex-col justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-800/80 shadow-md hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 cursor-pointer overflow-hidden"
          >
            {/* Top gradient highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-400 to-primary-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

            {/* Subtle background glow */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-primary-400/10 blur-3xl group-hover:bg-primary-400/20 transition-all duration-500"></div>

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg mb-6 group-hover:scale-110 transition-transform duration-500">
                <i className="fas fa-pen-nib"></i>
              </div>
              <h3 className="text-xl font-bold font-serif text-slate-800 dark:text-white mb-3 tracking-tight group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors duration-300">
                {t.resume.siteIntro.journalTitle}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-light mb-8">
                {t.resume.siteIntro.journalDesc}
              </p>
            </div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 group-hover:bg-primary-500 group-hover:text-white group-hover:border-transparent transition-all duration-300">
                <span>Read Logs</span>{' '}
                <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1 duration-300"></i>
              </span>
            </div>
          </div>

          {/* CARD 2: PROFILE/RESUME */}
          <div
            onClick={() => onNavigate(PageView.RESUME)}
            className="group relative flex flex-col justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-800/80 shadow-md hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 cursor-pointer overflow-hidden"
          >
            {/* Top gradient highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-400 to-primary-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

            {/* Subtle background glow */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-primary-400/10 blur-3xl group-hover:bg-primary-400/20 transition-all duration-500"></div>

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg mb-6 group-hover:scale-110 transition-transform duration-500">
                <i className="fas fa-history"></i>
              </div>
              <h3 className="text-xl font-bold font-serif text-slate-800 dark:text-white mb-3 tracking-tight group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors duration-300">
                {t.resume.siteIntro.profileTitle}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-light mb-8">
                {t.resume.siteIntro.profileDesc}
              </p>
            </div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 group-hover:bg-primary-500 group-hover:text-white group-hover:border-transparent transition-all duration-300">
                <span>Access Archives</span>{' '}
                <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1 duration-300"></i>
              </span>
            </div>
          </div>

          {/* CARD 3: PROJECTS (replaces retired human chat) */}
          <div
            onClick={() => onNavigate(PageView.RESUME)}
            className="group relative flex flex-col justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-800/80 shadow-md hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 cursor-pointer overflow-hidden"
          >
            {/* Top gradient highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-400 to-primary-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

            {/* Subtle background glow */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-primary-400/10 blur-3xl group-hover:bg-primary-400/20 transition-all duration-500"></div>

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg mb-6 group-hover:scale-110 transition-transform duration-500">
                <i className="fas fa-code-branch"></i>
              </div>
              <h3 className="text-xl font-bold font-serif text-slate-800 dark:text-white mb-3 tracking-tight group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors duration-300">
                Projects & Engineering
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-light mb-8">
                Explore the systems, tools and products I build.
              </p>
            </div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 group-hover:bg-primary-500 group-hover:text-white group-hover:border-transparent transition-all duration-300">
                <span>Explore Projects</span>{' '}
                <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1 duration-300"></i>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Replaced Section: Star Compass & Contact */}
      <div className="grid md:grid-cols-2 gap-12 border-t border-slate-200 dark:border-slate-800 pt-20">
        <div className="flex flex-col items-center justify-center order-2 md:order-1">
          <StarCompass />

          {/* Orion Explanation */}
          <div className="mt-12 text-center max-w-md mx-auto bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-primary-500/10 shadow-xl">
            <div className="mb-4">
              <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white uppercase tracking-widest inline-block border-b-2 border-primary-500 pb-1">
                Orion
              </h3>
              <p className="text-xs font-mono text-slate-400 mt-2">/əˈraɪən/</p>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 font-light leading-relaxed">
              <p>
                <strong className="text-primary-600 dark:text-primary-500">Or</strong>{' '}
                {t.resume.orion.etymology1} +{' '}
                <strong className="text-primary-600 dark:text-primary-500">Orion</strong>{' '}
                {t.resume.orion.etymology2}
              </p>
              <p className="opacity-90">{t.resume.orion.description}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-900 dark:text-white">
                {t.resume.orion.slogan}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-12 order-1 md:order-2 flex flex-col justify-center">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">
              Contact
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="mailto:moviegoer24@gmail.com"
                  className="group flex items-center gap-4 text-slate-600 dark:text-slate-400 hover:text-primary-500 transition-colors bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-500/30 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <i className="fas fa-envelope text-sm"></i>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Email
                    </span>
                    <span className="text-sm font-mono font-bold truncate">
                      moviegoer24@gmail.com
                    </span>
                  </div>
                </a>
                <a
                  href="https://github.com/yaohuangguan"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-4 text-slate-600 dark:text-slate-400 hover:text-primary-500 transition-colors bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-500/30 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <i className="fab fa-github text-sm"></i>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      GitHub
                    </span>
                    <span className="text-sm font-mono font-bold truncate">
                      github.com/yaohuangguan
                    </span>
                  </div>
                </a>
              </div>

              {/* LinkedIn Badge Embed */}
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-sky-500/30 transition-all">
                <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <i className="fab fa-linkedin text-sky-600 dark:text-sky-400 text-sm"></i>
                  <span>LinkedIn Profile</span>
                </div>
                <LinkedInBadge />
              </div>
            </div>
          </section>

          {/* New Website Introduction Section */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">
              {t.resume.websiteIntro.title}
            </h2>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-light mb-6">
                {t.resume.websiteIntro.description}
              </p>
              <button
                onClick={() => setShowSpecs(true)}
                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:text-primary-500 dark:hover:text-primary-400 hover:border-primary-500 dark:hover:border-primary-500 transition-all flex items-center gap-2 group"
              >
                <i className="fas fa-sitemap group-hover:animate-pulse"></i>
                {t.resume.websiteIntro.viewSpecs}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* System Specs Modal */}
      {showSpecs &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0f172a] w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowSpecs(false)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors z-20"
              >
                <i className="fas fa-times text-lg"></i>
              </button>

              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                  {t.resume.websiteIntro.modalTitle}
                </h2>
                <p className="text-sm text-slate-500 font-mono mt-2 uppercase tracking-wider">
                  Architecture & Capabilities
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-[#0f172a]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Public Sector */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-xl shadow-sm">
                        <i className="fas fa-globe"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                          {sections.public.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sections.public.desc}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {sections.public.features.map((feat: string, i: number) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <i className="fas fa-check text-primary-500 mt-1"></i>
                          <span dangerouslySetInnerHTML={{ __html: feat }} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Private Space */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-xl shadow-sm">
                        <i className="fas fa-user-secret"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                          {sections.private.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sections.private.desc}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {sections.private.features.map((feat: string, i: number) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <i className="fas fa-lock text-rose-500 mt-1"></i>
                          <span dangerouslySetInnerHTML={{ __html: feat }} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Admin */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xl shadow-sm">
                        <i className="fas fa-cogs"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                          {sections.admin.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sections.admin.desc}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {sections.admin.features.map((feat: string, i: number) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <i className="fas fa-shield-alt text-slate-500 mt-1"></i>
                          <span dangerouslySetInnerHTML={{ __html: feat }} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tech Stack */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-xl shadow-sm">
                        <i className="fas fa-layer-group"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                          {sections.stack.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Core Technologies
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sections.stack.list.map((tech: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
