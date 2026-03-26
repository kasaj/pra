import { ActivityDefinition, ActivityType } from '../types';
import { Translations } from '../i18n/translations';
import { translations } from '../i18n/translations';

const ACTIVITIES_STORAGE_KEY = 'pra_activities';

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
    const variants = 'variants' in activityTrans ? [...(activityTrans as unknown as { variants: readonly string[] }).variants] : undefined;
    return {
      type: base.type,
      emoji: base.emoji,
      durationMinutes: base.durationMinutes,
      name: activityTrans.name,
      description: activityTrans.desc,
      variants,
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
  const variants = 'variants' in activityTrans ? [...(activityTrans as unknown as { variants: readonly string[] }).variants] : activity.variants;
  return {
    ...activity,
    name: activityTrans.name,
    description: activityTrans.desc,
    variants,
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
    variants: ['Dýchání', 'Sken těla', 'Tiché zastavení'],
  },
  {
    type: 'pohyb',
    name: 'Pohyb',
    emoji: '🚶',
    description: 'Protažení, procvičení, posilování, sport nebo chůze s vnímáním těla',
    durationMinutes: 30,
    variants: ['Chůze', 'Protažení', 'Posilování', 'Jóga', 'Tanec'],
  },
  {
    type: 'rozjimani',
    name: 'Rozjímání',
    emoji: '🌅',
    description: 'Tiché sezení, otevřená otázka, vnitřní prostor, pozorování přírody, pocitů, myšlenek',
    durationMinutes: 15,
    variants: ['Tiché sezení', 'Kontemplace', 'Journaling', 'Vděčnost'],
  },
  // Nečasové aktivity
  {
    type: 'komentar',
    name: 'Komentář.',
    emoji: '📜',
    description: 'Reflexe, záměr, slovo nebo věta která provede dnem',
    durationMinutes: null,
  },
  {
    type: 'objeti',
    name: 'Objetí nebo kontakt',
    emoji: '🤗',
    description: 'Vědomý kontakt s druhým člověkem',
    durationMinutes: null,
  },
  {
    type: 'vyzva',
    name: 'Výzva',
    emoji: '🔥',
    description: 'Vědomé čelení tomu, čemu se vyhýbám. Jediná konkrétní akce uprostřed nepřehlednosti.',
    durationMinutes: null,
  },
];

export const loadActivities = (): ActivityDefinition[] => {
  try {
    const stored = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Při chybě vrátíme výchozí
  }
  return [...DEFAULT_ACTIVITIES];
};

export const saveActivities = (activities: ActivityDefinition[]): void => {
  localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
};

export const addCustomActivity = (activity: ActivityDefinition): ActivityDefinition[] => {
  const activities = loadActivities();
  activities.push(activity);
  saveActivities(activities);
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
  }
  return activities;
};

export const deleteActivity = (type: ActivityType): ActivityDefinition[] => {
  const activities = loadActivities();
  const filtered = activities.filter((a) => a.type !== type);
  saveActivities(filtered);
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
  return activities.find((a) => a.type === type);
};

export const isTimedActivity = (activity: ActivityDefinition): boolean => {
  return activity.durationMinutes !== null;
};

export const ACTIVITIES = DEFAULT_ACTIVITIES;
