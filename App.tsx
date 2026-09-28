import React, { useState, useEffect, Suspense } from 'react';
import { io, Socket } from 'socket.io-client';
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Hero } from './components/Hero';
import { CosmicBackground } from './components/CosmicBackground';
import { ScenicBackground } from './components/ScenicBackground';
import { ToastContainer, toast } from './components/Toast';
import { DeleteModal } from './components/DeleteModal';
import { apiService } from './services/api';
import { Theme, PageView, User, BlogPost, ChatUser, PERM_KEYS, can } from './types';
import { useTranslation } from './i18n/LanguageContext';
import { Helmet } from 'react-helmet-async';

// Shared shell imports stay eager; route/modal content is loaded on demand below.
import { Footer } from './components/Footer';
import { PageLoader } from './components/PageLoader';
import { AccessRestricted } from './components/AccessRestricted';
import { InstallPwa } from './components/InstallPwa';
import { createLazyComponent } from './components/LazyLoader';

const LoginModal = createLazyComponent(() =>
  import('./components/LoginModal').then((module) => ({ default: module.LoginModal }))
);
const ResumeView = createLazyComponent(() =>
  import('./components/ResumeView').then((module) => ({ default: module.ResumeView }))
);
const BlogList = createLazyComponent(() =>
  import('./pages/BlogList').then((module) => ({ default: module.BlogList }))
);
const ArticleView = createLazyComponent(() =>
  import('./pages/ArticleView').then((module) => ({ default: module.ArticleView }))
);
const PortfolioPage = createLazyComponent(() =>
  import('./pages/PortfolioPage').then((module) => ({ default: module.PortfolioPage }))
);
const UserProfile = createLazyComponent(() =>
  import('./pages/UserProfile').then((module) => ({ default: module.UserProfile }))
);
const SettingsPage = createLazyComponent(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);
const ChatRoom = createLazyComponent(() =>
  import('./pages/ChatRoom').then((module) => ({ default: module.ChatRoom }))
);
const AuditLogViewer = createLazyComponent(() =>
  import('./pages/AuditLogViewer').then((module) => ({ default: module.AuditLogViewer }))
);
const SystemManagement = createLazyComponent(() =>
  import('./pages/SystemManagement').then((module) => ({ default: module.SystemManagement }))
);
const NotFound = createLazyComponent(() =>
  import('./pages/NotFound').then((module) => ({ default: module.NotFound }))
);
const NoPermission = createLazyComponent(() =>
  import('./pages/NoPermission').then((module) => ({ default: module.NoPermission }))
);

// Lazy Load Heavy Pages
const PrivateSpaceDashboard = createLazyComponent(
  () => import('./pages/private/PrivateSpaceDashboard')
);
const FootprintSpace = createLazyComponent(() => import('./pages/FootprintSpace'));

// Lazy Load Private Sub-Spaces
const JournalSpace = createLazyComponent(() => import('./pages/private/JournalSpace'));
const SecondBrainSpace = createLazyComponent(() => import('./pages/private/SecondBrainSpace'));
const LeisureSpace = createLazyComponent(() => import('./pages/private/LeisureSpace'));
const PhotoGallery = createLazyComponent(() => import('./pages/private/PhotoGallery'));
const FitnessSpace = createLazyComponent(() => import('./pages/private/FitnessSpace'));

const SOCKET_URL = 'https://api.samyao.me';

declare global {
  interface Window {
    hljs: any;
  }
}

