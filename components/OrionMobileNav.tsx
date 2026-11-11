import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, House, MapPinned, ShieldCheck, UserRound, LogOut, Settings2 } from 'lucide-react';
import { Language, PageView, PERM_KEYS, User, can } from '../types';
import type { DockLink } from './OrionDockNav';

interface DockLanguageOption {
  code: Language;
  label: string;
}

interface OrionMobileNavProps {
  open: boolean;
  links: DockLink[];
  currentPage: PageView;
  currentUser: User | null;
  language: Language;
  languages: DockLanguageOption[];
  onLanguage: (language: Language) => void;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  labels: {
    signIn: string;
    signOut: string;
    profile: string;
    settings: string;
    system: string;
  };
  isPrivate: boolean;
}

export function OrionMobileNav({
  open, links, currentPage, currentUser, language, languages,
  onLanguage, onClose, onLogin, onLogout, labels, isPrivate
}: OrionMobileNavProps) {
  return (
    <div
      id="orion-mobile-dock"
      aria-hidden={!open}
      className={'orion-dock-mobile-panel xl:hidden' + (open ? ' is-open' : '') + (isPrivate ? ' is-private' : '')}
    >
      <div className="orion-dock-mobile-topline">
        <span>EXPLORE THE ORION SYSTEM</span>
        <span>✦ 001 / 003</span>
      </div>
      <nav aria-label="Mobile primary navigation" className="orion-dock-mobile-links">
        {links.map((link, i) => {
          const active = currentPage === link.value;
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
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={'orion-dock-mobile-link' + (active ? ' is-active' : '')}
              style={{ '--dock-order': String(i) } as React.CSSProperties}
            >
              <span className="orion-dock-mobile-link-icon"><Icon size={19} strokeWidth={1.75} /></span>
              <span className="orion-dock-mobile-link-label">{link.label}</span>
              <span className="orion-dock-mobile-link-number">{link.code}</span>
              <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className="orion-dock-mobile-bottom">
        <div className="orion-dock-mobile-language">
          <label htmlFor="orion-dock-language">LANGUAGE</label>
          <select
            id="orion-dock-language"
            aria-label="Select language"
            value={language}
            onChange={(event) => onLanguage(event.target.value as Language)}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </div>

        {currentUser ? (
          <div className="orion-dock-mobile-account">
            <Link to="/user-profile" onClick={onClose}>
              <UserRound size={16} /> {labels.profile}
            </Link>
            <Link to="/system-settings" onClick={onClose}>
              <Settings2 size={16} /> {labels.settings}
            </Link>
            {can(currentUser, PERM_KEYS.SYSTEM_ACCESS) && (
              <Link to="/system-management" onClick={onClose}>
                <ShieldCheck size={16} /> {labels.system}
              </Link>
            )}
            <button onClick={() => { onLogout(); onClose(); }}>
              <LogOut size={16} /> {labels.signOut}
            </button>
          </div>
        ) : (
          <button
            className="orion-dock-mobile-login"
            onClick={() => { onLogin(); onClose(); }}
          >
            <span>{labels.signIn}</span>
            <ArrowUpRight size={17} strokeWidth={1.9} />
          </button>
        )}
      </div>
      <div className="orion-dock-mobile-footer">
        <span>ORION / SAM YAO</span>
        <span>DESIGNED FOR EXPLORATION</span>
      </div>
    </div>
  );
}
