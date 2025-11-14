import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PetALogCollection,
  CollectionPage,
  AnimalSticker,
  createInitialCollection,
} from '../types/petalog';
import { supabase } from './supabase';

const STORAGE_KEY_PREFIX = '@straysync_petalog_collection';
const SAVE_DEBOUNCE_MS = 300;

// Get user-specific storage key
async function getStorageKey(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

// Internal debounced save state
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
let latestSerialized: string | null = null;

/**
 * Pet-a-log Service
 * Handles CRUD operations for animal sticker collections
 */
export const petalogService = {
  /**
   * Load collection from storage
   * Returns initial collection if none exists
   */
  async loadCollection(): Promise<PetALogCollection> {
    try {
      const storageKey = await getStorageKey();
      const data = await AsyncStorage.getItem(storageKey);

      if (!data) {
        if (__DEV__) {
          console.log('[PetALog] No existing collection, creating new one');
        }
        const initial = createInitialCollection();
        await this.saveCollection(initial);
        return initial;
      }

      const collection = JSON.parse(data);

      // Convert date strings back to Date objects
      collection.pages = collection.pages.map((page: any) => ({
        ...page,
        createdAt: new Date(page.createdAt),
        updatedAt: new Date(page.updatedAt),
        stickers: page.stickers.map((sticker: any) => ({
          ...sticker,
          capturedAt: new Date(sticker.capturedAt),
        })),
      }));

      if (__DEV__) {
        console.log(`[PetALog] Loaded collection with ${collection.pages.length} pages for user`);
      }

      return collection;
    } catch (error) {
      console.error('[PetALog] Error loading collection:', error);
      return createInitialCollection();
    }
  },

  /**
   * Save entire collection to storage
   */
  async saveCollection(collection: PetALogCollection): Promise<void> {
    try {
      const storageKey = await getStorageKey();
      latestSerialized = JSON.stringify(collection);

      // Coalesce rapid saves with debounce
      if (pendingSaveTimer) {
        clearTimeout(pendingSaveTimer);
      }
      pendingSaveTimer = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(storageKey, latestSerialized!);
          if (__DEV__) {
            console.log('[PetALog] Collection saved (flush)');
          }
        } catch (error) {
          console.error('[PetALog] Error flushing save:', error);
        } finally {
          pendingSaveTimer = null;
        }
      }, SAVE_DEBOUNCE_MS);

      if (__DEV__) {
        console.log('[PetALog] Save scheduled');
      }
    } catch (error) {
      console.error('[PetALog] Error scheduling save:', error);
      throw error;
    }
  },

  // Force immediate persistence of the latest state
  async flushNow(): Promise<void> {
    if (pendingSaveTimer) {
      clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    if (latestSerialized) {
      const storageKey = await getStorageKey();
      await AsyncStorage.setItem(storageKey, latestSerialized);
      if (__DEV__) {
        console.log('[PetALog] Collection saved (flush now)');
      }
    }
  },

  /**
   * Add a new sticker to the current page
   */
  async addSticker(
    collection: PetALogCollection,
    sticker: AnimalSticker
  ): Promise<PetALogCollection> {
    const pageIndex = collection.currentPageIndex;
    const oldPage = collection.pages[pageIndex];
    const newPage: CollectionPage = {
      ...oldPage,
      stickers: [...oldPage.stickers, sticker],
      updatedAt: new Date(),
    };
    const newPages = collection.pages.map((p, i) => (i === pageIndex ? newPage : p));
    const newCollection: PetALogCollection = { ...collection, pages: newPages };

    await this.saveCollection(newCollection);
    return newCollection;
  },

  /**
   * Update an existing sticker
   */
  async updateSticker(
    collection: PetALogCollection,
    stickerId: string,
    updates: Partial<AnimalSticker>
  ): Promise<PetALogCollection> {
    const pageIndex = collection.currentPageIndex;
    const oldPage = collection.pages[pageIndex];
    const newStickers = oldPage.stickers.map((s) =>
      s.id === stickerId ? { ...s, ...updates } : s
    );
    const newPage: CollectionPage = {
      ...oldPage,
      stickers: newStickers,
      updatedAt: new Date(),
    };
    const newPages = collection.pages.map((p, i) => (i === pageIndex ? newPage : p));
    const newCollection: PetALogCollection = { ...collection, pages: newPages };

    await this.saveCollection(newCollection);
    return newCollection;
  },

  /**
   * Delete a sticker from the current page
   */
  async deleteSticker(
    collection: PetALogCollection,
    stickerId: string
  ): Promise<PetALogCollection> {
    const pageIndex = collection.currentPageIndex;
    const oldPage = collection.pages[pageIndex];
    const newPage: CollectionPage = {
      ...oldPage,
      stickers: oldPage.stickers.filter((s) => s.id !== stickerId),
      updatedAt: new Date(),
    };
    const newPages = collection.pages.map((p, i) => (i === pageIndex ? newPage : p));
    const newCollection: PetALogCollection = { ...collection, pages: newPages };

    await this.saveCollection(newCollection);
    return newCollection;
  },

  /**
   * Add a new page to the collection
   */
  async addPage(
    collection: PetALogCollection,
    page: CollectionPage
  ): Promise<PetALogCollection> {
    const updatedCollection = {
      ...collection,
      pages: [...collection.pages, page],
    };

    await this.saveCollection(updatedCollection);
    return updatedCollection;
  },

  /**
   * Update page details (name, background color)
   */
  async updatePage(
    collection: PetALogCollection,
    pageId: string,
    updates: Partial<CollectionPage>
  ): Promise<PetALogCollection> {
    const newPages = collection.pages.map((p) =>
      p.id === pageId
        ? { ...p, ...updates, updatedAt: new Date() }
        : p
    );

    const newCollection: PetALogCollection = {
      ...collection,
      pages: newPages,
    };

    await this.saveCollection(newCollection);
    return newCollection;
  },

  /**
   * Delete a page from the collection
   */
  async deletePage(
    collection: PetALogCollection,
    pageId: string
  ): Promise<PetALogCollection> {
    // Don't allow deleting the last page
    if (collection.pages.length <= 1) {
      throw new Error('Cannot delete the last page');
    }

    const pageIndex = collection.pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) {
      throw new Error('Page not found');
    }

    const updatedCollection = {
      ...collection,
      pages: collection.pages.filter(p => p.id !== pageId),
    };

    // Adjust current page index if needed
    if (updatedCollection.currentPageIndex >= updatedCollection.pages.length) {
      updatedCollection.currentPageIndex = updatedCollection.pages.length - 1;
    }

    await this.saveCollection(updatedCollection);
    return updatedCollection;
  },

  /**
   * Change current page
   */
  async setCurrentPage(
    collection: PetALogCollection,
    pageIndex: number
  ): Promise<PetALogCollection> {
    if (pageIndex < 0 || pageIndex >= collection.pages.length) {
      throw new Error('Invalid page index');
    }

    const updatedCollection = {
      ...collection,
      currentPageIndex: pageIndex,
    };

    await this.saveCollection(updatedCollection);
    return updatedCollection;
  },

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    try {
      const storageKey = await getStorageKey();
      await AsyncStorage.removeItem(storageKey);
      if (__DEV__) {
        console.log('[PetALog] Collection cleared for current user');
      }
    } catch (error) {
      console.error('[PetALog] Error clearing collection:', error);
      throw error;
    }
  },
};
