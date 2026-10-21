import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default fallback for development/demo mode (credentials should be placed in .env)
export const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

/**
 * Validates Supabase URL format strictly.
 * Only HTTPS URLs (or localhost in dev) are permitted.
 */
export function isValidSupabaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:') {
      const host = parsed.hostname.toLowerCase();
      const isOfficialDomain = host.endsWith('.supabase.co') || host.endsWith('.supabase.in') || host === 'localhost';
      return host.length > 3 && !host.includes(' ') && isOfficialDomain;
    }
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validates Supabase Anon Key format (must be a valid token string without forbidden characters).
 */
export function isValidSupabaseAnonKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim();
  return clean.length >= 20 && /^[A-Za-z0-9-_.]+$/.test(clean);
}

// Retrieve active credentials from localStorage or fallback
export function getActiveSupabaseConfig(): { url: string; anonKey: string; isCustom: boolean } {
  try {
    const customUrl = localStorage.getItem('robotics_supabase_url');
    const customKey = localStorage.getItem('robotics_supabase_anon_key');
    
    // Validate custom credentials if present
    if (customUrl && customKey && isValidSupabaseUrl(customUrl) && isValidSupabaseAnonKey(customKey)) {
      return {
        url: customUrl.trim(),
        anonKey: customKey.trim(),
        isCustom: true,
      };
    }
  } catch {
    // Ignore localStorage access errors
  }

  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false,
  };
}

let currentConfig = getActiveSupabaseConfig();
let clientInstance: SupabaseClient = createClient(currentConfig.url, currentConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Proxy or client getter to ensure latest client is always used
export function getSupabase(): SupabaseClient {
  return clientInstance;
}

export function updateSupabaseCredentials(url: string, anonKey: string): SupabaseClient {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (!isValidSupabaseUrl(cleanUrl)) {
    throw new Error('Format URL Supabase tidak valid. Gunakan format HTTPS resmi (contoh: https://xyzcompany.supabase.co).');
  }

  if (!isValidSupabaseAnonKey(cleanKey)) {
    throw new Error('Format Anon Key Supabase tidak valid. Pastikan key berupa token yang valid tanpa spasi.');
  }

  localStorage.setItem('robotics_supabase_url', cleanUrl);
  localStorage.setItem('robotics_supabase_anon_key', cleanKey);
  
  currentConfig = {
    url: cleanUrl,
    anonKey: cleanKey,
    isCustom: true,
  };

  clientInstance = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return clientInstance;
}

export function resetSupabaseCredentials(): SupabaseClient {
  localStorage.removeItem('robotics_supabase_url');
  localStorage.removeItem('robotics_supabase_anon_key');

  currentConfig = {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false,
  };

  clientInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return clientInstance;
}

// Export default constants and proxy client for backward compatibility
export const SUPABASE_URL = currentConfig.url;
export const SUPABASE_ANON_KEY = currentConfig.anonKey;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (clientInstance as any)[prop];
  }
});
