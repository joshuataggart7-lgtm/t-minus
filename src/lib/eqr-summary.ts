import { supabase } from "@/integrations/supabase/client";

// How far the technical evaluation has got on a file, read from the latest
// saved Evaluation of Quotations Record. Only the quoter names and ratings are
// selected; prices stay out of this read. Null when no record is saved.

export type TechnicalRecord = { quotes: number; rated: number };

const EQR_TEMPLATE = "Evaluation of Quotations Record";
const KEYS = [1, 2, 3, 4].flatMap((n) => [`quoter_${n}_name`, `quoter_${n}_rating`]);

export async function loadTechnicalRecord(acquisitionId: string): Promise<TechnicalRecord | null> {
  const tpl = await supabase.from("templates").select("template_id").eq("name", EQR_TEMPLATE);
  if (tpl.error) throw tpl.error;
  const ids = (tpl.data ?? []).map((t) => t.template_id);
  if (!ids.length) return null;
  const select = ["version", ...KEYS.map((k) => `${k}:field_values->>${k}`)].join(",");
  const docs = await supabase
    .from("documents")
    .select(select)
    .eq("acquisition_id", acquisitionId)
    .in("template_id", ids)
    .order("version", { ascending: false })
    .limit(1);
  if (docs.error) throw docs.error;
  const row = ((docs.data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  let quotes = 0;
  let rated = 0;
  for (let n = 1; n <= 4; n++) {
    const name = String(row[`quoter_${n}_name`] ?? "").trim();
    if (!name) continue;
    quotes += 1;
    if (/^(acceptable|unacceptable)$/i.test(String(row[`quoter_${n}_rating`] ?? "").trim())) rated += 1;
  }
  return quotes ? { quotes, rated } : null;
}
