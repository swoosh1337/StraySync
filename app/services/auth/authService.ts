import { supabase } from '../api/supabaseClient';
import { UserProfile } from '../../contexts/AuthContext';

export const authService = {
  /**
   * Get the current user's profile
   */
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching current user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error in getCurrentUserProfile:', error);
      return null;
    }
  },

  /**
   * Update the current user's profile
   */
  async updateProfile(updates: Partial<Pick<UserProfile, 'display_name' | 'avatar_url'>>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('No user logged in');
        return false;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        return false;
      }

      console.log('Profile updated successfully');
      return true;
    } catch (error) {
      console.error('Error in updateProfile:', error);
      return false;
    }
  },

  /**
   * Get a user's profile by ID (for displaying other users' info)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  },

  /**
   * Check if current user is a supporter
   */
  async isSupporter(): Promise<boolean> {
    try {
      const profile = await this.getCurrentUserProfile();
      return profile?.is_supporter ?? false;
    } catch (error) {
      console.error('Error checking supporter status:', error);
      return false;
    }
  },

  /**
   * Get current authenticated user ID
   */
  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  },
};
