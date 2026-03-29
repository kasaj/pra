import { getCachedConfig } from './config';

const STORAGE_KEY = 'pra_variant_registry';
const MODIFIED_KEY = 'pra_variant_registry_modified';

function getLang(): 'cs' | 'en' {
  return localStorage.getItem('pra_language') === 'en' ? 'en' : 'cs';
}

function isUserModified(): boolean {
  return localStorage.getItem(MODIFIED_KEY) === '1';
}

export function markModified(): void {
  localStorage.setItem(MODIFIED_KEY, '1');
}

function getConfigDefaults(): string[] {
  const lang = getLang();
  const config = getCachedConfig();
  return config?.properties?.[lang] || [];
}

export function loadVariantRegistry(): string[] {
  // If user modified, return their version
  if (isUserModified()) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* fall through */ }
  }
  // Otherwise always use config defaults
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
    markModified();
  }
}

export function removeFromRegistry(variant: string): void {
  const registry = loadVariantRegistry().filter(v => v !== variant);
  saveVariantRegistry(registry);
  markModified();
}

export function rebuildRegistry(): string[] {
  const lang = getLang();
  const defaults = getConfigDefaults();
  const sorted = [...new Set(defaults)].sort((a, b) => a.localeCompare(b, lang));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  localStorage.removeItem(MODIFIED_KEY);
  return sorted;
}
