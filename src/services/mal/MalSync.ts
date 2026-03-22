import { mmkvStorage } from '../mmkvStorage';
import { MalApiService } from './MalApi';
import { MalAuth } from './MalAuth';
import { MalListStatus, MalAnimeNode } from '../../types/mal';
import { catalogService } from '../catalogService';
import { ArmSyncService } from './ArmSyncService';
import { logger } from '../../utils/logger';
import axios from 'axios';

// MalSync.ts

export const MalSync = {
  /**
   * Tries to find a MAL ID using IMDb ID via MAL-Sync API.
   */
  /**
   * Tries to find a MAL ID using IMDb or TMDB ID via External APIs (MAL-Sync or ARM).
   */
  getMalIdFromExternal: async (id: string | number, source: 'imdb' | 'tmdb'): Promise<number | null> => {
    if (!id) return null;
    try {
      // 1. Try ARM API (v2)
      const endpoint = source === 'imdb' ? 'imdb' : 'tmdb';
      const cleanId = source === 'imdb' && typeof id === 'string' && !id.startsWith('tt') ? `tt${id}` : id;
      
      try {
          const armRes = await axios.get(`https://arm.haglund.dev/api/v2/${endpoint}`, {
              params: { id: cleanId }
          });
          if (Array.isArray(armRes.data) && armRes.data.length > 0) {
              const entry = armRes.data.find((e: any) => e.myanimelist);
              if (entry && entry.myanimelist) return entry.myanimelist;
          }
      } catch (e) {
          // Fallback to MAL-Sync for IMDb if ARM fails
      }

      // 2. Try MAL-Sync API (only for IMDb)
      if (source === 'imdb') {
          try {
              const malSyncRes = await axios.get(`https://api.malsync.moe/mal/anime/imdb/${cleanId}`);
              if (malSyncRes.data && malSyncRes.data.id) {
                  return malSyncRes.data.id;
              }
          } catch (e) {
              // Ignore
          }
      }
    } catch (e) {
      // General error catch
    }
    return null;
  },

  /**
   * Tries to find a MAL ID for a given anime title or IMDb ID.
   */
  getMalId: async (title: string, type: 'movie' | 'series' = 'series', year?: number, season?: number, imdbId?: string, episode: number = 1, releaseDate?: string, dayIndex?: number, tmdbId?: number): Promise<number | null> => {
    // Safety check: Never perform a MAL search for generic placeholders or empty strings.
    const cleanTitle = title.trim();
    const normalizedTitle = cleanTitle.toLowerCase();
    const isGenericTitle = !normalizedTitle || normalizedTitle === 'anime' || normalizedTitle === 'movie';

    if (isGenericTitle && !imdbId && !tmdbId) return null;

    // 0. Direct ID mapping for Movies (Skip date matching as movies are 1:1)
    if (type === 'movie') {
        if (tmdbId) {
            const idFromExternal = await MalSync.getMalIdFromExternal(tmdbId, 'tmdb');
            if (idFromExternal) return idFromExternal;
        }
        if (imdbId) {
            const idFromExternal = await MalSync.getMalIdFromExternal(imdbId, 'imdb');
            if (idFromExternal) return idFromExternal;
        }
        return null;
    }

    // 1. Try TMDB-based Resolution (High Accuracy)
    if (tmdbId && releaseDate) {
        try {
            const tmdbResult = await ArmSyncService.resolveByTmdb(tmdbId, releaseDate, dayIndex);
            if (tmdbResult && tmdbResult.malId) {
                console.log(`[MalSync] Found TMDB match: ${tmdbId} (${releaseDate}) -> MAL ${tmdbResult.malId}`);
                return tmdbResult.malId;
            }
        } catch (e) {
            console.warn('[MalSync] TMDB Sync failed:', e);
        }
    }

    // 2. Try ARM + Jikan Sync (IMDb fallback)
    if (imdbId && type === 'series' && releaseDate) {
        try {
            const armResult = await ArmSyncService.resolveByDate(imdbId, releaseDate, dayIndex);
            if (armResult && armResult.malId) {
                console.log(`[MalSync] Found ARM match: ${imdbId} (${releaseDate}) -> MAL ${armResult.malId} Ep ${armResult.episode}`);
                return armResult.malId;
            }
        } catch (e) {
            console.warn('[MalSync] ARM Sync failed:', e);
        }
    }

    // 3. Search MAL (Skip if generic title)
    // Disabled title-based search and IMDb mapping fallback for series to prevent inaccurate mappings.
    // Real-time resolution via ARM/TMDB is now the primary path.
    return null;
  },

  /**
   * Main function to track progress
   */
  scrobbleEpisode: async (
    animeTitle: string,
    episodeNumber: number,
    totalEpisodes: number = 0,
    type: 'movie' | 'series' = 'series',
    season?: number,
    imdbId?: string,
    releaseDate?: string,
    providedMalId?: number, // Optional: skip lookup if already known
    dayIndex?: number, // 0-based index of episode in a same-day release batch
    tmdbId?: number
  ) => {
    try {
      // Requirement 9 & 10: Respect user settings and safety
      const isEnabled = mmkvStorage.getBoolean('mal_enabled') ?? true;
      const isAutoUpdate = mmkvStorage.getBoolean('mal_auto_update') ?? true;
      
      if (!isEnabled || !isAutoUpdate || !MalAuth.isAuthenticated()) {
          return;
      }

      let malId: number | null = null;
      let finalEpisodeNumber = episodeNumber;

      // Strategy 0: Direct Resolution for Movies (Skip date matching)
      // We can trust providedMalId for movies as they are always 1:1.
      if (type === 'movie') {
          malId = providedMalId || null;
          if (!malId && tmdbId) {
              malId = await MalSync.getMalIdFromExternal(tmdbId, 'tmdb');
          }
          if (!malId && imdbId) {
              malId = await MalSync.getMalIdFromExternal(imdbId, 'imdb');
          }
          if (malId) {
              console.log(`[MalSync] Movie Resolved: ${animeTitle} -> MAL ${malId}`);
          }
      }

      // Strategy 1: TMDB-based Resolution (High Accuracy for Specials/Seasons)
      if (!malId && tmdbId && releaseDate) {
          const tmdbResult = await ArmSyncService.resolveByTmdb(tmdbId, releaseDate, dayIndex);
          if (tmdbResult) {
              malId = tmdbResult.malId;
              finalEpisodeNumber = tmdbResult.episode;
              console.log(`[MalSync] TMDB Resolved: ${animeTitle} -> MAL ${malId} Ep ${finalEpisodeNumber}`);
          }
      }

      // Strategy 2: IMDb-based Resolution (Fallback)
      if (!malId && imdbId && type === 'series' && releaseDate) {
          const armResult = await ArmSyncService.resolveByDate(imdbId, releaseDate, dayIndex);
          if (armResult) {
              malId = armResult.malId;
              finalEpisodeNumber = armResult.episode;
              console.log(`[MalSync] ARM Resolved: ${animeTitle} -> MAL ${malId} Ep ${finalEpisodeNumber}`);
          }
      }

      // Fallback to standard lookup for movies if direct resolution failed.
      // For series, getMalId is now redundant as it repeats the same strategies.
      if (!malId && type === 'movie') {
          malId = await MalSync.getMalId(animeTitle, type, undefined, season, imdbId, episodeNumber, releaseDate, dayIndex, tmdbId);
      }
      
      if (!malId) return;

      // Check current status on MAL to avoid overwriting completed/dropped shows
      try {
        const currentInfo = await MalApiService.getMyListStatus(malId);
        const currentStatus = currentInfo.my_list_status?.status;
        const currentEpisodesWatched = currentInfo.my_list_status?.num_episodes_watched || 0;

        // Requirement 4: Auto-Add Anime to MAL (Configurable)
        if (!currentStatus) {
            const autoAdd = mmkvStorage.getBoolean('mal_auto_add') ?? true;
            if (!autoAdd) {
                console.log(`[MalSync] Skipping scrobble for ${animeTitle}: Not in list and auto-add disabled`);
                return;
            }
        }

        // If already completed or dropped, don't auto-update via scrobble
        if (currentStatus === 'completed' || currentStatus === 'dropped') {
            console.log(`[MalSync] Skipping update for ${animeTitle}: Status is ${currentStatus}`);
            return;
        }

        // If we are just starting (ep 1) or resuming (plan_to_watch/on_hold/null), set to watching
        // Also ensure we don't downgrade episode count (though unlikely with scrobbling forward)
        if (finalEpisodeNumber <= currentEpisodesWatched) {
             console.log(`[MalSync] Skipping update for ${animeTitle}: Episode ${finalEpisodeNumber} <= Current ${currentEpisodesWatched}`);
             return;
        }
      } catch (e) {
        // If error (e.g. not found), proceed to add it
      }

      let finalTotalEpisodes = totalEpisodes;

      // If totalEpisodes not provided, try to fetch it from MAL details
      if (finalTotalEpisodes <= 0) {
        try {
          const details = await MalApiService.getAnimeDetails(malId);
          if (details && details.num_episodes) {
            finalTotalEpisodes = details.num_episodes;
          }
        } catch (e) {
          // Fallback to 0 if details fetch fails
        }
      }

      // Determine Status
      let status: MalListStatus = 'watching';
      if (finalTotalEpisodes > 0 && finalEpisodeNumber >= finalTotalEpisodes) {
        status = 'completed';
      }

      await MalApiService.updateStatus(malId, status, finalEpisodeNumber);
      console.log(`[MalSync] Synced ${animeTitle} Ep ${finalEpisodeNumber}/${finalTotalEpisodes || '?'} -> MAL ID ${malId} (${status})`);
    } catch (e) {
      console.error('[MalSync] Scrobble failed:', e);
    }
  },

  unscrobbleEpisode: async (
    animeTitle: string,
    episodeNumber: number,
    type: 'movie' | 'series' = 'series',
    season?: number,
    imdbId?: string,
    releaseDate?: string,
    providedMalId?: number,
    dayIndex?: number,
    tmdbId?: number
  ) => {
    try {
      if (!MalAuth.isAuthenticated()) return;

      let malId: number | null = null;
      let finalEpisodeNumber = episodeNumber;

      // Strategy 0: Direct Resolution for Movies (Skip date matching)
      // We can trust providedMalId for movies as they are always 1:1.
      if (type === 'movie') {
          malId = providedMalId || null;
          if (!malId && tmdbId) {
              malId = await MalSync.getMalIdFromExternal(tmdbId, 'tmdb');
          }
          if (!malId && imdbId) {
              malId = await MalSync.getMalIdFromExternal(imdbId, 'imdb');
          }
      }

      // Resolve ID using same strategies as scrobbling
      if (!malId && tmdbId && releaseDate) {
          const tmdbResult = await ArmSyncService.resolveByTmdb(tmdbId, releaseDate, dayIndex);
          if (tmdbResult) {
              malId = tmdbResult.malId;
              finalEpisodeNumber = tmdbResult.episode;
          }
      }

      if (!malId && imdbId && type === 'series' && releaseDate) {
          const armResult = await ArmSyncService.resolveByDate(imdbId, releaseDate, dayIndex);
          if (armResult) {
              malId = armResult.malId;
              finalEpisodeNumber = armResult.episode;
          }
      }

      // Fallback to standard lookup for movies if direct resolution failed.
      // For series, getMalId is now redundant as it repeats the same strategies.
      if (!malId && type === 'movie') {
          malId = await MalSync.getMalId(animeTitle, type, undefined, season, imdbId, episodeNumber, releaseDate, dayIndex, tmdbId);
      }

      if (!malId) return;

      // Get current count
      const currentInfo = await MalApiService.getMyListStatus(malId);
      if (!currentInfo.my_list_status) return;

      // Decrement logic: Only if the episode we are unmarking is the LAST one watched or current
      const currentlyWatched = currentInfo.my_list_status.num_episodes_watched;
      if (finalEpisodeNumber === currentlyWatched) {
          const newCount = Math.max(0, finalEpisodeNumber - 1);
          let newStatus = currentInfo.my_list_status.status;
          
          // If we unmark everything, maybe move back to 'plan_to_watch' or keep 'watching'
          if (newCount === 0 && newStatus === 'watching') {
              // Optional: Move back to plan to watch if desired
          } else if (newStatus === 'completed') {
              newStatus = 'watching';
          }

          await MalApiService.updateStatus(malId, newStatus, newCount);
          console.log(`[MalSync] Unscrobbled MAL ID ${malId} to Ep ${newCount}`);
      }
    } catch (e) {
      console.error('[MalSync] Unscrobble failed:', e);
    }
  },

  /**
   * Direct scrobble with known MAL ID and Episode
   * Used when ArmSync has already resolved the exact details.
   */
  scrobbleDirect: async (malId: number, episodeNumber: number) => {
      try {
          // Respect user settings and login status
          const isEnabled = mmkvStorage.getBoolean('mal_enabled') ?? true;
          const isAutoUpdate = mmkvStorage.getBoolean('mal_auto_update') ?? true;
          if (!isEnabled || !isAutoUpdate || !MalAuth.isAuthenticated()) return;

          // Check current status
          const currentInfo = await MalApiService.getMyListStatus(malId);
          const currentStatus = currentInfo.my_list_status?.status;
          
          // Auto-Add check
          if (!currentStatus) {
              const autoAdd = mmkvStorage.getBoolean('mal_auto_add') ?? true;
              if (!autoAdd) {
                  console.log(`[MalSync] Skipping direct scrobble: Not in list and auto-add disabled`);
                  return;
              }
          }

          // Safety checks (Completed/Dropped/Regression)
          if (currentStatus === 'completed' || currentStatus === 'dropped') return;
          if (currentInfo.my_list_status?.num_episodes_watched && episodeNumber <= currentInfo.my_list_status.num_episodes_watched) return;

          // Determine Status
          let status: MalListStatus = 'watching';
          if (currentInfo.num_episodes > 0 && episodeNumber >= currentInfo.num_episodes) {
              status = 'completed';
          }

          await MalApiService.updateStatus(malId, status, episodeNumber);
          console.log(`[MalSync] Direct synced MAL ID ${malId} Ep ${episodeNumber} (${status})`);
      } catch (e) {
          console.error('[MalSync] Direct scrobble failed:', e);
      }
  },

  /**
   * Import MAL list items into local library
   */
  syncMalToLibrary: async () => {
      if (!MalAuth.isAuthenticated()) return false;
      try {
          let allItems: MalAnimeNode[] = [];
          let offset = 0;
          let hasMore = true;

          while (hasMore && offset < 1000) { // Limit to 1000 items for safety
              const response = await MalApiService.getUserList(undefined, offset, 100);
              if (response.data && response.data.length > 0) {
                  allItems = [...allItems, ...response.data];
                  offset += response.data.length;
                  hasMore = !!response.paging.next;
              } else {
                  hasMore = false;
              }
          }
          
          for (const item of allItems) {
              // No longer populating mapping cache here to prevent season mismatches.
              // Logic is now real-time based on air dates.
          }
          console.log(`[MalSync] Synced ${allItems.length} items from MAL.`);
          
          // If auto-sync to library is enabled, also add 'watching' items to Nuvio Library
          if (mmkvStorage.getBoolean('mal_auto_sync_to_library') ?? false) {
              await MalSync.syncMalWatchingToLibrary();
          }
          
          return true;
      } catch (e) {
          console.error('syncMalToLibrary failed', e);
          return false;
      }
  },

  /**
   * Automatically adds MAL 'watching' items to the Nuvio Library
   */
  syncMalWatchingToLibrary: async () => {
      if (!MalAuth.isAuthenticated()) return;
      try {
          logger.log('[MalSync] Auto-syncing MAL watching items to library...');
          
          const response = await MalApiService.getUserList('watching', 0, 50);
          if (!response.data || response.data.length === 0) return;

          const currentLibrary = await catalogService.getLibraryItems();
          const libraryIds = new Set(currentLibrary.map(l => l.id));

          // Process items in small batches to avoid rate limiting
          for (let i = 0; i < response.data.length; i += 5) {
              const batch = response.data.slice(i, i + 5);
              await Promise.all(batch.map(async (item) => {
                  const malId = item.node.id;
                  const { imdbId } = await MalSync.getIdsFromMalId(malId);
                  
                  if (imdbId && !libraryIds.has(imdbId)) {
                      const type = item.node.media_type === 'movie' ? 'movie' : 'series';
                      logger.log(`[MalSync] Auto-adding to library: ${item.node.title} (${imdbId})`);
                      
                      await catalogService.addToLibrary({
                          id: imdbId,
                          type: type,
                          name: item.node.title,
                          poster: item.node.main_picture?.large || item.node.main_picture?.medium || '',
                          posterShape: 'poster',
                          year: item.node.start_season?.year,
                          description: '',
                          genres: [],
                          inLibrary: true,
                      });
                  }
              }));
          }
      } catch (e) {
          logger.error('[MalSync] syncMalWatchingToLibrary failed:', e);
      }
  },

  /**
   * Get external IDs (IMDb, etc.) and season info from a MAL ID using MalSync API
   */
  getIdsFromMalId: async (malId: number): Promise<{ imdbId: string | null; season: number }> => {
      try {
          const response = await axios.get(`https://api.malsync.moe/mal/anime/${malId}`);
          const data = response.data;
          
          let imdbId = null;
          let season = data.season || 1;

          // Try to find IMDb ID in Sites
          if (data.Sites && data.Sites.IMDB) {
              const imdbKeys = Object.keys(data.Sites.IMDB);
              if (imdbKeys.length > 0) {
                  imdbId = imdbKeys[0];
              }
          }

          return { imdbId, season };
      } catch (e) {
          console.error('[MalSync] Failed to fetch external IDs:', e);
      }
      return { imdbId: null, season: 1 };
  },

  /**
   * Get weekly anime schedule from Jikan API (Adjusted to Local Timezone)
   */
  getWeeklySchedule: async (): Promise<any[]> => {
      const cacheKey = 'mal_weekly_schedule_local_v2'; // Bump version for new format
      const cached = mmkvStorage.getString(cacheKey);
      const cacheTime = mmkvStorage.getNumber(`${cacheKey}_time`);
      
      // Cache for 24 hours
      if (cached && cacheTime && (Date.now() - cacheTime < 24 * 60 * 60 * 1000)) {
          return JSON.parse(cached);
      }

      try {
          // Jikan API rate limit mitigation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const response = await axios.get('https://api.jikan.moe/v4/schedules');
          const data = response.data.data;

          const daysOrder = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
          const dayMap: Record<string, number> = { 'Mondays': 0, 'Tuesdays': 1, 'Wednesdays': 2, 'Thursdays': 3, 'Fridays': 4, 'Saturdays': 5, 'Sundays': 6 };
          const daysReverse = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
          
          const grouped: Record<string, any[]> = {};

          // Calculate time difference in minutes: Local - JST (UTC+9)
          // getTimezoneOffset() returns minutes BEHIND UTC (positive for US, negative for Asia)
          // We want Local - UTC+9. 
          // Local = UTC - offset.
          // Diff = (UTC - localOffset) - (UTC + 540) = -localOffset - 540.
          const jstOffset = 540; // UTC+9 in minutes
          const localOffset = new Date().getTimezoneOffset(); // e.g. 300 for EST (UTC-5)
          const offsetMinutes = -localOffset - jstOffset; // e.g. -300 - 540 = -840 minutes (-14h)

          data.forEach((anime: any) => {
              let day = anime.broadcast?.day; // "Mondays"
              let time = anime.broadcast?.time; // "23:00"
              let originalDay = day;

              // Adjust to local time
              if (day && time && dayMap[day] !== undefined) {
                  const [hours, mins] = time.split(':').map(Number);
                  let totalMinutes = hours * 60 + mins + offsetMinutes;
                  
                  let dayShift = 0;
                  // Handle day rollovers
                  if (totalMinutes < 0) {
                      totalMinutes += 24 * 60;
                      dayShift = -1;
                  } else if (totalMinutes >= 24 * 60) {
                      totalMinutes -= 24 * 60;
                      dayShift = 1;
                  }

                  const newHour = Math.floor(totalMinutes / 60);
                  const newMin = totalMinutes % 60;
                  time = `${String(newHour).padStart(2,'0')}:${String(newMin).padStart(2,'0')}`;
                  
                  let dayIndex = dayMap[day] + dayShift;
                  if (dayIndex < 0) dayIndex = 6;
                  if (dayIndex > 6) dayIndex = 0;
                  day = daysReverse[dayIndex];
              } else {
                  day = 'Other'; // No specific time/day
              }
              
              if (!grouped[day]) grouped[day] = [];
              
              grouped[day].push({
                  id: `mal:${anime.mal_id}`,
                  seriesId: `mal:${anime.mal_id}`,
                  title: anime.title,
                  seriesName: anime.title_english || anime.title,
                  poster: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
                  releaseDate: null, 
                  season: 1, 
                  episode: 1, 
                  overview: anime.synopsis,
                  vote_average: anime.score,
                  day: day,
                  time: time,
                  genres: anime.genres?.map((g: any) => g.name) || [],
                  originalDay: originalDay // Keep for debug if needed
              });
          });

          // Sort by day (starting Monday or Today?) -> Standard is Monday start for anime
          // Sort items by time within day
          const result = [...daysOrder, 'Other']
              .filter(day => grouped[day] && grouped[day].length > 0)
              .map(day => ({
                  title: day,
                  data: grouped[day].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
              }));

          mmkvStorage.setString(cacheKey, JSON.stringify(result));
          mmkvStorage.setNumber(`${cacheKey}_time`, Date.now());
          
          return result;
      } catch (e) {
          console.error('[MalSync] Failed to fetch schedule:', e);
          return [];
      }
  }
};
