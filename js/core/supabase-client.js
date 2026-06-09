import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase-config.js";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
