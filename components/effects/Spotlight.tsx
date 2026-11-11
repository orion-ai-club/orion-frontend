/**
 * Adapted from Kevin Girelli's Corsair UI Spotlight (MIT).
 * Source: https://github.com/KevinGirelli/corsair-ui/blob/main/registry/default/ui/spotlight.tsx
 * Copyright (c) 2026 Kevin Girelli. See THIRD_PARTY_NOTICES.md.
 *
 * Native div version avoids a new Radix dependency, preserving the original
 * rAF cursor tracking, layered light, and masked edge ring.
 */
import { useEffect, useRef, type ComponentProps, type CSSProperties } from 'react';

const RING_MASK = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';

interface SpotlightProps extends ComponentProps<'div'> {
  size?: number;
  color?: string;
  ring?: boolean;
}

export function Spotlight({
  size = 320, color = 'rgb(250 191 87)', ring = true,
  className = '', children, onPointerMove, ...props
}: SpotlightProps) {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const circle = String(size) + 'px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%)';
  const ringStyle: CSSProperties = {
    background: 'radial-gradient(' + circle + ', color-mix(in oklab, ' + color + ' 52%, transparent), transparent 64%)',
    mask: RING_MASK,
    maskComposite: 'exclude',
    WebkitMask: RING_MASK,
    WebkitMaskComposite: 'xor'
  };

  return (
    <div
      className={'orion-spotlight relative isolate ' + className}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (event.pointerType !== 'mouse' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const target = event.currentTarget;
        const clientX = event.clientX, clientY = event.clientY;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          target.style.setProperty('--spotlight-x', String(clientX - rect.left) + 'px');
          target.style.setProperty('--spotlight-y', String(clientY - rect.top) + 'px');
        });
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="orion-spotlight-light"
        style={{ background: 'radial-gradient(' + circle + ', color-mix(in oklab, ' + color + ' 16%, transparent), transparent 74%)' }}
      />
      {ring && <span aria-hidden="true" className="orion-spotlight-ring" style={ringStyle} />}
      {children}
    </div>
  );
}
