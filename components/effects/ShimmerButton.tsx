/**
 * Adapted from Klyv UI's ShimmerButton (MIT).
 * Source: https://github.com/Klyv-UI/klyv/blob/main/src/components/ShimmerButton/ShimmerButton.tsx
 * Copyright (c) 2026 Klyv contributors. See THIRD_PARTY_NOTICES.md.
 */
import { useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode, type CSSProperties } from 'react';

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  duration?: number;
  glow?: boolean;
}

/** The existing Orion shape, copy and colours are passed through className. */
export function ShimmerButton({
  children, duration = 4, glow = true, className = '',
  onPointerMove, onPointerLeave, ...props
}: ShimmerButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerMove?.(event);
    if (!glow || event.pointerType !== 'mouse') return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--glow-x', String(event.clientX - rect.left) + 'px');
    node.style.setProperty('--glow-y', String(event.clientY - rect.top) + 'px');
    node.style.setProperty('--glow-opacity', '1');
  };
  return (
    <button
      ref={ref}
      type="button"
      className={'orion-shimmer-button ' + className}
      onPointerMove={handlePointerMove}
      onPointerLeave={(event) => {
        ref.current?.style.setProperty('--glow-opacity', '0');
        onPointerLeave?.(event);
      }}
      {...props}
    >
      {glow && <span className="orion-shimmer-glow" aria-hidden="true" />}
      <span
        className="orion-shimmer-sheen"
        style={{ '--shimmer-duration': String(duration) + 's' } as CSSProperties}
        aria-hidden="true"
      />
      <span className="orion-shimmer-content">{children}</span>
    </button>
  );
}
