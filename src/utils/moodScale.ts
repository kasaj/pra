export interface MoodScaleItem {
  value: number;
  emoji: string;
  labelCs?: string;
  labelEn?: string;
}

const STORAGE_KEY = 'pra_mood_scale';

const DEFAULT_SCALE: MoodScaleItem[] = [
  { value: 1, emoji: '😡', labelCs: 'Vztek', labelEn: 'Anger' },
  { value: 2, emoji: '😟', labelCs: 'Úzkost', labelEn: 'Anxiety' },
  { value: 3, emoji: '😕', labelCs: 'Sklíčenost', labelEn: 'Gloom' },
  { value: 4, emoji: '😐', labelCs: 'Neutrál', labelEn: 'Neutral' },
  { value: 5, emoji: '🙂', labelCs: 'Pohoda', labelEn: 'Fine' },
  { value: 6, emoji: '😊', labelCs: 'Radost', labelEn: 'Joy' },
  { value: 7, emoji: '😄', labelCs: 'Nadšení', labelEn: 'Excitement' },
];

export function loadMoodScale(): MoodScaleItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* default */ }
  return DEFAULT_SCALE;
}

export function saveMoodScale(scale: MoodScaleItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scale));
}

export function getDefaultMoodScale(): MoodScaleItem[] {
  return DEFAULT_SCALE;
}

/** Get emoji for a rating value from the current scale */
export function getMoodEmoji(rating: number, scale?: MoodScaleItem[]): string {
  const s = scale || loadMoodScale();
  const rounded = Math.round(Math.min(s[s.length - 1].value, Math.max(s[0].value, rating)));
  const item = s.find(i => i.value === rounded);
  return item?.emoji || '😐';
}
