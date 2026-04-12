export interface ThemeColors {
  background: string; surface: string; primary: string; secondary: string; accent: string; text: string; textMuted: string;
}
export interface Theme {
  name: string; colors: ThemeColors; borderRadius: string; fontFamily: string; iconStyle: "emoji" | "outline" | "filled";
}
