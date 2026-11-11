/**
 * Adapted from Elia Kuratli's Text Reveal (MIT).
 * Source: https://github.com/kuratlielia/arc-library/blob/main/public/r/text-reveal.json
 * Copyright (c) 2026 Elia Kuratli. See THIRD_PARTY_NOTICES.md.
 */
import { Fragment, type CSSProperties } from 'react';

interface TextRevealProps {
  text: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
}

/** Subtle word-by-word first-paint reveal, preserving semantic text. */
export function TextReveal({ text, as = 'span', className, delay = 0 }: TextRevealProps) {
  const Tag = as;
  const lines = text.split('\n').map((line) => line.split(/\s+/).filter(Boolean));
  const count = lines.reduce((total, words) => total + words.length, 0);
  const stagger = Math.min(0.105, 0.65 / Math.max(count, 1));
  const blur = as === 'p' ? 3 : 6;
  let index = 0;

  return (
    <Tag
      aria-label={text.replace(/\n/g, ' ')}
      className={['orion-text-reveal', className].filter(Boolean).join(' ')}
      style={{ '--reveal-blur': String(blur) + 'px' } as CSSProperties}
    >
      {lines.map((words, lineIndex) => (
        <Fragment key={lineIndex}>
          <span className="orion-text-reveal-line" aria-hidden="true">
            {words.map((word, wordIndex) => {
              const position = index++;
              return (
                <Fragment key={position}>
                  <span className="orion-text-reveal-clip">
                    <span
                      className="orion-text-reveal-word"
                      style={{ '--reveal-delay': String(delay + position * stagger) + 's' } as CSSProperties}
                    >
                      {word}
                    </span>
                  </span>
                  {wordIndex < words.length - 1 ? ' ' : null}
                </Fragment>
              );
            })}
          </span>
          {lineIndex < lines.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}
