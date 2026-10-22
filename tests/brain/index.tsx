import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../i18n/LanguageContext';
import { MemoryVault } from '../../components/brain/MemoryVault';
createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <MemoryVault />
  </LanguageProvider>
);
