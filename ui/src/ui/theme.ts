export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function getSystemTheme(): ResolvedTheme {
  return "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return "light";
}

export function detectTheme(): ResolvedTheme {
  return "light";
}

export { startThemeTransition as transitionTheme } from "./theme-transition.ts";
