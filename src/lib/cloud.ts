import { AppData } from '../types';
import { supabase } from './supabase';

// One row per user: { user_id, data (jsonb), updated_at }. The whole AppData
// object is stored as a single JSON blob, mirroring how it's kept locally.
const TABLE = 'finance_data';

/** Fetch the signed-in user's saved data, or null if they have none yet. */
export async function pullData(userId: string): Promise<AppData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as AppData | undefined) ?? null;
}

/** Upsert the signed-in user's data (last-write-wins). */
export async function pushData(userId: string, payload: AppData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    data: payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
