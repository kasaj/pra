import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { loadSettings, saveSettings } from '../utils/settings';
import { loadAllData, saveAllData } from '../utils/storage';
import { loadActivities, saveActivities } from '../utils/activities';
import { DayEntry, ActivityDefinition } from '../types';
import { Theme, loadTheme, saveTheme } from '../utils/theme';
import { getCachedConfig } from '../utils/config';

interface ExportActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  name: string;
  description: string;
  variants?: string[];
}

interface PraFile {
  type: 'backup' | 'config';
  version: 1;
  exportedAt: string;
  name?: string;
  language: string;
  theme: string;
  activities: ExportActivity[];
  info: Record<string, unknown>;
  history?: DayEntry[];
  notes?: { cs: Record<string, string>; en: Record<string, string> };
  userModified?: string[];
  sessionStart?: string;
  activityStats?: Record<string, { count: number; totalSeconds: number }>;
}

function generateBackup(lang: string, currentTheme: string, profileName: string): PraFile {
  const activities = loadActivities();
  const history = loadAllData();

  const exportActivities: ExportActivity[] = activities.map((a) => ({
    type: a.type, emoji: a.emoji, durationMinutes: a.durationMinutes,
    name: a.name, description: a.description, variants: a.variants,
  }));

  const cfgInfo = { ...(getCachedConfig()?.info?.[lang as 'cs' | 'en'] || {}) };

  const loadNotes = (l: string) => {
    try { const s = localStorage.getItem(`pra_info_notes_${l}`); if (s) return JSON.parse(s); } catch {}
    return {};
  };

  let userModified: string[] = [];
  try { const s = localStorage.getItem('pra_user_modified_activities'); if (s) userModified = JSON.parse(s); } catch {}

  // Compute per-activity stats from history
  const activityStats: Record<string, { count: number; totalSeconds: number }> = {};
  history.forEach((day) => {
    day.activities.forEach((a) => {
      if (!activityStats[a.type]) activityStats[a.type] = { count: 0, totalSeconds: 0 };
      activityStats[a.type].count++;
      activityStats[a.type].totalSeconds += a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
    });
  });

  return {
    type: 'backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: profileName,
    language: lang,
    theme: currentTheme,
    activities: exportActivities,
    info: cfgInfo,
    history,
    notes: { cs: loadNotes('cs'), en: loadNotes('en') },
    userModified,
    sessionStart: localStorage.getItem('pra_session_start') || undefined,
    activityStats,
  } as PraFile;
}

function generateConfigExport(lang: string, currentTheme: string, profileName: string): PraFile {
  const activities = loadActivities();

  const exportActivities: ExportActivity[] = activities.map((a) => ({
    type: a.type, emoji: a.emoji, durationMinutes: a.durationMinutes,
    name: a.name, description: a.description, variants: a.variants,
  }));

  const loadNotes = (l: string) => {
    try { const s = localStorage.getItem(`pra_info_notes_${l}`); if (s) return JSON.parse(s); } catch {}
    return {};
  };
  const cfgInfo = { ...(getCachedConfig()?.info?.[lang as 'cs' | 'en'] || {}) };

  return {
    type: 'config',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: profileName,
    language: lang,
    theme: currentTheme,
    activities: exportActivities,
    info: { ...cfgInfo, noteWhy: loadNotes(lang).why || '', noteHow: loadNotes(lang).how || '', noteWhat: loadNotes(lang).what || '' },
  };
}

