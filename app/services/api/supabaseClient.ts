import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tzbkkduvytabeiqyliqw.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YmtrZHV2eXRhYmVpcXlsaXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTIyNjAsImV4cCI6MjA1NjIyODI2MH0.tPxoXwaHZOzGQ7MHuYJRlyDY6sowE4E7o2rcDDKRI9c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Set up AppState-based token refresh
 * Official Supabase pattern: start/stop auto-refresh based on app state
 * This ensures tokens are refreshed when app is active and conserves resources when backgrounded
 */
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Function to check if Supabase connection is working
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('cats').select('id').limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }
    
    console.log('Supabase connection test successful');
    return true;
  } catch (error: any) {
    console.error('Supabase connection test error:', error.message || error);
    return false;
  }
}; 