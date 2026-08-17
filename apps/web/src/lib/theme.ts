"use client";

import type { UserSettings } from "@job-ai/types";

export const THEME_COOKIE = "jobai-theme";

export function applyTheme(theme: UserSettings["ui"]["theme"]): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (theme !== "system") root.classList.add(theme);

  const oneYear = 60 * 60 * 24 * 365;
  const value = theme === "system" ? "" : theme;
  const maxAge = theme === "system" ? 0 : oneYear;

  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}
