import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { loadSettings, saveSettings } from '../utils/settings';
import { loadAllData, saveAllData } from '../utils/storage';
import { loadActivities, saveActivities } from '../utils/activities';
import { DayEntry, ActivityDefinition } from '../types';
import { loadMoodScale, saveMoodScale, getDefaultMoodScale, MoodScaleItem } from '../utils/moodScale';
import { Theme, loadTheme, saveTheme } from '../utils/theme';
import { getCachedConfig } from '../utils/config';

interface ExportActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  name: string;
  description: string;
  properties?: string[];
  core?: boolean;
  durationOptions?: number[];
  defaultDuration?: number;
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
  notes?: { cs?: Record<string, string>; en?: Record<string, string> };
  userModified?: string[];
  sessionStart?: string;
  activityStats?: Record<string, { count: number; totalSeconds: number; avgRating?: number; avgMood?: number; totalLinks?: number }>;
  moodScale?: MoodScaleItem[];
  hiddenProperties?: string[];
  hiddenActivities?: string[];
  hiddenDurations?: number[];
  durationBubbles?: number[];
}

function generateBackup(lang: string, currentTheme: string, profileName: string): PraFile {
  const activities = loadActivities();
  const history = loadAllData();

  let hiddenActivitiesSet: Set<string> = new Set();
  let hiddenPropertiesSet: Set<string> = new Set();
  try { const s = localStorage.getItem('pra_hidden_activities'); if (s) hiddenActivitiesSet = new Set(JSON.parse(s)); } catch { /* */ }
  try { const s = localStorage.getItem('pra_hidden_properties'); if (s) hiddenPropertiesSet = new Set(JSON.parse(s)); } catch { /* */ }

  const exportActivities: ExportActivity[] = activities
    .filter(a => a.core || !hiddenActivitiesSet.has(a.type))
    .map((a) => ({
      type: a.type, emoji: a.emoji, durationMinutes: a.durationMinutes,
      name: a.name, description: a.description,
      properties: a.core && a.properties ? a.properties.filter(p => !hiddenPropertiesSet.has(p)) : a.properties,
      core: a.core, durationOptions: a.durationOptions, defaultDuration: a.defaultDuration,
    }));

  const cfgInfo = { ...(getCachedConfig()?.info?.[lang as 'cs' | 'en'] || {}) };

  const loadNotes = (l: string) => {
    try { const s = localStorage.getItem(`pra_info_notes_${l}`); if (s) return JSON.parse(s); } catch {}
    return {};
  };

  let userModified: string[] = [];
  try { const s = localStorage.getItem('pra_user_modified_activities'); if (s) userModified = JSON.parse(s); } catch {}

  // Compute per-activity stats from history
  const activityStats: Record<string, { count: number; totalSeconds: number; avgRating?: number; avgMood?: number; totalLinks?: number }> = {};
  const ratingAccum: Record<string, { sum: number; count: number }> = {};
  const moodAccum: Record<string, { sum: number; count: number }> = {};
  history.forEach((day) => {
    day.activities.forEach((a) => {
      if (!activityStats[a.type]) activityStats[a.type] = { count: 0, totalSeconds: 0 };
      activityStats[a.type].count++;
      activityStats[a.type].totalSeconds += a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
      // Links
      const links = (a.linkedActivityIds?.length || 0) + (a.linkedFromId ? 1 : 0);
      if (links > 0) activityStats[a.type].totalLinks = (activityStats[a.type].totalLinks || 0) + links;
      // Legacy rating
      const r = a.ratingAfter ?? a.rating;
      if (r) {
        if (!ratingAccum[a.type]) ratingAccum[a.type] = { sum: 0, count: 0 };
        ratingAccum[a.type].sum += r;
        ratingAccum[a.type].count++;
      }
      // Comment-based mood
      if (a.comments) {
        a.comments.forEach((c) => {
          if (c.rating != null) {
            if (!moodAccum[a.type]) moodAccum[a.type] = { sum: 0, count: 0 };
            moodAccum[a.type].sum += c.rating;
            moodAccum[a.type].count++;
          }
        });
      }
    });
  });
  Object.entries(ratingAccum).forEach(([type, { sum, count }]) => {
    if (activityStats[type]) {
      activityStats[type].avgRating = Math.round((sum / count) * 10) / 10;
    }
  });
  Object.entries(moodAccum).forEach(([type, { sum, count }]) => {
    if (activityStats[type]) {
      activityStats[type].avgMood = Math.round((sum / count) * 10) / 10;
    }
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
    notes: { [lang]: loadNotes(lang) },
    userModified,
    sessionStart: localStorage.getItem('pra_session_start') || undefined,
    moodScale: loadMoodScale().map(item => ({
      value: item.value, emoji: item.emoji,
      ...(lang === 'en' ? { labelEn: item.labelEn } : { labelCs: item.labelCs }),
    })),
    activityStats,
    hiddenProperties: (() => { try { const s = localStorage.getItem('pra_hidden_properties'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    hiddenActivities: (() => { try { const s = localStorage.getItem('pra_hidden_activities'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    hiddenDurations: (() => { try { const s = localStorage.getItem('pra_hidden_durations'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    durationBubbles: (() => { try { const s = localStorage.getItem('pra_duration_bubbles'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
  } as PraFile;
}

function generateConfigExport(lang: string, currentTheme: string, profileName: string): PraFile {
  const activities = loadActivities();

  let hiddenActivitiesSet: Set<string> = new Set();
  let hiddenPropertiesSet: Set<string> = new Set();
  try { const s = localStorage.getItem('pra_hidden_activities'); if (s) hiddenActivitiesSet = new Set(JSON.parse(s)); } catch { /* */ }
  try { const s = localStorage.getItem('pra_hidden_properties'); if (s) hiddenPropertiesSet = new Set(JSON.parse(s)); } catch { /* */ }

  // Export only visible activities; for core activity, only visible properties
  const exportActivities: ExportActivity[] = activities
    .filter(a => a.core || !hiddenActivitiesSet.has(a.type))
    .map((a) => {
      // Ensure durationOptions is always populated with a sensible default
      let durationOptions = a.durationOptions;
      if (!durationOptions || durationOptions.length === 0) {
        if (a.core) {
          durationOptions = [a.defaultDuration ?? 15];
        } else if (a.durationMinutes) {
          durationOptions = [a.durationMinutes];
        } else {
          durationOptions = [1]; // moment activity
        }
      }
      return {
        type: a.type, emoji: a.emoji, durationMinutes: a.durationMinutes,
        name: a.name, description: a.description,
        properties: a.core && a.properties
          ? a.properties.filter(p => !hiddenPropertiesSet.has(p))
          : a.properties,
        core: a.core, durationOptions, defaultDuration: a.defaultDuration ?? durationOptions[0],
      };
    });

  const loadNotes = (l: string) => {
    try { const s = localStorage.getItem(`pra_info_notes_${l}`); if (s) return JSON.parse(s); } catch {}
    return {};
  };

  const cachedConfig = getCachedConfig();
  const infoLang = { ...(cachedConfig?.info?.[lang as 'cs' | 'en'] || {}), ...loadNotes(lang) };

  return {
    type: 'config',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: profileName,
    language: lang,
    theme: currentTheme,
    activities: exportActivities,
    info: { [lang]: infoLang },
    moodScale: loadMoodScale().map(item => ({
      value: item.value, emoji: item.emoji,
      ...(lang === 'en' ? { labelEn: item.labelEn } : { labelCs: item.labelCs }),
    })),
  };
}

function importPraFile(file: PraFile, currentLang: string): void {
  // Activities - merge: update existing + add new
  if (file.activities) {
    const existing = loadActivities();
    const importedMap = new Map(file.activities.map((item) => [item.type, {
      type: item.type, emoji: item.emoji, durationMinutes: item.durationMinutes,
      name: item.name, description: item.description, properties: item.properties,
      core: item.core, durationOptions: item.durationOptions, defaultDuration: item.defaultDuration,
    } as ActivityDefinition]));

    if (file.type === 'config') {
      // Config import: update ALL matching activities from import
      const updated = existing.map(a => {
        const fromImport = importedMap.get(a.type);
        if (fromImport) {
          importedMap.delete(a.type);
          return { ...a, ...fromImport };
        }
        return a;
      });
      // Add remaining new activities
      const newActivities = Array.from(importedMap.values());
      saveActivities([...updated, ...newActivities]);
      // Mark all imported as user-modified so they don't get overwritten by config sync
      const allImportedTypes = file.activities.map(a => a.type);
      let userMod: string[] = [];
      try { const s = localStorage.getItem('pra_user_modified_activities'); if (s) userMod = JSON.parse(s); } catch { /* */ }
      localStorage.setItem('pra_user_modified_activities', JSON.stringify([...new Set([...userMod, ...allImportedTypes])]));
    } else {
      // Backup import: only add new activities (don't overwrite existing)
      const existingTypes = new Set(existing.map(a => a.type));
      const newActivities = Array.from(importedMap.values()).filter(a => !existingTypes.has(a.type));
      if (newActivities.length > 0) {
        saveActivities([...existing, ...newActivities]);
      }
    }
  }
  // User modified tracking - merge
  if (file.userModified) {
    let current: string[] = [];
    try { const s = localStorage.getItem('pra_user_modified_activities'); if (s) current = JSON.parse(s); } catch { /* */ }
    const merged = [...new Set([...current, ...file.userModified])];
    localStorage.setItem('pra_user_modified_activities', JSON.stringify(merged));
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
        const existingById = new Map(existingDay.activities.map(a => [a.id, a]));

        importDay.activities.forEach((importAct) => {
          const existingAct = existingById.get(importAct.id);
          if (existingAct) {
            // Merge comments: add imported comments that don't already exist
            if (importAct.comments && importAct.comments.length > 0) {
              const existingCommentIds = new Set((existingAct.comments || []).map(c => c.id));
              const newComments = importAct.comments.filter(c => !existingCommentIds.has(c.id));
              if (newComments.length > 0) {
                existingAct.comments = [...(existingAct.comments || []), ...newComments];
              }
            }
            // Merge linked activity IDs
            if (importAct.linkedActivityIds) {
              const existingLinks = new Set(existingAct.linkedActivityIds || []);
              importAct.linkedActivityIds.forEach(id => existingLinks.add(id));
              existingAct.linkedActivityIds = [...existingLinks];
            }
            if (importAct.linkedFromId && !existingAct.linkedFromId) {
              existingAct.linkedFromId = importAct.linkedFromId;
            }
            // Fill in missing ratings
            if (importAct.ratingBefore && !existingAct.ratingBefore) existingAct.ratingBefore = importAct.ratingBefore;
            if (importAct.ratingAfter && !existingAct.ratingAfter) existingAct.ratingAfter = importAct.ratingAfter;
            if (importAct.rating && !existingAct.rating) existingAct.rating = importAct.rating;
          } else {
            // New activity - add it
            existingDay.activities.push(importAct);
          }
        });

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
  // Mood scale
  if (file.moodScale && Array.isArray(file.moodScale) && file.moodScale.length > 0) {
    saveMoodScale(file.moodScale);
  }
  // Hidden properties, activities, durations + duration bubbles (backup only)
  if (file.type === 'backup') {
    if (file.hiddenProperties) localStorage.setItem('pra_hidden_properties', JSON.stringify(file.hiddenProperties));
    if (file.hiddenActivities) localStorage.setItem('pra_hidden_activities', JSON.stringify(file.hiddenActivities));
    if (file.hiddenDurations) localStorage.setItem('pra_hidden_durations', JSON.stringify(file.hiddenDurations));
    if (file.durationBubbles) localStorage.setItem('pra_duration_bubbles', JSON.stringify(file.durationBubbles));
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
  const [infoTab, setInfoTab] = useState<'info' | 'install'>('info');
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [moodScale, setMoodScale] = useState<MoodScaleItem[]>(() => loadMoodScale());
  const [editingMoodIdx, setEditingMoodIdx] = useState<number | null>(null);
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
    const safeName = (name || 'default').replace(/[^a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ_-]/g, '').toLowerCase();
    downloadFile(content, `pra-${safeName}-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
  }, [language, theme, name]);

  const handleExportConfig = useCallback(() => {
    const config = generateConfigExport(language, theme, name);
    const content = generatePraFileContent(config);
    const safeName = (name || 'default').replace(/[^a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ_-]/g, '').toLowerCase();
    downloadFile(content, `praconf-${safeName}-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
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
        setTimeout(() => { window.scrollTo(0, 0); window.location.reload(); }, 1500);
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
      { window.scrollTo(0, 0); window.location.reload(); };
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
    { window.scrollTo(0, 0); window.location.reload(); };
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
        setTimeout(() => { window.scrollTo(0, 0); window.location.reload(); }, 1500);
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

        {/* Info / Install */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-themed-primary">
              {infoTab === 'info' ? 'Info' : t.settings.installTitle}
            </h2>
            <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
              <button
                onClick={() => setInfoTab('info')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  infoTab === 'info'
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setInfoTab('install')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  infoTab === 'install'
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {t.settings.installTitle}
              </button>
            </div>
          </div>

          {infoTab === 'info' && (
            <div>
              <p className="text-sm text-themed-muted">{t.settings.statement}</p>
              <div className="text-left mt-3">
                <a href="https://github.com/kasaj/app" target="_blank" rel="noopener noreferrer" className="text-xs text-themed-accent-solid hover:underline">github.com/kasaj/app</a>
              </div>
            </div>
          )}

          {infoTab === 'install' && (
            <div className="space-y-2 text-sm text-themed-muted">
              <p>{t.settings.installStep1}</p>
              <p>{t.settings.installStep2iOS}</p>
              <p>{t.settings.installStep2Android}</p>
            </div>
          )}
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
              <p className="text-xs text-themed-faint mb-2">{t.settings.backupHint}</p>
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

        {/* Jazyk */}
        <section className="card">
          <h2 className="font-serif text-lg text-themed-primary mb-4">
            {t.settings.language}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => { setLanguage('cs'); setTimeout(() => { window.scrollTo(0, 0); window.location.reload(); }, 100); }}
              className={`flex-1 py-3 px-4 rounded-xl border transition-colors ${
                language === 'cs'
                  ? 'bg-themed-accent border-themed-accent text-themed-accent'
                  : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
              }`}
            >
              Čeština
            </button>
            <button
              onClick={() => { setLanguage('en'); setTimeout(() => { window.scrollTo(0, 0); window.location.reload(); }, 100); }}
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

        {/* Mood scale */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-themed-primary">
              {t.settings.moodScale}
            </h2>
            <button
              onClick={() => { setMoodScale(getDefaultMoodScale()); saveMoodScale(getDefaultMoodScale()); }}
              className="text-xs text-themed-faint hover:text-themed-muted"
            >
              Reset
            </button>
          </div>
          <div className="flex items-stretch justify-between gap-1">
            {moodScale.map((item, idx) => (
              <div key={item.value} className="flex flex-col items-center gap-0.5 flex-1">
                {editingMoodIdx === idx ? (
                  <input
                    autoFocus
                    defaultValue={item.emoji}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        const emoji = [...val].pop()!;
                        const updated = [...moodScale];
                        updated[idx] = { ...item, emoji };
                        setMoodScale(updated);
                        saveMoodScale(updated);
                      }
                      setEditingMoodIdx(null);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-10 h-10 text-center text-xl bg-themed-input border border-themed-accent rounded-lg focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingMoodIdx(idx)}
                    className="text-xl hover:scale-110 transition-transform"
                  >
                    {item.emoji}
                  </button>
                )}
                <span className="text-xs text-themed-faint">{item.value}</span>
                <span className="text-xs text-themed-muted text-center leading-tight" style={{ fontSize: '0.6rem' }}>
                  {language === 'cs' ? item.labelCs : item.labelEn}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Sync */}
        <section className="card" style={{ border: '1.5px solid var(--accent-solid)' }}>
          <button
            onClick={handleSync}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <svg className="w-5 h-5 text-themed-accent-solid" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
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
        <section className="card">
          <button
            onClick={handleReset}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <svg className="w-5 h-5" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <div>
              <div className="font-medium" style={{ color: '#ef4444' }}>{t.settings.resetDefault}</div>
              <div className="text-sm text-themed-faint">{t.settings.resetDefaultDesc}</div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
}
