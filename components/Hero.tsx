import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
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
      className="pointer-events-none relative flex min-h-[75vh] items-center justify-center overflow-hidden px-0 pb-16 pt-28 sm:pb-20 md:pt-36 lg:min-h-[82vh]"
    >
      {/* A quiet orbit motif, visible in both the light and cosmic themes. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[42%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#86435a]/[0.075] dark:border-[#f7b7c5]/[0.09] sm:h-[930px] sm:w-[930px]" />
        <div className="absolute left-1/2 top-[42%] h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#86435a]/[0.06] dark:border-[#f7b7c5]/[0.06] sm:h-[700px] sm:w-[700px]" />
      </div>

      <div className="pointer-events-auto relative z-10 mx-auto w-full max-w-6xl px-5 text-center sm:px-8">
        <div className="mb-7 flex items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#84435b] dark:text-[#edb6c2] sm:mb-10 sm:text-[13px]">
          <span className="h-px w-8 bg-current opacity-55" aria-hidden="true" />
          <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>{isChinese ? 'ORION · 我的数字宇宙' : 'Orion · A Personal Universe'}</span>
          <span className="h-px w-8 bg-current opacity-55" aria-hidden="true" />
        </div>

        <h1
          id="home-hero-title"
          className="mx-auto mb-6 max-w-6xl text-[clamp(3.3rem,9.3vw,8.25rem)] leading-[1.03] tracking-[-0.06em] sm:mb-9"
        >
          <span className="block font-display font-extrabold text-slate-950 dark:text-[#faf8f7] motion-safe:animate-slide-up">
            {t.hero.title1}
          </span>
          <span
            className={`relative mt-1 block pb-2 text-[#903c59] dark:text-[#e9a8b9] motion-safe:animate-slide-up sm:mt-2 sm:pb-4 ${
              isChinese
                ? 'font-serif font-bold not-italic tracking-[-0.075em]'
                : 'font-serif font-semibold italic tracking-[-0.055em]'
            }`}
            style={{ animationDelay: '0.07s' }}
          >
            {t.hero.title2}
          </span>
        </h1>

        <div className="mx-auto mb-7 flex items-center justify-center gap-3 text-[#a15a70] dark:text-[#e6aab8] sm:mb-9">
          <span className="h-px w-12 bg-current opacity-40 sm:w-16" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rotate-45 border border-current bg-current/10"
          />
          <span className="h-px w-12 bg-current opacity-40 sm:w-16" aria-hidden="true" />
        </div>

        <p
          className="mx-auto mb-9 max-w-[760px] font-sans text-[16px] font-normal leading-[1.85] tracking-[-0.01em] text-slate-700 dark:text-slate-300 motion-safe:animate-slide-up sm:mb-11 sm:text-[18px] sm:leading-[1.95]"
          style={{ animationDelay: '0.12s' }}
        >
          {t.hero.introPrefix}
          <strong className="relative mx-1 inline-block font-serif text-[1.12em] font-semibold italic text-[#843a55] dark:text-[#f1afbf]">
            {t.hero.introName}
            <span
              className="absolute bottom-0 left-0 h-px w-full bg-[#9b5068]/45 dark:bg-[#f1afbf]/45"
              aria-hidden="true"
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
            className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-primary-600 px-8 py-3.5 font-sans text-[14px] font-semibold tracking-[0.02em] text-white shadow-[0_14px_26px_-15px_rgba(60,47,156,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 active:translate-y-0 dark:bg-primary-500 dark:text-slate-950 dark:hover:bg-primary-400 sm:w-auto sm:px-9 motion-reduce:transition-none"
          >
            {t.hero.ctaPrimary}
            <ArrowRight
              size={17}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </button>

          <button
            type="button"
            onClick={
              onSecondaryCtaClick ||
              (() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }))
            }
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-300/90 bg-white/55 px-8 py-3.5 font-sans text-[14px] font-semibold tracking-[0.02em] text-slate-800 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#98546a]/45 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 active:translate-y-0 dark:border-white/20 dark:bg-slate-900/55 dark:text-slate-100 dark:hover:border-[#e6aab8]/40 dark:hover:bg-slate-900/80 sm:w-auto sm:px-9 motion-reduce:transition-none"
          >
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  );
};
