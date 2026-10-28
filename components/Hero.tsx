import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface HeroProps {
  onCtaClick: () => void;
  onSecondaryCtaClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCtaClick, onSecondaryCtaClick }) => {
  const { t, language } = useTranslation();
  const isChinese = language.startsWith('zh');

  return (
    <section
      aria-labelledby="home-hero-title"
      className="pointer-events-none relative flex min-h-[75vh] items-center justify-center overflow-hidden pb-16 pt-28 md:min-h-[80vh] md:pb-24 md:pt-36"
    >
      <div className="pointer-events-auto relative z-10 mx-auto w-full max-w-5xl px-5 text-center sm:px-8">
        <div className="mb-7 flex items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-400 sm:mb-10 sm:text-[13px]">
          <span aria-hidden="true" className="h-px w-6 bg-primary-500/50 sm:w-10" />
          <span>{isChinese ? 'ORION · 我的数字宇宙' : 'ORION · A PERSONAL UNIVERSE'}</span>
          <span aria-hidden="true" className="h-px w-6 bg-primary-500/50 sm:w-10" />
        </div>

        <h1
          id="home-hero-title"
          className="mx-auto mb-7 font-display leading-[1.04] tracking-[-0.065em] sm:mb-9"
        >
          <span className="block text-[clamp(3.2rem,9vw,8rem)] font-extrabold text-slate-950 dark:text-slate-50 motion-safe:animate-slide-up">
            {t.hero.title1}
          </span>
          <span
            className={`block pb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700 dark:from-primary-200 dark:via-primary-400 dark:to-primary-600 motion-safe:animate-slide-up ${
              isChinese
                ? 'mt-1 text-[clamp(3.2rem,9vw,8rem)]'
                : 'mt-1 text-[clamp(2.85rem,8vw,7.3rem)] sm:mt-2'
            }`}
            style={{ animationDelay: '0.08s' }}
          >
            {t.hero.title2}
          </span>
        </h1>

        <div
          className="mx-auto mb-8 h-[2px] w-16 rounded-full bg-primary-500/50 dark:bg-primary-400/55 sm:mb-10"
          aria-hidden="true"
        />

        <p
          className="mx-auto mb-9 max-w-[740px] text-[16px] font-normal leading-[1.85] text-slate-700 dark:text-slate-300 motion-safe:animate-slide-up sm:mb-11 sm:text-[18px] sm:leading-[1.85]"
          style={{ animationDelay: '0.12s' }}
        >
          {t.hero.introPrefix}
          <strong className="relative mx-1 inline-block font-semibold text-slate-950 dark:text-white">
            {t.hero.introName}
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-px w-full bg-primary-500/60 dark:bg-primary-400/60"
            />
          </strong>
          {t.hero.introSuffix}
        </p>

        <div
          className="flex flex-col items-center justify-center gap-3 motion-safe:animate-slide-up sm:flex-row sm:gap-4"
          style={{ animationDelay: '0.2s' }}
        >
          <button
            type="button"
            onClick={onCtaClick}
            className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary-600 px-8 py-3.5 text-[14px] font-semibold tracking-[0.02em] text-white shadow-lg shadow-primary-500/15 transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 dark:bg-primary-500 dark:text-slate-950 dark:hover:bg-primary-400 sm:w-auto sm:px-9 motion-reduce:transition-none"
          >
            {t.hero.ctaPrimary}
            <ArrowRight
              aria-hidden="true"
              size={17}
              className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </button>
          <button
            type="button"
            onClick={
              onSecondaryCtaClick ||
              (() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }))
            }
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white/65 px-8 py-3.5 text-[14px] font-semibold tracking-[0.02em] text-slate-800 backdrop-blur-sm transition-colors hover:border-primary-500/50 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 dark:border-slate-600/70 dark:bg-slate-900/55 dark:text-slate-100 dark:hover:border-primary-400/50 dark:hover:bg-slate-800/80 sm:w-auto sm:px-9 motion-reduce:transition-none"
          >
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  );
};
