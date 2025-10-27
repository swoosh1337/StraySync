import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Linking, AppState } from 'react-native';
import { supabase } from '../services/api/supabaseClient';

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
  profileError: string | null;
  loading: boolean;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use ref to track processed URLs to avoid race conditions
  const processedUrlsRef = useRef(new Set<string>());

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      if (__DEV__) {
        console.log('[AuthContext] Fetching profile for user:', userId);
      }

      // Add timeout to prevent hanging forever (2s timeout)
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise: Promise<never> = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 2s')), 2000)
      );

      type FetchResult = Awaited<typeof fetchPromise>;
      
      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as FetchResult;

      if (error) {
        // If profile doesn't exist (PGRST116 is "not found" error)
        if (error.code === 'PGRST116') {
          if (__DEV__) {
            console.log('[AuthContext] Profile not found, waiting for database trigger...');
          }
          
          // Wait a bit for the database trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try fetching again
          const { data: retryData, error: retryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (retryError) {
            const errorMsg = 'Profile not found after retry. Database trigger may not be working.';
            if (__DEV__) {
              console.error('[AuthContext]', errorMsg, retryError.message);
            }
            setProfileError(errorMsg);
            return;
          }
          
          if (retryData) {
            if (__DEV__) {
              console.log('[AuthContext] Profile found after retry');
            }
            setProfile(retryData as UserProfile);
            setProfileError(null);
          }
          return;
        }

        // Non-PGRST116 error
        const errorMsg = `Failed to fetch profile: ${error.message}`;
        if (__DEV__) {
          console.error('[AuthContext] Error fetching profile:', error.code, error.message);
        }
        setProfileError(errorMsg);
        return;
      }

      if (data) {
        if (__DEV__) {
          console.log('[AuthContext] Profile fetched successfully');
        }
        setProfile(data as UserProfile);
        setProfileError(null);
      } else {
        const errorMsg = 'No profile data returned';
        if (__DEV__) {
          console.error('[AuthContext]', errorMsg);
        }
        setProfileError(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error fetching profile';
      if (__DEV__) {
        console.error('[AuthContext] Exception in fetchProfile:', errorMsg);
      }
      setProfileError(errorMsg);
    }
  };

  // Initialize auth state
  useEffect(() => {
    console.log('Initializing auth state...');

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      }

      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Wrap in try-catch to prevent errors from bubbling up
          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            console.log('⚠️ [onAuthStateChange] Profile fetch failed, will retry via fallback');
            // Don't throw - let the fallback mechanism handle it
          }
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // Handle deep link when returning from OAuth
    const handleDeepLink = async (event: { url: string }) => {
      console.log('🔗 [AuthContext] Deep link received:', event.url);

      // Prevent processing the same URL twice using ref
      if (processedUrlsRef.current.has(event.url)) {
        console.log('⚠️ [AuthContext] URL already processed, ignoring duplicate');
        return;
      }
      processedUrlsRef.current.add(event.url);

      if (event.url.startsWith('straysync://')) {
        // Extract tokens from URL fragment (after #)
        const hashIndex = event.url.indexOf('#');
        if (hashIndex !== -1) {
          const fragment = event.url.substring(hashIndex + 1);
          console.log('Fragment:', fragment.substring(0, 50) + '...');

          const params = new URLSearchParams(fragment);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          console.log('Access token present:', !!accessToken);
          console.log('Refresh token present:', !!refreshToken);

          if (accessToken && refreshToken) {
            console.log('✅ Setting session from OAuth callback...');
            console.log('Access token length:', accessToken.length);
            console.log('Refresh token:', refreshToken);

            try {
              console.log('Calling supabase.auth.setSession...');

              // Await setSession and let onAuthStateChange handle all state updates
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                console.error('❌ Error setting session:', error);
                console.error('Error message:', error.message);
              } else {
                console.log('✅ Session set successfully!');
                console.log('User ID:', data.user?.id);
                console.log('User email:', data.user?.email);
                // onAuthStateChange will handle session/user/profile updates
              }
            } catch (err: any) {
              console.error('❌ Exception calling setSession:', err);
              console.error('Exception message:', err?.message);
            }
          } else {
            console.error('❌ Missing tokens in OAuth callback');
            console.log('Access token present:', !!accessToken);
            console.log('Refresh token present:', !!refreshToken);
            console.log('Params keys:', Array.from(params.keys()));
          }
        } else {
          console.log('⚠️ No # fragment in URL');
        }
      } else {
        console.log('⚠️ URL does not start with straysync://');
      }
    };

    // Listen for deep links (when app is already running)
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🚀 App opened with initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Handle app coming to foreground (might have missed deep link)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking for pending deep link...');
        Linking.getInitialURL().then((url) => {
          if (url && url.includes('access_token')) {
            // Don't process the same URL twice using ref
            if (processedUrlsRef.current.has(url)) {
              console.log('⚠️ Already processed this OAuth URL, skipping...');
              return;
            }
            console.log('Found pending OAuth URL, processing...');
            handleDeepLink({ url });
          }
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  // Sign in with Google
  const signInWithGoogle = async (): Promise<void> => {
    try {
      console.log('Initiating Google sign-in...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'straysync://', // Deep link for mobile app
        },
      });

      if (error) {
        console.error('Google sign-in error:', error);
        throw error;
      }

      console.log('Google sign-in initiated:', data);

      // Open the OAuth URL in the browser
      if (data?.url) {
        console.log('Opening OAuth URL:', data.url);
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Cannot open OAuth URL');
        }
      }
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
      throw error;
    }
  };

  // Sign in with Apple
  const signInWithApple = async (): Promise<void> => {
    try {
      console.log('Initiating Apple sign-in...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'straysync://', // Deep link for mobile app
        },
      });

      if (error) {
        console.error('Apple sign-in error:', error);
        throw error;
      }

      console.log('Apple sign-in initiated:', data);

      // Open the OAuth URL in the browser
      if (data?.url) {
        console.log('Opening OAuth URL:', data.url);
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Cannot open OAuth URL');
        }
      }
    } catch (error) {
      console.error('Error in signInWithApple:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      console.log('🚪 [AuthContext] Signing out...');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('❌ Sign out error:', error);
        // Continue anyway to clear local state
      }

      // Force clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);

      console.log('✅ Signed out successfully, local state cleared');
    } catch (error) {
      console.error('❌ Exception in signOut:', error);
      // Still clear local state even if error
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  // Refresh profile (useful after updates)
  const refreshProfile = async (): Promise<void> => {
    if (__DEV__) {
      console.log('[AuthContext] refreshProfile called');
    }
    if (user) {
      await fetchProfile(user.id);
      if (__DEV__) {
        console.log('[AuthContext] refreshProfile complete');
      }
    } else if (__DEV__) {
      console.log('[AuthContext] No user found, skipping profile refresh');
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    profileError,
    loading,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
