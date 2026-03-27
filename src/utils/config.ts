export interface ConfigInfo {
  title?: string;
  subtitle?: string;
  intro1?: string;
  intro2?: string;
  sequence?: string;
  intro3?: string;
  bioTitle?: string;
  bioText?: string;
  psychTitle?: string;
  psychText?: string;
  philoTitle?: string;
  philoText?: string;
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

let cachedConfig: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch(getConfigUrl(), { cache: 'no-cache' });
    cachedConfig = await res.json();
    return cachedConfig!;
  } catch {
    return { version: 1, activities: [], info: { cs: {}, en: {} } };
  }
}

export function getCachedConfig(): AppConfig | null {
  return cachedConfig;
}
