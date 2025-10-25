import { supabase } from './supabaseClient';
import { Cat } from '../../types';

export const catService = {
  // Add a new cat to the database
  async addCat(cat: Omit<Cat, 'id' | 'created_at'>): Promise<Cat | null> {
    try {
      console.log('Adding new cat to database:', JSON.stringify({
        user_id: cat.user_id,
        latitude: cat.latitude,
        longitude: cat.longitude,
        has_image: !!cat.image_url,
        description_length: cat.description?.length || 0,
      }));
      
      const { data, error } = await supabase
        .from('cats')
        .insert([cat])
        .select()
        .single();
      
      if (error) {
        console.error('Error adding cat:', error);
        return null;
      }
      
      console.log('Successfully added cat with ID:', data.id);
      return data;
    } catch (error: any) {
      console.error('Error in addCat:', error.message || error);
      return null;
    }
  },
  
  // Get all cats from the database
  async getCats(): Promise<Cat[]> {
    try {
      console.log('Fetching all cats from database...');
      const { data, error } = await supabase
        .from('cats')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching cats:', error);
        return [];
      }
      
      console.log(`Retrieved ${data.length} cats from database`);
      return data;
    } catch (error: any) {
      console.error('Error in getCats:', error.message || error);
      return [];
    }
  },
  
  // Get cats within a specific time frame
  async getCatsWithinTimeFrame(hours: number): Promise<Cat[]> {
    try {
      console.log(`Fetching cats from the last ${hours} hours...`);
      
      // Calculate the timestamp for 'hours' ago
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);
      
      const { data, error } = await supabase
        .from('cats')
        .select('*')
        .gte('created_at', hoursAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching recent cats:', error);
        return [];
      }
      
      console.log(`Retrieved ${data.length} cats from the last ${hours} hours`);
      return data;
    } catch (error: any) {
      console.error('Error in getCatsWithinTimeFrame:', error.message || error);
      return [];
    }
  },
  
  // Get cats within a specific radius and time frame
  async getCatsWithinRadius(
    latitude: number,
    longitude: number,
    radiusKm: number,
    hours: number
  ): Promise<Cat[]> {
    try {
      console.log(`Searching for cats within ${radiusKm}km of (${latitude}, ${longitude}) in the last ${hours} hours...`);
      
      // First try to use the PostGIS function if available
      try {
        const { data, error } = await supabase.rpc('find_cats_within_radius', {
          lat: latitude,
          lng: longitude,
          radius_km: radiusKm,
          hours_ago: hours
        });
        
        if (!error && data) {
          console.log(`Found ${data.length} cats using PostGIS function`);
          return data;
        }
      } catch (rpcError) {
        console.log('PostGIS function not available, falling back to client-side filtering');
      }
      
      // Fallback: Get all cats within the time frame and filter by distance
      const recentCats = await this.getCatsWithinTimeFrame(hours);
      
      // Filter cats by distance
      const nearbyCats = recentCats.filter(cat => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          cat.latitude,
          cat.longitude
        );
        return distance <= radiusKm;
      });
      
      console.log(`Found ${nearbyCats.length} cats within ${radiusKm}km radius`);
      return nearbyCats;
    } catch (error: any) {
      console.error('Error in getCatsWithinRadius:', error.message || error);
      return [];
    }
  },
  
  // Calculate distance between two points using Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  },
  
  // Convert degrees to radians
  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  },
  
  // Check if a user is the owner of a cat
  async isUserOwner(catId: string, userId: string): Promise<boolean> {
    try {
      console.log(`Checking if user ${userId} is owner of cat ${catId}...`);

      const { data, error } = await supabase
        .from('cats')
        .select('user_id, auth_user_id')
        .eq('id', catId)
        .single();

      if (error) {
        console.error('Error checking cat ownership:', error);
        return false;
      }

      // Check both auth_user_id (for authenticated users) and user_id (legacy)
      const isOwner = data.auth_user_id === userId || data.user_id === userId;
      console.log(`User ${userId} is ${isOwner ? '' : 'not '}the owner of cat ${catId}`);
      return isOwner;
    } catch (error: any) {
      console.error('Error in isUserOwner:', error.message || error);
      return false;
    }
  },
  
  // Update a cat in the database
  async updateCat(
    catId: string, 
    userId: string, 
    updates: Partial<Omit<Cat, 'id' | 'created_at' | 'user_id'>>
  ): Promise<boolean> {
    try {
      console.log(`Updating cat ${catId} with:`, updates);
      
      // First check if the user is the owner
      const isOwner = await this.isUserOwner(catId, userId);
      
      if (!isOwner) {
        console.error(`User ${userId} is not authorized to update cat ${catId}`);
        return false;
      }
      
      const { error } = await supabase
        .from('cats')
        .update(updates)
        .eq('id', catId)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error updating cat:', error);
        return false;
      }
      
      console.log(`Successfully updated cat ${catId}`);
      return true;
    } catch (error: any) {
      console.error('Error in updateCat:', error.message || error);
      return false;
    }
  },
  
  // Delete a cat from the database
  async deleteCat(catId: string, userId: string): Promise<boolean> {
    try {
      console.log(`Attempting to delete cat ${catId} by user ${userId}...`);
      
      // First check if the user is the owner
      const isOwner = await this.isUserOwner(catId, userId);
      
      if (!isOwner) {
        console.error(`User ${userId} is not authorized to delete cat ${catId}`);
        return false;
      }
      
      // Get the cat data first (to get the image URL)
      const { data: cat, error: getError } = await supabase
        .from('cats')
        .select('*')
        .eq('id', catId)
        .single();
      
      if (getError) {
        console.error('Error getting cat data for deletion:', getError);
        return false;
      }
      
      // Delete the cat record
      const { error } = await supabase
        .from('cats')
        .delete()
        .eq('id', catId)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error deleting cat:', error);
        return false;
      }
      
      console.log(`Successfully deleted cat ${catId}`);
      return true;
    } catch (error: any) {
      console.error('Error in deleteCat:', error.message || error);
      return false;
    }
  },
  
  // Clean up old cat sightings (older than 30 days)
  async cleanupOldCatSightings(): Promise<string[]> {
    try {
      console.log('Cleaning up old cat sightings...');
      
      // Calculate the timestamp for 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get the old cats first (to get their image URLs)
      const { data: oldCats, error: getError } = await supabase
        .from('cats')
        .select('id, image_url')
        .lt('created_at', thirtyDaysAgo.toISOString());
      
      if (getError) {
        console.error('Error getting old cats for cleanup:', getError);
        return [];
      }
      
      if (!oldCats || oldCats.length === 0) {
        console.log('No old cat sightings to clean up');
        return [];
      }
      
      console.log(`Found ${oldCats.length} old cat sightings to clean up`);
      
      // Delete the old cats
      const oldCatIds = oldCats.map(cat => cat.id);
      const { error } = await supabase
        .from('cats')
        .delete()
        .in('id', oldCatIds);
      
      if (error) {
        console.error('Error deleting old cats:', error);
        return [];
      }
      
      console.log(`Successfully deleted ${oldCats.length} old cat sightings`);
      
      // Return the IDs of the deleted cats
      return oldCatIds;
    } catch (error: any) {
      console.error('Error in cleanupOldCatSightings:', error.message || error);
      return [];
    }
  },

  // Get all animals posted by a specific user
  async getUserAnimals(authUserId: string): Promise<Cat[]> {
    try {
      console.log(`Fetching animals for user ${authUserId}...`);

      const { data, error } = await supabase
        .from('cats')
        .select('*')
        .eq('auth_user_id', authUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user animals:', error);
        return [];
      }

      console.log(`Retrieved ${data.length} animals for user ${authUserId}`);
      return data;
    } catch (error: any) {
      console.error('Error in getUserAnimals:', error.message || error);
      return [];
    }
  }
}; 