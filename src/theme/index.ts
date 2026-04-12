export type { Theme, ThemeColors } from "./types";
import { playful } from "./playful";
import { minimal } from "./minimal";
import type { Theme } from "./types";
export const themes: Record<string, Theme> = { playful, minimal };
export function getTheme(id: string): Theme { return themes[id] ?? themes.playful; }
