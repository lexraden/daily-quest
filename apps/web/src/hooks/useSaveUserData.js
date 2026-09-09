import { useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { updateCachedUserData, noteInFlightSave } from '@/components/UserDataCache';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

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
    mutationFn: async ({ data }) => {
      // The row is identified by the caller's token, not by an id in the URL.
      const promise = api.questData.update(data);
      noteInFlightSave(promise);
      await promise;
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
    onError: (error, _variables, context) => {
      toast.error(error?.message || t().errors.saveFailed);
      if (context?.previousSnapshot) {
        restoreRef.current(context.previousSnapshot);
        if (userDataIdRef.current) {
          updateCachedUserData(userDataIdRef.current, context.previousSnapshot);
        }
      }
    },
  });

  // Keep mutate in a ref so `save` callback identity stays stable across renders
  const mutateRef = useRef(mutation.mutate);
  useEffect(() => { mutateRef.current = mutation.mutate; }, [mutation.mutate]);

  // Stable save function that reads latest state via refs
  const save = useCallback(() => {
    if (!isLoaded || !userDataIdRef.current) return;

    // Optimistic cache update immediately
    const data = getSnapshotRef.current();
    updateCachedUserData(userDataIdRef.current, data);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const toSave = getSnapshotRef.current();
      mutateRef.current({ id: userDataIdRef.current, data: toSave });
    }, DEBOUNCE_MS);
  }, [isLoaded]);

  /**
   * Send a queued save now instead of waiting out the debounce.
   *
   * Leaving the page used to just drop the timer, so anything edited in the
   * last 800ms never reached the server — invisible until something refetched
   * the row, at which point the edit appeared to undo itself. Called on
   * unmount, and available to anything that needs the row settled first.
   *
   * The request goes out directly rather than through the mutation: this runs
   * while the component is going away, and the rollback the mutation performs
   * on failure would be writing into state nobody is rendering any more.
   */
  const flushPendingSave = useCallback(() => {
    if (!timerRef.current) return Promise.resolve();
    clearTimeout(timerRef.current);
    timerRef.current = null;

    const id = userDataIdRef.current;
    if (!id) return Promise.resolve();

    const data = getSnapshotRef.current();
    updateCachedUserData(id, data);
    const promise = api.questData.update(data).catch((error) => {
      // Nothing is left on screen to roll back, so surface it and move on.
      toast.error(error?.message || t().errors.saveFailed);
    });
    noteInFlightSave(promise);
    return promise;
  }, []);

  // Expose whether a save is queued or in-flight
  const hasPendingWrite = () => timerRef.current !== null || mutation.isPending;

  // Cancel any pending debounced save (used when external code overwrites local state)
  const cancelPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // On unmount, send what is queued rather than discarding it.
  const flushRef = useRef(flushPendingSave);
  useEffect(() => { flushRef.current = flushPendingSave; }, [flushPendingSave]);
  useEffect(() => () => { flushRef.current(); }, []);

  return { save, cancelPendingSave, flushPendingSave, isSaving: mutation.isPending, hasPendingWrite };
}