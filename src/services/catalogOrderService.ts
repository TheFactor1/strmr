import { mmkvStorage } from './mmkvStorage';
import EventEmitter from 'eventemitter3';

const ORDER_STORAGE_KEY = 'catalog_display_order';

export const catalogOrderEmitter = new EventEmitter();
export const CATALOG_ORDER_EVENTS = {
  CHANGED: 'catalog_order_changed',
} as const;

export class CatalogOrderService {
  private static instance: CatalogOrderService;

  private constructor() {}

  static getInstance(): CatalogOrderService {
    if (!CatalogOrderService.instance) {
      CatalogOrderService.instance = new CatalogOrderService();
    }
    return CatalogOrderService.instance;
  }

  private async getStorageKey(): Promise<string> {
    const scope = await mmkvStorage.getItem('@user:current') || 'local';
    return `@user:${scope}:${ORDER_STORAGE_KEY}`;
  }

  async getOrder(): Promise<string[]> {
    try {
      const key = await this.getStorageKey();
      const json = await mmkvStorage.getItem(key);
      if (!json) return [];
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  async saveOrder(order: string[]): Promise<void> {
    try {
      const key = await this.getStorageKey();
      await mmkvStorage.setItem(key, JSON.stringify(order));
      catalogOrderEmitter.emit(CATALOG_ORDER_EVENTS.CHANGED);
    } catch {
      // silent fail
    }
  }

  async resetOrder(): Promise<void> {
    try {
      const key = await this.getStorageKey();
      await mmkvStorage.setItem(key, JSON.stringify([]));
      catalogOrderEmitter.emit(CATALOG_ORDER_EVENTS.CHANGED);
    } catch {
      // silent fail
    }
  }

  /** Build a catalog key from addon/type/id */
  static catalogKey(addonId: string, type: string, catalogId: string): string {
    return `${addonId}:${type}:${catalogId}`;
  }

  /** Build a collection key from collection id */
  static collectionKey(collectionId: string): string {
    return `collection_${collectionId}`;
  }
}

export const catalogOrderService = CatalogOrderService.getInstance();
