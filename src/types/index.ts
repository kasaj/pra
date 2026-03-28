export type ActivityType =
  | 'sobe'
  | 'pohyb'
  | 'rozjimani'
  | 'komentar'
  | 'objeti'
  | 'vyzva'
  | string; // Pro vlastní aktivity

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface ActivityDefinition {
  type: ActivityType;
  name: string;
  emoji: string;
  description: string;
  durationMinutes: number | null; // null = nečasová aktivita
  variants?: string[]; // Možnosti/varianty aktivity
}

export interface ActivityComment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  rating?: Rating;
}

export interface Activity {
  id: string;
  type: ActivityType;
  startedAt: string;
  completedAt: string;
  durationMinutes: number | null;
  actualDurationSeconds?: number;
  selectedVariant?: string;
  ratingBefore?: Rating | null;
  ratingAfter?: Rating | null;
  noteBefore?: string;
  noteAfter?: string;
  rating?: Rating | null;
  note?: string;
  comments?: ActivityComment[];
  linkedFromId?: string;
  linkedActivityIds?: string[];
}

export interface DayEntry {
  date: string; // YYYY-MM-DD
  activities: Activity[];
}

export interface UserSettings {
  language: 'cs' | 'en';
  name?: string;
}

export type Page = 'today' | 'time' | 'info' | 'settings';
