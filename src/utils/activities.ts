import { ActivityDefinition, ActivityType } from '../types';
import { Translations } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { getCachedConfig } from './config';
import { loadAllData, saveAllData } from './storage';

const ACTIVITIES_STORAGE_KEY = 'pra_activities';
const USER_MODIFIED_KEY = 'pra_user_modified_activities';
const USER_DELETED_KEY = 'pra_user_deleted_activities';

// Track which activity types the user has explicitly edited
function getUserModified(): Set<string> {
  try {
    const stored = localStorage.getItem(USER_MODIFIED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* default */ }
  return new Set();
}

export function markActivityModified(type: string): void {
  markUserModified(type);
}

function getUserDeleted(): Set<string> {
  try {
    const stored = localStorage.getItem(USER_DELETED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* default */ }
  return new Set();
}

function markUserDeleted(type: string): void {
  const deleted = getUserDeleted();
  deleted.add(type);
  localStorage.setItem(USER_DELETED_KEY, JSON.stringify([...deleted]));
}

function markUserModified(type: string): void {
  const modified = getUserModified();
  modified.add(type);
  localStorage.setItem(USER_MODIFIED_KEY, JSON.stringify([...modified]));
}

// Default activity types that have translations
const TRANSLATABLE_TYPES = ['sobe', 'pohyb', 'rozjimani', 'komentar', 'objeti', 'vyzva'] as const;

// Base activity definitions (without translations)
const DEFAULT_ACTIVITY_BASE: Array<{
  type: ActivityType;
  emoji: string;
  durationMinutes: number | null;
}> = [
  { type: 'sobe', emoji: '⏸️', durationMinutes: 3 },
  { type: 'pohyb', emoji: '🚶', durationMinutes: 30 },
  { type: 'rozjimani', emoji: '🌅', durationMinutes: 15 },
  { type: 'komentar', emoji: '📜', durationMinutes: null },
  { type: 'objeti', emoji: '🤗', durationMinutes: null },
  { type: 'vyzva', emoji: '🔥', durationMinutes: null },
];

// Get localized default activities
export const getDefaultActivities = (t: Translations): ActivityDefinition[] => {
  return DEFAULT_ACTIVITY_BASE.map((base) => {
    const activityTrans = t.activities[base.type as keyof typeof t.activities];
    const properties = 'variants' in activityTrans ? [...(activityTrans as unknown as { variants: readonly string[] }).variants] : undefined;
    return {
      type: base.type,
      emoji: base.emoji,
      durationMinutes: base.durationMinutes,
      name: activityTrans.name,
      description: activityTrans.desc,
      properties,
    };
  });
};

// Check if activity type is a default translatable type
export const isTranslatableType = (type: string): boolean => {
  const normalizedType = type.trim().toLowerCase();
  return TRANSLATABLE_TYPES.some(t => t.toLowerCase() === normalizedType);
};

// Get the canonical type for translation lookup
const getCanonicalType = (type: string): string => {
  const normalizedType = type.trim().toLowerCase();
  return TRANSLATABLE_TYPES.find(t => t.toLowerCase() === normalizedType) || type;
};

// Check if activity name/description were customized by the user
const isCustomized = (activity: ActivityDefinition): boolean => {
  if (!isTranslatableType(activity.type)) return true;
  const canonicalType = getCanonicalType(activity.type) as keyof typeof translations.cs.activities;
  const csTrans = translations.cs.activities[canonicalType];
  const enTrans = translations.en.activities[canonicalType];
  if (!csTrans || !enTrans) return true;
  // If name matches neither CS nor EN default, user has customized it
  const isDefaultName = activity.name === csTrans.name || activity.name === enTrans.name;
  return !isDefaultName;
};

// Get translated activity (for display purposes)
export const getTranslatedActivity = (
  activity: ActivityDefinition,
  t: Translations
): ActivityDefinition => {
  if (!isTranslatableType(activity.type)) {
    return activity;
  }
  // If user has customized the name, don't override with translation
  if (isCustomized(activity)) {
    return activity;
  }
  const canonicalType = getCanonicalType(activity.type);
  const activityTrans = t.activities[canonicalType as keyof typeof t.activities];
  if (!activityTrans) {
    return activity;
  }
  // Keep user's properties from stored definition - translation only provides name/description
  const properties = activity.properties;
  return {
    ...activity,
    name: activityTrans.name,
    description: activityTrans.desc,
    properties,
  };
};

export const DEFAULT_ACTIVITIES: ActivityDefinition[] = [
  // Časové aktivity
  {
    type: 'sobe',
    name: 'Zastavení',
    emoji: '⏸️',
    description: 'Na pár minut se zastavit, vnímat, pobýt sám se sebou',
    durationMinutes: 3,
    properties: ['Dýchání', 'Sken těla', 'Tiché zastavení'],
  },
  {
    type: 'pohyb',
    name: 'Pohyb',
    emoji: '🚶',
    description: 'Protažení, procvičení, posilování, sport nebo chůze s vnímáním těla',
    durationMinutes: 30,
    properties: ['Chůze', 'Protažení', 'Posilování', 'Jóga', 'Tanec'],
  },
  {
    type: 'rozjimani',
    name: 'Rozjímání',
    emoji: '🌅',
    description: 'Tiché sezení, otevřená otázka, vnitřní prostor, pozorování přírody, pocitů, myšlenek',
    durationMinutes: 15,
    properties: ['Tiché sezení', 'Kontemplace', 'Journaling', 'Vděčnost'],
  },
  // Nečasové aktivity
  {
    type: 'komentar',
    name: 'Komentář',
    emoji: '📜',
    description: 'Reflexe, záměr, slovo nebo věta která provede dnem',
    durationMinutes: null,
    properties: ['Ranní záměr', 'Večerní reflexe', 'Vděčnost', 'Afirmace'],
  },
  {
    type: 'objeti',
    name: 'Objetí nebo kontakt',
    emoji: '🤗',
    description: 'Vědomý kontakt s druhým člověkem',
    durationMinutes: null,
    properties: ['Objetí', 'Podání ruky', 'Oční kontakt', 'Rozhovor'],
  },
  {
    type: 'vyzva',
    name: 'Výzva',
    emoji: '🔥',
    description: 'Vědomé čelení tomu, čemu se vyhýbám. Jediná konkrétní akce uprostřed nepřehlednosti.',
    durationMinutes: null,
    properties: ['Konfrontace strachu', 'Těžký rozhovor', 'Nový návyk', 'Malý krok'],
  },
];

const getDefaultFromConfig = (lang?: string): ActivityDefinition[] => {
  const config = getCachedConfig();
  // Config not yet loaded — return empty so we don't pollute localStorage with hardcoded defaults
  if (!config) return [];
  // Config loaded but has no activities (edge case) — also return empty
  if (!config.activities?.length) return [];
  const l = lang || (localStorage.getItem('pra_language') === 'en' ? 'en' : 'cs');
  return config.activities.map((item) => {
    const localized = l === 'en' ? item.en : item.cs;
    return {
      type: item.type as ActivityType,
      emoji: item.emoji,
      durationMinutes: item.durationMinutes,
      name: localized.name,
      description: localized.description,
      properties: localized.properties,
      core: item.core,
    };
  });
};

// Extract emoji from the first property of a record's selectedVariant
export const getRecordEmoji = (selectedVariant?: string, defaultEmoji?: string): string => {
  if (!selectedVariant) return defaultEmoji || '';
  const firstProp = selectedVariant.split(',')[0].trim();
  if (!firstProp) return defaultEmoji || '';
  // Check if the property starts with an emoji
  const emojiMatch = firstProp.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  if (emojiMatch) return emojiMatch[0];
  return defaultEmoji || '';
};

// Get config properties for an activity type
export const getConfigProperties = (type: string): string[] => {
  const config = getCachedConfig();
  if (!config?.activities?.length) return [];
  const lang = localStorage.getItem('pra_language') === 'en' ? 'en' : 'cs';
  const item = config.activities.find((a: { type: string }) => a.type === type);
  if (!item) return [];
  const localized = lang === 'en' ? item.en : item.cs;
  return localized?.properties || [];
};

// Merge config activities into existing user activities
// - User-modified activities: keep user version
// - Non-modified activities: update from config
// - New activities in config: add them
export const mergeWithConfig = (existing: ActivityDefinition[]): ActivityDefinition[] => {
  const configActivities = getDefaultFromConfig();
  const userModified = getUserModified();
  const configByType = new Map(configActivities.map(a => [a.type, a]));
  const existingTypes = new Set(existing.map(a => a.type));

  let changed = false;

  // Update existing non-modified activities from config
  const merged = existing.map(a => {
    const fromConfig = configByType.get(a.type);
    if (!fromConfig) return a; // not in config (custom) - keep
    // Always sync core flag from config
    if (a.core !== fromConfig.core) {
      a = { ...a, core: fromConfig.core };
      changed = true;
    }
    if (userModified.has(a.type)) return a; // user edited - keep as-is
    if (a.core) {
      // Core activity: sync properties from config (e.g. on language change), keep rest
      if (fromConfig && JSON.stringify(a.properties) !== JSON.stringify(fromConfig.properties)) {
        changed = true;
        return { ...a, properties: fromConfig.properties };
      }
      return a;
    }
    // Check if different
    if (a.name !== fromConfig.name || a.description !== fromConfig.description ||
        a.emoji !== fromConfig.emoji || a.durationMinutes !== fromConfig.durationMinutes ||
        JSON.stringify(a.properties) !== JSON.stringify(fromConfig.properties)) {
      changed = true;
      return fromConfig;
    }
    return a;
  });

  // Add new activities from config (skip user-deleted ones)
  const deletedTypes = getUserDeleted();
  const newFromConfig = configActivities.filter(a => !existingTypes.has(a.type) && !deletedTypes.has(a.type));
  if (newFromConfig.length > 0) {
    merged.push(...newFromConfig);
    changed = true;
  }

  if (changed) {
    saveActivities(merged);
  }
  return merged;
};

export const loadActivities = (): ActivityDefinition[] => {
  try {
    const stored = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (stored) {
      const activities = JSON.parse(stored) as ActivityDefinition[];
      // Auto-merge new activities from config
      return mergeWithConfig(activities);
    }
  } catch {
    // Při chybě vrátíme výchozí
  }
  const defaults = getDefaultFromConfig();
  if (defaults.length > 0) saveActivities(defaults);
  return defaults;
};

export const saveActivities = (activities: ActivityDefinition[]): void => {
  localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
};

export const addCustomActivity = (activity: ActivityDefinition): ActivityDefinition[] => {
  const activities = loadActivities();
  activities.push(activity);
  saveActivities(activities);
  markUserModified(activity.type);
  return activities;
};

export const updateActivity = (
  type: ActivityType,
  updates: Partial<ActivityDefinition>
): ActivityDefinition[] => {
  const activities = loadActivities();
  const index = activities.findIndex((a) => a.type === type);
  if (index >= 0) {
    activities[index] = { ...activities[index], ...updates };
    saveActivities(activities);
    markUserModified(type);
  }
  return activities;
};

export const deleteActivity = (type: ActivityType): ActivityDefinition[] => {
  const activities = loadActivities();
  const filtered = activities.filter((a) => a.type !== type);
  saveActivities(filtered);
  markUserModified(type);
  markUserDeleted(type);

  // Remove all records of this activity type from history
  const allData = loadAllData();
  const cleaned = allData
    .map(d => ({
      ...d,
      activities: d.activities.filter(a => a.type !== type),
    }))
    .filter(d => d.activities.length > 0);
  saveAllData(cleaned);
  return filtered;
};

export const resetActivities = (): ActivityDefinition[] => {
  const defaults = [...DEFAULT_ACTIVITIES];
  saveActivities(defaults);
  return defaults;
};

export const generateActivityType = (): ActivityType => {
  return `custom_${Date.now()}` as ActivityType;
};

export const getActivityByType = (type: string): ActivityDefinition | undefined => {
  const activities = loadActivities();
  const found = activities.find((a) => a.type === type);
  if (found) return found;
  // Check archived (deleted) activities for history display
  try {
    const archived = JSON.parse(localStorage.getItem('pra_archived_activities') || '{}');
    if (archived[type]) {
      return { type, emoji: archived[type].emoji, name: archived[type].name, description: '', durationMinutes: null };
    }
  } catch { /* ignore */ }
  return undefined;
};

export const isTimedActivity = (activity: ActivityDefinition): boolean => {
  return activity.durationMinutes !== null;
};

export const ACTIVITIES = DEFAULT_ACTIVITIES;
