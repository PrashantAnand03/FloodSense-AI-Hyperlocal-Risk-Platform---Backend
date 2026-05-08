import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Supabase ADMIN client — uses service_role key
 * ONLY used on the backend. Never expose this key to frontend.
 * Bypasses RLS — use only for trusted server-side operations.
 */
console.log('Supabase Initialization:');
console.log('  URL:', process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING');
console.log('  Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT (starts with ' + process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) + '...)' : 'MISSING');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Supabase PUBLIC client — uses anon key
 * Used for verifying user JWTs on the backend
 */
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export { supabaseAdmin, supabasePublic };