function importPraFile(file: PraFile, currentLang: string): void {
  // Activities
  if (file.activities) {
    const activities: ActivityDefinition[] = file.activities.map((item) => ({
      type: item.type, emoji: item.emoji, durationMinutes: item.durationMinutes,
      name: item.name, description: item.description, variants: item.variants,
    }));
    saveActivities(activities);
  }
  // User modified tracking
  if (file.userModified) {
    localStorage.setItem('pra_user_modified_activities', JSON.stringify(file.userModified));
  }
  // Language
  if (file.language && (file.language === 'cs' || file.language === 'en')) {
    localStorage.setItem('pra_language', file.language);
  }
  // Theme
  if (file.theme && (file.theme === 'classic' || file.theme === 'modern' || file.theme === 'dark')) {
    saveTheme(file.theme);
  }
  // Name
  if (file.name) {
    const settings = loadSettings();
    saveSettings({ ...settings, name: file.name });
  }
  // History (backup only) - merge with existing, don't overwrite
  if (file.type === 'backup' && file.history) {
    const existing = loadAllData();
    const existingMap = new Map(existing.map(d => [d.date, d]));

    // Merge imported days with existing
    file.history.forEach((importDay) => {
      const existingDay = existingMap.get(importDay.date);
      if (existingDay) {
        // Add activities that don't already exist (by id)
        const existingIds = new Set(existingDay.activities.map(a => a.id));
        const newActivities = importDay.activities.filter(a => !existingIds.has(a.id));
        existingDay.activities.push(...newActivities);
        existingMap.set(importDay.date, existingDay);
      } else {
        existingMap.set(importDay.date, importDay);
      }
    });

    // Sort by date descending and save
    const merged = Array.from(existingMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    saveAllData(merged);
  }
  // Notes
  if (file.type === 'backup' && file.notes) {
    if (file.notes.cs) localStorage.setItem('pra_info_notes_cs', JSON.stringify(file.notes.cs));
    if (file.notes.en) localStorage.setItem('pra_info_notes_en', JSON.stringify(file.notes.en));
  } else if (file.info) {
    const lang = file.language || currentLang;
    const notes = {
      why: (file.info as Record<string, unknown>).noteWhy as string || '',
      how: (file.info as Record<string, unknown>).noteHow as string || '',
      what: (file.info as Record<string, unknown>).noteWhat as string || '',
    };
    if (notes.why || notes.how || notes.what) {
      localStorage.setItem(`pra_info_notes_${lang}`, JSON.stringify(notes));
    }
  }
  // Session start
  if (file.type === 'backup' && file.sessionStart) {
    localStorage.setItem('pra_session_start', file.sessionStart);
  }
}

function generatePraFileContent(data: PraFile): string {
  return JSON.stringify(data, null, 2);
}

async function downloadFile(content: string, filename: string, mimeType = 'application/json') {
  // Try File System Access API (Save As dialog) - Chrome/Edge
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JSON file',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (e) {
      // User cancelled or API failed - fall through to legacy
      if ((e as Error).name === 'AbortError') return;
    }
  }
  // Fallback: direct download
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PageSettings() {
  const { language, setLanguage, t } = useLanguage();
  const [name, setName] = useState('');
  const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(null);
  const [exportTab, setExportTab] = useState<'backup' | 'config'>('backup');
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleThemeChange = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  useEffect(() => {
    const settings = loadSettings();
    if (settings.name) {
      setName(settings.name);
    } else {
      // Default from config
      const cfg = getCachedConfig();
      setName(cfg?.name || 'default');
    }
  }, []);

  // Auto-save on any change
  useEffect(() => {
    if (name) saveSettings({ language, name });
  }, [language, name]);

  const handleExportBackup = useCallback(() => {
    const backup = generateBackup(language, theme, name);
    const content = generatePraFileContent(backup);
    downloadFile(content, `prabackup-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
  }, [language, theme, name]);

  const handleExportConfig = useCallback(() => {
    const config = generateConfigExport(language, theme, name);
    const content = generatePraFileContent(config);
    downloadFile(content, `praconfig-${language}-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
  }, [language, theme, name]);

  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleImportBackup = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const praFile = JSON.parse(event.target?.result as string) as PraFile;
        if (!praFile.version || !Array.isArray(praFile.activities)) throw new Error('Invalid');
        importPraFile(praFile, language);
        setImportStatus('success');
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  }, [language]);

  const [synced, setSynced] = useState(false);

  const handleSync = useCallback(async () => {
    // Re-fetch config fresh
    const { loadConfig } = await import('../utils/config');
    await loadConfig();
    // Merge: keep user activities, add new ones from config
    const { mergeWithConfig, loadActivities: reload } = await import('../utils/activities');
    const current = reload();
    mergeWithConfig(current);
    setSynced(true);
    setTimeout(() => {
      setSynced(false);
      window.location.reload();
    }, 1000);
  }, []);

  const handleReset = useCallback(() => {
    if (!window.confirm(t.settings.resetConfirm)) return;
    // Clear all localStorage
    localStorage.clear();
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }
    // Clear caches
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
    // Reload
    window.location.reload();
  }, [t]);

  const handleImportConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const praFile = JSON.parse(event.target?.result as string) as PraFile;
        if (!praFile.version || !Array.isArray(praFile.activities)) throw new Error('Invalid');
        praFile.type = 'config'; // force config mode (no history import)
        importPraFile(praFile, language);
        setImportStatus('success');
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [language]);

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-themed-primary">{t.settings.title}</h1>
      </header>

      <div className="space-y-6">
        {/* Profil */}
        <section className="card">
          <h2 className="font-serif text-lg text-themed-primary mb-4">
            {t.settings.profile}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-themed-muted mb-2">
                {t.settings.name}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.settings.namePlaceholder}
                className="w-full p-3 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent
                         text-themed-primary placeholder:text-themed-faint"
              />
            </div>
          </div>
        </section>

        {/* Export / Import */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-themed-primary">
              {t.settings.export}
            </h2>
            <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
              <button
                onClick={() => setExportTab('backup')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  exportTab === 'backup'
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {t.settings.backupExport}
              </button>
              <button
                onClick={() => setExportTab('config')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  exportTab === 'config'
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {t.settings.exportConfig}
              </button>
            </div>
          </div>

          {exportTab === 'backup' && (
            <div className="space-y-3">
              <div className="text-sm text-themed-muted mb-2">{t.settings.backupExportDesc}</div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportBackup}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
                >
                  Export
                </button>
                <label
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center cursor-pointer border transition-colors"
                  style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
                >
                  Import
                  <input ref={backupInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {exportTab === 'config' && (
            <div className="space-y-3">
              <div className="text-sm text-themed-muted mb-2">{t.settings.exportConfigDesc}</div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportConfig}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
                >
                  Export
                </button>
                <label
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center cursor-pointer border transition-colors"
                  style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
                >
                  Import
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {importStatus && (
            <div className={`p-3 rounded-xl text-sm mt-3 ${
              importStatus === 'success'
                ? 'bg-themed-accent text-themed-accent'
                : 'bg-themed-error text-themed-error'
            }`}>
              {importStatus === 'success' ? t.settings.importSuccess : t.settings.importError}
            </div>
          )}
        </section>

        {/* Statement + tip */}
        <section className="card" style={{ borderLeft: '3px solid var(--text-faint)' }}>
          <p className="text-sm text-themed-muted">{t.settings.statement}</p>
          <p className="text-xs text-themed-faint italic mt-2">{t.settings.backupHint}</p>
        </section>

        {/* Install */}
        <section className="card">
          <h2 className="font-serif text-lg text-themed-primary mb-3">
            {t.settings.installTitle}
          </h2>
          <div className="space-y-2 text-sm text-themed-muted">
            <p>{t.settings.installStep1}</p>
            <p>{t.settings.installStep2iOS}</p>
            <p>{t.settings.installStep2Android}</p>
          </div>
        </section>

        {/* Jazyk */}
        <section className="card">
          <h2 className="font-serif text-lg text-themed-primary mb-4">
            {t.settings.language}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage('cs')}
              className={`flex-1 py-3 px-4 rounded-xl border transition-colors ${
                language === 'cs'
                  ? 'bg-themed-accent border-themed-accent text-themed-accent'
                  : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
              }`}
            >
              Čeština
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 px-4 rounded-xl border transition-colors ${
                language === 'en'
                  ? 'bg-themed-accent border-themed-accent text-themed-accent'
                  : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Theme */}
        <section className="card">
          <h2 className="font-serif text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t.settings.theme}
          </h2>
          <div className="flex gap-3">
            {(['classic', 'modern', 'dark'] as Theme[]).map((th) => (
              <button
                key={th}
                onClick={() => handleThemeChange(th)}
                className="flex-1 py-3 px-2 rounded-xl border transition-colors text-sm"
                style={{
                  backgroundColor: theme === th ? 'var(--accent-bg)' : 'var(--bg-input)',
                  borderColor: theme === th ? 'var(--accent-border)' : 'var(--border-light)',
                  color: theme === th ? 'var(--accent-text)' : 'var(--text-muted)',
                }}
              >
                {th === 'classic' ? t.settings.themeClassic : th === 'modern' ? t.settings.themeModern : t.settings.themeDark}
              </button>
            ))}
          </div>
        </section>

        {/* Sync */}
        <section className="card">
          <button
            onClick={handleSync}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <svg className="w-5 h-5 text-themed-accent-solid" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <div className="text-themed-accent-solid font-medium">
                {synced ? `${t.settings.syncSuccess} ✓` : t.settings.syncConfig}
              </div>
              <div className="text-sm text-themed-faint">{t.settings.syncConfigDesc}</div>
            </div>
          </button>
        </section>

        {/* Reset */}
        <section className="card" style={{ borderColor: 'var(--warn-text)', borderWidth: '1px' }}>
          <button
            onClick={handleReset}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <svg className="w-5 h-5 text-themed-ochre" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <div className="text-themed-warn font-medium">{t.settings.resetDefault}</div>
              <div className="text-sm text-themed-faint">{t.settings.resetDefaultDesc}</div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
}
