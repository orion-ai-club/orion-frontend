import React, { useState } from 'react';
import { BookOpen, ChevronDown, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

// The Code of Love and Honor, exactly as supplied; translations do not alter its text.
const creed = [
  'I am Miami.',
  'I believe that a liberal education is grounded in qualities of character and intellect.',
  'I stand for honesty, integrity, and the importance of moral conduct.',
  'I respect the dignity, rights, and property of others and their right to hold and express disparate beliefs.',
  'I defend the freedom of inquiry that is the heart of learning.',
  'I exercise good judgment and believe in personal responsibility.',
  'I welcome a diversity of people, ideas, and experiences.',
  'I embrace the spirit, academic rigor, opportunities, and challenges of a Miami Experience, preparing me to make the world a better place.',
  'I demonstrate Love and Honor by supporting and caring for my fellow Miamians.',
  'And because I Am Miami, I act through my words and deeds in ways that reflect these values and beliefs.',
  'With a deep sense of accomplishment and gratitude, I will Love, Honor, and make proud those who help me earn the joy and privilege of saying,',
  '“To think that in such a place, I led such a life.”'
];

export const MiamiCreed: React.FC = () => {
  const { language } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isChinese = language.startsWith('zh');

  return (
    <section
      id="miami-creed"
      aria-labelledby="miami-creed-title"
      className="pointer-events-auto mx-auto w-full max-w-6xl px-5 pb-8 pt-12 sm:px-6 sm:pt-20"
    >
      <div className="relative overflow-hidden rounded-[2rem] border border-[#792c43]/20 bg-[#fdfaf7]/95 text-[#222634] shadow-[0_32px_105px_-48px_rgba(31,16,42,0.38)] dark:border-[#d99ca7]/20 dark:bg-[#111927]/95 dark:text-[#f9f4f0] sm:rounded-[2.75rem]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-28 -top-36 h-[420px] w-[420px] rounded-full border border-[#9d475e]/10 dark:border-[#e9a2b0]/10" />
          <div className="absolute -right-14 -top-24 h-[300px] w-[300px] rounded-full border border-[#9d475e]/10 dark:border-[#e9a2b0]/10" />
          <div className="absolute right-16 top-20 h-2 w-2 rounded-full bg-[#a83d59]/50 shadow-[0_0_22px_rgba(179,80,104,0.5)] dark:bg-[#f0a0ad]/70" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#a94e62]/[0.055] blur-3xl dark:bg-[#a94e62]/[0.11]" />
        </div>
        <div className="relative px-6 py-9 sm:px-12 sm:py-14 lg:px-16 lg:py-16">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#7e3d4c]/15 pb-6 dark:border-white/10">
            <div className="flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.16em] text-[#92405a] dark:text-[#efb0bd] sm:text-[13px]">
              <span aria-hidden="true" className="h-px w-7 bg-current" />
              {isChinese ? '信念与传承' : 'Origins / What I Stand For'}
            </div>
            <span className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-400 sm:text-[13px]">
              <Sparkles aria-hidden="true" size={15} /> Miami University · Oxford, Ohio
            </span>
          </div>
          <div className="mx-auto max-w-3xl pb-5 pt-12 text-center sm:pt-16">
            <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.24em] text-[#934a5d] dark:text-[#dba6b0]">
              The Code of Love and Honor
            </p>
            <h2
              id="miami-creed-title"
              className="font-display text-[clamp(3.25rem,8vw,6rem)] font-black leading-[1.06] tracking-[-0.06em] text-slate-950 dark:text-white"
            >
              I Am{' '}
              <span className="font-serif italic font-normal tracking-[-0.07em] text-[#9d344e] dark:text-[#eba1ad]">
                Miami.
              </span>
            </h2>
            <div className="mx-auto my-8 flex items-center justify-center gap-3 text-[#a54460] dark:text-[#efa8b7]">
              <span className="h-px w-12 bg-current opacity-40" />
              <Heart aria-hidden="true" size={17} strokeWidth={1.8} />
              <span className="h-px w-12 bg-current opacity-40" />
            </div>
            <blockquote className="mx-auto max-w-[690px] font-serif text-[clamp(1.55rem,3.2vw,2.5rem)] italic leading-[1.36] tracking-[-0.022em] text-[#302b36] dark:text-[#f2e8e6]">
              “To think that in such a place, I led such a life.”
            </blockquote>
            <p className="mx-auto mt-7 max-w-[590px] text-[15px] leading-7 text-slate-600 dark:text-slate-300 sm:text-[17px] sm:leading-8">
              {isChinese
                ? '来自母校的信念：诚实、独立思考、个人责任，以及对不同声音的尊重。它们塑造了我，也将继续伴随我前行。'
                : 'A code I carry beyond campus: honesty, freedom of inquiry, personal responsibility, and respect for others.'}
            </p>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="miami-creed-full-text"
              onClick={() => setExpanded((prev) => !prev)}
              className="group mx-auto mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#aa6375]/40 bg-[#a23d58] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(151,43,73,0.65)] transition-colors hover:bg-[#862e49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a23d58] dark:border-[#f2aab8]/25 dark:bg-[#a94461] dark:hover:bg-[#bf5773]"
            >
              <BookOpen aria-hidden="true" size={17} />
              {expanded
                ? isChinese
                  ? '收起完整宣言'
                  : 'Close the Creed'
                : isChinese
                  ? '阅读完整宣言'
                  : 'Read the Full Creed'}
              <ChevronDown
                aria-hidden="true"
                size={17}
                className={`transition-transform duration-300 motion-reduce:transition-none ${expanded ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}
              />
            </button>
          </div>
          <div
            id="miami-creed-full-text"
            hidden={!expanded}
            className="mx-auto mt-8 max-w-[750px] border-t border-[#7e3d4c]/20 pt-9 dark:border-white/15"
          >
            <div className="mb-8 flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-[#9d445b]/45" />
              <h3 className="text-center font-serif text-xl font-semibold text-[#81344a] dark:text-[#e7a9b4] sm:text-2xl">
                The Code of Love and Honor
              </h3>
              <div className="h-px w-8 bg-[#9d445b]/45" />
            </div>
            <div className="space-y-5 text-[16px] leading-[1.9] text-[#43414b] dark:text-[#d7d4dc] sm:text-[18px]">
              {creed.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={
                    index === 0 || index === creed.length - 1
                      ? 'text-left font-serif text-[21px] italic text-[#863b53] dark:text-[#eeb2bd] sm:text-[24px]'
                      : 'text-left'
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#7e3d4c]/15 pt-6 text-center sm:flex-row sm:text-left dark:border-white/10">
            <p className="text-[13px] leading-6 text-slate-600 dark:text-slate-400 sm:text-[14px]">
              {isChinese
                ? '致敬我的母校与其 Code of Love and Honor。'
                : 'A personal tribute to my alma mater and its Code of Love and Honor.'}
            </p>
            <span className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#873f55] dark:text-[#eba2b0]">
              Love &amp; Honor
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
