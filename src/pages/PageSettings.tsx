import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { loadSettings, saveSettings } from '../utils/settings';
import { loadAllData } from '../utils/storage';
import { getActivityByType, loadActivities, saveActivities } from '../utils/activities';
import { DayEntry, ActivityDefinition } from '../types';
import { Theme, loadTheme, saveTheme } from '../utils/theme';
import { getCachedConfig } from '../utils/config';

function formatDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(isoStr: string, lang: string): string {
  const date = new Date(isoStr);
  return date.toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function generateHistoryMarkdown(data: DayEntry[], lang: string): string {
  const t = lang === 'cs'
    ? {
        date: 'Datum', activity: 'Aktivita', duration: 'Čas', rating: 'Stav', note: 'Poznámka',
        summary: 'Shrnutí', totalActivities: 'Celkem aktivit', totalTime: 'Celkový čas',
        avgRating: 'Průměrný stav', weeklyTitle: 'Týdenní přehled', records: 'Záznamy'
      }
    : {
        date: 'Date', activity: 'Activity', duration: 'Duration', rating: 'State', note: 'Note',
        summary: 'Summary', totalActivities: 'Total activities', totalTime: 'Total time',
        avgRating: 'Average state', weeklyTitle: 'Weekly overview', records: 'Records'
      };

  // Calculate statistics
  let totalActivities = 0;
  let totalSeconds = 0;
  const ratings: number[] = [];

  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 6);
  const weekAgoStr = weekAgoDate.toISOString().split('T')[0];
  let weekActivities = 0;
  let weekSeconds = 0;

  const monthAgoDate = new Date();
  monthAgoDate.setDate(monthAgoDate.getDate() - 29);
  const monthAgoStr = monthAgoDate.toISOString().split('T')[0];
  let monthActivities = 0;
  let monthSeconds = 0;

  data.forEach((day) => {
    day.activities.forEach((activity) => {
      totalActivities++;
      const secs = activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 60);
      totalSeconds += secs;
      if (activity.ratingAfter) ratings.push(activity.ratingAfter);
      else if (activity.rating) ratings.push(activity.rating);

      if (day.date >= weekAgoStr) {
        weekActivities++;
        weekSeconds += secs;
      }
      if (day.date >= monthAgoStr) {
        monthActivities++;
        monthSeconds += secs;
      }
    });
  });

  const toHM = (s: number) => ({ h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  const total = toHM(totalSeconds);
  const weekHM = toHM(weekSeconds);
  const monthHM = toHM(monthSeconds);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
    : '-';

  // Calculate weekly stats (last 7 days)
  const today = new Date();
  const weekData: Array<{ day: string; count: number; avgRating: string }> = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayEntry = data.find((d) => d.date === dateStr);

    const dayName = date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const count = dayEntry ? dayEntry.activities.length : 0;

    let dayAvg = '-';
    if (dayEntry) {
      const dayRatings: number[] = [];
      dayEntry.activities.forEach((a) => {
        if (a.ratingAfter) dayRatings.push(a.ratingAfter);
        else if (a.rating) dayRatings.push(a.rating);
      });
      if (dayRatings.length > 0) {
        dayAvg = (dayRatings.reduce((sum, r) => sum + r, 0) / dayRatings.length).toFixed(1);
      }
    }

    weekData.push({ day: dayName, count, avgRating: dayAvg });
  }

  let md = `# PRA - ${lang === 'cs' ? 'Historie' : 'History'}\n\n`;
  md += `${lang === 'cs' ? 'Exportováno' : 'Exported'}: ${new Date().toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')}\n\n`;

  const fmtTime = (hm: { h: number; m: number }) => `${hm.h > 0 ? `${hm.h}h ` : ''}${hm.m}min`;
  const weekLabel = lang === 'cs' ? 'Týden' : 'Week';
  const monthLabel = lang === 'cs' ? 'Měsíc' : 'Month';
  const activitiesLabel = lang === 'cs' ? 'aktivit' : 'activities';
  const timeLabel = lang === 'cs' ? 'čas' : 'time';

  // Elapsed time since first activity
  const firstDate = data.length > 0 ? data[data.length - 1].date : null;
  let elapsedStr = '-';
  let practicePercent = '0';
  if (firstDate) {
    const diffSec = Math.floor((Date.now() - new Date(firstDate).getTime()) / 1000);
    const days = Math.floor(diffSec / 86400);
    const hrs = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    elapsedStr = `${days}:${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    const wakingSec = (days + 1) * 16 * 3600;
    if (wakingSec > 0) practicePercent = (totalSeconds / wakingSec * 100).toFixed(1);
  }

  const runningLabel = lang === 'cs' ? 'Doba běhu' : 'Running time';
  const practiceLabel = lang === 'cs' ? 'Praxe z bdělého stavu' : 'Practice of waking time';

  // Summary section
  md += `## ${t.summary}\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| **${runningLabel}** | ${elapsedStr} |\n`;
  md += `| **${practiceLabel}** | ${practicePercent}% |\n`;
  md += `| **${weekLabel} ${activitiesLabel}** | ${weekActivities} |\n`;
  md += `| **${weekLabel} ${timeLabel}** | ${fmtTime(weekHM)} |\n`;
  md += `| **${monthLabel} ${activitiesLabel}** | ${monthActivities} |\n`;
  md += `| **${monthLabel} ${timeLabel}** | ${fmtTime(monthHM)} |\n`;
  md += `| **${t.totalActivities}** | ${totalActivities} |\n`;
  md += `| **${t.totalTime}** | ${fmtTime(total)} |\n`;
  md += `| **${t.avgRating}** | ${avgRating} |\n\n`;

  // Weekly overview
  md += `## ${t.weeklyTitle}\n\n`;
  md += `| ${lang === 'cs' ? 'Den' : 'Day'} | ${lang === 'cs' ? 'Počet' : 'Count'} | ${t.avgRating} |\n`;
  md += `|-----|-------|----------|\n`;
  weekData.forEach((w) => {
    md += `| ${w.day} | ${w.count} | ${w.avgRating} |\n`;
  });
  md += '\n';

  // Monthly overview (last 30 days)
  const monthlyTitle = lang === 'cs' ? 'Měsíční přehled' : 'Monthly overview';
  md += `## ${monthlyTitle}\n\n`;
  md += `| ${lang === 'cs' ? 'Den' : 'Day'} | ${lang === 'cs' ? 'Počet' : 'Count'} | ${t.avgRating} |\n`;
  md += `|-----|-------|----------|\n`;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayEntry = data.find((d) => d.date === dateStr);
    const dayName = date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'numeric' });
    const cnt = dayEntry ? dayEntry.activities.length : 0;
    let dayAvgM = '-';
    if (dayEntry) {
      const dr: number[] = [];
      dayEntry.activities.forEach((a) => {
        if (a.ratingAfter) dr.push(a.ratingAfter);
        else if (a.rating) dr.push(a.rating);
      });
      if (dr.length > 0) dayAvgM = (dr.reduce((s, r) => s + r, 0) / dr.length).toFixed(1);
    }
    if (cnt > 0) md += `| ${dayName} | ${cnt} | ${dayAvgM} |\n`;
  }
  md += '\n';

  // Records table
  md += `## ${t.records}\n\n`;
  md += `| ${t.date} | ${t.activity} | ${t.duration} | ${t.rating} | ${t.note} |\n`;
  md += `|----------|----------|----------|----------|----------|\n`;

  // Table rows
  data.forEach((day) => {
    day.activities.forEach((activity) => {
      const def = getActivityByType(activity.type);
      const isTimed = activity.durationMinutes !== null;

      const dateStr = `${formatDate(day.date, lang)} ${formatTime(activity.startedAt, lang)}`;
      const activityName = `${def?.emoji || ''} ${def?.name || activity.type}`;

      const duration = activity.actualDurationSeconds
        ? formatDuration(activity.actualDurationSeconds)
        : activity.durationMinutes
          ? `${activity.durationMinutes}m`
          : '1m';

      let rating = '-';
      if (isTimed) {
        if (activity.ratingBefore || activity.ratingAfter) {
          rating = `${activity.ratingBefore || '-'}→${activity.ratingAfter || '-'}`;
        }
      } else if (activity.rating) {
        rating = '★'.repeat(activity.rating);
      }

      const note = isTimed
        ? (activity.noteAfter || activity.noteBefore || '-')
        : (activity.note || '-');

      md += `| ${dateStr} | ${activityName} | ${duration} | ${rating} | ${note.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |\n`;
    });
  });

  return md;
}

