import { supabase } from './api/supabaseClient';
import { locationService } from './location/locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { petalogService } from './petalogService';
import { createSticker } from '../types/petalog';

const MOCK_DATA_KEY = '@straysync_mock_data_ids';

/**
 * Mock Data Service
 * Creates realistic mock data for screenshots and demos
 */

// Mock cat/dog names
const CAT_NAMES = [
  'Whiskers', 'Luna', 'Mittens', 'Oliver', 'Bella', 'Simba',
  'Shadow', 'Tiger', 'Chloe', 'Max', 'Lucy', 'Charlie'
];

const DOG_NAMES = [
  'Buddy', 'Max', 'Charlie', 'Cooper', 'Rocky', 'Bear',
  'Duke', 'Zeus', 'Bella', 'Daisy', 'Luna', 'Sadie'
];

// Mock breeds
const CAT_BREEDS = [
  'Domestic Shorthair', 'Siamese', 'Persian', 'Maine Coon',
  'Tabby', 'Calico', 'Russian Blue', 'Bengal'
];

const DOG_BREEDS = [
  'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Beagle',
  'Bulldog', 'Poodle', 'Rottweiler', 'Yorkshire Terrier', 'Boxer', 'Husky'
];

// Mock colors
const COLORS = [
  'Black', 'White', 'Brown', 'Gray', 'Orange', 'Cream',
  'Black and White', 'Brown and White', 'Tabby', 'Spotted'
];

// Mock descriptions
const DESCRIPTIONS = [
  'Very friendly and approachable',
  'Seems well-fed and healthy',
  'Appears to be lost, looking confused',
  'Wearing a collar but no tag',
  'Limping on front left leg',
  'Very playful and energetic',
  'Looks scared, hiding under cars',
  'Follows people around',
];

// Mock image URLs (placeholder images)
const MOCK_CAT_IMAGES = [
  'https://placekitten.com/400/400',
  'https://placekitten.com/401/401',
  'https://placekitten.com/402/402',
  'https://placekitten.com/403/403',
  'https://placekitten.com/404/404',
  'https://placekitten.com/405/405',
];

const MOCK_DOG_IMAGES = [
  'https://placedog.net/400/400',
  'https://placedog.net/401/401',
  'https://placedog.net/402/402',
  'https://placedog.net/403/403',
  'https://placedog.net/404/404',
  'https://placedog.net/405/405',
];

interface MockDataIds {
  activeAnimals: string[];
  rescuedAnimals: string[];
  lostAnimals: string[];
  petalogStickers: string[];
  favorites: string[];
}

class MockDataService {
  /**
   * Generate random offset for location (in degrees, ~1km = 0.01 degrees)
   */
  private randomOffset(maxKm: number = 2): number {
    const degrees = maxKm * 0.01;
    return (Math.random() - 0.5) * 2 * degrees;
  }

  /**
   * Pick random item from array
   */
  private pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Create mock active animals on the map
   */
  async createMockActiveAnimals(count: number = 8): Promise<string[]> {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated - cannot create mock animals');
      }

      // Get current location
      const location = await locationService.getCurrentLocation();
      if (!location) {
        throw new Error('Could not get current location');
      }

      const { latitude, longitude } = location;
      const animalIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const animalType = Math.random() > 0.5 ? 'cat' : 'dog';
        const names = animalType === 'cat' ? CAT_NAMES : DOG_NAMES;
        const breeds = animalType === 'cat' ? CAT_BREEDS : DOG_BREEDS;
        const images = animalType === 'cat' ? MOCK_CAT_IMAGES : MOCK_DOG_IMAGES;

