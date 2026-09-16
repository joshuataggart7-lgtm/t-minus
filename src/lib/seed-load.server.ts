/**
 * Server-only seed loader used by the HQ "Reset demo" action.
 * Reads the files in t-minus-seed/ exactly as written and invents nothing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const csvFiles = import.meta.glob("../../t-minus-seed/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const jsonFiles = import.meta.glob("../../t-minus-seed/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function read(name: string): string {
  const all = { ...csvFiles, ...jsonFiles };
  const hit = Object.entries(all).find(([k]) => k.endsWith(`/${name}`));
  if (!hit) throw new Error(`Seed file missing: ${name}`);
  return hit[1];
}

/** Minimal RFC 4180 CSV parser (quoted fields, embedded commas and newlines). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const nul = (v: string | undefined) => (v === undefined || v === "" ? null : v);
const num = (v: string | undefined) => (nul(v) === null ? null : Number(v));
const int = (v: string | undefined) => (nul(v) === null ? null : parseInt(v!, 10));

type Db = SupabaseClient<never, never, never>;
type AnyDb = {
  from: (t: string) => {
    insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
    upsert: (rows: unknown[], o: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      not: (col: string, op: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
};

async function insertAll(db: AnyDb, table: string, rows: unknown[], conflict?: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = conflict
      ? await db.from(table).upsert(chunk, { onConflict: conflict })
      : await db.from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function wipe(db: AnyDb, table: string, pk: string) {
  const { error } = await db.from(table).delete().not(pk, "is", null);
  if (error) throw new Error(`${table} clear: ${error.message}`);
}

export function seededAcquisitionIds(): string[] {
  return (JSON.parse(read("acquisitions.json")) as { acquisition_id: string }[]).map((a) => a.acquisition_id);
}

/** Reload every seed file. Reference tables without natural keys are cleared first. */
export async function reloadSeed(client: Db): Promise<Record<string, number>> {
  const db = client as unknown as AnyDb;
  const counts: Record<string, number> = {};
  const put = async (table: string, rows: unknown[], conflict?: string) => {
    await insertAll(db, table, rows, conflict);
    counts[table] = rows.length;
  };

  const cb = parseCsv(read("centers_branches.csv"));
  const centers = new Map<string, { center_code: string; center_name: string }>();
  for (const r of cb) centers.set(r["center_code"]!, { center_code: r["center_code"]!, center_name: r["center_name"]! });
  await put("centers", [...centers.values()], "center_code");
  await put(
    "branches",
    cb
      .filter((r) => r["branch_code"])
      .map((r) => ({ center_code: r["center_code"], branch_code: r["branch_code"], branch_name: r["branch_name"] })),
    "center_code,branch_code",
  );

  await put("missions", JSON.parse(read("missions.json")), "mission_id");

  await wipe(db, "competition_authorities", "authority_id");
  await put(
    "competition_authorities",
    parseCsv(read("competition_authorities.csv")).map((r) => ({
      acquisition_method: r["acquisition_method"],
      competition_type: r["competition_type"],
      citation: r["citation"],
      description: r["description"],
      source_tier: r["source_tier"] || "binding",
    })),
  );

  const acqRows = (JSON.parse(read("acquisitions.json")) as Record<string, unknown>[]).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v === "" ? null : v;
    // A document is only attached when a file is stored. Seeded samples carry
    // no files, so these load as missing rather than claiming an attachment.
    // Funds certified is a certification on the record, not a file, so the
    // seeded answer is kept as written.
    for (const k of ["igce_attached", "sow_attached"]) out[k] = false;
    return out;
  });
  await put("acquisition_facts", acqRows, "acquisition_id");

  await wipe(db, "thresholds", "threshold_id");
  await put(
    "thresholds",
    parseCsv(read("thresholds.csv")).map((r) => ({
      name: r["name"],
      value: num(r["value"]),
      citation: nul(r["citation"]),
      effective_date: nul(r["effective_date"]),
      tier: nul(r["tier"]),
      note: nul(r["note"]),
    })),
  );

  await put(
    "naics_size_standards",
    parseCsv(read("naics_size_standards.csv")).map((r) => ({
      naics_code: r["naics_code"],
      naics_title: nul(r["naics_title"]),
      standard_type: r["standard_type"],
      employees: r["employees"] ? int(r["employees"]) : null,
      receipts_usd: r["receipts_usd"] ? num(r["receipts_usd"]) : null,
      citation: nul(r["citation"]),
      effective_date: nul(r["effective_date"]),
      note: nul(r["note"]),
    })),
    "naics_code",
  );

  await put(
    "phase_plan",
    parseCsv(read("phase_plan.csv")).map((r) => ({
      acquisition_type: r["acquisition_type"],
      phase: r["phase"],
      planned_days: int(r["planned_days"]),
      order: int(r["order"]),
      note: nul(r["note"]),
    })),
    "acquisition_type,phase",
  );

  await wipe(db, "review_rules", "rule_id");
  await put(
    "review_rules",
    parseCsv(read("review_rules.csv")).map((r) => ({
      reviewer_role: r["reviewer_role"],
      trigger: nul(r["trigger"]),
      citation: nul(r["citation"]),
      planned_days: int(r["planned_days"]),
      note: nul(r["note"]),
    })),
  );

  await put(
    "enterprise_strategies",
    parseCsv(read("enterprise_strategies.csv")).map((r) => ({
      psl: r["psl"],
      name: nul(r["name"]),
      buying_location: nul(r["buying_location"]),
      mandatory_vehicles: nul(r["mandatory_vehicles"]),
      required_coordination: nul(r["required_coordination"]),
      applies: nul(r["applies"]),
    })),
    "psl",
  );

  await wipe(db, "regulatory_refs", "ref_id");
  await put(
    "regulatory_refs",
    parseCsv(read("regulatory_refs.csv")).map((r) => ({
      citation: r["citation"],
      title: nul(r["title"]),
      tier: nul(r["tier"]),
      source: nul(r["source"]),
      effective_date: nul(r["effective_date"]),
      far_part: nul(r["far_part"]),
      nfs_part: nul(r["nfs_part"]),
      url: nul(r["url"]),
      applies_to_phase: nul(r["applies_to_phase"]),
    })),
  );

  await wipe(db, "templates", "template_id");
  await put(
    "templates",
    parseCsv(read("templates.csv")).map((r) => ({
      nf_1098_tab: nul(r["nf_1098_tab"]),
      name: r["name"],
      hq_revision_date: nul(r["hq_effective_date"]),
      status: nul(r["status"]),
      governing_citation: nul(r["governing_citation"]),
      citation_tier: nul(r["citation_tier"]),
    })),
  );

  await wipe(db, "clauses", "row_id");
  await put(
    "clauses",
    parseCsv(read("clauses.csv")).map((r) => ({
      clause_number: r["clause_number"],
      title: nul(r["title"]),
      ucf_section: nul(r["ucf_section"]),
      prescription_citation: nul(r["prescription_citation"]),
      last_updated: nul(r["last_updated"]),
      last_sync: nul(r["last_sync"]),
      source: nul(r["source"]),
      status: nul(r["status"]),
      applies_when: r["applies_when"] ? JSON.parse(r["applies_when"]) : null,
      fill_ins: r["fill_ins"] ? JSON.parse(r["fill_ins"]) : null,
      pcd_reference: nul(r["pcd_reference"]),
      disposition: nul(r["disposition"]),
      rfo_number_or_pcd: nul(r["rfo_number_or_pcd"]),
      post_rfo_date: nul(r["post_rfo_date"]),
    })),
  );

  await wipe(db, "clause_matrix_2603b", "row_id");
  await put(
    "clause_matrix_2603b",
    parseCsv(read("clause_matrix_26-03B.csv")).map((r) => ({
      codified_number: r["codified_number"],
      name: nul(r["name"]),
      effective_date: nul(r["effective_date"]),
      prescribed_in: nul(r["prescribed_in"]),
      p_or_c: nul(r["p_or_c"]),
      rfo_rx: nul(r["rfo_rx"]),
      rfo_number: nul(r["rfo_number"]),
      rfo_title: nul(r["rfo_title"]),
      nasa_date_post_rfo: nul(r["nasa_date_post_rfo"]),
      disposition: nul(r["disposition"]),
      notes: nul(r["notes"]),
    })),
  );

  const applicabilityCols = [
    "Supply FP", "Supply CR", "R&D FP", "R&D CR", "Service FP", "Service CR",
    "Construction FP", "Construction CR", "Time & Material/ Labor Hour",
    "Archetecture & Engineering", "Idefinite Delivery", "Transportation",
    "Simplified Acquisition Procedures", "Commercial Items",
  ];
  await wipe(db, "nfs_clause_matrix", "row_id");
  await put(
    "nfs_clause_matrix",
    parseCsv(read("nfs_clause_matrix_2026-07-23.csv")).map((r) => ({
      clause_number: r["Clause/Provision Number"],
      title: nul(r["Title"]),
      clause_date: nul(r["Date"]),
      prescribed_in: nul(r["Prescribed In"]),
      provision_or_clause: nul(r["Provision or Clause"]),
      ucf: nul(r["UCF"]),
      ibr_or_ft: nul(r["IBR or FT"]),
      fill_in: nul(r["Fill In"]),
      mod_or_sub: nul(r["Mod or Sub"]),
      app_dev: nul(r["App Dev"]),
      applicability: Object.fromEntries(applicabilityCols.map((c) => [c, r[c] ?? ""])),
    })),
  );

  await wipe(db, "nf1707_fields", "field_id");
  await put(
    "nf1707_fields",
    parseCsv(read("nf1707_fields_full.csv")).map((r) => ({
      section: nul(r["section"]),
      subform: nul(r["subform"]),
      field_name: nul(r["field_name"]),
      field_kind: nul(r["field_kind"]),
      caption_full: nul(r["caption_full"]),
      nearest_form_text_full: nul(r["nearest_form_text_full"]),
      choice_items: nul(r["choice_items"]),
      center_specific: nul(r["center_specific"]),
      is_answerable: nul(r["is_answerable"]),
    })),
  );

  await put("announcements", SEED_ANNOUNCEMENTS, "announcement_id");
  await put("template_defects", SEED_TEMPLATE_DEFECTS, "defect_id");

  return counts;
}

