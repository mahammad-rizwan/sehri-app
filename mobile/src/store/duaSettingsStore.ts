import { create } from 'zustand';

export type ThemeKey = 'dark' | 'sepia' | 'light' | 'green';
export type FontSizeKey = 'sm' | 'md' | 'lg' | 'xl';

interface DuaSettingsState {
  theme: ThemeKey;
  fontSizeKey: FontSizeKey;
  setTheme: (t: ThemeKey) => void;
  setFontSizeKey: (k: FontSizeKey) => void;
}

export const useDuaSettings = create<DuaSettingsState>((set) => ({
  theme: 'sepia',
  fontSizeKey: 'xl',
  setTheme: (theme) => set({ theme }),
  setFontSizeKey: (fontSizeKey) => set({ fontSizeKey }),
}));
