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

  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const collectionsService = CollectionsService.getInstance();
