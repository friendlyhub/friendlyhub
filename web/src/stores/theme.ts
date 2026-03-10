import { create } from 'zustand';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref;
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const stored = (localStorage.getItem('theme') as ThemePreference | null) ?? 'system';
const initial = resolve(stored);
applyTheme(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  preference: stored,
  resolved: initial,

  setPreference: (pref) => {
    localStorage.setItem('theme', pref);
    const resolved = resolve(pref);
    applyTheme(resolved);
    set({ preference: pref, resolved });
  },
}));

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { preference, setPreference } = useThemeStore.getState();
  if (preference === 'system') {
    setPreference('system');
  }
});
