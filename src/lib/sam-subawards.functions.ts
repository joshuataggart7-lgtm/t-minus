import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, currentActor } from "@/lib/actor";
import type { Json } from "@/integrations/supabase/types";

/**
 * fetch_subawards
 *
 * Market research view. It calls the SAM.gov Acquisition Subaward Reporting
 * Public API for a NAICS code and returns, for recent prime awards, who
 * subcontracts to whom. The raw response is cached in sam_checks and a clearly
 * labeled sample is shown when the API cannot be reached.
 */

const inputSchema = z.object({
  naicsCode: z.string().trim().min(2).max(10),
  simulateFailure: z.boolean().optional(),
});

export type SubawardRow = {
  primeName: string;
  primeAgency: string;
  subName: string;
  subLocation: string;
  amount: number | null;
  actionDate: string;
  description: string;
};

export type SubawardView = {
  naicsCode: string;
  rows: SubawardRow[];
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

function rowsFromRaw(raw: unknown): SubawardRow[] {
  const root = object(raw);
  const rows = array(
    root["subawards"] ?? root["data"] ?? root["results"] ?? root["subawardData"] ?? root["_embedded"],
  ).map(object);
  return rows.slice(0, 25).map((row) => ({
    primeName: text(row["primeAwardeeName"], row["primeEntityName"], row["primeName"], row["awardeeName"]),
    primeAgency: text(row["fundingAgencyName"], row["awardingAgencyName"], row["agency"]),
    subName: text(row["subAwardeeName"], row["subEntityName"], row["subawardeeName"], row["subName"]),
    subLocation: text(row["subAwardeeCity"], row["subEntityCity"], row["subawardeePlace"], row["subLocation"]),
    amount: numberOrNull(row["subAwardAmount"] ?? row["subawardAmount"] ?? row["amount"]),
    actionDate: text(row["subAwardDate"], row["subawardActionDate"], row["actionDate"], row["dateSigned"]),
    description: text(row["subAwardDescription"], row["subawardDescription"], row["descriptionOfWork"]),
  }));
}

/** Fictional subaward relationships, clearly labeled, used when SAM.gov is unreachable. */
function sampleSubawards(naics: string) {
  return {
    sample: true,
    naicsCode: naics,
    subawards: [
      {
        primeAwardeeName: "Meridian Flight Sciences LLC (fictional)",
        fundingAgencyName: "National Aeronautics and Space Administration (sample)",
        subAwardeeName: "Cascade Rotor Maintenance Inc (fictional)",
        subAwardeeCity: "Bakersfield, CA",
        subAwardAmount: 240000,
        subAwardDate: "2026-04-02",
        subAwardDescription: "Airframe inspection and rotor maintenance labor",
      },
      {
        primeAwardeeName: "Meridian Flight Sciences LLC (fictional)",
        fundingAgencyName: "National Aeronautics and Space Administration (sample)",
        subAwardeeName: "Highland Avionics Services LLC (fictional)",
        subAwardeeCity: "Boise, ID",
        subAwardAmount: 118500,
        subAwardDate: "2026-01-19",
        subAwardDescription: "Avionics calibration for survey aircraft",
      },
      {
        primeAwardeeName: "Basin Air Charter Group (fictional)",
        fundingAgencyName: "National Oceanic and Atmospheric Administration (sample)",
        subAwardeeName: "Tule Field Logistics LLC (fictional)",
        subAwardeeCity: "Fresno, CA",
        subAwardAmount: 76000,
        subAwardDate: "2025-11-07",
        subAwardDescription: "Ground handling and fuel coordination",
      },
      {
        primeAwardeeName: "Basin Air Charter Group (fictional)",
        fundingAgencyName: "United States Geological Survey (sample)",
        subAwardeeName: "Redwood Sensor Works (fictional)",
        subAwardeeCity: "Arcata, CA",
        subAwardAmount: 305000,
        subAwardDate: "2025-08-14",
        subAwardDescription: "Sensor pod integration for aerial survey",
      },
    ],
  };
}

export const fetchSubawards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SubawardView> => {
    const me = await currentActor(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const naics = data.naicsCode.trim();
    const checkedAt = new Date().toISOString();

    let raw: unknown;
    let source: SubawardView["source"];
    let providerError = "";

    try {
      if (data.simulateFailure) throw new Error("Simulated network failure");
      const apiKey = process.env['SAM_GOV_API_KEY']?.trim();
      console.log(`[SAM.gov subawards] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`);
      if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
      const url = new URL("https://api.sam.gov/prod/federalcontractawards/subawards/v1/search");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("naicsCode", naics);
      url.searchParams.set("limit", "25");
      const redacted = url.toString().replace(encodeURIComponent(apiKey), "REDACTED").replace(apiKey, "REDACTED");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`api.sam.gov responded ${response.status} for GET ${redacted}. Body: ${body || "(empty)"}`);
      }
      raw = await response.json();
      if (!rowsFromRaw(raw).length) throw new Error(`SAM.gov returned no subawards for NAICS ${naics}.`);
      source = "live";
    } catch (error) {
      providerError = error instanceof Error ? error.message : "The subaward lookup failed.";
      console.error(`[SAM.gov subawards] ${providerError}`);
      const cached = await supabaseAdmin
        .from("sam_checks")
        .select("response_json,checked_at")
        .eq("check_type", `Subaward market research ${naics}`)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const envelope = object(cached.data?.response_json);
      const cachedRaw = envelope["raw"];
      if (!cached.error && cachedRaw && rowsFromRaw(cachedRaw).length && envelope["source"] !== "sample") {
        raw = cachedRaw;
        source = "cached";
      } else {
        raw = sampleSubawards(naics);
        source = "sample";
      }
    }

    const view: SubawardView = {
      naicsCode: naics,
      rows: rowsFromRaw(raw),
      source,
      sourceLabel:
        source === "live"
          ? "Live SAM.gov subaward reporting"
          : source === "cached"
            ? "Cached SAM.gov subaward reporting"
            : "Sample data, fictional subawards",
      checkedAt,
    };
    if (providerError) view.providerError = providerError;

    const { error: saveError } = await supabaseAdmin.from("sam_checks").insert({
      acquisition_id: null,
      vendor_uei: null,
      check_type: `Subaward market research ${naics}`,
      response_json: { raw, normalized: view, source, providerError: providerError || null } as Json,
      checked_by: me.name,
      checked_at: checkedAt,
    });
    if (saveError) throw new Error(saveError.message);

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: null,
      actor: me.name,
      action: "Subaward market research run",
      field: `NAICS ${naics}`,
      old_value: null,
      new_value: `${view.rows.length} subaward records · ${view.sourceLabel}`,
      reason: providerError || view.sourceLabel,
      phase: "Market Research",
      logged_at: checkedAt,
    });
    if (auditError) throw new Error(auditError.message);

    return view;
  });
