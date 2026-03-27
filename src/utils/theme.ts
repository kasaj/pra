import { getCachedConfig } from './config';

export type Theme = 'classic' | 'modern' | 'dark';

const THEME_KEY = 'pra_theme';

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'classic' || stored === 'modern' || stored === 'dark') return stored;
  // Fallback to config default
  const configTheme = getCachedConfig()?.theme;
  if (configTheme === 'classic' || configTheme === 'modern' || configTheme === 'dark') return configTheme;
  return 'modern';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  // Modern follows system preference
  if (theme === 'modern') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'modern');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Listen for system theme changes (only relevant for modern)
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const current = localStorage.getItem('pra_theme');
    if (!current || current === 'modern') {
      applyTheme('modern');
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// Chart colors from CSS variables
export function getChartColors(): {
  before: string;
  after: string;
  barEmpty: string;
  barLow: string;
  barMid: string;
  barHigh: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
} {
  const style = getComputedStyle(document.documentElement);
  return {
    before: style.getPropertyValue('--chart-before').trim(),
    after: style.getPropertyValue('--chart-after').trim(),
    barEmpty: style.getPropertyValue('--chart-bar-empty').trim(),
    barLow: style.getPropertyValue('--chart-bar-low').trim(),
    barMid: style.getPropertyValue('--chart-bar-mid').trim(),
    barHigh: style.getPropertyValue('--chart-bar-high').trim(),
    tick: style.getPropertyValue('--chart-tick').trim(),
    tooltipBg: style.getPropertyValue('--chart-tooltip-bg').trim(),
    tooltipBorder: style.getPropertyValue('--chart-tooltip-border').trim(),
  };
}
