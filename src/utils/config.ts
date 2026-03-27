export interface ConfigQuote {
  text: string;
  author: string;
}

export interface ConfigInfo {
  title?: string;
  subtitle?: string;
  statement?: string;
  intro?: string;
  quotes?: ConfigQuote[];
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
  name?: string;
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
  return fetchConfig();
}

async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(getConfigUrl(), { cache: 'no-cache' });
    const text = await res.text();
    cachedConfig = JSON.parse(text);

    // Track config hash - detect changes
    const newHash = simpleHash(text);
    localStorage.setItem(CONFIG_HASH_KEY, newHash);

    return cachedConfig!;
  } catch {
    return cachedConfig || { version: 1, activities: [], info: { cs: {}, en: {} } };
  }
}

// Check for config updates (call on visibility change / interval)
export async function checkConfigUpdate(): Promise<boolean> {
  const oldHash = localStorage.getItem(CONFIG_HASH_KEY);
  cachedConfig = null; // force re-fetch
  await fetchConfig();
  const newHash = localStorage.getItem(CONFIG_HASH_KEY);
  return oldHash !== newHash;
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
