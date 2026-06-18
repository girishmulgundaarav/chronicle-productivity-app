import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Fallback checking to prevent crashes during initial local dev or offline staging
const isConfigured = !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co';

if (!isConfigured) {
  console.warn(
    'Supabase Configuration Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Chronicle AI will utilize client-side volatile storage mode. ' +
    'Please configure your .env.local file with real keys to enable real-time backend synchronization.'
  );
}

// Export the initialized Supabase client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-anon-key'
);

// Helper function to check configuration state across views
export const isSupabaseConfigured = (): boolean => {
  return isConfigured;
};
