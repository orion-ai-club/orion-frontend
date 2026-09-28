import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../../services/api';
import { HotSearchItem, DailyListType } from '../../types';
import { toast } from '../Toast';
import { useTranslation } from '../../i18n/LanguageContext';

const NewsWidgetComponent: React.FC = () => {
  const { t } = useTranslation();

  // Detect mobile: < 768px (md breakpoint). Default closed on mobile.
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<DailyListType>('guonei');

  // Lists Cache
  const [dataLists, setDataLists] = useState<Record<DailyListType, HotSearchItem[]>>({
    hotsearch: [],
    finance: [],
    game: [],
    guonei: [],
    world: []
  });
  const dataListsRef = useRef(dataLists);
  dataListsRef.current = dataLists;

  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Draggable State
  const widgetRef = useRef<HTMLDivElement>(null);
  // Default position: bottom left. Use lazy init for window access.
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      return { x: 20, y: window.innerHeight - 520 };
    }
    return { x: 20, y: 500 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const fetchData = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        // If we already have data and not forced, skip (simple caching)
        if (!force && dataListsRef.current[activeTab].length > 0) {
          setLoading(false);
          return;
        }

        const res = await apiService.getDailyList(activeTab, force);

        setDataLists((prev) => ({
          ...prev,
          [activeTab]: res.list || []
        }));

        // Update timestamp if available, else use current time
        // Ensure we display time part if available, or just standard
        setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        if (force) toast.success(t.privateSpace.hotSearch.updated);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load data.');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, t.privateSpace.hotSearch.updated]
  );

  useEffect(() => {
    if (isOpen) {
      void fetchData();
    }
  }, [isOpen, fetchData]);

  // --- Draggable Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!widgetRef.current) return;
    const target = e.target as HTMLElement;

    // Critical: If clicking a link, do not start drag and do not prevent default
    if (target.closest('a')) return;

    // In expanded mode, only allow drag from header area (the top part), exclude specific controls
    if (isOpen) {
      if (target.closest('button') || target.closest('.no-drag')) return;
    }

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Prevent text selection during drag
    e.preventDefault();
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      if (!isDragging) return;
      setIsDragging(false);

      // Snap Logic
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      // Determine dimensions based on current state
      const widgetWidth = isOpen ? 350 : 56; // 350px vs w-14 (56px)
      const widgetHeight = isOpen ? 500 : 56;

      // 1. Constrain Y to be within viewport (with padding)
      let snappedY = Math.max(80, Math.min(position.y, winHeight - widgetHeight - 20));

      // 2. Snap X to nearest side (Left or Right)
      const centerX = position.x + widgetWidth / 2;
      let snappedX = 20; // Default Left

      if (centerX > winWidth / 2) {
        snappedX = winWidth - widgetWidth - 20; // Right Snap
      }

      setPosition({ x: snappedX, y: snappedY });
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isOpen, position]);

  const currentList = dataLists[activeTab];

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <i className="fas fa-trophy text-yellow-500"></i>;
      case 1:
        return <i className="fas fa-medal text-slate-400"></i>;
      case 2:
        return <i className="fas fa-medal text-amber-700"></i>;
      default:
        return <span className="font-mono text-slate-300 w-4 text-center">{index + 1}</span>;
    }
  };

  // Minimized State
  if (!isOpen) {
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        style={{ left: position.x, top: position.y }}
        className="fixed z-[100] cursor-grab active:cursor-grabbing touch-none transition-all duration-300 ease-out"
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md shadow-2xl border-2 border-blue-400 text-blue-500 flex items-center justify-center hover:scale-110 transition-all hover:bg-blue-50 group"
          title={t.privateSpace.hotSearch.title}
        >
          <i className="fas fa-newspaper text-2xl group-hover:animate-pulse"></i>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
        </button>
      </div>
    );
  }

  // Expanded State
  return (
    <div
      ref={widgetRef}
      onPointerDown={handlePointerDown}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[100] w-[350px] h-[500px] flex flex-col bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-100 animate-slide-up overflow-hidden cursor-grab active:cursor-grabbing touch-none transition-transform duration-75"
    >
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100 p-4 relative">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <i
                className={`fas ${activeTab === 'hotsearch' ? 'fa-fire' : activeTab === 'finance' ? 'fa-chart-line' : activeTab === 'game' ? 'fa-gamepad' : 'fa-globe'}`}
              ></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-none">
                {t.privateSpace.hotSearch.title}
              </h3>
              <p className="text-[9px] text-blue-400 font-mono mt-0.5">
                {lastUpdate
                  ? `${t.privateSpace.hotSearch.updated} ${lastUpdate}`
                  : t.privateSpace.hotSearch.loading}
              </p>
            </div>
          </div>
          <div className="flex gap-2 no-drag">
            <button
              onClick={() => fetchData(true)}
              className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm border border-slate-100"
            >
              <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin' : ''}`}></i>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center transition-colors shadow-md shadow-blue-200"
            >
              <i className="fas fa-compress-alt text-xs"></i>
            </button>
          </div>
        </div>

        {/* Tabs - Reordered: Domestic -> World -> Finance -> Game -> Hot Trends */}
        <div
          className="flex bg-slate-100 p-1 rounded-xl no-drag overflow-x-auto gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setActiveTab('guonei')}
            className={`flex-1 min-w-[3rem] py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${activeTab === 'guonei' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.privateSpace.hotSearch.guonei}
          </button>
          <button
            onClick={() => setActiveTab('world')}
            className={`flex-1 min-w-[3rem] py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${activeTab === 'world' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.privateSpace.hotSearch.world}
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`flex-1 min-w-[3rem] py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${activeTab === 'finance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.privateSpace.hotSearch.finance}
          </button>
          <button
            onClick={() => setActiveTab('game')}
            className={`flex-1 min-w-[3rem] py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${activeTab === 'game' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.privateSpace.hotSearch.game}
          </button>
          <button
            onClick={() => setActiveTab('hotsearch')}
            className={`flex-1 min-w-[3rem] py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${activeTab === 'hotsearch' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.privateSpace.hotSearch.hot}
          </button>
        </div>
      </div>

      {/* List Content */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-white/50 cursor-default"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {loading && currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-blue-300 gap-2">
            <i className="fas fa-circle-notch fa-spin text-2xl"></i>
            <span className="text-xs uppercase tracking-widest">
              {t.privateSpace.hotSearch.loading}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {currentList.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 transition-all group/item cursor-pointer border border-transparent hover:border-blue-100"
              >
                <div className="flex items-center justify-center w-5 shrink-0 font-bold text-sm">
                  {getRankIcon(index)}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-medium truncate ${index < 3 ? 'text-slate-800 font-bold' : 'text-slate-600'}`}
                  >
                    {item.title}
                  </div>
                  {item.hot && (
                    <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <i className="fas fa-chart-bar text-[8px]"></i> {item.hot}
                    </div>
                  )}
                </div>
                <i className="fas fa-chevron-right text-[10px] text-slate-300 opacity-0 group-hover/item:opacity-100 transition-opacity"></i>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const NewsWidget = React.memo(NewsWidgetComponent);
