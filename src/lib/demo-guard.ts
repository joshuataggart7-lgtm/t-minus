// Demo sessions (anonymous sign-in) can look at everything but write nothing.

import { supabase } from "@/integrations/supabase/client";

export const DEMO_READ_ONLY_NOTE = "Demo session: view only. Nothing is saved.";

export async function isDemoSession(): Promise<boolean> {
  return (await supabase.auth.getUser()).data.user?.is_anonymous === true;
}
