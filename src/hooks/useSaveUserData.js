import { useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  const lastSavedRef = useRef(null);
  const getSnapshotRef = useRef(getStateSnapshot);
  const restoreRef = useRef(restoreSnapshot);
  const userDataIdRef = useRef(userDataId);

  // Keep refs up to date without causing re-renders
  useEffect(() => { getSnapshotRef.current = getStateSnapshot; }, [getStateSnapshot]);
  useEffect(() => { restoreRef.current = restoreSnapshot; }, [restoreSnapshot]);
  useEffect(() => { userDataIdRef.current = userDataId; }, [userDataId]);

  const mutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.UserQuestData.update(id, data);
      return data;
    },
    onMutate: async ({ id, data }) => {
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
        restoreRef.current(context.previousSnapshot);
        if (userDataIdRef.current) {
          updateCachedUserData(userDataIdRef.current, context.previousSnapshot);
        }
      }
    },
  });

  // Stable save function that reads latest state via refs
  const save = useCallback(() => {
    if (!isLoaded || !userDataIdRef.current) return;

    // Optimistic cache update immediately
    const data = getSnapshotRef.current();
    updateCachedUserData(userDataIdRef.current, data);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSave = getSnapshotRef.current();
      mutation.mutate({ id: userDataIdRef.current, data: toSave });
    }, DEBOUNCE_MS);
  }, [isLoaded, mutation]);

  // Cancel any pending debounced save (used when external code overwrites local state)
  const cancelPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save, cancelPendingSave, isSaving: mutation.isPending };
}