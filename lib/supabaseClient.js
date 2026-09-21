import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tamzlrygqskxscofwnho.supabase.co';
const supabaseAnonKey = 'sb_publishable_6aNejtXmFMJ984mqQY2kQA_o0Kuei_4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}