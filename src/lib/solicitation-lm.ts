// Sections L and M on a file, and the method shell that decides their voice.
//
// The record decides the shell: a commercial streamlined file carries the SF
// 1449 path and Part 12/13 voice; a FAR 15 file carries the Uniform Contract
// Format and Part 15 voice. Nothing here invents authority text. Officer-saved
// content is the source of truth for the scaffold and the local handoff packet;
// where nothing is saved the lines print "Not recorded".

import { supabase } from "@/integrations/supabase/client";
import type { ScaffoldFacts, ScaffoldLine } from "@/lib/format-scaffold";
import { isStreamlined } from "@/lib/format-scaffold";
import { isSimplifiedCommercial, isSoleSourceRecord } from "@/lib/memo-draft";

export type MethodShell = {
  path: "sf1449" | "ucf";
  partFamily: "12_13" | "15";
  methodLabel: string;
  formatLabel: string;
  formatSource: string;
  competitive: boolean;
};

export type SectionLRow = {
  acquisition_id: string;
  volumes: string | null;
  page_limit: string | null;
  submission_instructions: string | null;
  response_due_note: string | null;
};

export type SectionMRow = {
  acquisition_id: string;
  lpta: boolean;
  notes: string | null;
};

export type FactorRow = {
  factor_id: string;
  acquisition_id: string;
  name: string;
  relative_importance: string | null;
  description: string | null;
  sort_order: number;
};

export type FactorInput = {
  name: string;
  relative_importance: string | null;
  description: string | null;
};

const str = (f: ScaffoldFacts, key: string): string => {
  const v = f[key];
  return typeof v === "string" ? v.trim() : "";
};

const NOT_RECORDED = "Not recorded";

/** The shell the record calls for: SF 1449 / Part 12-13, or UCF / Part 15. */
export function methodShell(facts: ScaffoldFacts | null | undefined): MethodShell | null {
  if (!facts) return null;
  const record = facts as Record<string, unknown>;
  const method = str(facts, "acquisition_method");
  const format = str(facts, "contract_format");
  const simplified = isSimplifiedCommercial(record);
  const part15 = /part\s*15|far\s*15|(^|\D)15(\.\d+)?($|\D)/i.test(method) && !simplified;
  const streamlined = isStreamlined(facts);
  return {
    path: streamlined && !part15 ? "sf1449" : "ucf",
    partFamily: part15 ? "15" : "12_13",
    methodLabel: method || "Acquisition method not recorded",
    formatLabel:
      format || (streamlined && !part15 ? "SF 1449 streamlined (from the commercial determination)" : "Uniform Contract Format"),
    formatSource: format
      ? "Contract format recorded on this file."
      : "No contract format recorded; the format is read from the commercial determination.",
    competitive: !isSoleSourceRecord(record),
  };
}

export const LM_STUB_CHIP =
  "L/M are handoff stubs — not the solicitation of record.";
export const LM_AUTHORED_CHIP =
  "L/M drafted in T-Minus for handoff — NCMS remains the solicitation of record.";

/** True where the officer has saved anything on L or M. */
export function lmAuthored(
  l: SectionLRow | null,
  m: SectionMRow | null,
  factors: FactorRow[],
): boolean {
  const lHas = Boolean(
    l && [l.volumes, l.page_limit, l.submission_instructions, l.response_due_note].some((v) => (v ?? "").trim()),
  );
  const mHas = Boolean(m && (m.lpta || (m.notes ?? "").trim())) || factors.length > 0;
  return lHas || mHas;
}

/** Section L as the scaffold and the packet print it. */
export function sectionLLines(
  facts: ScaffoldFacts,
  shell: MethodShell,
  l: SectionLRow | null,
  hasClause52_212_1: boolean,
): ScaffoldLine[] {
  const lines: ScaffoldLine[] = [];
  if (shell.partFamily === "12_13" && hasClause52_212_1) {
    lines.push({
      text: "Quotations are submitted under FAR 52.212-1 as it is included on this file.",
      citation: "FAR 12.301(b)(1)",
    });
  }
  if (shell.partFamily === "15") {
    lines.push({
      text: "Proposals are prepared and submitted in the Uniform Contract Format; instructions to offerors ride in Section L.",
      citation: "FAR 15.203",
    });
  }
  lines.push({
    text: `What is being bought: ${str(facts, "description_of_requirement") || str(facts, "title") || "recorded on this file"}.`,
    citation: null,
  });
  lines.push({
    text: `${shell.partFamily === "15" ? "Proposals" : "Quotations"} are addressed to ${
      str(facts, "co_name") || "the contracting officer"
    } at ${str(facts, "center_name") || str(facts, "center_code") || "the issuing office"}.`,
    citation: null,
  });
  lines.push({
    text: `Response date: ${
      (l?.response_due_note ?? "").trim() || "Not recorded until the notice is posted"
    }.`,
    citation: null,
  });
  lines.push({
    text: `Volumes: ${(l?.volumes ?? "").trim() || NOT_RECORDED}. Page limit: ${(l?.page_limit ?? "").trim() || NOT_RECORDED}.`,
    citation: null,
  });
  const instructions = (l?.submission_instructions ?? "").trim();
  lines.push({
    text: `Submission instructions: ${instructions || NOT_RECORDED}.`,
    citation: null,
  });
  if (str(facts, "set_aside")) {
    lines.push({
      text: `The set-aside on this record is ${str(facts, "set_aside")}; offerors represent their size against NAICS ${
        str(facts, "naics_code") || "on this file"
      }.`,
      citation: "FAR 19.301-1",
    });
  }
  return lines;
}

