import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { loadSettings, saveSettings } from '../utils/settings';
import { loadAllData } from '../utils/storage';
import { getActivityByType, loadActivities, saveActivities } from '../utils/activities';
import { translations } from '../i18n/translations';
import { DayEntry, ActivityDefinition } from '../types';

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
        date: 'Datum', activity: 'Aktivita', duration: 'Čas', rating: 'Hodnocení', note: 'Poznámka',
        summary: 'Shrnutí', totalActivities: 'Celkem aktivit', totalTime: 'Celkový čas',
        avgRating: 'Průměrné hodnocení', weeklyTitle: 'Týdenní přehled', records: 'Záznamy'
      }
    : {
        date: 'Date', activity: 'Activity', duration: 'Duration', rating: 'Rating', note: 'Note',
        summary: 'Summary', totalActivities: 'Total activities', totalTime: 'Total time',
        avgRating: 'Average rating', weeklyTitle: 'Weekly overview', records: 'Records'
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

  data.forEach((day) => {
    day.activities.forEach((activity) => {
      totalActivities++;
      const secs = activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 0);
      totalSeconds += secs;
      if (activity.ratingAfter) ratings.push(activity.ratingAfter);
      else if (activity.rating) ratings.push(activity.rating);

      if (day.date >= weekAgoStr) {
        weekActivities++;
        weekSeconds += secs;
      }
    });
  });

  const toHM = (s: number) => ({ h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  const total = toHM(totalSeconds);
  const weekHM = toHM(weekSeconds);
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
  const activitiesLabel = lang === 'cs' ? 'aktivit' : 'activities';
  const timeLabel = lang === 'cs' ? 'čas' : 'time';

  // Summary section
  md += `## ${t.summary}\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| **${weekLabel} ${activitiesLabel}** | ${weekActivities} |\n`;
  md += `| **${weekLabel} ${timeLabel}** | ${fmtTime(weekHM)} |\n`;
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
          : '-';

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

interface ConfigActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  cs: { name: string; description: string; variants?: string[] };
  en: { name: string; description: string; variants?: string[] };
}

interface ConfigInfo {
  cs: {
    title: string;
    subtitle: string;
    intro1: string;
    intro2: string;
    sequence: string;
    intro3: string;
    bioTitle: string;
    bioText: string;
    psychTitle: string;
    psychText: string;
    philoTitle: string;
    philoText: string;
  };
  en: {
    title: string;
    subtitle: string;
    intro1: string;
    intro2: string;
    sequence: string;
    intro3: string;
    bioTitle: string;
    bioText: string;
    psychTitle: string;
    psychText: string;
    philoTitle: string;
    philoText: string;
  };
}

interface AppConfig {
  version: 1;
  exportedAt: string;
  activities: ConfigActivity[];
  info: ConfigInfo;
}

function generateConfig(): AppConfig {
  const activities = loadActivities();
  const cs = translations.cs;
  const en = translations.en;

  const configActivities: ConfigActivity[] = activities.map((activity) => {
    const csTransKey = activity.type as keyof typeof cs.activities;
    const enTransKey = activity.type as keyof typeof en.activities;
    const csTrans = cs.activities[csTransKey];
    const enTrans = en.activities[enTransKey];

    const csData: ConfigActivity['cs'] = csTrans
      ? { name: csTrans.name, description: csTrans.desc, ...('variants' in csTrans ? { variants: [...csTrans.variants] } : {}) }
      : { name: activity.name, description: activity.description, ...(activity.variants ? { variants: activity.variants } : {}) };

    const enData: ConfigActivity['en'] = enTrans
      ? { name: enTrans.name, description: enTrans.desc, ...('variants' in enTrans ? { variants: [...enTrans.variants] } : {}) }
      : { name: activity.name, description: activity.description, ...(activity.variants ? { variants: activity.variants } : {}) };

    return {
      type: activity.type,
      emoji: activity.emoji,
      durationMinutes: activity.durationMinutes,
      cs: csData,
      en: enData,
    };
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activities: configActivities,
    info: {
      cs: { ...translations.cs.info },
      en: { ...translations.en.info },
    },
  };
}

function importConfig(config: AppConfig, lang: string): ActivityDefinition[] {
  const activities: ActivityDefinition[] = config.activities.map((item) => {
    const localized = lang === 'cs' ? item.cs : item.en;
    return {
      type: item.type,
      emoji: item.emoji,
      durationMinutes: item.durationMinutes,
      name: localized.name,
      description: localized.description,
      variants: localized.variants,
    };
  });
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
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const settings = loadSettings();
    setName(settings.name || '');
    setEmail(settings.email || '');
  }, []);

  const handleSave = () => {
    saveSettings({ language, name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportHistory = useCallback(() => {
    const data = loadAllData();
    const markdown = generateHistoryMarkdown(data, language);
    downloadFile(markdown, `pra-history-${new Date().toISOString().split('T')[0]}.md`);
  }, [language]);

  const handleExportConfig = useCallback(() => {
    const config = generateConfig();
    const json = JSON.stringify(config, null, 2);
    downloadFile(json, `pra-config-${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8');
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
        const config = JSON.parse(event.target?.result as string) as AppConfig;
        if (!config.version || !Array.isArray(config.activities)) {
          throw new Error('Invalid config format');
        }
        importConfig(config, language);
        setImportStatus('success');
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
        <h1 className="font-serif text-3xl text-clay-800">{t.settings.title}</h1>
      </header>

      <div className="space-y-6">
        {/* Profil */}
        <section className="card">
          <h2 className="font-serif text-lg text-clay-800 mb-4">
            {t.settings.profile}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-clay-600 mb-2">
                {t.settings.name}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.settings.namePlaceholder}
                className="w-full p-3 rounded-xl bg-cream-100 border border-clay-200
                         focus:outline-none focus:border-forest-400
                         text-clay-800 placeholder:text-clay-400"
              />
            </div>
          </div>
        </section>

        {/* Export / Import */}
        <section className="card">
          <h2 className="font-serif text-lg text-clay-800 mb-4">
            {t.settings.export}
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleExportHistory}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-cream-100 border border-clay-200
                       hover:border-clay-300 transition-colors text-left"
            >
              <svg className="w-5 h-5 text-clay-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div>
                <div className="text-clay-800 font-medium">{t.settings.exportHistory}</div>
                <div className="text-sm text-clay-500">{t.settings.exportHistoryDesc}</div>
              </div>
            </button>
            <button
              onClick={handleExportConfig}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-cream-100 border border-clay-200
                       hover:border-clay-300 transition-colors text-left"
            >
              <svg className="w-5 h-5 text-clay-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div>
                <div className="text-clay-800 font-medium">{t.settings.exportConfig}</div>
                <div className="text-sm text-clay-500">{t.settings.exportConfigDesc}</div>
              </div>
            </button>
            <label
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-cream-100 border border-clay-200
                       hover:border-clay-300 transition-colors text-left cursor-pointer"
            >
              <svg className="w-5 h-5 text-clay-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0L16 8m4-4v12" />
              </svg>
              <div>
                <div className="text-clay-800 font-medium">{t.settings.importConfig}</div>
                <div className="text-sm text-clay-500">{t.settings.importConfigDesc}</div>
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
                  ? 'bg-forest-100 text-forest-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {importStatus === 'success' ? t.settings.importSuccess : t.settings.importError}
              </div>
            )}
          </div>
        </section>

        {/* Jazyk */}
        <section className="card">
          <h2 className="font-serif text-lg text-clay-800 mb-4">
            {t.settings.language}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage('cs')}
              className={`flex-1 py-3 px-4 rounded-xl border transition-colors ${
                language === 'cs'
                  ? 'bg-forest-100 border-forest-400 text-forest-700'
                  : 'bg-cream-100 border-clay-200 text-clay-600 hover:border-clay-300'
              }`}
            >
              Čeština
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 px-4 rounded-xl border transition-colors ${
                language === 'en'
                  ? 'bg-forest-100 border-forest-400 text-forest-700'
                  : 'bg-cream-100 border-clay-200 text-clay-600 hover:border-clay-300'
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Subscription */}
        <section className="card">
          <h2 className="font-serif text-lg text-clay-800 mb-4">
            {t.settings.subscription}
          </h2>
          <div className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.settings.subscriptionPlaceholder}
                className="w-full p-3 rounded-xl bg-cream-100 border border-clay-200
                         focus:outline-none focus:border-forest-400
                         text-clay-800 placeholder:text-clay-400"
              />
            </div>
            <button
              onClick={handleSave}
              className="btn-primary w-full"
            >
              {saved ? `${t.settings.saved} ✓` : t.settings.save}
            </button>
          </div>
        </section>

        {/* Reset */}
        <section className="card border-ochre-200">
          <button
            onClick={handleReset}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <svg className="w-5 h-5 text-ochre-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <div className="text-ochre-700 font-medium">{t.settings.resetDefault}</div>
              <div className="text-sm text-clay-500">{t.settings.resetDefaultDesc}</div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
}
