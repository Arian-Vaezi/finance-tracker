import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase config comes from environment variables (Vite exposes anything
// prefixed with VITE_). The anon key is safe to expose in the client — row level
// security on the database is what actually protects the data.
//
// If the variables are missing (e.g. the public demo, or a fresh clone with no
// keys), the app still runs perfectly in local-only mode; the sync features are
// simply hidden. This keeps the project usable without any backend setup.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
