export type ActivityType =
  | 'sobe'
  | 'pohyb'
  | 'rozjimani'
  | 'komentar'
  | 'objeti'
  | 'vyzva'
  | string; // Pro vlastní aktivity

export interface ActivityDefinition {
  type: ActivityType;
  name: string;
  emoji: string;
  description: string;
  durationMinutes: number | null; // null = nečasová aktivita
  variants?: string[]; // Možnosti/varianty aktivity
}

export interface Activity {
  id: string;
  type: ActivityType;
  startedAt: string;
  completedAt: string;
  durationMinutes: number | null;
  actualDurationSeconds?: number; // Skutečně strávený čas
  selectedVariant?: string; // Vybraná varianta
  ratingBefore?: Rating | null;
  ratingAfter?: Rating | null;
  noteBefore?: string;
  noteAfter?: string;
  rating?: Rating | null;
  note?: string;
}

export interface DayEntry {
  date: string; // YYYY-MM-DD
  activities: Activity[];
}

export interface UserSettings {
  language: 'cs' | 'en';
  name?: string;
  email?: string;
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export type Page = 'today' | 'time' | 'info' | 'settings';
