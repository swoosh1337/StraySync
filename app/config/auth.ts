// OAuth Configuration for StraySync
// Using Supabase OAuth flow - configuration is handled in Supabase Dashboard

export const AUTH_CONFIG = {
  // Deep link scheme for OAuth redirects
  // This must match the "scheme" in app.json
  scheme: 'straysync',

  // Supabase handles the OAuth flow
  // No need for native client IDs when using Supabase Auth
};

// Notes:
// - Google OAuth is configured in Supabase Dashboard (Web client credentials)
// - Apple OAuth is configured in Supabase Dashboard (Services ID + Key)
// - The app uses deep linking to receive the auth callback
// - Make sure "straysync://" is added to allowed redirect URLs in Supabase
