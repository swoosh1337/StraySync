import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../contexts/AuthContext';

const PROFILE_CACHE_KEY = '@straysync_profile_cache';

/**
 * Profile caching service to provide instant profile loading
 * and handle slow/offline network scenarios
 */
export const profileCache = {
  /**
   * Save profile to AsyncStorage cache
   */
  async save(userId: string, profile: UserProfile): Promise<void> {
    try {
      const cacheData = {
        userId,
        profile,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
      if (__DEV__) {
        console.log('[ProfileCache] Saved profile to cache for user:', userId);
      }
    } catch (error) {
      console.error('[ProfileCache] Error saving profile:', error);
    }
  },

  /**
   * Load profile from AsyncStorage cache
   * Returns null if cache doesn't exist or is for a different user
   */
  async load(userId: string): Promise<UserProfile | null> {
    try {
      const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) {
        if (__DEV__) {
          console.log('[ProfileCache] No cached profile found');
        }
        return null;
      }

      const cacheData = JSON.parse(cached);

      // Verify cache is for the current user
      if (cacheData.userId !== userId) {
        if (__DEV__) {
          console.log('[ProfileCache] Cached profile is for different user, ignoring');
        }
        return null;
      }

      if (__DEV__) {
        const cacheAge = Date.now() - new Date(cacheData.cachedAt).getTime();
        console.log(`[ProfileCache] Loaded cached profile (age: ${Math.round(cacheAge / 1000)}s)`);
      }

      return cacheData.profile;
    } catch (error) {
      console.error('[ProfileCache] Error loading profile:', error);
      return null;
    }
  },

  /**
   * Clear profile cache
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      if (__DEV__) {
        console.log('[ProfileCache] Cleared profile cache');
      }
    } catch (error) {
      console.error('[ProfileCache] Error clearing profile:', error);
    }
  },
};
