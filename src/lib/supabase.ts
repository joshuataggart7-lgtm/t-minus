import { createClient } from "@supabase/supabase-js";

// The existing T-Minus Supabase project (per project stack rules).
// Publishable key only; the service role key never reaches the browser.
export const SUPABASE_URL = "https://wczndteslofhtxbazhnj.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j4RIs7nDeJGwuUV9K9XNvw_xhI4BBw-";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
