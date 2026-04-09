import { loadAllData, saveAllData } from './storage';
import { loadActivities, saveActivities } from './activities';
import { loadSettings, saveSettings } from './settings';
import { loadMoodScale, saveMoodScale, MoodScaleItem } from './moodScale';
import { Theme, saveTheme } from './theme';
import { getCachedConfig } from './config';
import { DayEntry, ActivityDefinition } from '../types';

export interface PraFile {
  type: 'backup' | 'config';
  version: 1;
  exportedAt: string;
  name?: string;
  language: string;
  theme: string;
  activities: ActivityDefinition[];
  info: Record<string, unknown>;
  history?: DayEntry[];
  notes?: { cs?: Record<string, string>; en?: Record<string, string> };
  userModified?: string[];
  sessionStart?: string;
  activityStats?: Record<string, unknown>;
  moodScale?: MoodScaleItem[];
  hiddenProperties?: string[];
  hiddenActivities?: string[];
  hiddenDurations?: number[];
  durationBubbles?: number[];
  deletedRecordIds?: string[];
  userDeleted?: string[];
}

export function generateBackup(lang: string, currentTheme: string, profileName: string): PraFile {
  const activities = loadActivities();
  const history = loadAllData();

  let hiddenActivitiesSet: Set<string> = new Set();
  let hiddenPropertiesSet: Set<string> = new Set();
  try { const s = localStorage.getItem('pra_hidden_activities'); if (s) hiddenActivitiesSet = new Set(JSON.parse(s)); } catch { /* */ }
  try { const s = localStorage.getItem('pra_hidden_properties'); if (s) hiddenPropertiesSet = new Set(JSON.parse(s)); } catch { /* */ }

  const exportActivities = activities
    .filter(a => a.core || !hiddenActivitiesSet.has(a.type))
    .map((a) => ({
      ...a,
      properties: a.core && a.properties ? a.properties.filter(p => !hiddenPropertiesSet.has(p)) : a.properties,
    }));

  const cfgInfo = { ...(getCachedConfig()?.info?.[lang as 'cs' | 'en'] || {}) };
  const loadNotes = (l: string) => {
    try { const s = localStorage.getItem(`pra_info_notes_${l}`); if (s) return JSON.parse(s); } catch {}
    return {};
  };

  let userModified: string[] = [];
  try { const s = localStorage.getItem('pra_user_modified_activities'); if (s) userModified = JSON.parse(s); } catch {}
  let deletedRecordIds: string[] = [];
  try { const s = localStorage.getItem('pra_deleted_record_ids'); if (s) deletedRecordIds = JSON.parse(s); } catch {}
  let userDeleted: string[] = [];
  try { const s = localStorage.getItem('pra_user_deleted_activities'); if (s) userDeleted = JSON.parse(s); } catch {}

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
    hiddenProperties: (() => { try { const s = localStorage.getItem('pra_hidden_properties'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    hiddenActivities: (() => { try { const s = localStorage.getItem('pra_hidden_activities'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    hiddenDurations: (() => { try { const s = localStorage.getItem('pra_hidden_durations'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    durationBubbles: (() => { try { const s = localStorage.getItem('pra_duration_bubbles'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
    deletedRecordIds: deletedRecordIds.length > 0 ? deletedRecordIds : undefined,
    userDeleted: userDeleted.length > 0 ? userDeleted : undefined,
  };
}

export function applyFullSync(file: PraFile): void {
  if (file.history) saveAllData(file.history);
  if (file.activities) saveActivities(file.activities);
  if (file.language) localStorage.setItem('pra_language', file.language);
  if (file.theme) saveTheme(file.theme as Theme);
  if (file.name) { const s = loadSettings(); saveSettings({ ...s, name: file.name }); }
  if (file.sessionStart) localStorage.setItem('pra_session_start', file.sessionStart);
  if (file.moodScale && file.moodScale.length > 0) saveMoodScale(file.moodScale);
  localStorage.setItem('pra_hidden_activities', JSON.stringify(file.hiddenActivities || []));
  localStorage.setItem('pra_hidden_properties', JSON.stringify(file.hiddenProperties || []));
  localStorage.setItem('pra_hidden_durations', JSON.stringify(file.hiddenDurations || []));
  localStorage.setItem('pra_duration_bubbles', JSON.stringify(file.durationBubbles || []));
  localStorage.setItem('pra_user_modified_activities', JSON.stringify(file.userModified || []));
  localStorage.setItem('pra_user_deleted_activities', JSON.stringify(file.userDeleted || []));
  localStorage.setItem('pra_deleted_record_ids', JSON.stringify(file.deletedRecordIds || []));
  if (file.notes?.cs) localStorage.setItem('pra_info_notes_cs', JSON.stringify(file.notes.cs));
  if (file.notes?.en) localStorage.setItem('pra_info_notes_en', JSON.stringify(file.notes.en));
}

function getSyncConfig() {
  const url = localStorage.getItem('pra_sync_url');
  const secret = localStorage.getItem('pra_sync_secret');
  if (!url || !secret) throw new Error('Sync not configured');
  return { url, secret };
}

export async function uploadSync(lang: string, theme: string, name: string): Promise<void> {
  const { url, secret } = getSyncConfig();
  const backup = generateBackup(lang, theme, name);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, action: 'upload', data: backup }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  localStorage.setItem('pra_last_synced', new Date().toISOString());
}

export async function downloadSync(): Promise<void> {
  const { url, secret } = getSyncConfig();
  const downloadUrl = `${url}?secret=${encodeURIComponent(secret)}`;
  const response = await fetch(downloadUrl, { method: 'GET' });
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch { /* */ }
    console.error('downloadSync failed', response.status, detail);
    const err = new Error(`HTTP ${response.status}: ${detail}`) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  const data = await response.json() as PraFile;
  applyFullSync(data);
  localStorage.setItem('pra_last_synced', new Date().toISOString());
}
