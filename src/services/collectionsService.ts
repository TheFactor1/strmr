import { mmkvStorage } from './mmkvStorage';
import { Collection, CollectionFolder, CollectionCatalogSource } from '../types/collections';
import { logger } from '../utils/logger';
import EventEmitter from 'eventemitter3';

const COLLECTIONS_STORAGE_KEY = 'collections';
const COLLECTION_SETTINGS_KEY = 'collection_settings';

export const collectionsEmitter = new EventEmitter();
export const COLLECTIONS_EVENTS = {
  CHANGED: 'collections_changed',
} as const;

class CollectionsService {
  private static instance: CollectionsService;

  private constructor() {}

  static getInstance(): CollectionsService {
    if (!CollectionsService.instance) {
      CollectionsService.instance = new CollectionsService();
    }
    return CollectionsService.instance;
  }

  private async getStorageKey(): Promise<string> {
    const scope = await mmkvStorage.getItem('@user:current') || 'local';
    return `@user:${scope}:${COLLECTIONS_STORAGE_KEY}`;
  }

  async getCollections(): Promise<Collection[]> {
    try {
      const key = await this.getStorageKey();
      const json = await mmkvStorage.getItem(key);
      if (!json) return [];
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (error) {
      logger.error('[CollectionsService] Error loading collections:', error);
      return [];
    }
  }

  async saveCollections(collections: Collection[]): Promise<void> {
    try {
      const key = await this.getStorageKey();
      await mmkvStorage.setItem(key, JSON.stringify(collections));
      collectionsEmitter.emit(COLLECTIONS_EVENTS.CHANGED);
    } catch (error) {
      logger.error('[CollectionsService] Error saving collections:', error);
    }
  }

  async addCollection(collection: Collection): Promise<void> {
    const collections = await this.getCollections();
    collections.push(collection);
    await this.saveCollections(collections);
  }

  async updateCollection(updated: Collection): Promise<void> {
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === updated.id);
    if (index >= 0) {
      collections[index] = updated;
      await this.saveCollections(collections);
    }
  }

  async deleteCollection(id: string): Promise<void> {
    const collections = await this.getCollections();
    await this.saveCollections(collections.filter(c => c.id !== id));
  }

  async moveCollection(id: string, direction: 'up' | 'down'): Promise<void> {
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === id);
    if (index < 0) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= collections.length) return;
    const temp = collections[index];
    collections[index] = collections[newIndex];
    collections[newIndex] = temp;
    await this.saveCollections(collections);
  }

  async exportToJson(): Promise<string> {
    const collections = await this.getCollections();
    return JSON.stringify(collections, null, 2);
  }

  async importFromJson(json: string): Promise<{ added: number; updated: number }> {
    try {
      const imported = JSON.parse(json);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected an array');
      }

      const existing = await this.getCollections();
      const existingMap = new Map(existing.map(c => [c.id, c]));

      let added = 0;
      let updated = 0;

      for (const item of imported) {
        if (!item.id || !item.title || !Array.isArray(item.folders)) continue;
        if (existingMap.has(item.id)) {
          existingMap.set(item.id, item);
          updated++;
        } else {
          existingMap.set(item.id, item);
          added++;
        }
      }

      await this.saveCollections(Array.from(existingMap.values()));
      return { added, updated };
    } catch (error) {
      logger.error('[CollectionsService] Import error:', error);
      throw error;
    }
  }

  private async getSettingsKey(): Promise<string> {
    const scope = await mmkvStorage.getItem('@user:current') || 'local';
    return `@user:${scope}:${COLLECTION_SETTINGS_KEY}`;
  }

  async getCollectionSettings(): Promise<Record<string, boolean>> {
    try {
      const key = await this.getSettingsKey();
      const json = await mmkvStorage.getItem(key);
      if (!json) return {};
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  async isCollectionEnabled(id: string): Promise<boolean> {
    const settings = await this.getCollectionSettings();
    return settings[id] !== false; // default enabled
  }

  async setCollectionEnabled(id: string, enabled: boolean): Promise<void> {
    try {
      const settings = await this.getCollectionSettings();
      settings[id] = enabled;
      const key = await this.getSettingsKey();
      await mmkvStorage.setItem(key, JSON.stringify(settings));
      collectionsEmitter.emit(COLLECTIONS_EVENTS.CHANGED);
    } catch {
      // silent fail
    }
  }

  validateCollectionsJson(json: string): { valid: boolean; error?: string; collectionCount: number; folderCount: number } {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        return { valid: false, error: 'Invalid format: expected an array of collections', collectionCount: 0, folderCount: 0 };
      }
      if (parsed.length === 0) {
        return { valid: false, error: 'Empty array: no collections found', collectionCount: 0, folderCount: 0 };
      }
      let folderCount = 0;
      const validTileShapes = ['poster', 'wide', 'square', 'POSTER', 'LANDSCAPE', 'SQUARE'];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item || typeof item.id !== 'string' || !item.id.trim()) {
          return { valid: false, error: `Collection ${i + 1}: missing or invalid "id"`, collectionCount: 0, folderCount: 0 };
        }
        if (typeof item.title !== 'string') {
          return { valid: false, error: `Collection "${item.id}": missing or invalid "title"`, collectionCount: 0, folderCount: 0 };
        }
        if (!Array.isArray(item.folders)) {
          return { valid: false, error: `Collection "${item.title || item.id}": "folders" must be an array`, collectionCount: 0, folderCount: 0 };
        }
        for (let j = 0; j < item.folders.length; j++) {
          const folder = item.folders[j];
          if (!folder || typeof folder.id !== 'string' || !folder.id.trim()) {
            return { valid: false, error: `Collection "${item.title}", folder ${j + 1}: missing or invalid "id"`, collectionCount: 0, folderCount: 0 };
          }
          if (typeof folder.title !== 'string') {
            return { valid: false, error: `Collection "${item.title}", folder "${folder.id}": missing or invalid "title"`, collectionCount: 0, folderCount: 0 };
          }
          if (!Array.isArray(folder.catalogSources)) {
            return { valid: false, error: `Collection "${item.title}", folder "${folder.title || folder.id}": "catalogSources" must be an array`, collectionCount: 0, folderCount: 0 };
          }
          if (folder.tileShape && !validTileShapes.includes(folder.tileShape)) {
            return { valid: false, error: `Collection "${item.title}", folder "${folder.title}": invalid tileShape "${folder.tileShape}"`, collectionCount: 0, folderCount: 0 };
          }
          for (let k = 0; k < folder.catalogSources.length; k++) {
            const source = folder.catalogSources[k];
            if (!source || typeof source.addonId !== 'string' || typeof source.type !== 'string' || typeof source.catalogId !== 'string') {
              return { valid: false, error: `Collection "${item.title}", folder "${folder.title}", source ${k + 1}: missing required fields (addonId, type, catalogId)`, collectionCount: 0, folderCount: 0 };
            }
          }
          folderCount++;
        }
      }
      return { valid: true, collectionCount: parsed.length, folderCount };
    } catch (e: any) {
      return { valid: false, error: `JSON parse error: ${e.message}`, collectionCount: 0, folderCount: 0 };
    }
  }

  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const collectionsService = CollectionsService.getInstance();
