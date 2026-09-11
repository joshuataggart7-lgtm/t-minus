/**
 * T-Minus seed script (B1).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/seed.ts
 *
 * Loads t-minus-seed/ exactly as written. Invents nothing.
 * The service role key is read from the environment only; it never reaches the browser.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run again.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const SEED = join(process.cwd(), "t-minus-seed");
const read = (f: string) => readFileSync(join(SEED, f), "utf8");

/** Minimal RFC 4180 CSV parser (quoted fields, embedded commas and newlines). */
function parseCsv(text: string): Record<string, string>[] {
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

async function load(table: string, rows: unknown[], conflict?: string) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const q = conflict
      ? db.from(table).upsert(chunk as never, { onConflict: conflict })
      : db.from(table).insert(chunk as never);
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}

// ------------------------------------------------------------------ users
const USERS = [
  { role: "executive", name: "A. Whitfield (fictional)", title: "Executive", email: "executive@t-minus.demo", center_code: "HQ" },
  { role: "specialist", name: "J. Rivera (fictional CO)", title: "Contracting specialist / officer", email: "specialist@t-minus.demo", center_code: "ARC" },
  { role: "reviewer", name: "P. Osei (fictional counsel)", title: "Reviewer", email: "reviewer@t-minus.demo", center_code: "GSFC" },
  { role: "requester", name: "Dr. Elena Marsh (fictional)", title: "Requester", email: "requester@t-minus.demo", center_code: "ARC" },
  { role: "hq", name: "R. Calder (fictional)", title: "HQ", email: "hq@t-minus.demo", center_code: "HQ" },
];
const DEMO_PASSWORD = process.env["SEED_USER_PASSWORD"] ?? "t-minus-demo-2027";

async function seedUsers() {
  const rows = [];
  for (const u of USERS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });
    let id = created?.user?.id;
    if (error && !/already/i.test(error.message)) throw error;
    if (!id) {
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      id = list?.users.find((x) => x.email === u.email)?.id;
    }
    if (!id) throw new Error(`could not resolve auth user ${u.email}`);
    rows.push({ user_id: id, ...u });
  }
  await load("users", rows, "user_id");
}

// ------------------------------------------------------------------ tables
async function main() {
  await seedUsers();

  const cb = parseCsv(read("centers_branches.csv"));
  const centers = new Map<string, { center_code: string; center_name: string }>();
  for (const r of cb) centers.set(r["center_code"]!, { center_code: r["center_code"]!, center_name: r["center_name"]! });
  await load("centers", [...centers.values()], "center_code");
  await load(
    "branches",
    cb
      .filter((r) => r["branch_code"])
      .map((r) => ({ center_code: r["center_code"], branch_code: r["branch_code"], branch_name: r["branch_name"] })),
    "center_code,branch_code",
  );

  await load("missions", JSON.parse(read("missions.json")), "mission_id");

  // Sanitize acquisition rows: convert empty strings to null for date/numeric
  // fields so Postgres doesn't reject them.
  const acqRows = (JSON.parse(read("acquisitions.json")) as Record<string, unknown>[]).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v === "" ? null : v;
    }
    return out;
  });
  await load("acquisition_facts", acqRows, "acquisition_id");

  await load(
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

  await load(
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

  await load(
    "review_rules",
    parseCsv(read("review_rules.csv")).map((r) => ({
      reviewer_role: r["reviewer_role"],
      trigger: nul(r["trigger"]),
      citation: nul(r["citation"]),
      planned_days: int(r["planned_days"]),
      note: nul(r["note"]),
    })),
  );

  await load(
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

  await load(
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

  await load(
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

  // Deduplicate clauses by clause_number (CSV has 253 duplicate entries with
  // different dates/sources; keep the first occurrence for the prototype).
  const clauseRows = parseCsv(read("clauses.csv")).map((r) => ({
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
  }));
  const seenClauses = new Set<string>();
  const dedupClauses = clauseRows.filter((r) => {
    if (seenClauses.has(r.clause_number)) return false;
    seenClauses.add(r.clause_number);
    return true;
  });
  await load("clauses", dedupClauses, "clause_number");

  await load(
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

  const nfsRows = parseCsv(read("nfs_clause_matrix_2026-07-23.csv"));
  const applicabilityCols = [
    "Supply FP", "Supply CR", "R&D FP", "R&D CR", "Service FP", "Service CR",
    "Construction FP", "Construction CR", "Time & Material/ Labor Hour",
    "Archetecture & Engineering", "Idefinite Delivery", "Transportation",
    "Simplified Acquisition Procedures", "Commercial Items",
  ];
  await load(
    "nfs_clause_matrix",
    nfsRows.map((r) => ({
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

  await load(
    "nf1707_fields",
    parseCsv(read("nf1707_fields.csv")).map((r) => ({
      section: nul(r["section"]),
      subform: nul(r["subform"]),
      field_name: nul(r["field_name"]),
      field_kind: nul(r["field_kind"]),
      caption: nul(r["caption"]),
      nearest_form_text: nul(r["nearest_form_text"]),
      center_specific: nul(r["center_specific"]),
    })),
  );

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
