// Demo sessions (anonymous sign-in) can look at everything but write nothing.

import { supabase } from "@/integrations/supabase/client";

export const DEMO_READ_ONLY_NOTE = "Demo session: view only. Nothing is saved.";

export async function isDemoSession(): Promise<boolean> {
  return (await supabase.auth.getUser()).data.user?.is_anonymous === true;
}

/** Banner text for a failed write. A demo refusal shows the demo note alone. */
export function failureText(prefix: string, e: Error): string {
  if (e.message === DEMO_READ_ONLY_NOTE) return DEMO_READ_ONLY_NOTE;
  return `${prefix}: ${e.message.replace(/[.\s]+$/, "")}. Try again.`;
}
