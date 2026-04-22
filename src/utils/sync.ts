import { loadAllData, saveAllData } from './storage';
import { loadActivities, saveActivities } from './activities';
import { loadSettings, saveSettings } from './settings';
import { loadMoodScale, saveMoodScale, MoodScaleItem } from './moodScale';
import { Theme, saveTheme } from './theme';
import { getCachedConfig } from './config';
import { loadInfoActivity, saveInfoActivity, InfoActivity } from './infoActivity';
import { DayEntry, Activity, ActivityDefinition } from '../types';

/** Merge two history arrays by activity ID.
 *  - Tombstoned IDs (deletedIds) are excluded from the result.
 *  - If the same ID exists in both, the version with the later timestamp wins.
 *  - Activities only in one side are always included (unless tombstoned).
 */
export function mergeHistory(
  local: DayEntry[],
  remote: DayEntry[],
  deletedIds: Set<string>,
): DayEntry[] {
  // date → (activityId → Activity)
  const byDate = new Map<string, Map<string, Activity>>();

  const absorb = (days: DayEntry[]) => {
    for (const day of days) {
      if (!byDate.has(day.date)) byDate.set(day.date, new Map());
      const dayMap = byDate.get(day.date)!;
      for (const activity of day.activities) {
        // Surrogate key for activities without id (old backup format)
        const key: string = activity.id ||
          `${activity.startedAt || activity.completedAt || day.date}-${activity.type}-noId`;
        if (deletedIds.has(key) || (activity.id && deletedIds.has(activity.id))) continue;
        const existing = dayMap.get(key);
        if (!existing) {
          dayMap.set(key, activity);
        } else {
          // Keep the more recently completed/started version
          const tsExisting = new Date(existing.completedAt || existing.startedAt).getTime();
          const tsNew = new Date(activity.completedAt || activity.startedAt).getTime();
          if (tsNew > tsExisting) dayMap.set(key, activity);
        }
      }
    }
  };

  absorb(remote);
  absorb(local); // local with newer timestamps overwrites

  const result: DayEntry[] = [];
  for (const [date, actMap] of byDate) {
    const activities = [...actMap.values()].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    if (activities.length > 0) result.push({ date, activities });
  }
  result.sort((a, b) => b.date.localeCompare(a.date));
  return result;
}

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
  infoActivity?: InfoActivity;
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
    infoActivity: loadInfoActivity(),
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
  if (file.infoActivity) saveInfoActivity(file.infoActivity);
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
  // POST without "data" = download
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  });
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch { /* */ }
    console.error('downloadSync failed', response.status, detail);
    const err = new Error(`HTTP ${response.status}: ${detail}`) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  const remote = await response.json() as PraFile;

  // --- Merge history (local + remote, dedup by ID, tombstones respected) ---
  const localHistory = loadAllData();

  // Union tombstones from both sides so deletions propagate in both directions
  const localDeletedIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('pra_deleted_record_ids') || '[]'); } catch { return []; }
  })();
  const remoteDeletedIds: string[] = remote.deletedRecordIds || [];
  const mergedDeletedIds = new Set<string>([...localDeletedIds, ...remoteDeletedIds]);

  // Union user-modified / user-deleted activity type lists
  const localUserModified: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('pra_user_modified_activities') || '[]'); } catch { return []; }
  })();
  const localUserDeleted: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('pra_user_deleted_activities') || '[]'); } catch { return []; }
  })();
  const mergedUserModified = [...new Set([...localUserModified, ...(remote.userModified || [])])];
  const mergedUserDeleted  = [...new Set([...localUserDeleted,  ...(remote.userDeleted  || [])])];

  const mergedHistory = mergeHistory(localHistory, remote.history || [], mergedDeletedIds);

  // Apply everything — history via merged result, rest from remote (server is source of truth)
  saveAllData(mergedHistory);
  if (remote.activities) saveActivities(remote.activities);
  if (remote.language) localStorage.setItem('pra_language', remote.language);
  if (remote.theme) saveTheme(remote.theme as Theme);
  if (remote.name) { const s = loadSettings(); saveSettings({ ...s, name: remote.name }); }
  if (remote.sessionStart) localStorage.setItem('pra_session_start', remote.sessionStart);
  if (remote.moodScale && remote.moodScale.length > 0) saveMoodScale(remote.moodScale);
  if (remote.hiddenActivities !== undefined)
    localStorage.setItem('pra_hidden_activities', JSON.stringify(remote.hiddenActivities));
  if (remote.hiddenProperties !== undefined)
    localStorage.setItem('pra_hidden_properties', JSON.stringify(remote.hiddenProperties));
  if (remote.hiddenDurations !== undefined)
    localStorage.setItem('pra_hidden_durations', JSON.stringify(remote.hiddenDurations));
  if (remote.durationBubbles !== undefined)
    localStorage.setItem('pra_duration_bubbles', JSON.stringify(remote.durationBubbles));
  if (remote.notes?.cs) localStorage.setItem('pra_info_notes_cs', JSON.stringify(remote.notes.cs));
  if (remote.notes?.en) localStorage.setItem('pra_info_notes_en', JSON.stringify(remote.notes.en));
  if (remote.infoActivity) saveInfoActivity(remote.infoActivity);

  // Persist merged tombstones & type lists
  localStorage.setItem('pra_deleted_record_ids',       JSON.stringify([...mergedDeletedIds]));
  localStorage.setItem('pra_user_modified_activities', JSON.stringify(mergedUserModified));
  localStorage.setItem('pra_user_deleted_activities',  JSON.stringify(mergedUserDeleted));

  localStorage.setItem('pra_last_synced', new Date().toISOString());
}
