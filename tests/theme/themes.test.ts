import { describe, it, expect } from "vitest";
import { themes, getTheme, type Theme } from "@/theme";

describe("Theme system", () => {
  it("exports a playful theme as default", () => {
    const theme = getTheme("playful");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Playful");
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.background).toBeDefined();
    expect(theme.borderRadius).toBeDefined();
    expect(theme.fontFamily).toBeDefined();
    expect(theme.iconStyle).toBe("emoji");
  });

  it("exports a minimal theme", () => {
    const theme = getTheme("minimal");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Minimal");
  });

  it("falls back to playful for unknown theme", () => {
    const theme = getTheme("nonexistent");
    expect(theme.name).toBe("Playful");
  });

  it("lists all available themes", () => {
    expect(Object.keys(themes).length).toBeGreaterThanOrEqual(2);
    expect(themes.playful).toBeDefined();
    expect(themes.minimal).toBeDefined();
  });

  it("all themes satisfy the Theme interface", () => {
    const requiredColors = ["background", "surface", "primary", "secondary", "accent", "text", "textMuted"] as const;
    for (const [, theme] of Object.entries(themes)) {
      for (const color of requiredColors) {
        expect(theme.colors[color]).toBeDefined();
        expect(theme.colors[color]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
