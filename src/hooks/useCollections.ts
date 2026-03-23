import { useState, useEffect, useCallback } from 'react';
import { Collection } from '../types/collections';
import { collectionsService, collectionsEmitter, COLLECTIONS_EVENTS } from '../services/collectionsService';

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadCollections = useCallback(async () => {
    try {
      const [data, settings] = await Promise.all([
        collectionsService.getCollections(),
        collectionsService.getCollectionSettings(),
      ]);
      setCollections(data);
      setEnabledMap(settings);
    } catch (error) {
      if (__DEV__) console.error('[useCollections] Error loading:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    const handler = () => {
      loadCollections();
    };
    collectionsEmitter.on(COLLECTIONS_EVENTS.CHANGED, handler);
    return () => {
      collectionsEmitter.off(COLLECTIONS_EVENTS.CHANGED, handler);
    };
  }, [loadCollections]);

  return { collections, enabledMap, loading, refresh: loadCollections };
}
