// Section K — representations and certifications, as a workable shell.
//
// The method on the record decides the shell. A commercial Part 12/13 file
// runs the SAM path: the representations live in the offeror's SAM record and
// FAR 52.212-3 is not packed onto the file; FAR 52.212-5 stays Reserved and is
// never offered as a checkbox block. A Part 15 file carries the Uniform
// Contract Format Section K shell. Nothing here invents authority text: labels
// and record-backed blanks only, and blanks read "Not recorded".

import { supabase } from "@/integrations/supabase/client";
import type { PacketClause } from "@/lib/clause-packet";
import type { MethodShell } from "@/lib/solicitation-lm";

export type KItemStatus = "not_recorded" | "in_sam" | "on_file" | "na";

export type SectionKItem = {
  key: string;
  label: string;
  status: KItemStatus;
  note: string | null;
};

export type SectionKRow = {
  acquisition_id: string;
  sam_status: string | null;
  notes: string | null;
  items: SectionKItem[];
};

export const K_STATUS_LABELS: Record<KItemStatus, string> = {
  not_recorded: "Not recorded",
  in_sam: "In SAM",
  on_file: "On file",
  na: "Not applicable",
};

export const K_SAM_STATUS_OPTIONS = [
  "Not recorded",
  "Confirmed in SAM",
  "Incomplete in SAM",
  "Not applicable",
];

export const K_HANDOFF_CHIP =
  "Section K is a handoff aid — NCMS remains the system of record (NFS 1804.171). It does not hold phase exit.";

export const K_EMPTY_NOTE =
  "Section K is not recorded on this file yet.";

export const K_SAM_PATH_NOTE =
  "Commercial path: the annual representations sit in the offeror's SAM record. FAR 52.212-3 is not packed onto this file, and FAR 52.212-5 stays Reserved — there is no checkbox block here.";

export const K_UCF_PATH_NOTE =
  "Part 15 path: Section K of the Uniform Contract Format carries the representations and certifications for this solicitation. Blanks read “Not recorded”.";

const isStatus = (v: unknown): v is KItemStatus =>
  v === "not_recorded" || v === "in_sam" || v === "on_file" || v === "na";

/** Checklist defaults for the shell the record calls for. Labels only. */
export function defaultKItems(shell: MethodShell | null): SectionKItem[] {
  const blank = (key: string, label: string): SectionKItem => ({
    key,
    label,
    status: "not_recorded",
    note: null,
  });
  if (!shell) return [];
  if (shell.partFamily === "15") {
    return [
      blank("annual_reps_sam", "Annual representations and certifications in SAM"),
      blank("solicitation_specific", "Solicitation-specific certifications for this file"),
      blank("size_representation", "Size and socioeconomic representation against the NAICS on this file"),
      blank("telecom_representation", "Covered telecommunications representation"),
      blank("oci", "Organizational conflicts of interest, where applicable"),
      blank("other_reps", "Other representations required by this solicitation"),
    ];
  }
  return [
    blank("sam_registration", "SAM registration current for the offeror"),
    blank("annual_reps_sam", "Annual representations and certifications completed in SAM"),
    blank("size_representation", "Size and set-aside representation against the NAICS on this file"),
    blank("telecom_representation", "Covered telecommunications representation"),
    blank("other_sam_reps", "Other representations carried in the SAM record"),
  ];
}

/** Normalise stored rows and fill in any missing default rows. */
export function mergeKItems(shell: MethodShell | null, stored: unknown): SectionKItem[] {
  const defaults = defaultKItems(shell);
  const rows: SectionKItem[] = Array.isArray(stored)
    ? stored
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const r = raw as Record<string, unknown>;
          const key = typeof r["key"] === "string" ? r["key"] : "";
          if (!key) return null;
          return {
            key,
            label: typeof r["label"] === "string" ? r["label"] : key,
            status: isStatus(r["status"]) ? r["status"] : "not_recorded",
            note: typeof r["note"] === "string" && r["note"].trim() ? r["note"].trim() : null,
          } as SectionKItem;
        })
        .filter((v): v is SectionKItem => v !== null)
    : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const merged = defaults.map((d) => {
    const found = byKey.get(d.key);
    return found ? { ...found, label: d.label } : d;
  });
  // Anything stored that is not in the defaults (a shell change) is kept.
  for (const r of rows) if (!merged.some((m) => m.key === r.key)) merged.push(r);
  return merged;
}

/** True where the officer has recorded anything on Section K. */
export function kAuthored(k: SectionKRow | null): boolean {
  if (!k) return false;
  if ((k.sam_status ?? "").trim() && (k.sam_status ?? "").trim() !== "Not recorded") return true;
  if ((k.notes ?? "").trim()) return true;
  return (k.items ?? []).some((i) => i.status !== "not_recorded" || (i.note ?? "").trim());
}

/** Section K as the scaffold and the local handoff packet print it. */
export function sectionKForPacket(
  k: SectionKRow | null,
  shell: MethodShell | null,
  kClauses: PacketClause[],
) {
  const items = mergeKItems(shell, k?.items ?? []);
  return {
    path: shell?.partFamily === "15" ? "ucf_section_k" : "sam_path",
    heading:
      shell?.partFamily === "15"
        ? "Section K — representations and certifications"
        : "Representations and certifications",
    path_note: shell?.partFamily === "15" ? K_UCF_PATH_NOTE : K_SAM_PATH_NOTE,
    sam_status: (k?.sam_status ?? "").trim() || "Not recorded",
    notes: (k?.notes ?? "").trim() || null,
    checklist: items.map((i) => ({
      label: i.label,
      status: K_STATUS_LABELS[i.status],
      note: i.note ?? null,
    })),
    clauses: kClauses.map((c) => ({ clause_number: c.clause_number, title: c.title })),
    clauses_empty_note:
      kClauses.length === 0 ? "No clause on this file is placed in Section K by the matrices." : null,
    empty_note: kAuthored(k) ? null : K_EMPTY_NOTE,
    note: K_HANDOFF_CHIP,
  };
}

/* ------------------------------ persistence ------------------------------ */

export async function loadSectionK(acquisitionId: string): Promise<SectionKRow | null> {
  const { data, error } = await supabase
    .from("solicitation_k")
    .select("acquisition_id,sam_status,notes,items")
    .eq("acquisition_id", acquisitionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as { acquisition_id: string; sam_status: string | null; notes: string | null; items: unknown };
  return {
    acquisition_id: row.acquisition_id,
    sam_status: row.sam_status,
    notes: row.notes,
    // The shell merge happens where the shell is known; here the stored rows
    // are only normalised.
    items: mergeKItems(null, row.items),
  };
}

export async function saveSectionK(
  acquisitionId: string,
  input: { sam_status: string | null; notes: string | null; items: SectionKItem[] },
  actor: string,
): Promise<void> {
  const { error } = await supabase.from("solicitation_k").upsert(
    {
      acquisition_id: acquisitionId,
      sam_status: input.sam_status,
      notes: input.notes,
      items: input.items as unknown,
    } as never,
    { onConflict: "acquisition_id" },
  );
  if (error) throw new Error(error.message);
  const recorded = input.items.filter((i) => i.status !== "not_recorded").length;
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "Section K saved",
    field: "Representations and certifications",
    old_value: null,
    new_value: `${(input.sam_status ?? "").trim() || "SAM status not recorded"}; ${recorded} of ${
      input.items.length
    } checklist rows recorded`,
    reason: "Representations and certifications recorded on this file for the handoff packet.",
  } as never);
}