interface ExportActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  name: string;
  description: string;
  variants?: string[];
}

interface ExportConfig {
  version: 1;
  exportedAt: string;
  name?: string;
  language: string;
  theme: string;
  activities: ExportActivity[];
  info: Record<string, unknown>;
}

function generateExport(lang: string, currentTheme: string, profileName: string): ExportConfig {
  const activities = loadActivities();

  const exportActivities: ExportActivity[] = activities.map((activity) => ({
    type: activity.type,
    emoji: activity.emoji,
    durationMinutes: activity.durationMinutes,
    name: activity.name,
    description: activity.description,
    variants: activity.variants,
  }));

  // Get info for current language + user notes
  let userNotes = { why: '', how: '', what: '' };
  try {
    const stored = localStorage.getItem(`pra_info_notes_${lang}`);
    if (stored) userNotes = JSON.parse(stored);
  } catch { /* default */ }
  const cfgInfo = { ...(getCachedConfig()?.info?.[lang as 'cs' | 'en'] || {}) };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    name: profileName,
    language: lang,
    theme: currentTheme,
    activities: exportActivities,
    info: { ...cfgInfo, noteWhy: userNotes.why, noteHow: userNotes.how, noteWhat: userNotes.what },
  };
}

function importExport(config: ExportConfig): ActivityDefinition[] {
  const activities: ActivityDefinition[] = config.activities.map((item) => ({
    type: item.type,
    emoji: item.emoji,
    durationMinutes: item.durationMinutes,
    name: item.name,
    description: item.description,
    variants: item.variants,
  }));
  saveActivities(activities);
  return activities;
}

