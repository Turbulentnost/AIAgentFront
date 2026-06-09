import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ai-platform-theme";

type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: (origin?: { x: number; y: number }) => void;
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

function applyThemeToDocument(theme: Theme, origin?: { x: number; y: number }) {
  if (origin) {
    document.documentElement.style.setProperty("--theme-origin-x", `${origin.x}px`);
    document.documentElement.style.setProperty("--theme-origin-y", `${origin.y}px`);
  }

  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
  }, []);

  const setTheme = useCallback((nextTheme: Theme, origin?: { x: number; y: number }) => {
    const update = () => {
      applyThemeToDocument(nextTheme, origin);
      setThemeState(nextTheme);
    };

    if (!document.startViewTransition) {
      update();
      return;
    }

    document.startViewTransition(() => {
      update();
    });
  }, []);

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      setTheme(theme === "light" ? "dark" : "light", origin);
    },
    [setTheme, theme]
  );

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      toggleTheme,
      setTheme
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