/**
 * The three JOFOC citation defects T-Minus already corrected and reported to
 * PGPD. Fixed identifiers so a demo reset restores them rather than duplicating
 * them.
 */
export const SEED_TEMPLATE_DEFECTS = [
  {
    defect_id: "d1000000-0000-4000-8000-000000000001",
    template_key: "jofoc",
    template_name: "Justification for Other Than Full and Open Competition",
    revision: "HQ 04/2026 revision",
    citation: "FAR 6.103",
    defect: "The template cited FAR 6.1030, which does not exist.",
    correction: "Corrected to FAR 6.103.",
    status: "reported to PGPD",
    acquisition_id: null,
    reporter_name: "T-Minus",
    reporter_role: "hq",
    reported_at: "2026-04-15T00:00:00Z",
  },
  {
    defect_id: "d1000000-0000-4000-8000-000000000002",
    template_key: "jofoc",
    template_name: "Justification for Other Than Full and Open Competition",
    revision: "HQ 04/2026 revision",
    citation: "FAR 6.104-1(a)(1) through (a)(11)",
    defect: "The template asked for six areas; the regulation lists eleven items.",
    correction: "Corrected to eleven items at FAR 6.104-1(a)(1) through (a)(11).",
    status: "reported to PGPD",
    acquisition_id: null,
    reporter_name: "T-Minus",
    reporter_role: "hq",
    reported_at: "2026-04-15T00:00:00Z",
  },
  {
    defect_id: "d1000000-0000-4000-8000-000000000003",
    template_key: "jofoc",
    template_name: "Justification for Other Than Full and Open Competition",
    revision: "HQ 04/2026 revision",
    citation: "FAR Subpart 5.1",
    defect: "The template cited Subpart 5.2 and used the word synopsized.",
    correction: "Corrected to Subpart 5.1 and publicized.",
    status: "reported to PGPD",
    acquisition_id: null,
    reporter_name: "T-Minus",
    reporter_role: "hq",
    reported_at: "2026-04-15T00:00:00Z",
  },
];

