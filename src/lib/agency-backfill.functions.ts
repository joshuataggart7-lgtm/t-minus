import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/actor";
import type { Json } from "@/integrations/supabase/types";

/**
 * agency_backfill
 *
 * Pulls NASA awards from the SAM.gov Contract Awards API by agency code for a
 * date range, requesting the nasaSpecific section, and writes them into
 * acquisition_facts as post-award records: phase Administration, clock
 * Launched, tagged "backfilled". Records are de-duplicated by contract number,
 * so running the same range twice adds nothing. Backfilled records are left
 * alone by the demo reset.
 */

const inputSchema = z.object({
  agencyCode: z.string().trim().min(2).max(10).default("080"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(50).default(25),
  simulateFailure: z.boolean().optional(),
});

export type BackfillResult = {
  agencyCode: string;
  from: string;
  to: string;
  found: number;
  inserted: number;
  skippedDuplicates: number;
  source: "live" | "sample";
  sourceLabel: string;
  acquisitionIds: string[];
  providerError?: string;
};

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (...values: unknown[]) => {
  const found = values.find((v) => typeof v === "string" && v.trim());
  return typeof found === "string" ? found.trim() : "";
};
const numberOrNull = (value: unknown) => {
  const n = Number(typeof value === "string" ? value.replace(/[$,]/g, "") : value);
  return Number.isFinite(n) ? n : null;
};

type AwardRow = {
  contractNumber: string;
  title: string;
  awardDate: string;
  vendorName: string;
  vendorUei: string;
  vendorCage: string;
  naics: string;
  psc: string;
  obligated: number | null;
  popEnd: string;
  centerCode: string;
  raw: JsonRecord;
};

function rowsFromRaw(raw: unknown, limit: number): AwardRow[] {
  const root = object(raw);
  const rows = array(
    root["contractAwards"] ?? root["awardData"] ?? root["results"] ?? root["data"] ?? root["_embedded"],
  ).map(object);
  return rows
    .slice(0, limit)
    .map((row) => {
      const nasa = object(row["nasaSpecific"]);
      return {
        contractNumber: str(row["contractNumber"], row["awardIdPiid"], row["piid"], row["awardNumber"]),
        title: str(row["descriptionOfRequirement"], row["awardDescription"], row["title"]) || "Backfilled award",
        awardDate: str(row["awardDate"], row["dateSigned"], row["signedDate"]),
        vendorName: str(row["vendorName"], row["recipientName"], row["legalBusinessName"]),
        vendorUei: str(row["ueiSAM"], row["uei"], row["recipientUei"]),
        vendorCage: str(row["cageCode"], row["cage"]),
        naics: str(row["naicsCode"], row["naics"]),
        psc: str(row["productOrServiceCode"], row["pscCode"], row["psc"]),
        obligated: numberOrNull(row["totalObligatedAmount"] ?? row["obligatedAmount"] ?? row["dollarsObligated"]),
        popEnd: str(row["periodOfPerformanceEndDate"], row["ultimateCompletionDate"], row["popEndDate"]),
        centerCode: str(nasa["centerCode"], nasa["installationCode"], row["fundingOfficeCode"]),
        raw: row,
      };
    })
    .filter((r) => r.contractNumber);
}

/** Fictional NASA awards, clearly labeled, used when SAM.gov cannot be reached. */
function sampleAwards(from: string, to: string) {
  const year = from.slice(0, 4);
  return {
    sample: true,
    contractAwards: [
      {
        contractNumber: `80SAMPLE${year}C0001`,
        descriptionOfRequirement: "Sample data, fictional award: cryogenic test stand maintenance",
        awardDate: from,
        vendorName: "Northfield Cryogenics (sample)",
        ueiSAM: "SAMPLE0000A1",
        cageCode: "0SM01",
        naicsCode: "541330",
        productOrServiceCode: "J019",
        totalObligatedAmount: 2_480_000,
        periodOfPerformanceEndDate: `${Number(year) + 2}-09-30`,
        nasaSpecific: { centerCode: "MSFC", sample: true },
      },
      {
        contractNumber: `80SAMPLE${year}C0002`,
        descriptionOfRequirement: "Sample data, fictional award: flight hardware calibration services",
        awardDate: to,
        vendorName: "Meridian Precision Labs (sample)",
        ueiSAM: "SAMPLE0000B2",
        cageCode: "0SM02",
        naicsCode: "541380",
        productOrServiceCode: "H359",
        totalObligatedAmount: 940_000,
        periodOfPerformanceEndDate: `${Number(year) + 1}-06-30`,
        nasaSpecific: { centerCode: "GSFC", sample: true },
      },
    ],
  };
}

/** A stable, readable acquisition id for a backfilled contract number. */
function backfillId(contractNumber: string) {
  return `BF-${contractNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`.slice(0, 40);
}

export const agencyBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<BackfillResult> => {
    const me = await requireRole(context, ["hq"], "The agency backfill is available to HQ only.");
    if (data.from > data.to) throw new Error("The start date must fall on or before the end date.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let raw: unknown;
    let source: BackfillResult["source"] = "live";
    let providerError = "";
    try {
      if (data.simulateFailure) throw new Error("Simulated network failure");
      const apiKey = process.env['SAM_GOV_API_KEY']?.trim();
      console.log(`[SAM.gov backfill] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`);
      if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
      const url = new URL("https://api.sam.gov/prod/federalcontractawards/v1/search");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("agencyCode", data.agencyCode);
      url.searchParams.set("awardDateFrom", data.from);
      url.searchParams.set("awardDateTo", data.to);
      url.searchParams.set("includeSections", "nasaSpecific");
      url.searchParams.set("limit", String(data.limit));
      const redacted = url.toString().replace(encodeURIComponent(apiKey), "REDACTED").replace(apiKey, "REDACTED");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`api.sam.gov responded ${response.status} for GET ${redacted}. Body: ${body || "(empty)"}`);
      }
      raw = await response.json();
      if (!rowsFromRaw(raw, data.limit).length) {
        throw new Error("SAM.gov returned no awards for that agency code and date range.");
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message : "The contract awards backfill failed.";
      console.error(`[SAM.gov backfill] ${providerError}`);
      raw = sampleAwards(data.from, data.to);
      source = "sample";
    }

    const rows = rowsFromRaw(raw, data.limit);
    const checkedAt = new Date().toISOString();

    const existing = await supabaseAdmin
      .from("acquisition_facts")
      .select("contract_number")
      .in("contract_number", rows.map((r) => r.contractNumber));
    if (existing.error) throw new Error(existing.error.message);
    const seen = new Set((existing.data ?? []).map((r) => r.contract_number));

    const inserts = rows
      .filter((r) => !seen.has(r.contractNumber))
      .map((r) => ({
        acquisition_id: backfillId(r.contractNumber),
        contract_number: r.contractNumber,
        source_tag: "backfilled",
        title: r.title,
        center_code: r.centerCode || null,
        estimated_value: r.obligated,
        naics_code: r.naics || null,
        psc_code: r.psc || null,
        vendor_legal_name: r.vendorName || null,
        vendor_uei: r.vendorUei || null,
        vendor_cage: r.vendorCage || null,
        target_award_date: r.awardDate || null,
        period_of_performance_end: r.popEnd || null,
        current_phase: "Administration",
        clock_state: "launched",
        status: "Launched",
        note:
          source === "sample"
            ? "Backfilled from SAM.gov Contract Awards. Sample data, fictional award."
            : "Backfilled from SAM.gov Contract Awards.",
        backfill_source: { agencyCode: data.agencyCode, source, award: r.raw } as Json,
      }));

    if (inserts.length) {
      const { error: insertError } = await supabaseAdmin
        .from("acquisition_facts")
        .insert(inserts as never);
      if (insertError) throw new Error(insertError.message);
    }

    const sourceLabel =
      source === "live"
        ? "Live SAM.gov contract awards"
        : "Sample data, fictional NASA awards";

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert(
      [
        {
          acquisition_id: null,
          actor: me.name,
          action: "Agency backfill run",
          field: "acquisition_facts",
          old_value: null,
          new_value: `${inserts.length} backfilled, ${rows.length - inserts.length} already on file`,
          reason: `Agency ${data.agencyCode}, ${data.from} to ${data.to} · ${sourceLabel}`,
          phase: "Administration",
          logged_at: checkedAt,
        },
      ] as never,
    );
    if (auditError) throw new Error(auditError.message);

    const result: BackfillResult = {
      agencyCode: data.agencyCode,
      from: data.from,
      to: data.to,
      found: rows.length,
      inserted: inserts.length,
      skippedDuplicates: rows.length - inserts.length,
      source,
      sourceLabel,
      acquisitionIds: inserts.map((i) => i.acquisition_id),
    };
    if (providerError) result.providerError = providerError;
    return result;
  });
