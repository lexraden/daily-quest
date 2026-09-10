import { useEffect, useState } from 'react';
import { getTheme, subscribeTheme } from '@/lib/theme';

/**
 * The current theme, kept in step across pages.
 *
 * Every screen used to hold its own copy read from storage on mount, which
 * stopped updating the moment the tab stayed mounted in the background.
 */
export function useTheme() {
  const [theme, setLocal] = useState(getTheme);
  useEffect(() => subscribeTheme(setLocal), []);
  return theme;
}
