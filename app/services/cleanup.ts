import { catService } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: Server-side cleanup is now the primary mechanism for deleting old animals.
// A PostgreSQL function with pg_cron runs daily at 2 AM UTC to delete animals older than 14 days.
// This client-side cleanup serves as a fallback for older Supabase instances without pg_cron
// or as a safety net in case the server-side job fails.

const CLEANUP_INTERVAL_KEY = 'lastCleanupDate';
const CLEANUP_INTERVAL_DAYS = 30; // Run client-side cleanup every 30 days (server-side handles daily)
const ANIMAL_MAX_AGE_DAYS = 14; // Delete animals older than 2 weeks

export const cleanupService = {
  /**
   * Check if cleanup should run and execute if needed
   *
   * NOTE: This is a fallback mechanism. Primary cleanup happens server-side via pg_cron.
   * This runs every 30 days as a safety net in case server-side cleanup fails.
   */
  async checkAndRunCleanup(): Promise<void> {
    try {
      const lastCleanup = await AsyncStorage.getItem(CLEANUP_INTERVAL_KEY);
      const now = new Date();

      let shouldRunCleanup = false;

      if (!lastCleanup) {
        // First time running, skip cleanup since server-side should handle it
        // Just set the timestamp and wait for the interval
        await AsyncStorage.setItem(CLEANUP_INTERVAL_KEY, now.toISOString());
        console.log('Client-side cleanup initialized. Server-side cleanup is primary mechanism.');
        return;
      } else {
        const lastCleanupDate = new Date(lastCleanup);
        const daysSinceLastCleanup = Math.floor(
          (now.getTime() - lastCleanupDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCleanup >= CLEANUP_INTERVAL_DAYS) {
          shouldRunCleanup = true;
        }
      }

      if (shouldRunCleanup) {
        console.log('[FALLBACK] Running client-side cleanup of old animal records...');
        console.log('Note: Server-side cleanup via pg_cron should handle this automatically');
        await this.cleanupOldAnimals();
        await AsyncStorage.setItem(CLEANUP_INTERVAL_KEY, now.toISOString());
        console.log('Client-side cleanup completed and timestamp saved');
      } else {
        console.log('Client-side cleanup not needed yet (server-side handles daily cleanup)');
      }
    } catch (error) {
      console.error('Error in checkAndRunCleanup:', error);
    }
  },

  /**
   * Delete animals older than the specified number of days
   */
  async cleanupOldAnimals(): Promise<number> {
    try {
      const animals = await catService.getCats();
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - ANIMAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      
      console.log(`Checking ${animals.length} animals for cleanup...`);
      console.log(`Cutoff date: ${cutoffDate.toISOString()}`);
      
      const oldAnimals = animals.filter(animal => {
        const spottedDate = new Date(animal.spotted_at);
        return spottedDate < cutoffDate;
      });
      
      console.log(`Found ${oldAnimals.length} animals older than ${ANIMAL_MAX_AGE_DAYS} days`);
      
      let deletedCount = 0;
      
      for (const animal of oldAnimals) {
        try {
          console.log(`Deleting animal ${animal.id} spotted on ${animal.spotted_at}`);
          
          // Delete the image from Supabase Storage (not placeholder images)
          if (animal.image_url && 
              !animal.image_url.includes('placekitten.com') && 
              !animal.image_url.includes('placeholder')) {
            console.log(`Deleting image from storage: ${animal.image_url}`);
            const imageDeleted = await catService.deleteImageFromStorage(animal.image_url);
            if (imageDeleted) {
              console.log('Image deleted successfully from storage');
            } else {
              console.log('Failed to delete image from storage (may not exist)');
            }
          } else {
            console.log('Skipping image deletion (placeholder or external URL)');
          }
          
          // Delete the animal record
          const success = await catService.deleteCat(animal.id);
          
          if (success) {
            deletedCount++;
            console.log(`Successfully deleted animal ${animal.id}`);
          } else {
            console.log(`Failed to delete animal ${animal.id}`);
          }
        } catch (error) {
          console.error(`Error deleting animal ${animal.id}:`, error);
        }
      }
      
      console.log(`Cleanup completed: ${deletedCount} animals deleted`);
      return deletedCount;
    } catch (error) {
      console.error('Error in cleanupOldAnimals:', error);
      return 0;
    }
  },

  /**
   * Get the last cleanup date
   */
  async getLastCleanupDate(): Promise<Date | null> {
    try {
      const lastCleanup = await AsyncStorage.getItem(CLEANUP_INTERVAL_KEY);
      return lastCleanup ? new Date(lastCleanup) : null;
    } catch (error) {
      console.error('Error getting last cleanup date:', error);
      return null;
    }
  },

  /**
   * Manually trigger cleanup (for testing or admin purposes)
   */
  async manualCleanup(): Promise<number> {
    try {
      const deletedCount = await this.cleanupOldAnimals();
      await AsyncStorage.setItem(CLEANUP_INTERVAL_KEY, new Date().toISOString());
      return deletedCount;
    } catch (error) {
      console.error('Error in manual cleanup:', error);
      return 0;
    }
  },
};
