import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ksszogzpavdwhyvptfea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M7GevbrpxxPJYHKGk5ek0A_2eLII7HY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
