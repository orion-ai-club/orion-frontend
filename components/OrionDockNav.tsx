import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, House, MapPinned, ShieldCheck, UserRound } from 'lucide-react';
import { PageView } from '../types';

export interface DockLink {
  label: string;
  value: PageView;
  path: string;
  code: string;
}

interface OrionDockNavProps {
  links: DockLink[];
  currentPage: PageView;
  isPrivate: boolean;
}

export function OrionDockNav({ links, currentPage, isPrivate }: OrionDockNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeShape, setActiveShape] = useState<{ left: number; width: number } | null>(null);
  const signature = links.map((item) => item.label + item.path).join('|');

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const element = track.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      if (!element) {
        setActiveShape(null);
        return;
      }
      setActiveShape({ left: element.offsetLeft, width: element.offsetWidth });
    };
    const raf = requestAnimationFrame(measure);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    if (resizeObserver) resizeObserver.observe(track);
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [currentPage, signature]);

  return (
    <nav aria-label="Primary navigation" className={'orion-dock-nav hidden xl:flex' + (isPrivate ? ' is-private' : '')}>
      <div
        className="orion-dock-track"
        ref={trackRef}
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') return;
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--dock-glow-x', String(event.clientX - rect.left) + 'px');
          event.currentTarget.style.setProperty('--dock-glow-y', String(event.clientY - rect.top) + 'px');
        }}
      >
        <span aria-hidden="true" className="orion-dock-track-glow" />
        {activeShape && (
          <span
            aria-hidden="true"
            className="orion-dock-active"
            style={{
              width: activeShape.width + 'px',
              transform: 'translate3d(' + activeShape.left + 'px,0,0)'
            }}
          >
            <span className="orion-dock-active-specular" />
          </span>
        )}
        {links.map((link) => {
          const selected = currentPage === link.value;
          const Icon =
            link.value === PageView.HOME ? House
            : link.value === PageView.BLOG ? BookOpenText
            : link.value === PageView.RESUME ? UserRound
            : link.value === PageView.FOOTPRINT ? MapPinned
            : ShieldCheck;
          return (
            <Link
              key={link.path}
              to={link.path}
              aria-current={selected ? 'page' : undefined}
              className={'orion-dock-link' + (selected ? ' is-active' : '')}
              onPointerMove={(event) => {
                if (event.pointerType !== 'mouse') return;
                const rect = event.currentTarget.getBoundingClientRect();
                const offsetX = (event.clientX - rect.left - rect.width / 2) * 0.07;
                const offsetY = (event.clientY - rect.top - rect.height / 2) * 0.09;
                event.currentTarget.style.setProperty('--magnet-x', offsetX.toFixed(1) + 'px');
                event.currentTarget.style.setProperty('--magnet-y', offsetY.toFixed(1) + 'px');
              }}
              onPointerLeave={(event) => {
                event.currentTarget.style.removeProperty('--magnet-x');
                event.currentTarget.style.removeProperty('--magnet-y');
              }}
            >
              <span className="orion-dock-link-inner">
                <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>{link.label}</span>
              </span>
              <span aria-hidden="true" className="orion-dock-link-dot" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