        const mockAnimal = {
          latitude: latitude + this.randomOffset(2),
          longitude: longitude + this.randomOffset(2),
          image_url: this.pickRandom(images),
          description: this.pickRandom(DESCRIPTIONS),
          animal_type: animalType,
          name: this.pickRandom(names),
          breed: this.pickRandom(breeds),
          color: this.pickRandom(COLORS),
          age: ['kitten', 'young', 'adult', 'senior'][Math.floor(Math.random() * 4)],
          gender: Math.random() > 0.5 ? 'male' : 'female',
          health_status: Math.random() > 0.7 ? 'injured' : 'healthy',
          is_neutered: Math.random() > 0.5,
          spotted_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          user_id: user.id,
          auth_user_id: user.id,
        };

        try {
          const result = await supabase
            .from('animals')
            .insert(mockAnimal)
            .select('id')
            .single();

          console.log(`[MockData] Raw result for animal ${i + 1}:`, {
            hasData: !!result.data,
            hasError: !!result.error,
            status: result.status,
            statusText: result.statusText,
          });

          if (result.error) {
            console.error(`[MockData] Failed to insert animal ${i + 1}:`, JSON.stringify(result.error, null, 2));
            console.log('[MockData] Full error object:', result.error);
            console.log('[MockData] Error keys:', Object.keys(result.error));
            console.log('[MockData] Attempted to insert:', mockAnimal);
          } else if (result.data) {
            animalIds.push(result.data.id);
            if (__DEV__) {
              console.log(`[MockData] ✅ Successfully created animal ${i + 1}: ${result.data.id}`);
            }
          } else {
            console.warn(`[MockData] No data and no error for animal ${i + 1}`);
          }
        } catch (insertError) {
          console.error(`[MockData] Exception inserting animal ${i + 1}:`, insertError);
          console.log('[MockData] Attempted to insert:', mockAnimal);
        }
      }

      if (__DEV__) {
        console.log(`[MockData] Created ${animalIds.length} active animals`);
      }

      return animalIds;
    } catch (error) {
      console.error('[MockData] Error creating active animals:', error);
      return [];
    }
  }

  /**
   * Create mock rescued animals
   */
  async createMockRescuedAnimals(count: number = 3): Promise<string[]> {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated - cannot create mock animals');
      }

      const location = await locationService.getCurrentLocation();
      if (!location) {
        throw new Error('Could not get current location');
      }

      const { latitude, longitude } = location;
      const animalIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const animalType = Math.random() > 0.5 ? 'cat' : 'dog';
        const names = animalType === 'cat' ? CAT_NAMES : DOG_NAMES;
        const breeds = animalType === 'cat' ? CAT_BREEDS : DOG_BREEDS;
        const images = animalType === 'cat' ? MOCK_CAT_IMAGES : MOCK_DOG_IMAGES;

        const mockAnimal = {
          latitude: latitude + this.randomOffset(1),
          longitude: longitude + this.randomOffset(1),
          image_url: this.pickRandom(images),
          description: 'Successfully rescued and safe!',
          animal_type: animalType,
          name: this.pickRandom(names),
          breed: this.pickRandom(breeds),
          color: this.pickRandom(COLORS),
          age: 'adult',
          gender: Math.random() > 0.5 ? 'male' : 'female',
          health_status: 'healthy',
          is_neutered: true,
          is_adoptable: true,
          spotted_at: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
          user_id: user.id,
          auth_user_id: user.id,
        };

        try {
          const result = await supabase
            .from('animals')
            .insert(mockAnimal)
            .select('id')
            .single();

          console.log(`[MockData] Raw result for animal ${i + 1}:`, {
            hasData: !!result.data,
            hasError: !!result.error,
            status: result.status,
            statusText: result.statusText,
          });

          if (result.error) {
            console.error(`[MockData] Failed to insert animal ${i + 1}:`, JSON.stringify(result.error, null, 2));
            console.log('[MockData] Full error object:', result.error);
            console.log('[MockData] Error keys:', Object.keys(result.error));
            console.log('[MockData] Attempted to insert:', mockAnimal);
          } else if (result.data) {
            animalIds.push(result.data.id);
            if (__DEV__) {
              console.log(`[MockData] ✅ Successfully created animal ${i + 1}: ${result.data.id}`);
            }
          } else {
            console.warn(`[MockData] No data and no error for animal ${i + 1}`);
          }
        } catch (insertError) {
          console.error(`[MockData] Exception inserting animal ${i + 1}:`, insertError);
          console.log('[MockData] Attempted to insert:', mockAnimal);
        }
      }

      if (__DEV__) {
        console.log(`[MockData] Created ${animalIds.length} rescued animals`);
      }

      return animalIds;
    } catch (error) {
      console.error('[MockData] Error creating rescued animals:', error);
      return [];
    }
  }

  /**
   * Create mock Pet-a-log stickers
   */
  async createMockPetalogStickers(count: number = 5): Promise<string[]> {
    try {
      const collection = await petalogService.loadCollection();
      const stickerIds: string[] = [];

      // Create stickers in a grid-like pattern to ensure visibility
      const rows = Math.ceil(Math.sqrt(count));
      const cols = Math.ceil(count / rows);
      const spacingX = 250;
      const spacingY = 250;
      const offsetX = 50;
      const offsetY = 100;

      for (let i = 0; i < count; i++) {
        const animalType = Math.random() > 0.5 ? 'cat' : 'dog';
        const names = animalType === 'cat' ? CAT_NAMES : DOG_NAMES;
        const images = animalType === 'cat' ? MOCK_CAT_IMAGES : MOCK_DOG_IMAGES;

        const row = Math.floor(i / cols);
        const col = i % cols;

        const sticker = createSticker(
          this.pickRandom(images),
          {
            x: offsetX + col * spacingX + (Math.random() - 0.5) * 50,
            y: offsetY + row * spacingY + (Math.random() - 0.5) * 50,
          },
          animalType
        );

        sticker.name = this.pickRandom(names);
        sticker.scale = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
        sticker.rotation = (Math.random() - 0.5) * 30; // -15 to +15 degrees for subtle rotation

        const updatedCollection = await petalogService.addSticker(collection, sticker);
        stickerIds.push(sticker.id);
      }

      if (__DEV__) {
        console.log(`[MockData] Created ${stickerIds.length} Pet-a-log stickers`);
      }

      return stickerIds;
    } catch (error) {
      console.error('[MockData] Error creating Pet-a-log stickers:', error);
      return [];
    }
  }

  /**
   * Create mock favorites from existing animals
   */
  async createMockFavorites(animalIds: string[]): Promise<string[]> {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated - cannot create favorites');
      }

      const favoriteIds: string[] = [];

      // Randomly select 3-5 animals to favorite
      const numFavorites = Math.min(animalIds.length, Math.floor(Math.random() * 3) + 3);
      const shuffled = [...animalIds].sort(() => Math.random() - 0.5);
      const selectedIds = shuffled.slice(0, numFavorites);

      for (const animalId of selectedIds) {
        const { data, error } = await supabase
          .from('favorites')
          .insert({
            auth_user_id: user.id,
            animal_id: animalId,
          })
          .select('id')
          .single();

        if (error) {
          console.error('[MockData] Failed to create favorite:', error);
        } else if (data) {
          favoriteIds.push(data.id);
        }
      }

      if (__DEV__) {
        console.log(`[MockData] Created ${favoriteIds.length} favorites`);
      }

      return favoriteIds;
    } catch (error) {
      console.error('[MockData] Error creating favorites:', error);
      return [];
    }
  }

  /**
   * Populate all mock data
   */
  async populateAllMockData(): Promise<{
    success: boolean;
    counts: {
      activeAnimals: number;
      rescuedAnimals: number;
      petalogStickers: number;
      favorites: number;
    };
  }> {
    try {
      if (__DEV__) {
        console.log('[MockData] Populating mock data...');
      }

      // Create mock data
      const [activeIds, rescuedIds, stickerIds] = await Promise.all([
        this.createMockActiveAnimals(8),
        this.createMockRescuedAnimals(3),
        this.createMockPetalogStickers(5),
      ]);

      // Create favorites from the created animals
      const allAnimalIds = [...activeIds, ...rescuedIds];
      const favoriteIds = await this.createMockFavorites(allAnimalIds);

      // Store IDs for later deletion
      const mockDataIds: MockDataIds = {
        activeAnimals: activeIds,
        rescuedAnimals: rescuedIds,
        lostAnimals: [], // TODO: Add lost animals if you have that feature
        petalogStickers: stickerIds,
        favorites: favoriteIds,
      };

      await AsyncStorage.setItem(MOCK_DATA_KEY, JSON.stringify(mockDataIds));

      if (__DEV__) {
        console.log('[MockData] ✅ Mock data populated successfully');
      }

      return {
        success: true,
        counts: {
          activeAnimals: activeIds.length,
          rescuedAnimals: rescuedIds.length,
          petalogStickers: stickerIds.length,
          favorites: favoriteIds.length,
        },
      };
    } catch (error) {
      console.error('[MockData] Error populating mock data:', error);
      return {
        success: false,
        counts: {
          activeAnimals: 0,
          rescuedAnimals: 0,
          petalogStickers: 0,
          favorites: 0,
        },
      };
    }
  }

  /**
   * Delete all mock data
   */
  async deleteAllMockData(): Promise<{
    success: boolean;
    counts: {
      activeAnimals: number;
      rescuedAnimals: number;
      petalogStickers: number;
      favorites: number;
    };
  }> {
    try {
      if (__DEV__) {
        console.log('[MockData] Deleting mock data...');
      }

      // Get stored mock IDs
      const storedData = await AsyncStorage.getItem(MOCK_DATA_KEY);

      if (!storedData) {
        if (__DEV__) {
          console.log('[MockData] No mock data to delete');
        }
        return {
          success: true,
          counts: {
            activeAnimals: 0,
            rescuedAnimals: 0,
            petalogStickers: 0,
            favorites: 0,
          },
        };
      }

      const mockDataIds: MockDataIds = JSON.parse(storedData);

      // Delete favorites first (before deleting animals)
      if (mockDataIds.favorites && mockDataIds.favorites.length > 0) {
        await supabase
          .from('favorites')
          .delete()
          .in('id', mockDataIds.favorites);
      }

      // Delete animals from database
      const allAnimalIds = [
        ...mockDataIds.activeAnimals,
        ...mockDataIds.rescuedAnimals,
        ...mockDataIds.lostAnimals,
      ];

      if (allAnimalIds.length > 0) {
        await supabase
          .from('animals')
          .delete()
          .in('id', allAnimalIds);
      }

      // Delete Pet-a-log stickers
      const collection = await petalogService.loadCollection();
      for (const stickerId of mockDataIds.petalogStickers) {
        await petalogService.deleteSticker(collection, stickerId);
      }

      // Clear stored IDs
      await AsyncStorage.removeItem(MOCK_DATA_KEY);

      if (__DEV__) {
        console.log('[MockData] ✅ Mock data deleted successfully');
      }

      return {
        success: true,
        counts: {
          activeAnimals: mockDataIds.activeAnimals.length,
          rescuedAnimals: mockDataIds.rescuedAnimals.length,
          petalogStickers: mockDataIds.petalogStickers.length,
          favorites: mockDataIds.favorites?.length || 0,
        },
      };
    } catch (error) {
      console.error('[MockData] Error deleting mock data:', error);
      return {
        success: false,
        counts: {
          activeAnimals: 0,
          rescuedAnimals: 0,
          petalogStickers: 0,
          favorites: 0,
        },
      };
    }
  }

  /**
   * Check if mock data exists
   */
  async hasMockData(): Promise<boolean> {
    try {
      const storedData = await AsyncStorage.getItem(MOCK_DATA_KEY);
      return storedData !== null;
    } catch (error) {
      return false;
    }
  }
}

export const mockDataService = new MockDataService();
