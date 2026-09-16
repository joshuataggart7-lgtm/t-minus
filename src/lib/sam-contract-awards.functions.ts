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
  source: "live" | "cached" | "sample";
  sourceLabel: string;
  checkedAt: string;
  providerError?: string;
};

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
    const contracting = object(core["contractingOfficeAddress"] ?? core["contractingOffice"]);
    const department = object(core["department"] ?? contracting["department"]);
    const subtier = object(core["subTier"] ?? core["agency"] ?? contracting["subTier"]);
    const pricing = object(details["typeOfContractPricing"] ?? core["typeOfContractPricing"]);
    const competition = object(
      details["competitionInformation"] ?? core["competitionInformation"] ?? row["competitionInformation"],
    );
    const extent = object(competition["extentCompeted"]);
    return {
      agency: text(
        subtier["name"],
        department["name"],
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
    if (providerError) view.providerError = providerError;

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
