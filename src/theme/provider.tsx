"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getTheme, type Theme } from "./index";

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}

export function ThemeProvider({ themeId, children }: { themeId: string; children: ReactNode }) {
  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const cssVars = useMemo(() => ({
    "--color-background": theme.colors.background,
    "--color-surface": theme.colors.surface,
    "--color-primary": theme.colors.primary,
    "--color-secondary": theme.colors.secondary,
    "--color-accent": theme.colors.accent,
    "--color-text": theme.colors.text,
    "--color-text-muted": theme.colors.textMuted,
    "--border-radius": theme.borderRadius,
    "--font-family": theme.fontFamily,
  }) as React.CSSProperties, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssVars} className="contents">{children}</div>
    </ThemeContext.Provider>
  );
}
