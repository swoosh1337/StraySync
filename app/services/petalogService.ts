import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PetALogCollection,
  CollectionPage,
  AnimalSticker,
  createInitialCollection,
} from '../types/petalog';

const STORAGE_KEY = '@straysync_petalog_collection';

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
      const data = await AsyncStorage.getItem(STORAGE_KEY);

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
        console.log(`[PetALog] Loaded collection with ${collection.pages.length} pages`);
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
      const data = JSON.stringify(collection);
      await AsyncStorage.setItem(STORAGE_KEY, data);

      if (__DEV__) {
        console.log('[PetALog] Collection saved successfully');
      }
    } catch (error) {
      console.error('[PetALog] Error saving collection:', error);
      throw error;
    }
  },

  /**
   * Add a new sticker to the current page
   */
  async addSticker(
    collection: PetALogCollection,
    sticker: AnimalSticker
  ): Promise<PetALogCollection> {
    const updatedCollection = { ...collection };
    const currentPage = updatedCollection.pages[collection.currentPageIndex];

    currentPage.stickers.push(sticker);
    currentPage.updatedAt = new Date();

    await this.saveCollection(updatedCollection);
    return updatedCollection;
  },

  /**
   * Update an existing sticker
   */
  async updateSticker(
    collection: PetALogCollection,
    stickerId: string,
    updates: Partial<AnimalSticker>
  ): Promise<PetALogCollection> {
    const updatedCollection = { ...collection };
    const currentPage = updatedCollection.pages[collection.currentPageIndex];

    const stickerIndex = currentPage.stickers.findIndex(s => s.id === stickerId);
    if (stickerIndex !== -1) {
      currentPage.stickers[stickerIndex] = {
        ...currentPage.stickers[stickerIndex],
        ...updates,
      };
      currentPage.updatedAt = new Date();
    }

    await this.saveCollection(updatedCollection);
    return updatedCollection;
  },

  /**
   * Delete a sticker from the current page
   */
  async deleteSticker(
    collection: PetALogCollection,
    stickerId: string
  ): Promise<PetALogCollection> {
    const updatedCollection = { ...collection };
    const currentPage = updatedCollection.pages[collection.currentPageIndex];

    currentPage.stickers = currentPage.stickers.filter(s => s.id !== stickerId);
    currentPage.updatedAt = new Date();

    await this.saveCollection(updatedCollection);
    return updatedCollection;
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
    const updatedCollection = { ...collection };
    const pageIndex = updatedCollection.pages.findIndex(p => p.id === pageId);

    if (pageIndex !== -1) {
      updatedCollection.pages[pageIndex] = {
        ...updatedCollection.pages[pageIndex],
        ...updates,
        updatedAt: new Date(),
      };
    }

    await this.saveCollection(updatedCollection);
    return updatedCollection;
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
      await AsyncStorage.removeItem(STORAGE_KEY);
      if (__DEV__) {
        console.log('[PetALog] Collection cleared');
      }
    } catch (error) {
      console.error('[PetALog] Error clearing collection:', error);
      throw error;
    }
  },
};
