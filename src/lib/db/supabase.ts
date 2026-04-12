import { createClient } from '@supabase/supabase-js';

// Re-export the shared admin client so bot code can import from here.
export { supabase, supabaseAdmin } from '@/lib/supabase';
export { createClient };
