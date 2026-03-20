import { useRef, useCallback } from 'react';

const TAB_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];

/**
 * Tracks navigation history to provide reliable "go back" behavior.
 * Maintains a stack of visited paths so we always know where to return.
 */
export default function useNavigationStack() {
  const stackRef = useRef(['/DailyTracker']);

  const push = useCallback((path) => {
    const stack = stackRef.current;
    // Don't push duplicates
    if (stack[stack.length - 1] === path) return;
    // Tab-to-tab: replace top instead of push (tabs are siblings, not a stack)
    const isTab = TAB_PATHS.includes(path);
    const topIsTab = TAB_PATHS.includes(stack[stack.length - 1]);
    if (isTab && topIsTab) {
      stack[stack.length - 1] = path;
    } else {
      stack.push(path);
    }
    // Cap stack size
    if (stack.length > 50) stack.shift();
  }, []);

  const getBackPath = useCallback(() => {
    const stack = stackRef.current;
    if (stack.length <= 1) return '/DailyTracker';
    // Pop current, return previous
    stack.pop();
    return stack[stack.length - 1] || '/DailyTracker';
  }, []);

  const isOnTab = useCallback((path) => TAB_PATHS.includes(path), []);

  return { push, getBackPath, isOnTab };
}