function downloadFile(content: string, filename: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
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
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(null);
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

  const handleSave = () => {
    saveSettings({ language, name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportHistory = useCallback(() => {
    const data = loadAllData();
    const markdown = generateHistoryMarkdown(data, language);
    downloadFile(markdown, `pra-history-${new Date().toISOString().split('T')[0]}.md`);
  }, [language]);

  const handleExportConfig = useCallback(() => {
    const config = generateExport(language, theme, name);
    const json = JSON.stringify(config, null, 2);
    downloadFile(json, `pra-config-${language}-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
  }, [language, theme, name]);

  const [synced, setSynced] = useState(false);

  const handleSync = useCallback(() => {
    // Clear activities from localStorage so they reload from config
    localStorage.removeItem('pra_activities');
    // Clear config hash to force re-read
    localStorage.removeItem('pra_config_hash');
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
        const config = JSON.parse(event.target?.result as string) as ExportConfig;
        if (!config.version || !Array.isArray(config.activities)) {
          throw new Error('Invalid config format');
        }
        // Import name
        if (config.name) {
          const settings = loadSettings();
          saveSettings({ ...settings, name: config.name });
        }
        // Import activities (single language)
        importExport(config);
        // Import language
        if (config.language && (config.language === 'cs' || config.language === 'en')) {
          localStorage.setItem('pra_language', config.language);
        }
        // Import theme
        if (config.theme && (config.theme === 'classic' || config.theme === 'modern' || config.theme === 'dark')) {
          saveTheme(config.theme);
        }
        // Import user notes (single language from export)
        if (config.info) {
          const lang = config.language || language;
          const notes = {
            why: (config.info as Record<string, unknown>).noteWhy as string || '',
            how: (config.info as Record<string, unknown>).noteHow as string || '',
            what: (config.info as Record<string, unknown>).noteWhat as string || '',
          };
          if (notes.why || notes.how || notes.what) {
            localStorage.setItem(`pra_info_notes_${lang}`, JSON.stringify(notes));
          }
        }
        setImportStatus('success');
        // Reload to apply all changes (info, language, theme, activities)
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
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
          <h2 className="font-serif text-lg text-themed-primary mb-4">
            {t.settings.export}
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleExportHistory}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-themed-input border border-themed
                       hover:border-themed-medium transition-colors text-left"
            >
              <svg className="w-5 h-5 text-themed-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div>
                <div className="text-themed-primary font-medium">{t.settings.exportHistory}</div>
                <div className="text-sm text-themed-faint">{t.settings.exportHistoryDesc}</div>
              </div>
            </button>
            <button
              onClick={handleExportConfig}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-themed-input border border-themed
                       hover:border-themed-medium transition-colors text-left"
            >
              <svg className="w-5 h-5 text-themed-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div>
                <div className="text-themed-primary font-medium">{t.settings.exportConfig}</div>
                <div className="text-sm text-themed-faint">{t.settings.exportConfigDesc}</div>
              </div>
            </button>
            <label
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-themed-input border border-themed
                       hover:border-themed-medium transition-colors text-left cursor-pointer"
            >
              <svg className="w-5 h-5 text-themed-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0L16 8m4-4v12" />
              </svg>
              <div>
                <div className="text-themed-primary font-medium">{t.settings.importConfig}</div>
                <div className="text-sm text-themed-faint">{t.settings.importConfigDesc}</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
              />
            </label>
            {importStatus && (
              <div className={`p-3 rounded-xl text-sm ${
                importStatus === 'success'
                  ? 'bg-themed-accent text-themed-accent'
                  : 'bg-themed-error text-themed-error'
              }`}>
                {importStatus === 'success' ? t.settings.importSuccess : t.settings.importError}
              </div>
            )}
          </div>
        </section>

        {/* Statement */}
        <section className="card" style={{ borderLeft: '3px solid var(--text-faint)' }}>
          <p className="text-sm text-themed-muted">{t.settings.statement}</p>
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

        {/* Save */}
        <button
          onClick={handleSave}
          className="btn-primary w-full"
        >
          {saved ? `${t.settings.saved} ✓` : t.settings.save}
        </button>

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
