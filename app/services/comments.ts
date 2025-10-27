import { supabase } from './api/supabaseClient';

export interface Comment {
  id: string;
  animal_id: string;
  auth_user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  profiles?: {
    display_name: string;
    avatar_url: string;
  };
}

export const commentService = {
  // Get comments for an animal
  async getComments(animalId: string): Promise<Comment[]> {
    try {
      if (__DEV__) {
        console.log('[Comments] Fetching comments for animal:', animalId);
      }

      // Fetch comments without join
      const { data: comments, error } = await supabase
        .from('comments')
        .select('*')
        .eq('animal_id', animalId)
        .order('created_at', { ascending: false });

      if (error) {
        if (__DEV__) {
          console.error('[Comments] Supabase error:', error);
        }
        // If table doesn't exist yet, return empty array
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          if (__DEV__) {
            console.log('[Comments] Comments table not found');
          }
          return [];
        }
        throw error;
      }

      if (!comments || comments.length === 0) {
        return [];
      }

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set(comments.map(c => c.auth_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      // Map profiles to comments
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const commentsWithProfiles = comments.map(comment => ({
        ...comment,
        profiles: profileMap.get(comment.auth_user_id) || {
          display_name: 'Anonymous',
          avatar_url: '🐾',
        },
      }));

      if (__DEV__) {
        console.log('[Comments] Fetched', commentsWithProfiles.length, 'comments');
      }
      return commentsWithProfiles;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Comments] Failed to fetch comments:', error.message);
      }
      return [];
    }
  },

  // Get comment count for an animal
  async getCommentCount(animalId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('animal_id', animalId);

      if (error) {
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return 0;
        }
        throw error;
      }
      return count || 0;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Comments] Failed to fetch comment count:', error.message);
      }
      return 0;
    }
  },

  // Get comment counts for multiple animals
  async getCommentCounts(animalIds: string[]): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('animal_id')
        .in('animal_id', animalIds);

      if (error) throw error;

      // Count comments per animal
      const counts: Record<string, number> = {};
      data?.forEach((comment) => {
        counts[comment.animal_id] = (counts[comment.animal_id] || 0) + 1;
      });

      return counts;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Comments] Failed to fetch comment counts');
      }
      return {};
    }
  },

  // Add a comment
  async addComment(animalId: string, commentText: string): Promise<Comment> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (__DEV__) {
        console.log('[Comments] Adding comment for user:', user.id);
      }

      // Insert comment
      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          animal_id: animalId,
          auth_user_id: user.id,
          comment_text: commentText,
        })
        .select('*')
        .single();

      if (error) {
        if (__DEV__) {
          console.error('[Comments] Insert error:', error);
        }
        throw error;
      }

      // Fetch profile separately
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (__DEV__) {
        console.log('[Comments] Comment added successfully');
      }

      return {
        ...comment,
        profiles: profile || {
          display_name: 'Anonymous',
          avatar_url: '🐾',
        },
      };
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Comments] Failed to add comment:', error.message);
      }
      throw error;
    }
  },

  // Delete a comment
  async deleteComment(commentId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Comments] Failed to delete comment');
      }
      throw error;
    }
  },

  // Subscribe to comments for an animal (real-time)
  subscribeToComments(
    animalId: string,
    callback: (comment: Comment) => void
  ) {
    const channel = supabase
      .channel(`comments:${animalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `animal_id=eq.${animalId}`,
        },
        async (payload) => {
          // Fetch the full comment with profile data
          const { data: comment } = await supabase
            .from('comments')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (comment) {
            // Fetch profile separately
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', comment.auth_user_id)
              .single();

            callback({
              ...comment,
              profiles: profile || {
                display_name: 'Anonymous',
                avatar_url: '🐾',
              },
            });
          }
        }
      )
      .subscribe();

    return channel;
  },

  // Unsubscribe from comments
  unsubscribeFromComments(channel: any) {
    supabase.removeChannel(channel);
  },
};
