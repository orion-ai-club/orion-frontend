import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';

interface HeroProps {
  onCtaClick: () => void;
  onSecondaryCtaClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCtaClick, onSecondaryCtaClick }) => {
  const { t } = useTranslation();

  return (
    <section className="relative pt-24 pb-16 md:pt-36 md:pb-24 overflow-hidden min-h-[75vh] flex items-center justify-center pointer-events-none">
      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl pointer-events-auto">
        {/* Main Title - Adapts Gradient */}
        <h1 className="font-display font-bold text-6xl md:text-8xl lg:text-9xl tracking-tighter text-slate-900 dark:text-white mb-6 leading-[0.9] animate-slide-up drop-shadow-2xl">
          <span className="block text-slate-900 dark:text-slate-100">{t.hero.title1}</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 dark:from-primary-200 dark:via-primary-500 dark:to-primary-600 animate-gradient-x pb-2">
            {t.hero.title2}
          </span>
        </h1>

        <div className="w-24 h-1 bg-primary-500/50 mx-auto mb-6 rounded-full blur-[1px]"></div>

        <p
          className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed animate-slide-up font-light tracking-wide"
          style={{ animationDelay: '0.1s' }}
        >
          {t.hero.introPrefix}
          <strong className="text-slate-900 dark:text-white font-semibold relative inline-block mx-1">
            {t.hero.introName}
            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-primary-500/50"></span>
          </strong>
          {t.hero.introSuffix}
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <button
            onClick={onCtaClick}
            className="group relative w-full sm:w-auto px-10 py-5 bg-primary-500 text-white font-bold text-sm uppercase tracking-[0.15em] transition-all hover:bg-primary-600 hover:shadow-[0_0_30px_rgba(var(--color-primary-500),0.4)] clip-path-polygon"
          >
            <span className="relative z-10 flex items-center gap-2">
              {t.hero.ctaPrimary}{' '}
              <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </span>
          </button>

          <button
            onClick={
              onSecondaryCtaClick ||
              (() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }))
            }
            className="w-full sm:w-auto px-10 py-5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-sm uppercase tracking-[0.15em] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:border-primary-500/30 transition-all backdrop-blur-sm"
          >
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  );
};
