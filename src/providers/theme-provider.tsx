"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS } from "@/lib/config";

/** What the user picked. "system" follows the device's light/dark setting. */
export type ThemePreference = "light" | "dark" | "system";

type ResolvedTheme = "light" | "dark";

const ThemeContext = createContext<{
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemePreference) => void;
} | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light stays the default for anyone who never chose a theme.
  const [theme, setThemeState] = useState<ThemePreference>("light");

  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);

    if (stored === "dark" || stored === "light" || stored === "system")
      setThemeState(stored);

    const media = window.matchMedia(DARK_QUERY);

    setSystemDark(media.matches);

    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEYS.theme, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);

  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");

  return ctx;
}
