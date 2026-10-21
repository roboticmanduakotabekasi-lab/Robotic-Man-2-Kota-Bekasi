export type ThemeColor = 'indigo';

export interface ThemeConfig {
  id: ThemeColor;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  colorHex: string;
  accentHex: string;
  lightBgHex: string;
  borderHex: string;
  // Tailwind utility classes
  primaryBg: string;
  primaryHoverBg: string;
  primaryText: string;
  primaryBorder: string;
  primaryRing: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  lightBg: string;
  lightBorder: string;
  activeNavTab: string;
  activeNavIcon: string;
  activeNavBadge: string;
  brandGradient: string;
}

export const THEMES: Record<ThemeColor, ThemeConfig> = {
  indigo: {
    id: 'indigo',
    name: 'Hyper Cobalt & Indigo (Utama)',
    shortName: 'Hyper Cobalt',
    badge: 'Robotic & STEM Edition',
    description: 'Palet futuristik resmi robotik: Hyper Cobalt (#4338CA), Deep Indigo (#312E81), Soft Ice (#C7D2FE), Tint (#EEF2FF)',
    colorHex: '#4338CA',
    accentHex: '#6366F1',
    lightBgHex: '#EEF2FF',
    borderHex: '#C7D2FE',
    primaryBg: 'bg-[#4338CA] hover:bg-[#3730A3] text-white',
    primaryHoverBg: 'hover:bg-[#3730A3]',
    primaryText: 'text-[#4338CA]',
    primaryBorder: 'border-[#4338CA]',
    primaryRing: 'focus:ring-[#4338CA]',
    badgeBg: 'bg-[#C7D2FE]/40',
    badgeText: 'text-[#312E81]',
    badgeBorder: 'border-[#C7D2FE]',
    lightBg: 'bg-[#EEF2FF]',
    lightBorder: 'border-[#C7D2FE]',
    activeNavTab: 'bg-[#4338CA] text-white shadow-sm shadow-[#4338CA]/25 font-bold',
    activeNavIcon: 'text-white',
    activeNavBadge: 'bg-[#312E81] text-[#C7D2FE]',
    brandGradient: 'bg-gradient-to-br from-slate-950 via-indigo-900 to-indigo-600 text-white shadow-indigo-900/25 ring-2 ring-[#C7D2FE]/60',
  },
};

const THEME_STORAGE_KEY = 'robotics_theme_color';

export function applyThemeVariables(_themeKey?: string) {
  if (typeof document === 'undefined') return;
  const t = THEMES.indigo;
  const root = document.documentElement;
  root.style.setProperty('--color-app-primary', t.colorHex);
  root.style.setProperty('--color-app-accent', t.accentHex);
  root.style.setProperty('--color-app-light-bg', t.lightBgHex);
  root.style.setProperty('--color-app-border', t.borderHex);
}

export function getStoredTheme(): ThemeColor {
  return 'indigo';
}

export function saveStoredTheme(_theme?: string) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, 'indigo');
    applyThemeVariables();
    window.dispatchEvent(new CustomEvent('robotics-theme-change', { detail: 'indigo' }));
  } catch (e) {
    // ignore
  }
}
