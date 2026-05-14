const STORAGE_KEY = "saip-theme";

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme === "light" ? "light" : "dark");
  } catch {
    /* ignore */
  }
}

export function toggleTheme(current) {
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}
