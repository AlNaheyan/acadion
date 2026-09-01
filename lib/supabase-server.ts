import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET;

  if (!supabaseUrl || !supabaseSecret) {
    throw new Error("Server-side Supabase credentials are not configured.");
  }

  return createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
