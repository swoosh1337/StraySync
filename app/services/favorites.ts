import { supabase } from './api/supabaseClient';

export interface Favorite {
  id: string;
  auth_user_id: string;
  animal_id: string;
  created_at: string;
}

export const favoritesService = {
  // Check if animal is favorited by current user
  async isFavorited(animalId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('animal_id', animalId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        throw error;
      }

      return !!data;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to check favorite status:', error.message);
      }
      return false;
    }
  },

  // Add animal to favorites
  async addFavorite(animalId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('favorites')
        .insert({
          auth_user_id: user.id,
          animal_id: animalId,
        });

      if (error) throw error;

      if (__DEV__) {
        console.log('[Favorites] Added favorite');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to add favorite:', error.message);
      }
      throw error;
    }
  },

  // Remove animal from favorites
  async removeFavorite(animalId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('auth_user_id', user.id)
        .eq('animal_id', animalId);

      if (error) throw error;

      if (__DEV__) {
        console.log('[Favorites] Removed favorite');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to remove favorite:', error.message);
      }
      throw error;
    }
  },

  // Toggle favorite status
  async toggleFavorite(animalId: string): Promise<boolean> {
    const isFav = await this.isFavorited(animalId);
    if (isFav) {
      await this.removeFavorite(animalId);
      return false;
    } else {
      await this.addFavorite(animalId);
      return true;
    }
  },

  // Get user's favorite animals
  async getUserFavorites(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          created_at,
          animal_id
        `)
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Fetch animal details for each favorite (including rescued ones)
      const animalIds = data.map(f => f.animal_id);
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('*')
        .in('id', animalIds);

      if (animalsError) throw animalsError;

      // Sort: active animals first, then rescued
      const sorted = (animals || []).sort((a, b) => {
        if (a.is_rescued === b.is_rescued) return 0;
        return a.is_rescued ? 1 : -1;
      });

      return sorted;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to fetch favorites:', error.message);
      }
      return [];
    }
  },

  // Get favorite count for an animal
  async getFavoriteCount(animalId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('animal_id', animalId);

      if (error) throw error;
      return count || 0;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to fetch favorite count');
      }
      return 0;
    }
  },

  // Get favorite counts for multiple animals
  async getFavoriteCounts(animalIds: string[]): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('animal_id')
        .in('animal_id', animalIds);

      if (error) throw error;

      // Count favorites per animal
      const counts: Record<string, number> = {};
      data?.forEach((fav) => {
        counts[fav.animal_id] = (counts[fav.animal_id] || 0) + 1;
      });

      return counts;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Favorites] Failed to fetch favorite counts');
      }
      return {};
    }
  },
};
