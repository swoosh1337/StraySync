import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATING_KEYS = {
  PROMPTED_COUNT: 'rating_prompted_count',
  LAST_PROMPTED: 'rating_last_prompted',
  USER_RATED: 'rating_user_rated',
  ACTIONS_COUNT: 'rating_actions_count',
};

const PROMPT_THRESHOLDS = {
  MIN_ACTIONS: 5, // Minimum actions before prompting
  DAYS_BETWEEN_PROMPTS: 30, // Days to wait between prompts
  MAX_PROMPTS: 3, // Maximum times to prompt
};

export const ratingService = {
  /**
   * Check if we should prompt for rating
   */
  async shouldPrompt(): Promise<boolean> {
    try {
      // Check if store review is available
      try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) return false;
      } catch (error) {
        // Not available in development
        if (__DEV__) {
          console.log('[Rating] Store review not available');
        }
        return false;
      }

      // Check if user already rated
      const userRated = await AsyncStorage.getItem(RATING_KEYS.USER_RATED);
      if (userRated === 'true') return false;

      // Check prompt count
      const promptCount = parseInt(
        (await AsyncStorage.getItem(RATING_KEYS.PROMPTED_COUNT)) || '0'
      );
      if (promptCount >= PROMPT_THRESHOLDS.MAX_PROMPTS) return false;

      // Check last prompted date
      const lastPrompted = await AsyncStorage.getItem(RATING_KEYS.LAST_PROMPTED);
      if (lastPrompted) {
        const daysSince = (Date.now() - parseInt(lastPrompted)) / (1000 * 60 * 60 * 24);
        if (daysSince < PROMPT_THRESHOLDS.DAYS_BETWEEN_PROMPTS) return false;
      }

      // Check actions count
      const actionsCount = parseInt(
        (await AsyncStorage.getItem(RATING_KEYS.ACTIONS_COUNT)) || '0'
      );
      if (actionsCount < PROMPT_THRESHOLDS.MIN_ACTIONS) return false;

      return true;
    } catch (error) {
      console.error('[Rating] Error checking if should prompt:', error);
      return false;
    }
  },

  /**
   * Increment action count (called when user does something meaningful)
   */
  async incrementActions(): Promise<void> {
    try {
      const current = parseInt(
        (await AsyncStorage.getItem(RATING_KEYS.ACTIONS_COUNT)) || '0'
      );
      await AsyncStorage.setItem(RATING_KEYS.ACTIONS_COUNT, (current + 1).toString());
    } catch (error) {
      console.error('[Rating] Error incrementing actions:', error);
    }
  },

  /**
   * Prompt user to rate the app
   */
  async promptForRating(): Promise<void> {
    try {
      const shouldPrompt = await this.shouldPrompt();
      if (!shouldPrompt) return;

      // Request review (only works in production builds)
      try {
        await StoreReview.requestReview();
      } catch (error) {
        // Silently fail in development - store review doesn't work in Expo Go
        if (__DEV__) {
          console.log('[Rating] Store review not available in development');
        }
        return;
      }

      // Update prompt tracking
      const promptCount = parseInt(
        (await AsyncStorage.getItem(RATING_KEYS.PROMPTED_COUNT)) || '0'
      );
      await AsyncStorage.setItem(
        RATING_KEYS.PROMPTED_COUNT,
        (promptCount + 1).toString()
      );
      await AsyncStorage.setItem(RATING_KEYS.LAST_PROMPTED, Date.now().toString());

      console.log('[Rating] Prompted user for rating');
    } catch (error) {
      console.error('[Rating] Error prompting for rating:', error);
    }
  },

  /**
   * Mark that user has rated (call this if you have custom rating flow)
   */
  async markAsRated(): Promise<void> {
    try {
      await AsyncStorage.setItem(RATING_KEYS.USER_RATED, 'true');
      console.log('[Rating] User marked as rated');
    } catch (error) {
      console.error('[Rating] Error marking as rated:', error);
    }
  },

  /**
   * Reset rating state (for testing)
   */
  async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        RATING_KEYS.PROMPTED_COUNT,
        RATING_KEYS.LAST_PROMPTED,
        RATING_KEYS.USER_RATED,
        RATING_KEYS.ACTIONS_COUNT,
      ]);
      console.log('[Rating] Reset rating state');
    } catch (error) {
      console.error('[Rating] Error resetting:', error);
    }
  },
};

/**
 * Meaningful actions that count towards rating prompt:
 * - Posting an animal sighting
 * - Marking an animal as rescued
 * - Adding to favorites
 * - Posting a lost animal
 * - Commenting on a sighting
 * - Using Pet-a-log
 */
