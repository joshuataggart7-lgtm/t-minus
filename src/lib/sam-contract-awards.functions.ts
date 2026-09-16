import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/actor";
import type { Json } from "@/integrations/supabase/types";

/**
 * sam_contract_awards
 *
 * Server-side handler for the PNM comparables table. It calls the SAM.gov
 * Contract Awards API with the record's NAICS, PSC, and a dollar range of half
 * to double the estimated value, caches the raw response in sam_checks, and
 * returns a labeled sample when the API cannot be reached.
 */

const inputSchema = z.object({
  acquisitionId: z.string().trim().min(1).max(40),
  simulateFailure: z.boolean().optional(),
});

export type ComparableAward = {
  agency: string;
  awardDate: string;
  pricingType: string;
  extentCompeted: string;
  obligatedAmount: number | null;
};

export type ComparablesView = {
  acquisitionId: string;
  naicsCode: string;
  pscCode: string;
  minValue: number | null;
  maxValue: number | null;
  awards: ComparableAward[];
  source: "live" | "cached" | "local" | "sample";
  sourceLabel: string;
  checkedAt: string;
  providerError?: string;
  /** Short contracting-officer-facing reason the live lookup was not used. */
  providerNote?: string;
};

/** Turns a raw provider failure into one plain sentence for the file. */
function providerNoteFrom(message: string): string {
  const status = message.match(/responded (\d{3})/)?.[1] ?? "";
  const prefix = "Live SAM.gov contract awards were not available";
  if (status === "401")
    return `${prefix}: HTTP 401 — SAM.gov did not accept the API key. Ask the key holder to check it.`;
  if (status === "403")
    return `${prefix}: HTTP 403 — the API key is not entitled to the Contract Awards API. Request that entitlement in SAM.gov.`;
  if (status === "404")
    return `${prefix}: HTTP 404 — SAM.gov did not recognise the Contract Awards address for this key.`;
  if (status === "429") return `${prefix}: HTTP 429 — the SAM.gov rate limit was reached. Try again later.`;
  if (status) return `${prefix}: HTTP ${status} from SAM.gov.`;
  if (/has not been configured/i.test(message))
    return `${prefix}: the SAM.gov API key has not been configured for this environment.`;
  if (/no prior awards/i.test(message))
    return `${prefix}: SAM.gov returned no prior awards for this product and service code and NAICS.`;
  return `${prefix}: ${message}`;
}

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "—";
};
const numberOrNull = (value: unknown) => {
  const n = Number(typeof value === "string" ? value.replace(/[$,]/g, "") : value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Reads the Contract Awards API v1 shape (awardSummary) and, for cached rows
 * written before the endpoint moved, the older flat shape.
 */
function awardsFromRaw(raw: unknown): ComparableAward[] {
  const root = object(raw);
  const rows = array(
    root["awardSummary"] ??
      root["contractAwards"] ??
      root["awardData"] ??
      root["results"] ??
      root["data"] ??
      root["_embedded"],
  ).map(object);
  return rows.slice(0, 10).map((row) => {
    const core = object(row["coreData"]);
    const details = object(row["awardDetails"]);
    const dates = object(details["dates"]);
    const dollars = object(details["dollars"]);
    const totalDollars = object(details["totalContractDollars"]);
    // Documented nesting: coreData.federalOrganization.contractingInformation.*
    const contractingInfo = object(
      object(core["federalOrganization"])["contractingInformation"] ??
        core["contractingInformation"],
    );
    const contracting = object(core["contractingOfficeAddress"] ?? core["contractingOffice"]);
    const department = object(
      contractingInfo["contractingDepartment"] ?? core["department"] ?? contracting["department"],
    );
    const subtier = object(
      contractingInfo["contractingSubTier"] ??
        contractingInfo["contractingSubtier"] ??
        core["subTier"] ??
        core["agency"] ??
        contracting["subTier"],
    );
    const office = object(contractingInfo["contractingOffice"]);
    const acquisitionData = object(core["acquisitionData"]);
    const pricing = object(
      acquisitionData["typeOfContractPricing"] ??
        details["typeOfContractPricing"] ??
        core["typeOfContractPricing"],
    );
    const competition = object(
      core["competitionInformation"] ??
        details["competitionInformation"] ??
        acquisitionData["competitionInformation"] ??
        row["competitionInformation"],
    );
    const extent = object(competition["extentCompeted"]);
    return {
      agency: text(
        department["name"],
        subtier["name"],
        office["name"],
        core["departmentName"],
        core["subTierName"],
        row["awardingAgencyName"],
        row["agency"],
        row["departmentName"],
      ),
      awardDate: text(
        dates["dateSigned"],
        details["dateSigned"],
        core["dateSigned"],
        row["awardDate"],
        row["dateSigned"],
        row["signedDate"],
      ).slice(0, 10),
      pricingType: text(
        pricing["name"],
        pricing["description"],
        details["typeOfContractPricing"],
        row["typeOfContractPricing"],
        row["pricingType"],
        row["contractPricingType"],
      ),
      extentCompeted: text(
        extent["name"],
        extent["description"],
        competition["extentCompeted"],
        competition["extentCompetedDescription"],
        row["extentCompeted"],
        row["extentCompetedDescription"],
      ),
      obligatedAmount: numberOrNull(
        dollars["actionObligation"] ??
          totalDollars["totalActionObligation"] ??
          details["totalActionObligation"] ??
          details["actionObligation"] ??
          core["totalActionObligation"] ??
          core["actionObligation"] ??
          row["totalActionObligation"] ??
          row["actionObligation"] ??
          row["totalObligatedAmount"] ??
          row["obligatedAmount"] ??
          row["dollarsObligated"],
      ),
    };
  });
}

/**
 * Prior T-Minus actions on the same NAICS or PSC, read from the public fields
 * already on those records. Nothing is invented: every row is a file that
 * exists in this system. Used when the external award lookups are down.
 */
function localPriorActions(
  rows: Record<string, unknown>[],
  currentId: string,
): ComparableAward[] {
  return rows
    .filter((r) => String(r["acquisition_id"] ?? "") !== currentId)
    .slice(0, 10)
    .map((r) => ({
      agency: `${String(r["acquisition_id"] ?? "—")} · ${String(r["title"] ?? "Untitled")} (T-Minus prior action)`,
      awardDate: String(r["target_award_date"] ?? r["need_date"] ?? "—"),
      pricingType: String(r["contract_type"] ?? "—"),
      extentCompeted: String(r["competition"] ?? "—"),
      obligatedAmount:
        r["estimated_value"] === null || r["estimated_value"] === undefined
          ? null
          : Number(r["estimated_value"]),
    }));
}

/** Fictional prior awards, clearly labeled, used when SAM.gov is unreachable. */
function sampleAwards(naics: string, psc: string, estimated: number | null) {
  const base = estimated && estimated > 0 ? estimated : 1_000_000;
  return {
    sample: true,
    naicsCode: naics,
    pscCode: psc,
    contractAwards: [
      {
        awardingAgencyName: "National Aeronautics and Space Administration (sample)",
        awardDate: "2026-03-11",
        typeOfContractPricing: "Firm fixed price",
        extentCompeted: "Full and open competition",
        totalObligatedAmount: Math.round(base * 0.82),
      },
      {
        awardingAgencyName: "National Oceanic and Atmospheric Administration (sample)",
        awardDate: "2025-11-04",
        typeOfContractPricing: "Firm fixed price",
        extentCompeted: "Not competed, authority 41 U.S.C. 3304(a)(1)",
        totalObligatedAmount: Math.round(base * 1.18),
      },
      {
        awardingAgencyName: "United States Geological Survey (sample)",
        awardDate: "2025-07-22",
        typeOfContractPricing: "Time and materials",
        extentCompeted: "Full and open competition",
        totalObligatedAmount: Math.round(base * 0.64),
      },
    ],
  };
}

export const samContractAwards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ComparablesView> => {
    const me = await requireRole(context, ["specialist", "reviewer", "hq"], "Comparables are available to contracting, reviewer, and HQ roles.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const record = await supabaseAdmin
      .from("acquisition_facts")
      .select("acquisition_id,naics_code,psc_code,estimated_value,vendor_uei")
      .eq("acquisition_id", data.acquisitionId)
      .maybeSingle();
    if (record.error) throw new Error(record.error.message);
    if (!record.data) throw new Error("The selected acquisition was not found.");

    const naics = record.data.naics_code ?? "";
    const psc = record.data.psc_code ?? "";
    const estimated = record.data.estimated_value === null ? null : Number(record.data.estimated_value);
    const minValue = estimated === null ? null : Math.round(estimated / 2);
    const maxValue = estimated === null ? null : Math.round(estimated * 2);
    const checkedAt = new Date().toISOString();

    let raw: unknown;
    let source: ComparablesView["source"];
    let providerError = "";

    try {
      if (data.simulateFailure) throw new Error("Simulated network failure");
      const apiKey = process.env['SAM_GOV_API_KEY']?.trim();
      console.log(
        `[SAM.gov awards] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`,
      );
      if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
      const url = new URL("https://api.sam.gov/contract-awards/v1/search");
      url.searchParams.set("api_key", apiKey);
      if (naics) url.searchParams.set("naicsCode", naics.slice(0, 6));
      if (psc) url.searchParams.set("productOrServiceCode", psc);
      if (minValue !== null && maxValue !== null)
        url.searchParams.set("totalDollarsObligated", `[${minValue},${maxValue}]`);
      url.searchParams.set("limit", "10");
      url.searchParams.set("offset", "0");
      url.searchParams.set("includeSections", "contractId,coreData,awardDetails,awardeeData");
      const redacted = url.toString().replace(encodeURIComponent(apiKey), "REDACTED").replace(apiKey, "REDACTED");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`api.sam.gov responded ${response.status} for GET ${redacted}. Body: ${body || "(empty)"}`);
      }
      raw = await response.json();
      if (!awardsFromRaw(raw).length) throw new Error("SAM.gov returned no prior awards for this NAICS and PSC.");
      source = "live";
    } catch (error) {
      providerError = error instanceof Error ? error.message : "The contract awards lookup failed.";
      console.error(`[SAM.gov awards] ${providerError}`);
      const cached = await supabaseAdmin
        .from("sam_checks")
        .select("response_json,checked_at")
        .eq("acquisition_id", data.acquisitionId)
        .eq("check_type", "Contract awards comparables")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const envelope = object(cached.data?.response_json);
      const cachedRaw = envelope["raw"];
      if (!cached.error && cachedRaw && awardsFromRaw(cachedRaw).length && envelope["source"] !== "sample") {
        raw = cachedRaw;
        source = "cached";
      } else {
        raw = sampleAwards(naics || "—", psc || "—", estimated);
        source = "sample";
      }
    }

    const view: ComparablesView = {
      acquisitionId: data.acquisitionId,
      naicsCode: naics || "—",
      pscCode: psc || "—",
      minValue,
      maxValue,
      awards: awardsFromRaw(raw),
      source,
      sourceLabel:
        source === "live"
          ? "Live SAM.gov contract awards"
          : source === "cached"
            ? "Cached SAM.gov contract awards"
            : "Sample data, fictional prior awards",
      checkedAt,
    };
    if (providerError) {
      view.providerError = providerError;
      view.providerNote = providerNoteFrom(providerError);
    }

    const { error: saveError } = await supabaseAdmin.from("sam_checks").insert({
      acquisition_id: data.acquisitionId,
      vendor_uei: record.data.vendor_uei,
      check_type: "Contract awards comparables",
      response_json: { raw, normalized: view, source, providerError: providerError || null } as Json,
      checked_by: me.name,
      checked_at: checkedAt,
    });
    if (saveError) throw new Error(saveError.message);

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: data.acquisitionId,
      actor: me.name,
      action: "Contract awards comparables run",
      field: "Price Negotiation Memorandum (PNM)",
      old_value: null,
      new_value: `${view.awards.length} prior awards · ${view.sourceLabel}`,
      reason: providerError || view.sourceLabel,
      phase: "Price Reasonableness",
      logged_at: checkedAt,
    });
    if (auditError) throw new Error(auditError.message);

    return view;
  });
