import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// @ts-ignore - Module might not have types
import TorrentStreamer from 'react-native-torrent-streamer';

export const torrentService = {
  startStreaming: (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'android') {
        reject(new Error('Torrent streaming natively is only supported on Android.'));
        return;
      }

      try {
        TorrentStreamer.start(url);

        const onReady = (data: any) => {
          logger.log('[TorrentService] Torrent is ready at:', data.url);
          // Remove listener once resolved to prevent memory leaks
          TorrentStreamer.removeEventListener('ready', onReady);
          resolve(data.url);
        };

        const onError = (error: any) => {
          logger.error('[TorrentService] Error streaming torrent:', error);
          TorrentStreamer.removeEventListener('error', onError);
          reject(error);
        };

        TorrentStreamer.addEventListener('ready', onReady);
        TorrentStreamer.addEventListener('error', onError);
        
      } catch (err) {
        logger.error('[TorrentService] Initialization error:', err);
        reject(err);
      }
    });
  },

  stopStreaming: () => {
    if (Platform.OS === 'android') {
      try {
        TorrentStreamer.stop();
        logger.log('[TorrentService] Stopped torrent stream.');
      } catch (err) {
        logger.error('[TorrentService] Failed to stop stream:', err);
      }
    }
  },

  addListener: (event: 'status' | 'ready' | 'error', callback: (data: any) => void) => {
    if (Platform.OS === 'android') {
      try {
        TorrentStreamer.addEventListener(event, callback);
      } catch (err) {
        logger.warn('[TorrentService] Could not add listener:', err);
      }
    }
  },

  removeListener: (event: 'status' | 'ready' | 'error', callback: (data: any) => void) => {
    if (Platform.OS === 'android') {
      try {
        TorrentStreamer.removeEventListener(event, callback);
      } catch (err) {
        logger.warn('[TorrentService] Could not remove listener:', err);
      }
    }
  }
};
