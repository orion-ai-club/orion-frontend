import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { CountDateWidget, TabType } from '../../components/private/CountDateWidget';
import { NewsWidget } from '../../components/private/HotSearchWidget';
import { AccessRestricted } from '../../components/AccessRestricted';
import { User, PERM_KEYS, can } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

// Import Theme Components (Static)
import { ChristmasTheme } from '../../components/private/themes/ChristmasTheme';
import { NewYearTheme } from '../../components/private/themes/NewYearTheme';

interface PrivateSpaceDashboardProps {
  user: User | null;
}

type HolidayMode = 'CHRISTMAS' | 'CNY' | 'OFF';

export const PrivateSpaceDashboard: React.FC<PrivateSpaceDashboardProps> = ({ user }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab -> Permission Mapping
  const TAB_PERMISSIONS: Record<TabType, string> = {
    JOURNAL: PERM_KEYS.JOURNAL_USE,
    SECOND_BRAIN: PERM_KEYS.BRAIN_USE,
    LEISURE: PERM_KEYS.LEISURE_USE,
    GALLERY: PERM_KEYS.CAPSULE_USE,
    FITNESS: PERM_KEYS.FITNESS_USE
  };

  // Tab -> Route Mapping
  const TAB_ROUTES: Record<TabType, string> = {
    JOURNAL: 'journal-space',
    SECOND_BRAIN: 'ai-space',
    LEISURE: 'leisure-space',
    GALLERY: 'capsule-gallery',
    FITNESS: 'fitness-space'
  };

  // Determine active tab based on URL path
  const currentPath = location.pathname.split('/').pop();
  const activeTab: TabType = useMemo(() => {
    switch (currentPath) {
      case 'ai-space':
        return 'SECOND_BRAIN';
      case 'journal-space':
        return 'JOURNAL';
      case 'leisure-space':
        return 'LEISURE';
      case 'capsule-gallery':
        return 'GALLERY';
      case 'fitness-space':
        return 'FITNESS';
      default:
        return 'JOURNAL';
    }
  }, [currentPath]);

  // Calculate Visible Tabs based on User Permissions
  const visibleTabs = useMemo(() => {
    const allTabs: TabType[] = ['SECOND_BRAIN', 'JOURNAL', 'GALLERY', 'LEISURE', 'FITNESS'];
    return allTabs.filter((tab) => can(user, TAB_PERMISSIONS[tab]));
  }, [user]);

  // Redirect if current tab is not accessible
  useEffect(() => {
    // If visibleTabs is calculated (and not empty) and activeTab is NOT in it
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      // Redirect to the first available tab
      const firstAllowed = visibleTabs[0];
      const route = TAB_ROUTES[firstAllowed];
      navigate(`/captain-cabin/${route}`, { replace: true });
    }
  }, [activeTab, visibleTabs, navigate]);

  const handleTabChange = (tab: TabType) => {
    const path = TAB_ROUTES[tab];
    if (path) navigate(`/captain-cabin/${path}`);
  };

  // --- Auto Holiday Logic ---
  const autoHoliday = useMemo<HolidayMode>(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Christmas: Dec 15 - Dec 30
    if (month === 12 && day >= 15 && day <= 30) return 'CHRISTMAS';

    // CNY: Dec 31 - Feb 20 (Covers until approx Lantern Festival)
    if ((month === 12 && day >= 31) || month === 1 || (month === 2 && day <= 20)) return 'CNY';

    return 'OFF';
  }, []);

  // --- Theme State Initialization ---
  const [manualHoliday, setManualHoliday] = useState<HolidayMode | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('private_theme');
      if (saved && (saved === 'CHRISTMAS' || saved === 'CNY' || saved === 'OFF')) {
        return saved as HolidayMode;
      }
    }
    return null;
  });

  // Determine active holiday
  const activeHoliday = manualHoliday !== null ? manualHoliday : autoHoliday;
  const effectsEnabled = activeHoliday !== 'OFF';

  // Toggle Handler: Cycle through CHRISTMAS -> CNY -> OFF -> CHRISTMAS
  // Save to localStorage on change
  const handleToggleEffects = () => {
    let next: HolidayMode;
    if (activeHoliday === 'CHRISTMAS') next = 'CNY';
    else if (activeHoliday === 'CNY') next = 'OFF';
    else next = 'CHRISTMAS';

    setManualHoliday(next);
    localStorage.setItem('private_theme', next);
  };

  // Fitness tab should scroll with the page, others have fixed internal layouts on desktop
  // Second Brain also has internal scroll
  const isFixedLayout = activeTab !== 'FITNESS';

  // --- Theme Background Logic ---
  const getBackgroundClass = () => {
    if (activeHoliday !== 'OFF') return ''; // Theme component handles it
    return 'bg-gradient-to-br from-pink-200 via-rose-200 to-pink-200 text-slate-900';
  };

  // Permission Check for Together Time Widget
  // Only VIP users or Super Admins can see the special timer. Everyone else sees System Time.
  const canViewTogetherTime = !!(user?.vip || user?.role === 'super_admin');

  // Strict Permission Check for current tab content rendering (Double check)
  const hasTabAccess = can(user, TAB_PERMISSIONS[activeTab]);

  return (
    <div
      className={`
      captains-cabin min-h-screen pt-24 pb-6 px-4 md:px-6 relative flex flex-col gap-6 transition-colors duration-1000 overflow-y-auto
      ${getBackgroundClass()}
    `}
    >
      {/* Keep the knowledge editor free from floating overlays. */}
      {activeTab !== 'SECOND_BRAIN' && <NewsWidget />}

      {/* --- RENDER THEMES --- */}
      {activeHoliday === 'CHRISTMAS' && <ChristmasTheme />}
      {activeHoliday === 'CNY' && <NewYearTheme />}

      {/* Default Floating Hearts Effect (Only when holiday effects are OFF) */}
      {activeHoliday === 'OFF' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-rise-slow opacity-60 will-change-transform"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `-50px`,
                fontSize: `${Math.random() * 30 + 15}px`,
                animationDuration: `${Math.random() * 10 + 10}s`,
                animationDelay: `${Math.random() * 5}s`,
                color: Math.random() > 0.5 ? '#f43f5e' : '#fb7185',
                textShadow: '0 0 10px rgba(244,63,94,0.3)'
              }}
            >
              ❤
            </div>
          ))}
        </div>
      )}

      {/* Top Section: Integrated Together Bar */}
      <div className="container mx-auto max-w-[1600px] shrink-0 relative z-10">
        <CountDateWidget
          fromDate="2020-02-14"
          activeTab={activeTab}
          onTabChange={handleTabChange}
          // Pass the calculated active holiday (or null if OFF) for widget styling
          holidayType={activeHoliday === 'OFF' ? null : activeHoliday}
          effectsEnabled={effectsEnabled}
          onToggleEffects={handleToggleEffects}
          // Display "Together Time" only for VIP or Super Admin
          hasAccess={canViewTogetherTime}
          // Dynamic Tab Visibility
          visibleTabs={visibleTabs}
        />
      </div>

      {/* Main Content Area - Render Outlet for Child Routes */}
      <div
        className={`container mx-auto flex-1 max-w-[1600px] relative z-10 ${isFixedLayout ? 'lg:min-h-0 pb-10 lg:pb-0' : 'pb-20'}`}
      >
        {/* STRICT PERMISSION CHECK INTERCEPTION */}
        {!hasTabAccess ? (
          <AccessRestricted
            permission={TAB_PERMISSIONS[activeTab]}
            className="bg-white/80 backdrop-blur shadow-xl border-white/50 h-full"
            onSuccess={() => window.location.reload()}
          />
        ) : (
          // Render actual content if permissions pass
          <div className="animate-fade-in w-full">
            <Outlet context={{ user }} />
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.2);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
};

export default PrivateSpaceDashboard;