// Layout Wrapper Component to handle common elements like Header, Background, Footer
const Layout: React.FC<{
  user: User | null;
  socket: Socket | null;
  theme: Theme;
  toggleTheme: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onNavigateToChat: (user: ChatUser) => void;
}> = ({ user, socket, theme, toggleTheme, onLogin, onLogout, onNavigateToChat }) => {
  const location = useLocation();
  const isPrivateSpace = location.pathname.startsWith('/captain-cabin');

  // Logic to identify Article View (slug based route) to remove animations
  const isArticleView = /^\/blogs\/.+/.test(location.pathname);

  // Determine Main Background
  let mainBgClass = '';
  if (isPrivateSpace) {
    mainBgClass = 'bg-gradient-to-br from-pink-200 via-rose-200 to-pink-200';
  } else if (isArticleView) {
    // Specific solid backgrounds for Article View
    mainBgClass = theme === Theme.DARK ? 'bg-[#111]' : 'bg-white';
  } else {
    // Default Public Pages
    mainBgClass = theme === Theme.DARK ? 'bg-slate-950' : 'bg-transparent';
  }

  // Helper to map path to PageView enum for Header highlight
  const getCurrentPageView = (path: string): PageView => {
    if (path.startsWith('/blogs')) return PageView.BLOG;
    if (path.startsWith('/profile')) return PageView.RESUME;
    if (path.startsWith('/user-profile')) return PageView.PROFILE;
    if (path.startsWith('/system-management')) return PageView.SYSTEM;
    if (path.startsWith('/system-settings')) return PageView.SETTINGS;
    if (path.startsWith('/footprints')) return PageView.FOOTPRINT;
    if (path.startsWith('/chatroom')) return PageView.CHAT;
    if (path.startsWith('/captain-cabin')) return PageView.PRIVATE_SPACE;
    return PageView.HOME;
  };

  return (
    <div
      className={`min-h-screen relative overflow-hidden transition-colors duration-500 selection:bg-primary-500/30 ${mainBgClass}`}
    >
      <Helmet titleTemplate="%s | Orion" defaultTitle="Orion | Engineering & Design">
        <meta
          name="description"
          content="A modern, high-performance blog and portfolio built with Next.js architecture, React, and Tailwind CSS."
        />
      </Helmet>

      <ToastContainer />
      <InstallPwa />

      {/* Hide Background Animations on Private Space OR Article View */}
      {!isPrivateSpace && !isArticleView && (
        <>{theme === Theme.DARK ? <CosmicBackground theme={theme} /> : <ScenicBackground />}</>
      )}

      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        setPage={() => {}} // Not used with Router Links in Header
        currentPage={getCurrentPageView(location.pathname)}
        currentUser={user}
        onLogin={onLogin}
        onLogout={onLogout}
        socket={socket}
        onNavigateToChat={onNavigateToChat}
      />

      <main className="relative z-10 pointer-events-none w-full pb-24 md:pb-0">
        <div className="pointer-events-auto w-full min-h-screen">
          <Outlet />
        </div>
      </main>

      <Footer
        currentPage={getCurrentPageView(location.pathname)}
        currentUser={user}
        onLogin={onLogin}
      />

      {/* Mobile Bottom Navigation */}
      <div className="block xl:hidden">
        <MobileBottomNav currentUser={user} onLoginRequest={onLogin} />
      </div>
    </div>
  );
};

interface ProtectedRouteProps {
  user: User | null;
  element: React.ReactNode;
  requiredPerm?: string;
  isLoading?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  element,
  requiredPerm,
  isLoading
}) => {
  if (isLoading) return <PageLoader />;
  if (!user) {
    // Not logged in -> Redirect to home (or could show login modal trigger)
    return <Navigate to="/" replace />;
  }
  if (requiredPerm && !can(user, requiredPerm)) {
    // Logged in but no permission -> Show Restricted Component
    return (
      <div className="pt-32 container mx-auto px-6">
        <AccessRestricted permission={requiredPerm} />
      </div>
    );
  }
  return <>{element}</>;
};

