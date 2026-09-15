// Reads the HQ-edited scenario trigger configuration once per session and
// hands it to the trigger table, so every launch sequence reads the same rows.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setTriggerConfig, type TriggerConfigRow } from "@/lib/scenario";

export async function loadTriggerConfig(): Promise<TriggerConfigRow[]> {
  const { data, error } = await supabase
    .from("scenario_trigger_config")
    .select("trigger_key,doc_key,label,citation,phase,state,enabled,note")
    .order("sort_order", { ascending: true });
  if (error) return [];
  const rows = (data ?? []) as TriggerConfigRow[];
  setTriggerConfig(rows);
  return rows;
}

export function useTriggerConfig() {
  return useQuery({
    queryKey: ["scenario-trigger-config"],
    queryFn: loadTriggerConfig,
    staleTime: 5 * 60 * 1000,
  });
}
