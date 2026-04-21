import { useState, useEffect } from 'react';
import { Page } from './types';
import { LanguageProvider } from './i18n';
import Navigation from './components/Navigation';
import PageToday from './pages/PageToday';
import PageTime from './pages/PageTime';
import PageInfo from './pages/PageInfo';
import PageSettings from './pages/PageSettings';
import { loadConfig, checkConfigUpdate } from './utils/config';
import { loadTheme, applyTheme, watchSystemTheme } from './utils/theme';

function AppContent() {
  const [currentPage, setCurrentPageRaw] = useState<Page>('today');
  const setCurrentPage = (page: Page) => {
    window.dispatchEvent(new Event('pra-flush-mood'));
    window.scrollTo(0, 0);
    setCurrentPageRaw(page);
  };
  const [, setRefresh] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const handler = () => {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    };
    window.addEventListener('pra-celebrate', handler);
    return () => window.removeEventListener('pra-celebrate', handler);
  }, []);

  // Check for config updates when tab becomes visible
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible') {
        const changed = await checkConfigUpdate();
        if (changed) {
          // Config changed on server - trigger re-render to merge new activities
          setRefresh(n => n + 1);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <main>
        {currentPage === 'today' && <PageToday onNavigate={(p: string) => setCurrentPage(p as Page)} />}
        {currentPage === 'time' && <PageTime onNavigate={(p: string) => setCurrentPage(p as Page)} />}
        {currentPage === 'info' && <PageInfo />}
        {currentPage === 'settings' && <PageSettings />}
      </main>

      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />

      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <img
            src="/jupi.png"
            alt=""
            className="celebrate-jupi w-48 h-auto drop-shadow-xl"
          />
        </div>
      )}
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyTheme(loadTheme());
    const cleanup = watchSystemTheme();

    // Apply theme immediately, show UI right away — don't block on config fetch
    setReady(true);

    // Load config in background; components handle missing config gracefully
    loadConfig().catch(() => { /* ignore — app already visible */ });

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
