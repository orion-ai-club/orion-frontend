import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Theme, PageView, User, AuditLog, PERM_KEYS, can, Language } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../services/core';
import { Menu, X } from 'lucide-react';
import { OrionDockNav } from './OrionDockNav';
import { OrionMobileNav } from './OrionMobileNav';

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
  setPage: (page: PageView) => void; // Deprecated but kept for type compat if needed temporarily
  currentPage: PageView;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

// Using flagcdn for stable, high-quality flag assets
const getFlagUrl = (code: string) => `https://flagcdn.com/w40/${code}.png`;

const LANGUAGES: { code: Language; label: string; flags: string[] }[] = [
  { code: 'en', label: 'English', flags: ['us', 'gb'] },
  { code: 'zh', label: '简体中文', flags: ['cn'] },
  { code: 'zh-HK', label: '繁體中文', flags: ['hk'] },
  { code: 'fr', label: 'Français', flags: ['fr'] },
  { code: 'ja', label: '日本語', flags: ['jp'] },
  { code: 'ru', label: 'Русский', flags: ['ru'] },
  { code: 'de', label: 'Deutsch', flags: ['de'] },
  { code: 'es', label: 'Español', flags: ['es'] }
];

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  currentPage,
  currentUser,
  onLogin,
  onLogout
}) => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Language Menu State
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { t, language, setLanguage } = useTranslation();

  // Notification UX remains driven by the authenticated Worker audit feed.
  // The human-chat Socket.IO connection is intentionally removed.

  // Worker CRUD records are persisted in MongoDB and polled by ObjectId cursor.
  // Worker events do not require a persistent socket connection.
  useEffect(() => {
    if (!can(currentUser, PERM_KEYS.SYSTEM_LOGS)) return;

    let stopped = false;
    let inFlight = false;
    let cursor: string | null = null;
    const seenIds = new Set<string>();

    const poll = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const query = cursor ? '?after=' + encodeURIComponent(cursor) : '';
        const response = await fetch(API_BASE_URL + '/audit/worker-events' + query, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;

        const payload: {
          events?: Array<{ id: string; message: string; timestamp: string; log: AuditLog }>;
          cursor?: string | null;
        } = await response.json();
        if (stopped) return;
        const events = Array.isArray(payload.events) ? payload.events : [];
        const fresh = events.filter((item) => {
          if (!item || typeof item.id !== 'string' || seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });
        if (typeof payload.cursor === 'string') cursor = payload.cursor;
        if (fresh.length > 0) {
          setNotifications((previous) =>
            [
              ...fresh.reverse().map((item) => ({
                type: 'audit',
                message: item.message,
                timestamp: new Date(item.timestamp),
                payload: { message: item.message, log: item.log }
              })),
              ...previous
            ].slice(0, 100)
          );
          setUnreadCount((count) => count + fresh.length);
        }
        // Keep a bounded dedupe set; the cursor carries long-term progress.
        if (seenIds.size > 200) {
          for (const id of [...seenIds].slice(0, seenIds.size - 100)) seenIds.delete(id);
        }
      } catch {
        // Lost connectivity never discards the cursor. A later poll catches up.
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 8_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [currentUser]);

  // OPTIMIZATION: Throttled scroll listener
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close Language Menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    if (isLangMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangMenuOpen]);

  // Close the mobile dock on navigation, Escape, or an outside click.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setIsMobileOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [isMobileOpen]);

  const handleClearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
  };

  const canAccessPrivateSpace = can(currentUser, PERM_KEYS.PRIVATE_ACCESS);

  const navLinks = [
    { label: t.header.home, value: PageView.HOME, path: '/', code: '01' },
    { label: t.header.blog, value: PageView.BLOG, path: '/blogs', code: '02' },
    { label: t.header.about, value: PageView.RESUME, path: '/profile', code: '03' }
  ];

  if (currentUser) {
    if (can(currentUser, PERM_KEYS.FOOTPRINT_USE)) {
      navLinks.push({
        label: t.header.footprint,
        value: PageView.FOOTPRINT,
        path: '/footprints',
        code: '04'
      });
    }
  }

  if (canAccessPrivateSpace) {
    navLinks.push({
      label: t.header.privateSpace,
      value: PageView.PRIVATE_SPACE,
      path: '/captain-cabin/journal-space',
      code: '00'
    });
  }

  const isPrivate = location.pathname.startsWith('/captain-cabin');

  // Keep the cabin theme intact; the public pages use a floating glass dock.
  const headerClasses = isPrivate
    ? 'fixed w-full top-0 z-[2000] bg-white/90 border-b border-rose-200 backdrop-blur-md py-3 shadow-sm shadow-rose-100/50'
    : 'orion-dock-header fixed w-full z-[2000]' + (isScrolled ? ' is-scrolled' : '');
  return (
    <header ref={headerRef} className={headerClasses}>
      {/* Removed max-w-[1600px] to occupy full screen width as requested */}
      <div className={isPrivate ? "w-full px-6 md:px-12 mx-auto flex justify-between items-center relative" : "orion-dock-shell"}>
        {/* The original routes, auth and utility controls remain connected. */}
        {/* Logo - Redesigned to be native CSS composition */}
        <Link to="/" className="flex items-center gap-3 cursor-pointer group z-20 relative mr-auto">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Glow Backing */}
            <div
              className={`absolute inset-0 rounded-xl blur-md transition-all duration-500 ${isPrivate ? 'bg-rose-400/60 group-hover:bg-rose-500/80' : 'bg-primary-500/20 group-hover:bg-primary-500/40'}`}
            ></div>

            {/* Main Icon Frame */}
            <div
              className={`relative w-full h-full rounded-xl border flex items-center justify-center backdrop-blur-md overflow-hidden transition-all duration-300 shadow-inner ${
                isPrivate
                  ? 'bg-rose-50 border-rose-200 group-hover:border-rose-300'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 group-hover:border-primary-500/50'
              }`}
            >
              {isPrivate ? (
                <i className="fas fa-heart text-sm text-rose-500 animate-pulse"></i>
              ) : (
                // Native CSS "Fusion" Icon
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Background Radial Tint */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-500 to-transparent"></div>

                  {/* Static Orbital Ring */}
                  <div className="absolute inset-1.5 rounded-full border border-primary-500/30 dark:border-primary-400/30 group-hover:scale-110 transition-transform duration-500"></div>

                  {/* Spinning Dashed Ring */}
                  <div className="absolute inset-2 rounded-full border border-dashed border-primary-500/60 dark:border-primary-400/60 animate-[spin_10s_linear_infinite]"></div>

                  {/* Center Diamond Core */}
                  <div className="relative z-10 w-2.5 h-2.5 bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 rounded-sm rotate-45 shadow-sm group-hover:rotate-[225deg] transition-transform duration-700"></div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <span
              className={`font-display text-xl tracking-widest uppercase transition-colors duration-300 leading-none ${isPrivate ? 'text-rose-600 group-hover:text-rose-500 font-bold' : 'text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 font-bold'}`}
            >
              Orion
            </span>
            {!isPrivate && (
              <span className="text-[7px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] hidden sm:block group-hover:text-primary-500/70 transition-colors mt-0.5">
                Navigate Value
              </span>
            )}
          </div>
        </Link>

        <OrionDockNav links={navLinks} currentPage={currentPage} isPrivate={isPrivate} />
        {/* Actions */}
        <div className="orion-dock-actions flex items-center gap-1.5 sm:gap-2 relative z-50">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
              theme === Theme.DARK
                ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/30'
                : 'text-amber-500 bg-amber-50 hover:bg-amber-100/50 shadow-sm shadow-amber-500/10 border border-amber-100/50'
            }`}
            aria-label="Toggle Theme"
            title={
              theme === Theme.DARK
                ? 'Turn On the Lights (Light Mode)'
                : 'Turn Off the Lights (Dark Mode)'
            }
          >
            <i
              className={`${theme === Theme.DARK ? 'far' : 'fas'} fa-lightbulb text-base transition-transform duration-300 hover:scale-105 active:scale-95`}
            ></i>
          </button>

          {/* Redesigned Language Switcher Pill */}
          <div
            className={`
              hidden sm:flex items-center p-0.5 rounded-full border shadow-sm transition-all duration-300 relative orion-dock-language
              ${
                isPrivate
                  ? 'bg-white/80 border-rose-200 text-rose-600'
                  : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }
            `}
            ref={langMenuRef}
          >
            {/* EN Button */}
            <button
              onClick={() => setLanguage('en')}
              className={`
                px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-300
                ${
                  language === 'en'
                    ? isPrivate
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-primary-500 text-white shadow-sm shadow-primary-500/20'
                    : isPrivate
                      ? 'hover:bg-rose-50 text-slate-600'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400'
                }
              `}
              title="English"
            >
              EN
            </button>

            {/* CN/ZH Button */}
            <button
              onClick={() => setLanguage('zh')}
              className={`
                px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-300
                ${
                  language === 'zh'
                    ? isPrivate
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-primary-500 text-white shadow-sm shadow-primary-500/20'
                    : isPrivate
                      ? 'hover:bg-rose-50 text-slate-600'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400'
                }
              `}
              title="简体中文"
            >
              中
            </button>

            {/* Vertical Divider */}
            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-1"></div>

            {/* Dropdown Toggle Button */}
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className={`
                p-1.5 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group
                ${isLangMenuOpen ? (isPrivate ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 dark:bg-slate-700/50 text-primary-500') : isPrivate ? 'hover:bg-rose-50' : 'hover:bg-slate-100 dark:hover:bg-white/5'}
              `}
              title="More Languages"
            >
              <i className="fas fa-globe text-xs opacity-75"></i>
              <i
                className={`fas fa-chevron-down text-[8px] opacity-60 ml-1 transition-transform duration-300 ${isLangMenuOpen ? 'rotate-180' : ''}`}
              ></i>
            </button>

            {/* Dropdown Menu (Excludes 'en' and 'zh') */}
            {isLangMenuOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-48 py-2 rounded-2xl shadow-xl border backdrop-blur-xl animate-fade-in z-50 overflow-hidden ${
                  isPrivate
                    ? 'bg-white/95 border-rose-200 shadow-rose-200/50'
                    : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200 dark:border-slate-700/50'
                }`}
              >
                {LANGUAGES.filter((lang) => lang.code !== 'en' && lang.code !== 'zh').map(
                  (lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between group transition-colors ${
                        isPrivate
                          ? 'hover:bg-rose-50 text-slate-600 hover:text-rose-600'
                          : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400'
                      } ${language === lang.code ? (isPrivate ? 'bg-rose-50/50 text-rose-600' : 'bg-slate-50 dark:bg-white/5 text-primary-600 dark:text-primary-400') : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-1.5">
                          {lang.flags.map((f) => (
                            <img
                              key={f}
                              src={getFlagUrl(f)}
                              className="w-5 h-5 rounded-full object-cover border border-white dark:border-slate-800 shadow-sm relative z-0 group-hover:z-10 transition-all"
                              alt={f}
                            />
                          ))}
                        </div>
                        <span>{lang.label}</span>
                      </div>
                      {language === lang.code && <i className="fas fa-check text-[10px]"></i>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-8 h-8 flex items-center justify-center transition-colors relative ${isPrivate ? 'text-rose-700 hover:text-rose-900' : 'text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400'}`}
              >
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
              </button>

              {/* Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-4 w-72 animate-fade-in z-50">
                  <div
                    className={`backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden ${isPrivate ? 'bg-white/95 border-rose-200 shadow-rose-200/50' : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200 dark:border-slate-700/50'}`}
                  >
                    <div
                      className={`p-3 border-b flex justify-between items-center ${isPrivate ? 'border-rose-100' : 'border-slate-200 dark:border-slate-700/50'}`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${isPrivate ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        {t.header.notifications}
                      </span>
                      {notifications.length > 0 && (
                        <button
                          onClick={handleClearNotifications}
                          className="text-[10px] text-slate-500 hover:text-red-400"
                        >
                          {t.header.clearAll}
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs italic">
                          {t.header.emptyNotifications}
                        </div>
                      ) : (
                        notifications.map((n, idx) => (
                          <div
                            key={idx}
                            onClick={() => setIsNotifOpen(false)}
                            className={`p-3 border-b text-xs last:border-0 cursor-pointer transition-colors ${
                              isPrivate
                                ? 'border-rose-50 hover:bg-rose-50'
                                : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5'
                            }`}
                          >
                            <div
                              className={`font-bold mb-1 uppercase flex items-center justify-between ${isPrivate ? 'text-rose-700' : 'text-primary-600 dark:text-primary-400'}`}
                            >
                              <span>
                                {n.type === 'private_message' ? 'Private Message' : 'System Alert'}
                              </span>
                              {n.type === 'private_message' && (
                                <i className="fas fa-chevron-right text-[8px] opacity-50"></i>
                              )}
                            </div>
                            <div
                              className={
                                isPrivate ? 'text-slate-600' : 'text-slate-700 dark:text-slate-300'
                              }
                            >
                              {n.message}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {new Date(n.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentUser ? (
            // Logged In Dropdown Menu (Desktop)
            <div
              className={`hidden xl:block relative group border-l pl-4 ${isPrivate ? 'border-rose-200' : 'border-slate-200 dark:border-white/10'}`}
            >
              <button className="flex items-center gap-3 py-1 outline-none min-w-[120px] justify-end">
                <div
                  className={`w-8 h-8 rounded-full p-[1px] ${isPrivate ? 'bg-gradient-to-tr from-rose-300 to-pink-500' : 'bg-gradient-to-tr from-primary-400 to-primary-600'}`}
                >
                  <img
                    src={
                      currentUser.photoURL ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=random`
                    }
                    alt="User"
                    className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900"
                  />
                </div>
                <span
                  className={`text-xs font-mono max-w-[100px] truncate ${isPrivate ? 'text-rose-800 font-bold' : 'text-slate-700 dark:text-primary-500/80 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}
                >
                  {currentUser.displayName}
                </span>
                <i
                  className={`fas fa-chevron-down text-[10px] transition-transform group-hover:rotate-180 ${isPrivate ? 'text-rose-600' : 'text-slate-400 dark:text-slate-300'}`}
                ></i>
              </button>

              {/* Hover Dropdown */}
              <div className="absolute right-0 top-full pt-4 hidden group-hover:block w-56 animate-fade-in z-50">
                <div
                  className={`backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden ${isPrivate ? 'bg-white/95 border-rose-200 shadow-rose-200/50' : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200 dark:border-slate-700/50'}`}
                >
                  <div
                    className={`p-3 border-b ${isPrivate ? 'border-rose-100' : 'border-slate-200 dark:border-slate-700/50'}`}
                  >
                    <p
                      className={`text-xs font-mono uppercase tracking-wider mb-1 ${isPrivate ? 'text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Signed in as
                    </p>
                    <p
                      className={`text-sm font-bold truncate ${isPrivate ? 'text-rose-900' : 'text-slate-900 dark:text-white'}`}
                    >
                      {currentUser.email}
                    </p>
                  </div>

                  <div className="p-1">
                    <Link
                      to="/user-profile"
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${isPrivate ? 'text-rose-700 hover:bg-rose-50 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'}`}
                    >
                      <i className="fas fa-id-card w-4 text-center"></i> {t.header.profile}
                    </Link>

                    {can(currentUser, PERM_KEYS.SYSTEM_ACCESS) && (
                      <Link
                        to="/system-management"
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${isPrivate ? 'text-rose-700 hover:bg-rose-50 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'}`}
                      >
                        <i className="fas fa-server w-4 text-center"></i> {t.header.system}
                      </Link>
                    )}

                    <Link
                      to="/system-settings"
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${isPrivate ? 'text-rose-700 hover:bg-rose-50 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'}`}
                    >
                      <i className="fas fa-cog w-4 text-center"></i> {t.header.settings}
                    </Link>

                    {can(currentUser, PERM_KEYS.SYSTEM_LOGS) && (
                      <Link
                        to="/audit-log"
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${isPrivate ? 'text-rose-700 hover:bg-rose-50 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'}`}
                      >
                        <i className="fas fa-shield-alt w-4 text-center"></i> {t.header.audit}
                      </Link>
                    )}
                  </div>

                  <div
                    className={`p-1 border-t ${isPrivate ? 'border-rose-100 bg-rose-50/50' : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-red-500/5'}`}
                  >
                    <button
                      onClick={onLogout}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 font-medium ${isPrivate ? 'text-rose-600 hover:bg-rose-100 hover:text-rose-800' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300'}`}
                    >
                      <i className="fas fa-sign-out-alt w-4 text-center"></i> {t.header.signOut}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="orion-dock-login hidden xl:flex items-center justify-center gap-2 px-6 py-2 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-widest hover:bg-primary-500 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] min-w-[110px]"
            >
              <i className="fas fa-terminal text-[10px]"></i>
              {t.header.signIn}
            </button>
          )}
          <button
            type="button"
            className="orion-dock-menu-toggle xl:hidden"
            aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileOpen}
            aria-controls="orion-mobile-dock"
            onClick={() => setIsMobileOpen((open) => !open)}
          >
            {isMobileOpen ? <X size={21} strokeWidth={1.9} /> : <Menu size={21} strokeWidth={1.9} />}
          </button>
        </div>
      </div>
      <OrionMobileNav
        open={isMobileOpen}
        links={navLinks}
        currentPage={currentPage}
        currentUser={currentUser}
        language={language}
        languages={LANGUAGES}
        onLanguage={setLanguage}
        onClose={() => setIsMobileOpen(false)}
        onLogin={onLogin}
        onLogout={onLogout}
        labels={{
          signIn: t.header.signIn,
          signOut: t.header.signOut,
          profile: t.header.profile,
          settings: t.header.settings,
          system: t.header.system
        }}
        isPrivate={isPrivate}
      />
    </header>
  );
};
