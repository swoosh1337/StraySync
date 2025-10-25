import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const [loading, setLoading] = useState(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      console.log('🔄 [AuthContext] Fetching profile for user:', userId);

      // Add timeout to prevent hanging forever (2s timeout)
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 2s')), 2000)
      );

      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        // If profile doesn't exist (PGRST116 is "not found" error)
        if (error.code === 'PGRST116') {
          console.log('⚠️ [AuthContext] Profile not found');
          console.log('This is normal for new users - the database trigger will create it');
          console.log('Waiting a moment for the trigger to complete...');
          
          // Wait a bit for the database trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try fetching again
          const { data: retryData, error: retryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (retryError) {
            console.error('❌ [AuthContext] Profile still not found after retry');
            console.error('The database trigger may not be working correctly');
            console.error('Error:', retryError.message);
            return;
          }
          
          if (retryData) {
            console.log('✅ [AuthContext] Profile found after retry');
            setProfile(retryData as UserProfile);
          }
          return;
        }

        console.error('❌ [AuthContext] Error fetching profile:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        return;
      }

      if (data) {
        console.log('✅ [AuthContext] Profile fetched successfully');
        console.log('Profile data:', JSON.stringify(data, null, 2));
        console.log('Setting profile state...');
        setProfile(data as UserProfile);
        console.log('Profile state updated!');
      } else {
        console.error('⚠️ [AuthContext] No data returned from profile fetch');
      }
    } catch (error: any) {
      console.error('❌ [AuthContext] Exception in fetchProfile:', error);
      console.error('Exception message:', error?.message);
      console.error('Exception stack:', error?.stack);
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

    // Track processed URLs at module level
    const processedUrls = new Set<string>();

    // Handle deep link when returning from OAuth
    const handleDeepLink = async (event: { url: string }) => {
      console.log('🔗 [AuthContext] Deep link received:', event.url);

      // Prevent processing the same URL twice
      if (processedUrls.has(event.url)) {
        console.log('⚠️ [AuthContext] URL already processed, ignoring duplicate');
        return;
      }
      processedUrls.add(event.url);

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

              // Don't wait for setSession to complete - it can hang on React Native
              // Instead, fire it and let the onAuthStateChange listener handle the result
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }).then(async ({ data, error }) => {
                if (error) {
                  console.error('❌ Error setting session:', error);
                  console.error('Error message:', error.message);
                } else {
                  console.log('✅ Session set successfully in promise!');
                  console.log('User ID:', data.user?.id);
                  console.log('User email:', data.user?.email);
                  
                  // Manually trigger state update and profile fetch as backup
                  // in case onAuthStateChange doesn't fire quickly enough
                  if (data.session && data.user) {
                    console.log('📦 Manually updating state from setSession promise...');
                    setSession(data.session);
                    setUser(data.user);
                    
                    // Wait a bit then fetch profile (reduced to 500ms for faster response)
                    setTimeout(async () => {
                      console.log('⏰ Timeout: Checking if profile was fetched...');
                      // Only fetch if profile is still null
                      const currentProfile = await new Promise<UserProfile | null>((resolve) => {
                        // This is a bit hacky but we need to check current state
                        setProfile((prev) => {
                          resolve(prev);
                          return prev;
                        });
                      });
                      
                      if (!currentProfile && data.user) {
                        console.log('⚠️ Profile still null, fetching manually...');
                        await fetchProfile(data.user.id);
                      } else if (currentProfile) {
                        console.log('✅ Profile already fetched, skipping manual fetch');
                      }
                    }, 500);
                  }
                }
              }).catch((err) => {
                console.error('❌ Exception in setSession promise:', err);
              });

              console.log('setSession called (not waiting for completion)');
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

    // Track if we've already processed a deep link to avoid duplicates
    let processedUrl: string | null = null;

    // Handle app coming to foreground (might have missed deep link)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking for pending deep link...');
        Linking.getInitialURL().then((url) => {
          if (url && url.includes('access_token')) {
            // Don't process the same URL twice
            if (url === processedUrl) {
              console.log('⚠️ Already processed this OAuth URL, skipping...');
              return;
            }
            console.log('Found pending OAuth URL, processing...');
            processedUrl = url;
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
    console.log('🔄 [AuthContext] refreshProfile called');
    if (user) {
      console.log('User exists, fetching profile for:', user.id);
      await fetchProfile(user.id);
      console.log('✅ [AuthContext] refreshProfile complete');
    } else {
      console.log('⚠️ [AuthContext] No user found, skipping profile refresh');
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
