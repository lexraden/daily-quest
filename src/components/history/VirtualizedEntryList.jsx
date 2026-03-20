import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import EntryCard from './EntryCard';

const BATCH_SIZE = 20;

/**
 * Incrementally renders a large list of grouped date entries.
 * Loads BATCH_SIZE date groups at a time, adding more as the user scrolls
 * near the bottom. This avoids rendering hundreds of entries at once
 * in the month view.
 */
export default function VirtualizedEntryList({ dateGroups, onSelect, formatSmallDate, theme }) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  // Reset visible count when data changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [dateGroups]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, dateGroups.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dateGroups.length]);

  const visibleGroups = useMemo(
    () => dateGroups.slice(0, visibleCount),
    [dateGroups, visibleCount]
  );

  const hasMore = visibleCount < dateGroups.length;

  return (
    <div className="space-y-3 mt-2">
      <div className={`text-xs font-semibold ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
        Записи за месяц
      </div>
      {visibleGroups.map(({ dateKey, entries }) => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`text-xs font-semibold ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              {formatSmallDate(dateKey)}
            </div>
            <div className={`flex-1 h-px ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
            <div className={`text-[10px] ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
              {entries.length}
            </div>
          </div>
          <div className="space-y-1">
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry} compact onSelect={onSelect} theme={theme} />
            ))}
          </div>
        </div>
      ))}
      {/* Sentinel for loading more */}
      {hasMore && (
        <div ref={sentinelRef} className="h-4" />
      )}
    </div>
  );
}