/** Section M as the scaffold and the packet print it, in the method's voice. */
export function sectionMLines(
  shell: MethodShell,
  m: SectionMRow | null,
  factors: FactorRow[],
  hasClause52_212_2: boolean,
): { mode: "competitive" | "sole-source"; lines: ScaffoldLine[] } {
  if (!shell.competitive) {
    return {
      mode: "sole-source",
      lines: [
        {
          text: "This is a sole-source file. Competitive evaluation factors are not the path; the technical evaluation of the single proposal carries the finding.",
          citation: "FAR 13.106-3(a); NFS CG 1815.3",
        },
        {
          text: "Price reasonableness is determined in the price negotiation memorandum.",
          citation: "RFO FAR 12.204(a); FAR 13.106-3",
        },
        {
          text: "The justification on this file states why only one source can meet the need.",
          citation: "FAR 6.303; FAR 13.501",
        },
      ],
    };
  }

  const lines: ScaffoldLine[] = [];
  if (shell.partFamily === "15") {
    lines.push({
      text: "Evaluation factors and significant subfactors for award are stated to offerors in Section M.",
      citation: "FAR 15.304",
    });
  } else if (hasClause52_212_2) {
    lines.push({
      text: "Evaluation factors are stated to offerors under FAR 52.212-2 as it is included on this file.",
      citation: "FAR 12.301(c)",
    });
  } else {
    lines.push({
      text: "Evaluation factors are stated to offerors in the solicitation.",
      citation: "FAR 13.106-1(a)(2)",
    });
  }

  if (m?.lpta) {
    lines.push({
      text: "Award is on a lowest price technically acceptable basis: quotations found technically acceptable are ranked by price.",
      citation: shell.partFamily === "15" ? "FAR 15.305" : "FAR 13.106-2(b)",
    });
  }

  if (factors.length > 0) {
    for (const f of factors) {
      lines.push({
        text: `Factor: ${f.name}. Relative importance: ${(f.relative_importance ?? "").trim() || NOT_RECORDED}.${
          (f.description ?? "").trim() ? ` ${(f.description ?? "").trim()}` : ""
        }`,
        citation: shell.partFamily === "15" ? "FAR 15.304" : "FAR 13.106-1(a)(2)",
      });
    }
    lines.push({
      text: `${shell.partFamily === "15" ? "Proposals" : "Quotations"} are evaluated against the factors stated, and the evaluation record on this file carries the result.`,
      citation: shell.partFamily === "15" ? "FAR 15.305" : "FAR 13.106-2(b)",
    });
  } else if (!m?.lpta) {
    lines.push({
      text: "Evaluation factors are not recorded on this file yet; the contracting officer sets at least two factors with their relative importance before the notice is posted.",
      citation: null,
    });
  }

  // A Part 15 file never carries the Part 13 best-value line.
  if (shell.partFamily === "12_13" && !m?.lpta) {
    lines.push({
      text: "Award is made to the quotation that represents the best value to the Government on the stated factors.",
      citation: "FAR 13.106-2(b)(3)",
    });
  }
  if (shell.partFamily === "15" && !m?.lpta) {
    lines.push({
      text: "Award is made to the proposal that represents the best value on the factors stated, as the comparative assessment records.",
      citation: "FAR 15.305",
    });
  }
  if ((m?.notes ?? "").trim()) {
    lines.push({ text: (m?.notes ?? "").trim(), citation: null });
  }
  return { mode: "competitive", lines };
}

/* ------------------------------ persistence ------------------------------ */

