import type { UiSettings } from '@job-ai/types';

export function applyTheme(theme: UiSettings['theme']): () => void {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const set = () => {
    const dark = theme === 'dark' || (theme === 'system' && media.matches);
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  };

  set();
  if (theme !== 'system') return () => {};
  media.addEventListener('change', set);
  return () => media.removeEventListener('change', set);
}
