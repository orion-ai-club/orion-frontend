import React, { useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageContext';
import { PrivateSpaceDashboard } from '../../pages/private/PrivateSpaceDashboard';
import { MemoryVault } from '../../components/brain/MemoryVault';
import { KnowledgeConsent } from '../../components/brain/KnowledgeConsent';
import '../../styles/index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
const user = {
  _id: '654321000000000000000001',
  displayName: 'Synthetic Cabin User',
  email: 'synthetic@example.invalid',
  permissions: ['*']
};
// Mirror App's intentional light Captain's Cabin shell, including when the site is dark.
document.documentElement.dataset.appTheme = 'light';
document.documentElement.classList.remove('dark');
localStorage.setItem('private_theme', 'OFF');
function ConsentFixture() {
  const [signedIn, setSignedIn] = useState(!location.search.includes('signedOut'));
  return (
    <KnowledgeConsent
      user={signedIn ? user : null}
      loading={false}
      onLogin={() => setSignedIn(true)}
    />
  );
}
const request = new URLSearchParams(location.search).get('request') || '';
createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <LanguageProvider>
      <MemoryRouter
        initialEntries={[
          location.search.includes('consent')
            ? '/memory/connect?request=' + encodeURIComponent(request)
            : '/captain-cabin/ai-space'
        ]}
      >
        <Routes>
          <Route path="/memory/connect" element={<ConsentFixture />} />
          <Route path="/captain-cabin" element={<PrivateSpaceDashboard user={user} />}>
            <Route path="ai-space" element={<MemoryVault />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  </HelmetProvider>
);
