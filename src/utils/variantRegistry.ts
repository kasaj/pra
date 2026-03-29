import { loadActivities, saveActivities } from './activities';
import { getCachedConfig } from './config';

const STORAGE_KEY = 'pra_variant_registry';
const DIRTY_KEY = 'pra_variant_registry_dirty';

function getLang(): 'cs' | 'en' {
  return localStorage.getItem('pra_language') === 'en' ? 'en' : 'cs';
}

export function loadVariantRegistry(): string[] {
  // Rebuild if flagged dirty (e.g. after config merge)
  if (localStorage.getItem(DIRTY_KEY)) {
    localStorage.removeItem(DIRTY_KEY);
    return rebuildRegistry();
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* default */ }
  return rebuildRegistry();
}

export function saveVariantRegistry(variants: string[]): void {
  const lang = getLang();
  const unique = [...new Set(variants)].sort((a, b) => a.localeCompare(b, lang));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

export function addToRegistry(variant: string): void {
  const registry = loadVariantRegistry();
  if (!registry.includes(variant)) {
    registry.push(variant);
    saveVariantRegistry(registry);
  }
}

export function removeFromRegistry(variant: string): void {
  const registry = loadVariantRegistry().filter(v => v !== variant);
  saveVariantRegistry(registry);

  // Also remove from all activities
  const activities = loadActivities();
  let changed = false;
  activities.forEach(a => {
    if (a.properties?.includes(variant)) {
      a.properties = a.properties.filter(v => v !== variant);
      if (a.properties.length === 0) a.properties = undefined;
      changed = true;
    }
  });
  if (changed) saveActivities(activities);
}

export function rebuildRegistry(): string[] {
  const lang = getLang();
  const all = new Set<string>();
  // From config default properties (language-specific)
  const config = getCachedConfig();
  const configProps = config?.properties;
  if (configProps) {
    const langProps = configProps[lang] || [];
    langProps.forEach(v => all.add(v));
  }
  // From all activities
  const activities = loadActivities();
  activities.forEach(a => a.properties?.forEach(v => all.add(v)));
  const sorted = [...all].sort((a, b) => a.localeCompare(b, lang));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}
