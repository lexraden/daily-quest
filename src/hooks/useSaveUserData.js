import { useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { updateCachedUserData } from '@/components/UserDataCache';
import { toast } from 'sonner';

const DEBOUNCE_MS = 800;

/**
 * React Query-based optimistic save hook for UserQuestData.
 * Debounces writes and rolls back local state on failure.
 */
export default function useSaveUserData({
  userDataId,
  isLoaded,
  getStateSnapshot,
  restoreSnapshot,
}) {
  const timerRef = useRef(null);
  const latestDataRef = useRef(null);
  const lastSavedRef = useRef(null);

  const mutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.UserQuestData.update(id, data);
      return data;
    },
    onMutate: async ({ id, data }) => {
      // Optimistic: update cache immediately
      const previousSnapshot = lastSavedRef.current;
      updateCachedUserData(id, data);
      return { previousSnapshot };
    },
    onSuccess: (data) => {
      lastSavedRef.current = data;
    },
    onError: (_error, _variables, context) => {
      toast.error('Ошибка сохранения. Откатываю изменения...');
      if (context?.previousSnapshot) {
        restoreSnapshot(context.previousSnapshot);
        if (userDataId) {
          updateCachedUserData(userDataId, context.previousSnapshot);
        }
      }
    },
  });

  const debouncedSave = useCallback(() => {
    if (!isLoaded || !userDataId) return;
    const data = getStateSnapshot();
    latestDataRef.current = data;

    // Optimistic cache update happens immediately
    updateCachedUserData(userDataId, data);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSave = latestDataRef.current;
      if (toSave) {
        mutation.mutate({ id: userDataId, data: toSave });
      }
    }, DEBOUNCE_MS);
  }, [isLoaded, userDataId, getStateSnapshot, mutation]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save: debouncedSave, isSaving: mutation.isPending };
}