export interface ConfigInfo {
  title?: string;
  subtitle?: string;
  intro?: string;
  why?: string;
  how?: string;
  what?: string;
  bioTitle?: string;
  bioText?: string;
  psychTitle?: string;
  psychText?: string;
  philoTitle?: string;
  philoText?: string;
  noteWhy?: string;
  noteHow?: string;
  noteWhat?: string;
  // Legacy fields for backwards compat
  intro1?: string;
  intro2?: string;
  sequence?: string;
  intro3?: string;
}

export interface ConfigActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  cs: { name: string; description: string; variants?: string[] };
  en: { name: string; description: string; variants?: string[] };
}

export interface AppConfig {
  version: number;
  language?: string;
  theme?: string;
  activities: ConfigActivity[];
  info: {
    cs: ConfigInfo;
    en: ConfigInfo;
  };
}

function getConfigUrl(): string {
  // Derive base from pathname: /pra/ or /pra -> /pra/
  const path = window.location.pathname;
  const base = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
  return `${base}default-config.json`;
}

const CONFIG_HASH_KEY = 'pra_config_hash';
let cachedConfig: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch(getConfigUrl(), { cache: 'no-cache' });
    const text = await res.text();
    cachedConfig = JSON.parse(text);

    // Detect config changes - if hash differs, clear cached activities
    const newHash = simpleHash(text);
    const oldHash = localStorage.getItem(CONFIG_HASH_KEY);
    if (oldHash !== null && oldHash !== newHash) {
      // Config changed since last load - clear localStorage activities
      localStorage.removeItem('pra_activities');
    }
    localStorage.setItem(CONFIG_HASH_KEY, newHash);

    return cachedConfig!;
  } catch {
    return { version: 1, activities: [], info: { cs: {}, en: {} } };
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

export function getCachedConfig(): AppConfig | null {
  return cachedConfig;
}
