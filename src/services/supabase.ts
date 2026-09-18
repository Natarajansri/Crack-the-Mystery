import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getStoredUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('mystery_supabase_url') || '';
}

function getStoredKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('mystery_supabase_anon_key') || '';
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export let currentSupabaseUrl: string = envUrl || getStoredUrl();
export let currentSupabaseAnonKey: string = envAnonKey || getStoredKey();

function isValidUrl(url: string): boolean {
  return Boolean(
    url &&
    url.startsWith('https://') &&
    url !== 'https://your-project.supabase.co' &&
    !url.includes('your-project')
  );
}

export let isSupabaseConfigured: boolean = Boolean(
  isValidUrl(currentSupabaseUrl) && 
  currentSupabaseAnonKey && 
  currentSupabaseAnonKey.length > 20
);

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(currentSupabaseUrl, currentSupabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 15,
        },
      },
    })
  : null;

export function setRuntimeSupabaseCredentials(url: string, anonKey: string): boolean {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (!isValidUrl(cleanUrl) || !cleanKey || cleanKey.length < 20) {
    return false;
  }

  try {
    const testClient = createClient(cleanUrl, cleanKey);
    if (testClient) {
      currentSupabaseUrl = cleanUrl;
      currentSupabaseAnonKey = cleanKey;
      isSupabaseConfigured = true;
      supabase = testClient;

      if (typeof window !== 'undefined') {
        localStorage.setItem('mystery_supabase_url', cleanUrl);
        localStorage.setItem('mystery_supabase_anon_key', cleanKey);
      }
      return true;
    }
  } catch (e) {
    console.error('Failed to configure runtime Supabase client:', e);
  }
  return false;
}
