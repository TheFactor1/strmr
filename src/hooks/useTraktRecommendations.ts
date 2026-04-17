import { useState, useEffect } from 'react';
import { traktService } from '../services/traktService';
import { mmkvStorage } from '../services/mmkvStorage';
import { logger } from '../utils/logger';
import type { CatalogContent, StreamingContent } from '../services/catalog/types';
import { useCatalogContext } from '../contexts/CatalogContext';

const TRAKT_RECOMMENDED_MOVIES_KEY = 'trakt_recommended_movies_enabled';
const TRAKT_RECOMMENDED_SHOWS_KEY = 'trakt_recommended_shows_enabled';

const FALLBACK_POSTER = 'https://via.placeholder.com/300x450/cccccc/666666?text=No+Image';

/** Convert a Trakt extended item (movie or show) into a StreamingContent row. */
function traktItemToStreamingContent(
  item: any,
  mediaType: 'movie' | 'series'
): StreamingContent | null {
  const media = mediaType === 'movie' ? item : item; // same shape, different fields
  const title: string = media.title;
  const imdbId: string | undefined = media.ids?.imdb;
  const tmdbId: number | undefined = media.ids?.tmdb;

  if (!title) return null;

  // Use IMDb ID as content ID (same convention as Stremio addons)
  const id = imdbId ?? (tmdbId ? `tmdb:${tmdbId}` : `trakt:${media.ids?.trakt}`);

  // Metahub is already used by the app for Stremio content — use it for posters too
  const poster = imdbId
    ? `https://images.metahub.space/poster/medium/${imdbId}/img`
    : FALLBACK_POSTER;

  return {
    id,
    type: mediaType,
    name: title,
    poster,
    posterShape: 'poster',
    year: media.year ?? undefined,
    description: media.overview ?? undefined,
    genres: Array.isArray(media.genres)
      ? media.genres.map((g: string) => g.charAt(0).toUpperCase() + g.slice(1))
      : undefined,
    runtime: media.runtime ? `${media.runtime} min` : undefined,
    certification: media.certification ?? undefined,
    imdb_id: imdbId,
  } as StreamingContent;
}

/**
 * Fetches personalized Trakt recommendations for the authenticated user
 * and returns them as two CatalogContent rows (movies + shows).
 * Returns an empty array when not authenticated.
 */
export function useTraktRecommendations(): {
  catalogs: CatalogContent[];
  loading: boolean;
} {
  const [catalogs, setCatalogs] = useState<CatalogContent[]>([]);
  const [loading, setLoading] = useState(false);
  const { lastUpdate } = useCatalogContext(); // re-run when refreshCatalogs() is called

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const isAuth = await traktService.isAuthenticated();
      if (!isAuth || cancelled) return;

      // Read user toggles (default enabled)
      const [moviesEnabledVal, showsEnabledVal] = await Promise.all([
        mmkvStorage.getItem(TRAKT_RECOMMENDED_MOVIES_KEY),
        mmkvStorage.getItem(TRAKT_RECOMMENDED_SHOWS_KEY),
      ]);
      const moviesEnabled = moviesEnabledVal !== 'false';
      const showsEnabled = showsEnabledVal !== 'false';

      if (!moviesEnabled && !showsEnabled) {
        setCatalogs([]);
        return;
      }

      setLoading(true);
      try {
        const [movies, shows] = await Promise.all([
          moviesEnabled ? traktService.getRecommendations('movies', 20) : Promise.resolve([]),
          showsEnabled ? traktService.getRecommendations('shows', 20) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        const result: CatalogContent[] = [];

        if (moviesEnabled) {
          const movieItems = movies
            .map((m: any) => traktItemToStreamingContent(m, 'movie'))
            .filter(Boolean) as StreamingContent[];
          if (movieItems.length > 0) {
            result.push({
              addon: 'trakt',
              type: 'movie',
              id: 'trakt-recommended-movies',
              name: 'Recommended Movies',
              items: movieItems,
            });
          }
        }

        if (showsEnabled) {
          const showItems = shows
            .map((s: any) => traktItemToStreamingContent(s, 'series'))
            .filter(Boolean) as StreamingContent[];
          if (showItems.length > 0) {
            result.push({
              addon: 'trakt',
              type: 'series',
              id: 'trakt-recommended-shows',
              name: 'Recommended Shows',
              items: showItems,
            });
          }
        }

        setCatalogs(result);
        logger.log(`[useTraktRecommendations] movies=${moviesEnabled} shows=${showsEnabled}`);
      } catch (err) {
        logger.error('[useTraktRecommendations] error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [lastUpdate]); // re-runs whenever refreshCatalogs() is called from settings

  return { catalogs, loading };
}
