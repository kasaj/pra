export interface ConfigQuote {
  text: string;
  author: string;
}

export interface ConfigInfo {
  title?: string;
  subtitle?: string;
  body?: string;
  quotes?: ConfigQuote[];
  featuredQuote?: ConfigQuote;
  why?: string;
  noteWhy?: string;
}

export interface ConfigActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  core?: boolean;
  cs: { name: string; description: string; properties?: string[] };
  en: { name: string; description: string; properties?: string[] };
}

export interface AppConfig {
  version: number;
  name?: string;
  language?: string;
  theme?: string;
  activities: ConfigActivity[];
  properties?: { cs: string[]; en: string[] };
  moodScale?: Array<{ value: number; emoji: string; labelCs?: string; labelEn?: string }>;
  info: {
    cs: ConfigInfo;
    en: ConfigInfo;
  };
  infoActivity?: { emoji: string; name: string; comment: string };
}

// Flat single-language activity format (used in language-specific config files)
interface FlatActivity {
  type: string;
  emoji: string;
  durationMinutes: number | null;
  core?: boolean;
  name: string;
  description: string;
  properties?: string[];
  durationOptions?: number[];
  defaultDuration?: number;
}

// Flat single-language config format (default-config-cs.json / default-config-en.json)
interface FlatAppConfig {
  version: number;
  language: string;
  theme?: string;
  activities: FlatActivity[];
  moodScale?: Array<{ value: number; emoji: string; labelCs?: string; labelEn?: string }>;
  info: { cs?: ConfigInfo; en?: ConfigInfo };
  infoActivity?: { emoji: string; name: string; comment: string };
}

function getConfigUrl(): string {
  const path = window.location.pathname;
  const base = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
  const lang = localStorage.getItem('pra_language') || 'cs';
  return `${base}default-config-${lang}.json`;
}

// Normalize flat single-language config into AppConfig (bilingual internal format)
function normalizeFlatConfig(flat: FlatAppConfig): AppConfig {
  const lang = flat.language as 'cs' | 'en';
  const activities: ConfigActivity[] = flat.activities.map((a) => {
    const localized = { name: a.name, description: a.description, properties: a.properties };
    return { type: a.type, emoji: a.emoji, durationMinutes: a.durationMinutes, core: a.core, cs: localized, en: localized };
  });

  const infoLang = flat.info[lang] || {};
  return {
    version: flat.version,
    language: flat.language,
    theme: flat.theme,
    activities,
    moodScale: flat.moodScale,
    info: {
      cs: lang === 'cs' ? infoLang : {},
      en: lang === 'en' ? infoLang : {},
    } as AppConfig['info'],
    infoActivity: flat.infoActivity,
  };
}

const CONFIG_HASH_KEY = 'pra_config_hash';
let cachedConfig: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  return fetchConfig();
}

async function fetchConfig(): Promise<AppConfig> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(getConfigUrl(), { cache: 'no-cache', signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    const parsed = JSON.parse(text);

    // Detect flat (single-language) format by absence of cs/en on first activity
    const firstActivity = parsed.activities?.[0];
    const isFlat = firstActivity && !firstActivity.cs && !firstActivity.en && firstActivity.name;
    cachedConfig = isFlat ? normalizeFlatConfig(parsed as FlatAppConfig) : (parsed as AppConfig);

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
  const prev = cachedConfig;
  cachedConfig = null; // force re-fetch
  await fetchConfig().catch(() => {
    // Network failed — restore previous config, don't break the app
    if (prev) cachedConfig = prev;
  });
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

export function clearConfigCache(): void {
  cachedConfig = null;
}