/**
 * Three seeded HQ notices, mirroring the Procurement Dispatch. Fictional.
 * Fixed identifiers so a demo reset restores them rather than duplicating them.
 */
export const SEED_ANNOUNCEMENTS = [
  {
    announcement_id: "a1000000-0000-4000-8000-000000000001",
    title: "PCD 26-03B issued",
    body:
      "Procurement Class Deviation 26-03B is in effect. The clause matrix in T-Minus reflects the deviation, including removed clauses. Check the clause list on any new handoff packet before you send it to NCMS.",
    severity: "notice",
    audience_roles: null,
    audience_centers: null,
    effective_from: "2026-08-03T00:00:00Z",
    effective_until: null,
    link: null,
    requires_acknowledgment: false,
    posted_by: "R. Calder (fictional)",
    posted_at: "2026-08-03T13:00:00Z",
  },
  {
    announcement_id: "a1000000-0000-4000-8000-000000000002",
    title: "JOFOC template revised, HQ 04/2026",
    body:
      "The JOFOC (NF 1098 tab 015) HQ 04/2026 revision is effective 4/27/2026 and is now the live template in T-Minus. Three citation corrections are recorded on the version badge. Use the revised template for every new justification.",
    severity: "action required",
    audience_roles: ["specialist", "reviewer", "hq"],
    audience_centers: null,
    effective_from: "2026-08-10T00:00:00Z",
    effective_until: null,
    link: null,
    requires_acknowledgment: true,
    posted_by: "R. Calder (fictional)",
    posted_at: "2026-08-10T15:30:00Z",
  },
  {
    announcement_id: "a1000000-0000-4000-8000-000000000003",
    title: "Data call: acquisitions on the mission critical path",
    body:
      "Confirm the mission link and need date on every acquisition you own by close of business Friday. Leadership is reporting schedule impact from these records.",
    severity: "urgent",
    audience_roles: null,
    audience_centers: null,
    effective_from: "2026-09-01T00:00:00Z",
    effective_until: "2027-12-31T23:59:59Z",
    link: null,
    requires_acknowledgment: true,
    posted_by: "R. Calder (fictional)",
    posted_at: "2026-09-01T12:00:00Z",
  },
];

