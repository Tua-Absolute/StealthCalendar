import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client. Server only: it bypasses row-level security, so use it just for OAuth tokens. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Calendar sync is not set up yet (SUPABASE_SERVICE_ROLE_KEY is missing).');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
