import { useEffect, useRef } from 'react';
import { embyService } from '../../../services/emby/embyService';
import { logger } from '../../../utils/logger';

// Report progress to Emby every 10 seconds to avoid request spam
const PROGRESS_INTERVAL_MS = 10_000;

/**
 * useEmbySession
 *
 * Reports playback lifecycle events (start / progress / stopped) back to an
 * Emby server whenever the current stream originated from Emby.
 *
 * Usage: call this hook inside the player component passing the embyItemId
 * extracted from the route params.  When embyItemId is undefined/null the hook
 * is a no-op, so it is safe to include unconditionally.
 */
export const useEmbySession = (
  embyItemId: string | undefined | null,
  currentTime: number,
  paused: boolean
) => {
  const hasStartedRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a ref for the latest values to avoid stale closures in the interval
  const currentTimeRef = useRef(currentTime);
  const pausedRef = useRef(paused);
  const embyItemIdRef = useRef(embyItemId);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { embyItemIdRef.current = embyItemId; }, [embyItemId]);

  // Report playback start once when embyItemId becomes available
  useEffect(() => {
    if (!embyItemId) return;
    if (hasStartedRef.current) return;

    hasStartedRef.current = true;
    embyService.reportPlaybackStart(embyItemId, currentTimeRef.current).catch((err) => {
      logger.warn('[useEmbySession] reportPlaybackStart error:', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embyItemId]);

  // Send progress every PROGRESS_INTERVAL_MS while playing; pause/resume sends an immediate report
  useEffect(() => {
    if (!embyItemId) return;

    // Clear existing timer first
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // Immediately report the new pause state when it changes
    embyService.reportPlaybackProgress(embyItemId, currentTimeRef.current, paused).catch(() => {});

    if (!paused) {
      progressTimerRef.current = setInterval(() => {
        const itemId = embyItemIdRef.current;
        if (!itemId) return;
        embyService
          .reportPlaybackProgress(itemId, currentTimeRef.current, pausedRef.current)
          .catch(() => {});
      }, PROGRESS_INTERVAL_MS);
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  // Re-run when paused state changes; embyItemId already guarded above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embyItemId, paused]);

  // Report stopped on component unmount (deferred so navigation can complete first)
  useEffect(() => {
    return () => {
      const itemId = embyItemIdRef.current;
      if (!itemId) return;

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      setTimeout(() => {
        embyService
          .reportPlaybackStopped(itemId, currentTimeRef.current)
          .catch((err) => logger.warn('[useEmbySession] reportPlaybackStopped error:', err));
      }, 0);
    };
  // Only run cleanup on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
