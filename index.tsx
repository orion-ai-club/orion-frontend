import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import { BrowserRouter } from 'react-router-dom';
import { inject } from '@vercel/analytics';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { HelmetProvider } from 'react-helmet-async';
import './styles/index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// Initialize Vercel Web Analytics
inject();

// A legacy www PWA service worker can serve cached HTML without reaching Vercel's 301.
// Normalize the host before mounting the SPA, preserving path, query and fragment.
if (window.location.hostname === 'www.samyao.me') {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = 'samyao.me';
  canonicalUrl.protocol = 'https:';
  window.location.replace(canonicalUrl.href);
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  const appContent = (
    <HelmetProvider>
      <BrowserRouter>
        <LanguageProvider>
          <App />
          <SpeedInsights />
        </LanguageProvider>
      </BrowserRouter>
    </HelmetProvider>
  );

  const normalizePath = (value: string) => {
    if (!value || value === '/') return '/';
    return value.replace(/\/+$/, '') || '/';
  };

  const prerenderPath = rootElement.getAttribute('data-prerender-path');
  const currentPath = normalizePath(window.location.pathname);
  const snapshotPath = prerenderPath ? normalizePath(prerenderPath) : null;
  const canHydrate = rootElement.hasChildNodes() && snapshotPath === currentPath;

  if (canHydrate) {
    hydrateRoot(rootElement, appContent);
  } else {
    // A SPA fallback may return a snapshot generated for a different route.
    // Never show/hydrate that stale page (for example Home HTML on /profile).
    if (rootElement.hasChildNodes()) rootElement.replaceChildren();
    const root = createRoot(rootElement);
    root.render(appContent);
  }
}
