/**
 * Pet-a-log Types
 * Data models for the animal sticker collection feature
 */

export interface AnimalSticker {
  id: string;
  imageUri: string; // Local file path or remote URL
  name: string; // User-given name
  position: {
    x: number;
    y: number;
  };
  scale: number; // Size multiplier (1.0 = original size)
  rotation: number; // Rotation in degrees (0-360)
  capturedAt: Date;
  animalType?: 'cat' | 'dog' | 'unknown';
}

export interface CollectionPage {
  id: string;
  name: string; // Page title like "My First Cats", "Park Dogs"
  stickers: AnimalSticker[];
  backgroundColor: string; // Hex color
  createdAt: Date;
  updatedAt: Date;
}

export interface PetALogCollection {
  pages: CollectionPage[];
  currentPageIndex: number;
}

// Constants for canvas behavior
export const CANVAS_CONSTANTS = {
  MIN_SCALE: 0.5,
  MAX_SCALE: 10,
  DEFAULT_STICKER_SCALE: 1.0,
  STICKER_SIZE: 200, // Base sticker size in pixels
  CANVAS_PADDING: 50,
};

// Helper to create new sticker
export const createSticker = (
  imageUri: string,
  position: { x: number; y: number },
  animalType?: 'cat' | 'dog'
): AnimalSticker => ({
  id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  imageUri,
  name: '', // User will name it later
  position,
  scale: CANVAS_CONSTANTS.DEFAULT_STICKER_SCALE,
  rotation: 0,
  capturedAt: new Date(),
  animalType,
});

// Helper to create new page
export const createCollectionPage = (name: string): CollectionPage => ({
  id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  stickers: [],
  backgroundColor: '#FFFFFF',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Helper to create initial empty collection
export const createInitialCollection = (): PetALogCollection => ({
  pages: [createCollectionPage('My Collection')],
  currentPageIndex: 0,
});
