import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { supabase } from '../services/api/supabaseClient';
import { profileCache } from '../services/profileCache';

// Profile type matching our database schema
export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_supporter: boolean;
  supporter_since: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Track processed URLs to prevent duplicates
  const processedUrls = React.useRef<Set<string>>(new Set());

  /**
   * Fetch user profile from database with retry logic
   * Non-blocking - uses cached profile as fallback
   */
  const fetchProfile = async (userId: string, attempt: number = 1): Promise<void> => {
    try {
      setProfileLoading(true);

      if (__DEV__) {
        console.log(`[AuthContext] Fetching profile for user: ${userId} (attempt ${attempt})`);
      }

      // Load cached profile immediately for instant UI
      if (attempt === 1) {
        const cachedProfile = await profileCache.load(userId);
        if (cachedProfile) {
          setProfile(cachedProfile);
          if (__DEV__) {
            console.log('[AuthContext] Using cached profile while fetching fresh data');
          }
        }
      }

      // Fetch fresh profile from database (no timeout)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile doesn't exist - retry with exponential backoff
        if (error.code === 'PGRST116') {
          const delays = [2000, 5000, 10000, 30000]; // 2s, 5s, 10s, 30s
          const delay = delays[Math.min(attempt - 1, delays.length - 1)];

          if (attempt <= 4) {
            if (__DEV__) {
              console.log(`[AuthContext] Profile not found, retrying in ${delay}ms...`);
            }
            setTimeout(() => fetchProfile(userId, attempt + 1), delay);
            return;
          } else {
            if (__DEV__) {
              console.error('[AuthContext] Profile not found after 4 attempts. Trigger may not be working.');
            }
            setProfileLoading(false);
            return;
          }
        }

        // Other errors - log but don't retry
        if (__DEV__) {
          console.error('[AuthContext] Error fetching profile:', error);
        }
        setProfileLoading(false);
        return;
      }

      // Success - update profile and cache
      if (data) {
        const profileData = data as UserProfile;
        setProfile(profileData);
        await profileCache.save(userId, profileData);

        if (__DEV__) {
          console.log('[AuthContext] Profile fetched and cached successfully');
        }
      }

      setProfileLoading(false);
    } catch (error: any) {
      if (__DEV__) {
        console.error('[AuthContext] Exception in fetchProfile:', error);
      }
      setProfileLoading(false);
    }
  };

  /**
   * Initialize auth state and set up listeners
   * Uses official Supabase pattern from documentation
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[AuthContext] Initializing auth state...');
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (__DEV__) {
        console.log('[AuthContext] Initial session:', session ? 'Found' : 'None');
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Load profile if user is logged in
      if (session?.user) {
        fetchProfile(session.user.id);
      }

      setIsLoading(false);
    });

    // Listen for auth changes (handles OAuth callbacks automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) {
          console.log('[AuthContext] Auth state changed:', event);
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Handle profile based on event
        if (session?.user) {
          // User signed in or session refreshed
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            fetchProfile(session.user.id);
          }
        } else {
          // User signed out
          setProfile(null);
          await profileCache.clear();
        }
      }
    );

    // Handle deep links for OAuth redirects
    const handleUrl = async ({ url }: { url: string }) => {
      if (__DEV__) {
        console.log('[AuthContext] Deep link received:', url.substring(0, 50) + '...');
      }

      // Only process straysync:// URLs with access_token
      if (!url.startsWith('straysync://') || !url.includes('access_token')) {
        return;
      }

      // Prevent processing the same URL twice
      if (processedUrls.current.has(url)) {
        if (__DEV__) {
          console.log('[AuthContext] URL already processed, skipping duplicate');
        }
        return;
      }
      processedUrls.current.add(url);

      try {
        // Extract tokens from URL fragment (after #)
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;

        const fragment = url.substring(hashIndex + 1);
        const params = new URLSearchParams(fragment);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          if (__DEV__) {
            console.log('[AuthContext] Missing tokens in OAuth callback');
          }
          return;
        }

        if (__DEV__) {
          console.log('[AuthContext] Setting session from OAuth callback...');
        }

        // Set session - this will trigger onAuthStateChange
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[AuthContext] Error setting session:', error);
        } else {
          if (__DEV__) {
            console.log('[AuthContext] Session set successfully');
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error processing OAuth callback:', error);
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleUrl);

    // Check for initial URL (cold start with OAuth redirect)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      if (__DEV__) {
        console.log('[AuthContext] Initiating Google sign-in...');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'straysync://',
        },
      });

      if (error) {
        console.error('[AuthContext] Google sign-in error:', error);
        throw error;
      }

      // Open OAuth URL in browser
      if (data?.url) {
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Cannot open OAuth URL');
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error in signInWithGoogle:', error);
      throw error;
    }
  };

  /**
   * Sign in with Apple OAuth
   */
  const signInWithApple = async (): Promise<void> => {
    try {
      if (__DEV__) {
        console.log('[AuthContext] Initiating Apple sign-in...');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'straysync://',
        },
      });

      if (error) {
        console.error('[AuthContext] Apple sign-in error:', error);
        throw error;
      }

      // Open OAuth URL in browser
      if (data?.url) {
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Cannot open OAuth URL');
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error in signInWithApple:', error);
      throw error;
    }
  };

  /**
   * Sign out
   */
  const signOut = async (): Promise<void> => {
    try {
      if (__DEV__) {
        console.log('[AuthContext] Signing out...');
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[AuthContext] Sign out error:', error);
      }

      // Clear local state and cache
      setSession(null);
      setUser(null);
      setProfile(null);
      await profileCache.clear();

      if (__DEV__) {
        console.log('[AuthContext] Signed out successfully');
      }
    } catch (error) {
      console.error('[AuthContext] Exception in signOut:', error);
      // Still clear local state even if error
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  /**
   * Manually refresh profile from database
   */
  const refreshProfile = async (): Promise<void> => {
    if (user) {
      if (__DEV__) {
        console.log('[AuthContext] Manually refreshing profile');
      }
      await fetchProfile(user.id, 1);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    profileLoading,
    isLoading,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
