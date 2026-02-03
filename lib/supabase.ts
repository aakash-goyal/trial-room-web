import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseInitError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    : null;

export const supabase = supabaseInitError ? null : createClient(supabaseUrl, supabaseAnonKey);