const App: React.FC = () => {
  const { pathname } = useLocation();
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === Theme.DARK || savedTheme === Theme.LIGHT) {
      return savedTheme as Theme;
    }
    return Theme.LIGHT;
  });
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Public Blog State
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(false);
  const [publicPostToDelete, setPublicPostToDelete] = useState<BlogPost | null>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Chat Navigation State
  const [chatTarget, setChatTarget] = useState<ChatUser | null>(null);

  const { t, language, toggleLanguage } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // 区分构建工具
    const ver = import.meta.env?.VITE_APP_VERSION;

    if (ver) {
      console.log(
        `%c ✅ Deployed Version: ${ver.substring(0, 7)} `,
        'background:#333; color:#bada55; border-radius:4px; padding:4px;'
      );
    }
  }, []);

  // Initial Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 Starting auth check...');
      try {
        console.log('🌐 Checking cookie-backed session...');
        const userData = await apiService.getCurrentUser();
        if (userData) {
          console.log('✅ User authenticated:', userData.displayName);
          setUser(userData);
        } else {
          console.log('🚫 No active session');
        }
      } catch (e) {
        console.error('❌ Auth check failed', e);
      }

      console.log('🏁 Setting isAuthChecking to false');
      setIsAuthChecking(false);
    };

    // 添加超时机制，确保即使认证检查卡住，首屏也会在5秒后消失
    const timeout = setTimeout(() => {
      console.log('⏰ Auth check timeout, forcing splash screen hide');
      setIsAuthChecking(false);
    }, 5000);

    checkAuth().finally(() => {
      clearTimeout(timeout);
    });
  }, []);

  // Theme Sync
  useEffect(() => {
    // Keep the user's real site theme available to isolated content surfaces
    // even when Captain's Cabin intentionally keeps its own light shell.
    document.documentElement.dataset.appTheme = theme;

    if (theme === Theme.DARK && !pathname.startsWith('/captain-cabin')) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme, pathname]);

  // 🔥🔥🔥 新增代码：当 Auth 检查结束，通知 HTML 移除 Splash Screen 🔥🔥🔥
  useEffect(() => {
    console.log('🔍 Auth checking state changed:', isAuthChecking);
    if (!isAuthChecking) {
      console.log('🚀 Hiding splash screen...');
      // 1. 给 body 添加 class，触发 index.html 中的 CSS 渐隐动画
      document.body.classList.add('app-ready');

      // 2. (可选) 动画结束后彻底移除 DOM 节点，释放内存
      const timer = setTimeout(() => {
        const splash = document.getElementById('pwa-splash');
        if (splash) {
          console.log('🗑️ Removing splash screen DOM element');
          splash.remove();
        }
      }, 1000); // 对应 CSS 中的 0.8s transition

      return () => clearTimeout(timer);
    }
  }, [isAuthChecking]);

  // 🚨 备用机制：确保首屏一定会在10秒后消失，防止卡住
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      console.log('🚨 Emergency: Force hiding splash screen after 10 seconds');
      document.body.classList.add('app-ready');
      setTimeout(() => {
        const splash = document.getElementById('pwa-splash');
        if (splash) {
          splash.remove();
        }
      }, 1000);
    }, 10000);

    return () => clearTimeout(emergencyTimer);
  }, []);

  // Socket Connection
  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }

    const newSocket = io(SOCKET_URL);
    newSocket.on('connect', () => {
      newSocket.emit('USER_CONNECTED', {
        name: user.displayName,
        id: user._id,
        email: user.email,
        photoURL: user.photoURL
      });
    });
    newSocket.on('NEW_NOTIFICATION', (data: any) => {
      if (data.type === 'private_message') {
        toast.info(data.content);
      }
      window.dispatchEvent(new CustomEvent('sys_notification', { detail: data }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, [user]);

  // Handlers
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    apiService.logout();
    setUser(null);
    localStorage.removeItem('googleInfo');
    setIsLoginModalOpen(true);
    navigate('/');
  };

  const handleNavigateToChat = (targetUser: ChatUser) => {
    setChatTarget(targetUser);
    navigate('/chatroom');
  };

  const confirmPublicDelete = async () => {
    if (!publicPostToDelete) return;
    try {
      await apiService.deletePost(publicPostToDelete._id);
      setPublicPostToDelete(null);
      window.dispatchEvent(new Event('blog:refresh'));
    } catch (error) {
      console.error('Failed to delete public post', error);
    }
  };

  const playSwitchSound = (turnOn: boolean) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // High-frequency contact click
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const baseFreq = turnOn ? 1300 : 950;

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, ctx.currentTime + 0.012);

      gain1.gain.setValueAtTime(0.06, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Low-frequency mechanical spring resonance
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(turnOn ? 420 : 340, ctx.currentTime + 0.002);
      osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.03);

      gain2.gain.setValueAtTime(0.04, ctx.currentTime + 0.002);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.015);

      osc2.start(ctx.currentTime + 0.002);
      osc2.stop(ctx.currentTime + 0.035);
    } catch (e) {
      console.warn('Audio switch playback blocked or not supported:', e);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
      playSwitchSound(nextTheme === Theme.LIGHT);
      return nextTheme;
    });
  };

  // if (isAuthChecking) {
  //   return <PageLoader />;
  // }

  return (
    <>
      <Routes>
        <Route
          element={
            <Layout
              user={user}
              socket={socket}
              theme={theme}
              toggleTheme={toggleTheme}
              onLogin={() => setIsLoginModalOpen(true)}
              onLogout={handleLogout}
              onNavigateToChat={handleNavigateToChat}
            />
          }
        >
          {/* Public Routes */}

          {/* ROOT: Console / Home */}
          <Route
            path="/"
            element={
              <>
                <Helmet>
                  <title>Orion | Home</title>
                </Helmet>
                <Hero
                  onCtaClick={() => navigate('/blogs')}
                  onSecondaryCtaClick={() => navigate('/profile')}
                />
                <div id="console" className="pointer-events-auto">
                  <ResumeView
                    onNavigate={(page) => {
                      if (page === PageView.BLOG) navigate('/blogs');
                      else if (page === PageView.RESUME) navigate('/profile');
                      else if (page === PageView.CHAT) navigate('/chatroom');
                      else if (page === PageView.PROFILE) navigate('/user-profile');
                    }}
                    currentUser={user}
                    onLoginRequest={() => setIsLoginModalOpen(true)}
                  />
                </div>
              </>
            }
          />

          {/* BLOGS: Public Journal */}
          <Route
            path="/blogs"
            element={
              <BlogList
                onSelectBlog={(blog) => {
                  // 🔥 修改 1: 弃用中文标题拼接，直接使用纯 ID 跳转
                  // 这样生成的链接是 /blogs/694d...，与预渲染脚本完美匹配
                  navigate(`/blogs/${blog._id}`);
                }}
                isLoading={isLoadingBlogs}
                currentUser={user}
                onDeletePost={(blog) => setPublicPostToDelete(blog)}
              />
            }
          />

          {/* ARTICLE: SEO Friendly Route (Pure ID Mode) */}
          <Route
            // 🔥 修改 2: 将参数名从 :slug 改为 :id (语义更清晰)
            // 注意：请检查 ArticleView 组件内部，确保是用 useParams().id 来获取参数
            // 如果组件里写死了解构 const { slug } = useParams()，这里保持 :slug 也可以
            path="/blogs/:slug"
            element={
              <ArticleView
                onBack={() => navigate('/blogs')}
                onNavigateToBlog={(blog) => {
                  // 🔥 修改 3: 详情页内部的关联跳转也同步改为纯 ID
                  navigate(`/blogs/${blog._id}`);
                }}
                currentUser={user}
                onLoginRequest={() => setIsLoginModalOpen(true)}
              />
            }
          />

          <Route path="/profile" element={<PortfolioPage currentUser={user} />} />
          <Route path="/profile/experience" element={<PortfolioPage currentUser={user} />} />

          {/* Authenticated Routes */}
          <Route
            path="/user-profile"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                element={<UserProfile user={user!} onUpdateUser={setUser} />}
              />
            }
          />

          <Route
            path="/system-management"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                element={<SystemManagement />}
                requiredPerm={PERM_KEYS.SYSTEM_ACCESS}
              />
            }
          />

          <Route
            path="/system-settings"
            element={
              <SettingsPage
                theme={theme}
                toggleTheme={toggleTheme}
                language={language}
                toggleLanguage={toggleLanguage}
              />
            }
          />

          <Route
            path="/audit-log"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                element={<AuditLogViewer />}
                requiredPerm={PERM_KEYS.SYSTEM_LOGS}
              />
            }
          />

          <Route
            path="/footprints"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                element={
                  <Suspense fallback={<PageLoader />}>
                    <FootprintSpace theme={theme} />
                  </Suspense>
                }
                requiredPerm={PERM_KEYS.FOOTPRINT_USE}
              />
            }
          />

          <Route
            path="/chatroom"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                element={<ChatRoom currentUser={user!} socket={socket} targetUser={chatTarget} />}
              />
            }
          />

          {/* Private Space (Captain Cabin) */}
          <Route
            path="/captain-cabin"
            element={
              <ProtectedRoute
                isLoading={isAuthChecking}
                user={user}
                requiredPerm={PERM_KEYS.PRIVATE_ACCESS}
                element={
                  <Suspense fallback={<PageLoader />}>
                    <PrivateSpaceDashboard user={user} />
                  </Suspense>
                }
              />
            }
          >
            <Route index element={<Navigate to="journal-space" replace />} />
            <Route
              path="journal-space"
              element={
                <Suspense fallback={<PageLoader />}>
                  <JournalSpace />
                </Suspense>
              }
            />
            <Route
              path="ai-space"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SecondBrainSpace user={user} />
                </Suspense>
              }
            />
            <Route
              path="leisure-space"
              element={
                <Suspense fallback={<PageLoader />}>
                  <LeisureSpace user={user} />
                </Suspense>
              }
            />
            <Route
              path="capsule-gallery"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PhotoGallery />
                </Suspense>
              }
            />
            <Route
              path="fitness-space"
              element={
                <Suspense fallback={<PageLoader />}>
                  <FitnessSpace currentUser={user} />
                </Suspense>
              }
            />
          </Route>

          {/* System Pages */}
          <Route path="/403" element={<NoPermission />} />

          {/* Catch All - Must be last */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>

      <DeleteModal
        isOpen={!!publicPostToDelete}
        onClose={() => setPublicPostToDelete(null)}
        onConfirm={confirmPublicDelete}
        title={t.delete.confirmTitle}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
};

export default App;
