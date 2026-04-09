import { create } from "zustand";

export type Theme = "system" | "light" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "companion_ai_theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { /* ignore */ }
  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", isDark);
  localStorage.setItem(STORAGE_KEY, theme);
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: getStoredTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));

// Apply on load
applyTheme(getStoredTheme());

// Listen for OS preference changes when set to "system"
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (useThemeStore.getState().theme === "system") {
    applyTheme("system");
  }
});