export async function loadSectionL(acquisitionId: string): Promise<SectionLRow | null> {
  const { data, error } = await supabase
    .from("solicitation_l")
    .select("acquisition_id,volumes,page_limit,submission_instructions,response_due_note")
    .eq("acquisition_id", acquisitionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as SectionLRow | null;
}

export async function loadSectionM(acquisitionId: string): Promise<SectionMRow | null> {
  const { data, error } = await supabase
    .from("solicitation_m")
    .select("acquisition_id,lpta,notes")
    .eq("acquisition_id", acquisitionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as SectionMRow | null;
}

export async function loadFactors(acquisitionId: string): Promise<FactorRow[]> {
  const { data, error } = await supabase
    .from("solicitation_m_factors")
    .select("factor_id,acquisition_id,name,relative_importance,description,sort_order")
    .eq("acquisition_id", acquisitionId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FactorRow[];
}

async function audit(
  acquisitionId: string,
  actor: string,
  action: string,
  field: string | null,
  newValue: string | null,
  reason: string,
): Promise<void> {
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action,
    field,
    old_value: null,
    new_value: newValue,
    reason,
  } as never);
}

export async function saveSectionL(
  acquisitionId: string,
  input: Omit<SectionLRow, "acquisition_id">,
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("solicitation_l")
    .upsert(
      {
        acquisition_id: acquisitionId,
        volumes: input.volumes,
        page_limit: input.page_limit,
        submission_instructions: input.submission_instructions,
        response_due_note: input.response_due_note,
      } as never,
      { onConflict: "acquisition_id" },
    );
  if (error) throw new Error(error.message);
  await audit(
    acquisitionId,
    actor,
    "Section L saved",
    "Instructions to offerors",
    [
      input.volumes ? `volumes ${input.volumes}` : null,
      input.page_limit ? `page limit ${input.page_limit}` : null,
      input.response_due_note ? `response ${input.response_due_note}` : null,
      input.submission_instructions ? "submission instructions recorded" : null,
    ]
      .filter(Boolean)
      .join("; ") || "cleared",
    "Instructions to offerors saved on this file for the handoff packet.",
  );
}

export async function saveSectionM(
  acquisitionId: string,
  input: { lpta: boolean; notes: string | null },
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("solicitation_m")
    .upsert({ acquisition_id: acquisitionId, lpta: input.lpta, notes: input.notes } as never, {
      onConflict: "acquisition_id",
    });
  if (error) throw new Error(error.message);
  await audit(
    acquisitionId,
    actor,
    "Section M saved",
    "Evaluation for award",
    `${input.lpta ? "Lowest price technically acceptable" : "Best value on the stated factors"}${
      input.notes ? "; notes recorded" : ""
    }`,
    "Evaluation basis saved on this file for the handoff packet.",
  );
}

export async function createFactor(
  acquisitionId: string,
  input: FactorInput,
  actor: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase.from("solicitation_m_factors").insert({
    acquisition_id: acquisitionId,
    name: input.name.trim(),
    relative_importance: input.relative_importance,
    description: input.description,
    sort_order: sortOrder,
  } as never);
  if (error) throw new Error(error.message);
  await audit(
    acquisitionId,
    actor,
    "Evaluation factor added",
    input.name.trim(),
    (input.relative_importance ?? "").trim() || "Relative importance not recorded",
    "Evaluation factor added to Section M on this file.",
  );
}

export async function updateFactor(row: FactorRow, input: FactorInput, actor: string): Promise<void> {
  const { error } = await supabase
    .from("solicitation_m_factors")
    .update({
      name: input.name.trim(),
      relative_importance: input.relative_importance,
      description: input.description,
    } as never)
    .eq("factor_id", row.factor_id);
  if (error) throw new Error(error.message);
  await audit(
    row.acquisition_id,
    actor,
    "Evaluation factor edited",
    input.name.trim(),
    (input.relative_importance ?? "").trim() || "Relative importance not recorded",
    "Evaluation factor edited in Section M on this file.",
  );
}

export async function deleteFactor(row: FactorRow, actor: string): Promise<void> {
  const { error } = await supabase
    .from("solicitation_m_factors")
    .delete()
    .eq("factor_id", row.factor_id);
  if (error) throw new Error(error.message);
  await audit(
    row.acquisition_id,
    actor,
    "Evaluation factor deleted",
    row.name,
    null,
    "Evaluation factor removed from Section M on this file.",
  );
}

/**
 * The award basis already recorded on this file, read from a saved evaluation
 * document. It is only a suggestion for the LPTA box: nothing is set for the
 * officer, and nothing is written back to the document.
 */
export async function awardBasisHint(acquisitionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("documents")
    .select("field_values")
    .eq("acquisition_id", acquisitionId)
    .order("saved_at", { ascending: false })
    .limit(25);
  for (const row of (data ?? []) as { field_values: unknown }[]) {
    const values = row.field_values;
    if (values && typeof values === "object" && !Array.isArray(values)) {
      const basis = (values as Record<string, unknown>)["award_basis"];
      if (typeof basis === "string" && basis.trim()) return basis.trim();
    }
  }
  return null;
}

export const isLptaBasis = (basis: string | null | undefined): boolean =>
  /lowest price technically acceptable|\blpta\b/i.test(String(basis ?? ""));
