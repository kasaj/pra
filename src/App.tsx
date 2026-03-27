import { useState, useEffect } from 'react';
import { Page } from './types';
import { LanguageProvider } from './i18n';
import Navigation from './components/Navigation';
import PageToday from './pages/PageToday';
import PageTime from './pages/PageTime';
import PageInfo from './pages/PageInfo';
import PageSettings from './pages/PageSettings';
import { loadConfig } from './utils/config';
import { loadTheme, applyTheme, watchSystemTheme } from './utils/theme';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('today');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <main>
        {currentPage === 'today' && <PageToday />}
        {currentPage === 'time' && <PageTime />}
        {currentPage === 'info' && <PageInfo />}
        {currentPage === 'settings' && <PageSettings />}
      </main>

      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyTheme(loadTheme());
    const cleanup = watchSystemTheme();
    loadConfig().then(() => setReady(true));
    return cleanup;
  }, []);

  if (!ready) return null;

  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
