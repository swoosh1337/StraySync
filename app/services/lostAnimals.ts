import { supabase } from './supabase';
import { Alert } from 'react-native';

export interface LostAnimal {
  id: string;
  user_id: string;
  animal_type: 'cat' | 'dog';
  name: string;
  description: string;
  breed?: string;
  color?: string;
  age?: string;
  gender?: 'male' | 'female' | 'unknown';
  distinctive_features?: string[];
  photo_url_1: string;
  photo_url_2?: string;
  photo_url_3?: string;
  last_seen_location: { latitude: number; longitude: number };
  last_seen_address?: string;
  last_seen_date: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  status: 'active' | 'found' | 'cancelled';
  potential_matches_count?: number;
  unviewed_matches_count?: number;
  created_at: string;
}

export interface LostAnimalMatch {
  id: string;
  lost_animal_id: string;
  sighting_id: string;
  confidence_score: number;
  match_reason?: string;
  viewed: boolean;
  dismissed: boolean;
  created_at: string;
}

export const lostAnimalsService = {
  // Simple event listeners for UI refreshes
  _listeners: new Set<(event: any) => void>(),
  subscribe(callback: (event: any) => void) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  },
  _emit(event: any) {
    this._listeners.forEach((cb) => {
      try { cb(event); } catch {}
    });
  },
  /**
   * Get a single lost animal by ID (with matches view)
   */
  async getById(lostAnimalId: string): Promise<LostAnimal | null> {
    try {
      const { data, error } = await supabase
        .from('lost_animals_with_matches')
        .select('*')
        .eq('id', lostAnimalId)
        .single();

      if (error) throw error;
      return data || null;
    } catch (error) {
      console.error('[LostAnimals] Error fetching by id:', error);
      return null;
    }
  },

  /**
   * Get all active lost animals
   */
  async getActiveLostAnimals(): Promise<LostAnimal[]> {
    try {
      const { data, error } = await supabase
        .from('lost_animals_with_matches')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[LostAnimals] Error fetching:', error);
      return [];
    }
  },

  /**
   * Get user's lost animal posts
   */
  async getUserLostAnimals(userId: string): Promise<LostAnimal[]> {
    try {
      const { data, error } = await supabase
        .from('lost_animals_with_matches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[LostAnimals] Error fetching user posts:', error);
      return [];
    }
  },

  /**
   * Create a new lost animal post
   */
  async createLostAnimal(data: {
    animal_type: 'cat' | 'dog';
    name: string;
    description: string;
    breed?: string;
    color?: string;
    age?: string;
    gender?: 'male' | 'female' | 'unknown';
    distinctive_features?: string[];
    photo_urls: string[]; // 1-3 photos
    last_seen_location: { latitude: number; longitude: number };
    last_seen_address?: string;
    last_seen_date: Date;
    contact_name: string;
    contact_phone?: string;
    contact_email?: string;
  }): Promise<LostAnimal | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData = {
        user_id: user.id,
        animal_type: data.animal_type,
        name: data.name,
        description: data.description,
        breed: data.breed,
        color: data.color,
        age: data.age,
        gender: data.gender,
        distinctive_features: data.distinctive_features,
        photo_url_1: data.photo_urls[0],
        photo_url_2: data.photo_urls[1] || null,
        photo_url_3: data.photo_urls[2] || null,
        last_seen_location: `POINT(${data.last_seen_location.longitude} ${data.last_seen_location.latitude})`,
        last_seen_address: data.last_seen_address,
        last_seen_date: data.last_seen_date.toISOString(),
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        status: 'active',
      };

      const { data: result, error } = await supabase
        .from('lost_animals')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Trigger AI analysis for existing sightings (non-blocking)
      // Don't await - let it run in background
      this.triggerMatchAnalysis(result.id).catch(err => 
        console.error('[LostAnimals] Background match analysis failed:', err)
      );

      // Track action for rating
      import('./rating').then(({ ratingService }) => {
        ratingService.incrementActions();
        ratingService.promptForRating();
      });

      // Notify listeners about creation
      this._emit({ type: 'created', record: result });
      return result;
    } catch (error) {
      console.error('[LostAnimals] Error creating post:', error);
      Alert.alert('Error', 'Failed to create lost animal post');
      return null;
    }
  },

  /**
   * Upload photo for lost animal
   */
  async uploadPhoto(uri: string, userId: string, index: number): Promise<string | null> {
    try {
      // Use the same upload method as regular animals (proven to work)
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `lost-animals/${userId}_${Date.now()}_${index}.${fileExt}`;

      // Read file as base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Decode base64 to binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('cat-images')
        .upload(fileName, bytes, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cat-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('[LostAnimals] Error uploading photo:', error);
      return null;
    }
  },

  /**
   * Get matches for a lost animal
   */
  async getMatches(lostAnimalId: string): Promise<LostAnimalMatch[]> {
    try {
      const { data, error } = await supabase
        .from('lost_animal_matches')
        .select(`
          *,
          sighting:animals(*)
        `)
        .eq('lost_animal_id', lostAnimalId)
        .eq('dismissed', false)
        .order('confidence_score', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[LostAnimals] Error fetching matches:', error);
      return [];
    }
  },

  /**
   * Mark match as viewed
   */
  async markMatchViewed(matchId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('lost_animal_matches')
        .update({
          viewed: true,
          viewed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (error) throw error;
    } catch (error) {
      console.error('[LostAnimals] Error marking match viewed:', error);
    }
  },

  /**
   * Dismiss a match
   */
  async dismissMatch(matchId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('lost_animal_matches')
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (error) throw error;
    } catch (error) {
      console.error('[LostAnimals] Error dismissing match:', error);
    }
  },

  /**
   * Mark lost animal as found
   */
  async markAsFound(lostAnimalId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('lost_animals')
        .update({
          status: 'found',
          found_at: new Date().toISOString(),
        })
        .eq('id', lostAnimalId);

      if (error) throw error;
      // Emit update so lists refresh deterministically
      this._emit({ type: 'updated', record: { id: lostAnimalId, status: 'found' } });
      Alert.alert('Success', 'Marked as found! 🎉');
    } catch (error) {
      console.error('[LostAnimals] Error marking as found:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  },

  /**
   * Delete a lost animal post
   */
  async deleteLostAnimal(lostAnimalId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('lost_animals')
        .delete()
        .eq('id', lostAnimalId);

      if (error) throw error;
      // Emit deletion for subscribers
      this._emit({ type: 'deleted', id: lostAnimalId });
    } catch (error) {
      console.error('[LostAnimals] Error deleting:', error);
      throw error;
    }
  },

  /**
   * Trigger AI matching analysis (calls Edge Function)
   */
  async triggerMatchAnalysis(lostAnimalId?: string | null, sightingId?: string | null): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('match-lost-animals', {
        body: { lostAnimalId, sightingId },
      });

      if (error) {
        console.error('[LostAnimals] Match analysis error:', error);
      }
    } catch (error) {
      console.error('[LostAnimals] Error triggering match analysis:', error);
    }
  },
};
